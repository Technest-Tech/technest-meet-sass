import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../ui/components/avatars/user_avatar.dart';
import '../ui/components/buttons/app_button.dart';
import '../ui/components/buttons/app_icon_button.dart';
import '../ui/components/containers/app_card.dart';
import '../ui/layout/app_scaffold.dart';
import 'video_conference_screen.dart';

class RoomEntryScreen extends StatefulWidget {
  const RoomEntryScreen({super.key});

  @override
  State<RoomEntryScreen> createState() => _RoomEntryScreenState();
}

class _RoomEntryScreenState extends State<RoomEntryScreen> {

  final _formKey = GlobalKey<FormState>();
  final _roomNameController = TextEditingController();
  final _participantNameController = TextEditingController();
  String _participantType = 'host';
  bool _isLoading = false;
  String? _error;
  bool _isVideoEnabled = false;
  bool _isMicEnabled = true;
  bool _isSpeakerEnabled = true;

  @override
  void dispose() {
    _roomNameController.dispose();
    _participantNameController.dispose();
    super.dispose();
  }

  Future<void> _joinRoom() async {
    print('🚀 RoomEntry: Starting room join process');
    
    if (!_formKey.currentState!.validate()) {
      print('❌ RoomEntry: Form validation failed');
      return;
    }

    print('✅ RoomEntry: Form validation passed');
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final roomName = _roomNameController.text.trim();
      final participantName = _participantNameController.text.trim().isEmpty 
          ? (_participantType == 'host' ? 'Host' : 'Guest')
          : _participantNameController.text.trim();

      print('📝 RoomEntry: Room details - Name: $roomName, Participant: $participantName, Type: $_participantType');

      // Request permissions first
      print('📱 RoomEntry: Requesting permissions...');
      await _requestPermissions();
      print('✅ RoomEntry: Permissions granted');

      // Validate room exists
      print('🔍 RoomEntry: Validating room existence...');
      final validation = await ApiService.validateRoom(roomName, _participantType);
      print('🔍 RoomEntry: Room validation result - Exists: ${validation.exists}');
      
      if (!validation.exists) {
        print('❌ RoomEntry: Room not found');
        setState(() {
          _error = 'Room not found. Please check the room name or create it through the admin dashboard.';
          _isLoading = false;
        });
        return;
      }

      if (validation.room != null && !validation.room!.isActive) {
        print('❌ RoomEntry: Room is inactive');
        setState(() {
          _error = 'This room is currently inactive. Please contact the administrator.';
          _isLoading = false;
        });
        return;
      }

      print('✅ RoomEntry: Room validation passed');

      // Navigate to video conference
      print('🎬 RoomEntry: Navigating to video conference screen');
      if (mounted) {
        final result = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => VideoConferenceScreen(
              roomName: roomName,
              participantName: participantName,
              participantType: _participantType,
            ),
          ),
        );
        print('✅ RoomEntry: Navigation completed, result: $result');
        
        // Reset loading state when returning from video conference
        if (mounted) {
          setState(() {
            _isLoading = false;
            _error = null;
          });
        }
      } else {
        print('⚠️ RoomEntry: Widget not mounted, skipping navigation');
      }

    } catch (e) {
      print('❌ RoomEntry: Error joining room: $e');
      setState(() {
        _error = 'Error joining room: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _requestPermissions() async {
    print('📱 RoomEntry: Starting permission request process');
    
    final permissions = [
      Permission.camera,
      Permission.microphone,
    ];

    for (final permission in permissions) {
      final permissionName = permission.toString().split('.').last;
      print('📱 RoomEntry: Checking permission: $permissionName');
      
      final status = await permission.status;
      print('📱 RoomEntry: Permission $permissionName status: $status');
      
      if (status.isDenied) {
        print('📱 RoomEntry: Permission $permissionName is denied, requesting...');
        final requestResult = await permission.request();
        print('📱 RoomEntry: Permission $permissionName request result: $requestResult');
        
        if (!requestResult.isGranted) {
          print('❌ RoomEntry: Permission $permissionName denied by user');
          throw Exception('Permission denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        print('❌ RoomEntry: Permission $permissionName is permanently denied');
        throw Exception('Permission permanently denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        print('❌ RoomEntry: Permission $permissionName is not granted');
        throw Exception('Permission not granted: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else {
        print('✅ RoomEntry: Permission $permissionName is already granted');
      }
    }
    
    print('✅ RoomEntry: All permissions granted successfully');
  }

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;

    return AppScaffold(
      extendBodyBehindAppBar: true,
      body: Form(
        key: _formKey,
        child: ListView(
          padding: EdgeInsets.symmetric(horizontal: spacing.lg, vertical: spacing.xl),
          children: [
            _buildHeader(context),
            SizedBox(height: spacing.xl),
            _buildPreviewCard(context),
            SizedBox(height: spacing.lg),
            _buildFormCard(context),
            if (_error != null) ...[
              SizedBox(height: spacing.lg),
              _buildErrorBanner(context),
            ],
            SizedBox(height: spacing.xxl),
            AppButton(
              label: _isLoading ? 'Joining...' : 'Join Meeting',
              onPressed: _isLoading ? null : _joinRoom,
              leading: const Icon(Icons.play_arrow_rounded, color: AppColors.textPrimary),
              isLoading: _isLoading,
            ),
            SizedBox(height: spacing.lg),
            TextButton.icon(
              onPressed: () {
                setState(() {
                  _participantType = _participantType == 'host' ? 'guest' : 'host';
                });
              },
              icon: Icon(
                Icons.swap_horiz,
                color: AppColors.textSecondary,
              ),
              label: Text(
                _participantType == 'host' ? 'Switch to Guest Mode' : 'Switch to Host Mode',
              ),
            ),
            SizedBox(height: spacing.xl),
            _buildInfoCallout(context),
            SizedBox(height: spacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome to',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppColors.textMuted),
                ),
                SizedBox(height: spacing.xs),
                Text(
                  'Almajd Meet',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface.withOpacity(0.6),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.outline.withOpacity(0.6)),
              ),
              child: Image.asset(
                'assets/icons/logo.png',
                width: 48,
                height: 48,
              ),
            ),
          ],
        ),
        SizedBox(height: spacing.xs),
        Text(
          'Enter the room details below to get started',
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _buildPreviewCard(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;

    return AppCard(
      backgroundColor: AppColors.surfaceElevated.withOpacity(0.9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 12),
          UserAvatar(
            initials: _participantNameController.text.isEmpty
                ? 'C'
                : _participantNameController.text.characters.take(2).toString(),
            showGlow: _participantType == 'host',
            statusColor: _isMicEnabled ? AppColors.success : AppColors.danger,
          ),
          SizedBox(height: spacing.md),
          Text(
            _participantNameController.text.isEmpty
                ? 'Guest'
                : _participantNameController.text.trim(),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          SizedBox(height: spacing.xs),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              _participantType.toUpperCase(),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.primary,
                    letterSpacing: 1.1,
                  ),
            ),
          ),
          SizedBox(height: spacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              AppIconButton(
                icon: _isVideoEnabled ? Icons.videocam : Icons.videocam_off,
                label: 'Video',
                isToggled: _isVideoEnabled,
                onPressed: () {
                  setState(() {
                    _isVideoEnabled = !_isVideoEnabled;
                  });
                },
              ),
              AppIconButton(
                icon: _isMicEnabled ? Icons.mic : Icons.mic_off,
                label: 'Mic',
                isToggled: _isMicEnabled,
                onPressed: () {
                  setState(() {
                    _isMicEnabled = !_isMicEnabled;
                  });
                },
              ),
              AppIconButton(
                icon: _isSpeakerEnabled ? Icons.volume_up : Icons.volume_off,
                label: 'Speaker',
                isToggled: _isSpeakerEnabled,
                onPressed: () {
                  setState(() {
                    _isSpeakerEnabled = !_isSpeakerEnabled;
                  });
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    return AppCard(
      backgroundColor: AppColors.surface.withOpacity(0.9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Meeting Details',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          SizedBox(height: spacing.sm),
          Text(
            'Only hosts can start or end a meeting. Guests will wait in the lobby until admitted.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textMuted),
          ),
          SizedBox(height: spacing.lg),
          TextFormField(
            controller: _roomNameController,
            decoration: const InputDecoration(
              labelText: 'Room Name',
              hintText: 'e.g. almajd-class-12a',
              prefixIcon: Icon(Icons.meeting_room_rounded),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter a room name';
              }
              return null;
            },
          ),
          SizedBox(height: spacing.md),
          TextFormField(
            controller: _participantNameController,
            decoration: const InputDecoration(
              labelText: 'Your Name',
              hintText: 'Optional',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
          ),
          SizedBox(height: spacing.md),
          Text(
            'Participant Role',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          SizedBox(height: spacing.xs),
          ToggleButtons(
            isSelected: [
              _participantType == 'host',
              _participantType == 'guest',
            ],
            onPressed: (index) {
              setState(() {
                _participantType = index == 0 ? 'host' : 'guest';
              });
            },
            borderRadius: BorderRadius.circular(16),
            fillColor: AppColors.primary.withOpacity(0.2),
            selectedColor: AppColors.primary,
            color: AppColors.textSecondary,
            borderColor: AppColors.outline,
            selectedBorderColor: AppColors.primary,
            children: const [
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                child: Text('Host'),
              ),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                child: Text('Guest'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    return Container(
      padding: EdgeInsets.all(spacing.md),
      decoration: BoxDecoration(
        color: AppColors.danger.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.danger.withOpacity(0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error, color: AppColors.danger),
          SizedBox(width: spacing.sm),
          Expanded(
            child: Text(
              _error!,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCallout(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    return Container(
      padding: EdgeInsets.all(spacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface.withOpacity(0.7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.outline.withOpacity(0.7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.18),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.security, color: AppColors.primary, size: 20),
          ),
          SizedBox(width: spacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Secure rooms with admin control',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                SizedBox(height: spacing.xs),
                Text(
                  'Only administrators can create new rooms. Hosts must be assigned from the dashboard before joining.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
