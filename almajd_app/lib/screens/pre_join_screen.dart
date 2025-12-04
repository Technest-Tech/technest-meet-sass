import 'dart:async';
import '../utils/logger.dart';

import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/logger.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../models/room.dart';
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import 'video_conference_screen.dart';
import '../utils/logger.dart';
import '../store/media_quality_store.dart';
import '../widgets/video_quality_selector.dart';

class PreJoinScreen extends StatefulWidget {
  const PreJoinScreen({
    super.key,
    required this.roomName,
    required this.participantName,
    required this.participantType,
    this.roomFeatures,
    this.passwordRequired,
    this.passwordFor,
    this.roomLink,
    this.joinedFromDeepLink = false, // Default to false for manual joins
  });

  final String roomName;
  final String participantName;
  final String participantType;
  final RoomFeatures? roomFeatures;
  final bool? passwordRequired;
  final String? passwordFor;
  final String? roomLink;
  final bool joinedFromDeepLink; // Track if joined from deep link

  @override
  State<PreJoinScreen> createState() => _PreJoinScreenState();
}

class _PreJoinScreenState extends State<PreJoinScreen> {
  lk.LocalVideoTrack? _previewTrack;
  bool _cameraEnabled = true;
  bool _microphoneEnabled = true;
  bool _speakerEnabled = true;
  bool _isPreviewLoading = true;
  bool _isJoining = false;
  String? _error;
  bool _animateIn = false;
  final TextEditingController _passwordController = TextEditingController();
  String? _passwordError;
  
  // Check if password is required for this participant type
  bool get _requiresPassword {
    Logger.debug(' PreJoin: Checking password requirement - passwordRequired: ${widget.passwordRequired}, passwordFor: ${widget.passwordFor}, participantType: ${widget.participantType}', 'pre_join_screen');
    if (widget.passwordRequired != true) {
      Logger.debug(' PreJoin: Password not required (passwordRequired is not true)', 'pre_join_screen');
      return false;
    }
    final requires = widget.passwordFor == 'HOST_AND_GUEST' ||
           (widget.passwordFor == 'HOST_ONLY' && widget.participantType == 'host');
    Logger.debug(' PreJoin: Password requirement result: $requires', 'pre_join_screen');
    return requires;
  }

  static const Duration _panelAnimationDuration = Duration(milliseconds: 280);

  @override
  void initState() {
    super.initState();
    // For observers, disable camera and mic, skip preview
    if (widget.participantType.toLowerCase() == 'observer') {
      _cameraEnabled = false;
      _microphoneEnabled = false;
    } else {
      _startPreview();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _animateIn = true;
      });
    });
  }

  Future<void> _startPreview() async {
    if (!_cameraEnabled) {
      return;
    }

    setState(() {
      _isPreviewLoading = true;
      _error = null;
    });

    try {
      final track = await lk.LocalVideoTrack.createCameraTrack(
        const lk.CameraCaptureOptions(
          cameraPosition: lk.CameraPosition.front,
        ),
      );

      if (!mounted) {
        await track.stop();
        await track.dispose();
        return;
      }

      setState(() {
        _previewTrack = track;
      });
    } catch (e) {
      setState(() {
        _error = 'Unable to start camera preview: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isPreviewLoading = false;
        });
      }
    }
  }

  Future<void> _disposePreview() async {
    try {
      await _previewTrack?.stop();
    } catch (_) {}
    await _previewTrack?.dispose();
    _previewTrack = null;
  }

  @override
  void dispose() {
    _disposePreview();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Map participant type to display label
    String roleLabel;
    if (widget.participantType.isEmpty) {
      roleLabel = 'Participant';
    } else {
      final type = widget.participantType.toLowerCase();
      if (type == 'host') {
        roleLabel = 'Teacher';
      } else if (type == 'observer') {
        roleLabel = 'Observer';
      } else {
        roleLabel = 'Student';
      }
    }
    final displayName =
        widget.participantName.isEmpty ? roleLabel : widget.participantName;

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leadingWidth: 100,
        leading: TextButton.icon(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
          label: Text(
            'Back',
            style: GoogleFonts.poppins(
              color: Colors.white,
              fontWeight: FontWeight.w500,
            ),
          ),
          style: TextButton.styleFrom(
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            textStyle: GoogleFonts.poppins(
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF111527), Color(0xFF07090F)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final previewHeight =
                  (constraints.maxHeight * 0.4).clamp(220.0, 360.0).toDouble();
              final controlSize = constraints.maxWidth < 360 ? 72.0 : 88.0;
              final verticalGap =
                  (constraints.maxHeight * 0.03).clamp(18.0, 36.0).toDouble();

              return AnimatedOpacity(
                opacity: _animateIn ? 1 : 0,
                duration: const Duration(milliseconds: 600),
                curve: Curves.easeOut,
                child: AnimatedSlide(
                  offset: _animateIn ? Offset.zero : const Offset(0, 0.06),
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.easeOut,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24)
                        .copyWith(bottom: 24),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: constraints.maxHeight,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildHeader(roleLabel),
                          SizedBox(height: verticalGap),
                          SizedBox(
                            height: previewHeight,
                            width: double.infinity,
                            child: _buildPreviewCard(displayName),
                          ),
                          SizedBox(height: verticalGap),
                          if (_requiresPassword) ...[
                            _buildPasswordField(),
                            SizedBox(height: verticalGap),
                          ],
                          _buildControlPanel(controlSize),
                          if (_error != null) ...[
                            const SizedBox(height: 20),
                            _buildErrorBanner(),
                          ],
                          SizedBox(height: verticalGap),
                          _buildQualitySettings(),
                          SizedBox(height: verticalGap * 2),
                          _buildJoinButton(),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(String roleLabel) {
    final isObserver = widget.participantType.toLowerCase() == 'observer';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (isObserver) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFFFF6B6B),
                  Color(0xFFFF5252),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFF5252).withOpacity(0.4),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.visibility,
                  size: 18,
                  color: Colors.white,
                ),
                const SizedBox(width: 8),
                Text(
                  'Observer Mode',
                  style: GoogleFonts.poppins(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        Text(
          roleLabel,
          style: GoogleFonts.poppins(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Room: ${widget.roomName}',
          style: GoogleFonts.poppins(
            color: Colors.white.withOpacity(0.65),
            fontSize: 15,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
          textAlign: TextAlign.center,
        ),
        if (widget.participantName.isNotEmpty &&
            widget.participantName.toLowerCase() != roleLabel.toLowerCase()) ...[
          const SizedBox(height: 4),
          Text(
            widget.participantName,
            style: GoogleFonts.poppins(
              color: Colors.white.withOpacity(0.6),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }

  Widget _buildPreviewCard(String displayName) {
    final borderRadius = BorderRadius.circular(36);

    return AnimatedContainer(
      duration: _panelAnimationDuration,
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF20283C),
            Color(0xFF111623),
          ],
        ),
        borderRadius: borderRadius,
        border: Border.all(color: Colors.white.withOpacity(0.08), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.45),
            blurRadius: 42,
            offset: const Offset(0, 28),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: Stack(
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 400),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: _cameraEnabled && _previewTrack != null
                  ? _buildVideoPreview()
                  : _buildAvatarPlaceholder(displayName),
            ),
            if (_isPreviewLoading)
              const Positioned.fill(
                child: ColoredBox(
                  color: Colors.black26,
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoPreview() {
    return SizedBox.expand(
      key: const ValueKey('video-preview'),
      child: lk.VideoTrackRenderer(
        _previewTrack!,
        mirrorMode: lk.VideoViewMirrorMode.auto,
        fit: lk.VideoViewFit.cover,
      ),
    );
  }

  Widget _buildAvatarPlaceholder(String displayName) {
    final initials = _initialLetter(displayName);

    return Container(
      key: const ValueKey('avatar-preview'),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF1A2031),
            Color(0xFF0C111C),
          ],
        ),
      ),
      child: Center(
        child: Container(
          width: 120,
          height: 120,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [
                Color(0xFF2B334A),
                Color(0xFF151A26),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(color: Colors.white.withOpacity(0.18), width: 1.6),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF4361EE).withOpacity(0.28),
                blurRadius: 32,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            initials,
            style: GoogleFonts.poppins(
              color: Colors.white,
              fontSize: 50,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
          ),
        ),
      ),
    );
  }

  String _initialLetter(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return 'A';
    }
    return String.fromCharCode(trimmed.runes.first).toUpperCase();
  }

  Widget _buildPasswordField() {
    return AnimatedContainer(
      duration: _panelAnimationDuration,
      curve: Curves.easeOut,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF20283C),
            Color(0xFF111623),
          ],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: _passwordError != null
              ? AppColors.danger.withOpacity(0.6)
              : Colors.white.withOpacity(0.08),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Room Password',
            style: GoogleFonts.poppins(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            obscureText: true,
            style: GoogleFonts.poppins(
              color: Colors.white,
              fontSize: 15,
            ),
            decoration: InputDecoration(
              hintText: 'Enter room password',
              hintStyle: GoogleFonts.poppins(
                color: Colors.white.withOpacity(0.4),
              ),
              filled: true,
              fillColor: Colors.white.withOpacity(0.08),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: _passwordError != null
                      ? AppColors.danger.withOpacity(0.6)
                      : Colors.white.withOpacity(0.1),
                  width: 1.5,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: _passwordError != null
                      ? AppColors.danger
                      : AppColors.primary,
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: AppColors.danger,
                  width: 1.5,
                ),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 18,
                vertical: 16,
              ),
            ),
            onChanged: (_) {
              if (_passwordError != null) {
                setState(() {
                  _passwordError = null;
                });
              }
            },
          ),
          if (_passwordError != null) ...[
            const SizedBox(height: 8),
            Text(
              _passwordError!,
              style: GoogleFonts.poppins(
                color: AppColors.danger,
                fontSize: 13,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildControlPanel(double controlSize) {
    final isObserver = widget.participantType.toLowerCase() == 'observer';
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _DeviceToggleButton(
          iconOn: Icons.videocam_rounded,
          iconOff: Icons.videocam_off_rounded,
          label: 'Video',
          isOn: _cameraEnabled,
          size: controlSize,
          isDisabled: isObserver,
          onTap: isObserver ? null : () async {
            if (_cameraEnabled) {
              setState(() {
                _cameraEnabled = false;
                _isPreviewLoading = false;
              });
              await _disposePreview();
            } else {
              setState(() {
                _cameraEnabled = true;
              });
              await _startPreview();
            }
          },
        ),
        _DeviceToggleButton(
          iconOn: Icons.mic_rounded,
          iconOff: Icons.mic_off_rounded,
          label: 'Mic',
          isOn: _microphoneEnabled,
          size: controlSize,
          isDisabled: isObserver,
          onTap: isObserver ? null : () async {
            setState(() {
              _microphoneEnabled = !_microphoneEnabled;
            });
          },
        ),
        _DeviceToggleButton(
          iconOn: Icons.volume_up_rounded,
          iconOff: Icons.volume_off_rounded,
          label: 'Speaker',
          isOn: _speakerEnabled,
          size: controlSize,
          onTap: () async {
            setState(() {
              _speakerEnabled = !_speakerEnabled;
            });
          },
        ),
      ],
    );
  }

  Widget _buildErrorBanner() {
    return AnimatedContainer(
      duration: _panelAnimationDuration,
      curve: Curves.easeOut,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.danger.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.danger.withOpacity(0.4)),
        boxShadow: [
          BoxShadow(
            color: AppColors.danger.withOpacity(0.25),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _error ?? '',
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJoinButton() {
    return AnimatedScale(
      duration: _panelAnimationDuration,
      scale: _isJoining ? 0.98 : 1.0,
      curve: Curves.easeOut,
      child: Material(
        color: Colors.transparent,
            child: InkWell(
          onTap: (_isJoining || (_requiresPassword && _passwordController.text.trim().isEmpty)) ? null : _handleJoinMeeting,
          borderRadius: BorderRadius.circular(32),
          child: Ink(
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFFFF4D5A),
                  Color(0xFFFF1F75),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(32),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFF1F75).withOpacity(0.35),
                  blurRadius: 36,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: Center(
              child: _isJoining
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Text(
                          'Connecting...',
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.login_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Join Meeting',
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQualitySettings() {
    return Consumer<MediaQualityStore>(
      builder: (context, qualityStore, child) {
        if (!qualityStore.isInitialized) {
          return const SizedBox.shrink();
        }

        return AnimatedContainer(
          duration: _panelAnimationDuration,
          curve: Curves.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withOpacity(0.08),
                Colors.white.withOpacity(0.04),
              ],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: Colors.white.withOpacity(0.1),
              width: 1,
            ),
          ),
          child: Theme(
            data: Theme.of(context).copyWith(
              dividerColor: Colors.transparent,
              expansionTileTheme: ExpansionTileThemeData(
                backgroundColor: Colors.transparent,
                collapsedBackgroundColor: Colors.transparent,
                iconColor: Colors.white,
                collapsedIconColor: Colors.white.withOpacity(0.7),
                textColor: Colors.white,
                collapsedTextColor: Colors.white.withOpacity(0.7),
              ),
            ),
            child: ExpansionTile(
              title: Row(
                children: [
                  Icon(
                    Icons.high_quality,
                    size: 20,
                    color: Colors.white.withOpacity(0.9),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Video Quality',
                    style: GoogleFonts.poppins(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: VideoQualitySelector(
                    onQualityChanged: (quality) {
                      // Quality will be applied automatically by adaptive stream manager
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleJoinMeeting() async {
    // If password is required, verify it first
    if (_requiresPassword) {
      if (_passwordController.text.trim().isEmpty) {
        setState(() {
          _passwordError = 'Password is required';
        });
        return;
      }

      setState(() {
        _isJoining = true;
        _error = null;
        _passwordError = null;
      });

      try {
        final isValid = await ApiService.verifyRoomPassword(
          roomLink: widget.roomLink ?? widget.roomName,
          accessType: widget.participantType,
          password: _passwordController.text.trim(),
        );

        if (!isValid) {
          setState(() {
            _passwordError = 'Invalid password';
            _isJoining = false;
          });
          return;
        }
      } catch (e) {
        setState(() {
          _passwordError = 'Failed to verify password. Please try again.';
          _isJoining = false;
        });
        return;
      }
    } else {
      setState(() {
        _isJoining = true;
        _error = null;
      });
    }

    await _disposePreview();

    try {
      final result = await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => VideoConferenceScreen(
            roomName: widget.roomName,
            participantName: widget.participantName,
            participantType: widget.participantType,
            initialCameraEnabled: _cameraEnabled,
            initialMicEnabled: _microphoneEnabled,
            initialSpeakerEnabled: _speakerEnabled,
            roomFeatures: widget.roomFeatures,
            joinedFromDeepLink: widget.joinedFromDeepLink,
          ),
        ),
      );

      if (!mounted) return;

      Navigator.of(context).pop(result);
    } catch (e) {
      setState(() {
        _error = 'Unable to join meeting: $e';
        _isJoining = false;
      });
    }
  }
}

class _DeviceToggleButton extends StatelessWidget {
  const _DeviceToggleButton({
    required this.iconOn,
    required this.iconOff,
    required this.label,
    required this.isOn,
    required this.size,
    required this.onTap,
    this.isDisabled = false,
  });

  final IconData iconOn;
  final IconData iconOff;
  final String label;
  final bool isOn;
  final double size;
  final Future<void> Function()? onTap;
  final bool isDisabled;

  static const Duration _animationDuration = Duration(milliseconds: 220);
  static const LinearGradient _activeGradient = LinearGradient(
    colors: [Color(0xFF2BE4AC), Color(0xFF13B88A)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient _inactiveGradient = LinearGradient(
    colors: [Color(0xFF1A1F2E), Color(0xFF121622)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  @override
  Widget build(BuildContext context) {
    final iconSize = size * 0.38;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedScale(
          scale: isOn ? 1.0 : 0.95,
          duration: _animationDuration,
          curve: Curves.easeOut,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: (onTap == null || isDisabled) ? null : () {
                onTap?.call();
              },
              customBorder: const CircleBorder(),
              child: AnimatedContainer(
                duration: _animationDuration,
                curve: Curves.easeOut,
                height: size,
                width: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: isDisabled
                      ? _inactiveGradient
                      : (isOn ? _activeGradient : _inactiveGradient),
                  border: Border.all(
                    color: isDisabled
                        ? Colors.white.withOpacity(0.05)
                        : (isOn
                            ? Colors.white.withOpacity(0.28)
                            : Colors.white.withOpacity(0.08)),
                  ),
                  boxShadow: [
                    if (isOn && !isDisabled)
                      BoxShadow(
                        color: const Color(0xFF2BE4AC).withOpacity(0.35),
                        blurRadius: 28,
                        offset: const Offset(0, 14),
                      )
                    else
                      BoxShadow(
                        color: Colors.black.withOpacity(0.22),
                        blurRadius: 20,
                        offset: const Offset(0, 12),
                      ),
                  ],
                ),
                child: Center(
                  child: AnimatedSwitcher(
                    duration: _animationDuration,
                    child: Icon(
                      isOn ? iconOn : iconOff,
                      key: ValueKey<bool>(isOn),
                      color: isDisabled
                          ? Colors.white.withOpacity(0.3)
                          : Colors.white,
                      size: iconSize,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          label,
          style: GoogleFonts.poppins(
            color: isDisabled
                ? Colors.white.withOpacity(0.4)
                : Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        AnimatedDefaultTextStyle(
          duration: _animationDuration,
          curve: Curves.easeOut,
          style: GoogleFonts.poppins(
            color: isDisabled
                ? Colors.white.withOpacity(0.3)
                : (isOn
                    ? const Color(0xFF5CFFB0)
                    : Colors.white.withOpacity(0.55)),
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
          child: Text(isDisabled ? 'Disabled' : (isOn ? 'On' : 'Off')),
        ),
      ],
    );
  }
}

