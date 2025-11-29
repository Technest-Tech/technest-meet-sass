import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../theme/app_colors.dart';
import '../utils/responsive.dart';

/// Optimized video participant widget with caching and performance optimizations
class VideoParticipantWidget extends StatefulWidget {
  final dynamic participant;
  final bool isLocal;
  final bool hasRaisedHand;
  final bool forceCameraOnly; // If true, show only camera feed (ignore screen share)
  final bool forceScreenShareOnly; // If true, show only screen share (ignore camera)

  const VideoParticipantWidget({
    super.key,
    required this.participant,
    this.isLocal = false,
    this.hasRaisedHand = false,
    this.forceCameraOnly = false,
    this.forceScreenShareOnly = false,
  });

  @override
  State<VideoParticipantWidget> createState() => _VideoParticipantWidgetState();
}

class _VideoParticipantWidgetState extends State<VideoParticipantWidget>
    with AutomaticKeepAliveClientMixin {
  // Cache track resolution to avoid redundant computations
  lk.VideoTrack? _cachedVideoTrack;
  bool _cachedHasScreenShare = false;
  bool _cachedHasVideo = false;
  int _lastTrackCount = 0;
  bool _lastCameraEnabled = false;
  
  @override
  bool get wantKeepAlive => true; // Keep video widgets alive to prevent re-rendering

  @override
  void initState() {
    super.initState();
    _updateCachedValues();
    _lastTrackCount = _getTrackCount();
    _lastCameraEnabled = _isCameraEnabled();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin
    
    // Check if track count or camera state changed (both indicate updates needed)
    final currentTrackCount = _getTrackCount();
    final currentCameraEnabled = _isCameraEnabled();
    
    if (currentTrackCount != _lastTrackCount || currentCameraEnabled != _lastCameraEnabled) {
      _updateCachedValues();
      _lastTrackCount = currentTrackCount;
      _lastCameraEnabled = currentCameraEnabled;
    }
    
    return RepaintBoundary(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Container(
          color: AppColors.surfaceMuted,
          child: Stack(
            children: [
              Positioned.fill(child: _buildPrimaryContent()),
              if (widget.hasRaisedHand)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFFFBBF24),
                          Color(0xFFF59E0B),
                        ],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFFBBF24).withOpacity(0.5),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Text(
                      '✋',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              Positioned(
                bottom: 16,
                left: 16,
                right: 16,
                child: _buildParticipantOverlay(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  int _getTrackCount() {
    if (widget.participant is lk.LocalParticipant) {
      return (widget.participant as lk.LocalParticipant).videoTrackPublications.length;
    } else if (widget.participant is lk.RemoteParticipant) {
      return (widget.participant as lk.RemoteParticipant).videoTrackPublications.length;
    }
    return 0;
  }
  
  void _updateCachedValues() {
    _cachedVideoTrack = _resolveVideoTrack();
    _cachedHasScreenShare = _hasScreenShare();
    _cachedHasVideo = _cachedVideoTrack != null && 
                      (_cachedHasScreenShare || _isCameraEnabled());
  }

  Widget _buildPrimaryContent() {
    // Use cached values to avoid redundant computations
    if (_cachedHasVideo && _cachedVideoTrack != null) {
      return DecoratedBox(
        decoration: const BoxDecoration(color: Colors.black),
        child: lk.VideoTrackRenderer(_cachedVideoTrack!),
      );
    }

    return Center(
      child: Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const RadialGradient(
            colors: [
              Color(0xFF3A2E2A),
              Color(0xFF1D1612),
            ],
            radius: 0.9,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.35),
              blurRadius: 24,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Center(
          child: Text(
            _getParticipantInitial(),
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 64,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
        ),
      ),
    );
  }

  lk.VideoTrack? _resolveVideoTrack() {
    lk.VideoTrack? screenShareTrack;
    lk.VideoTrack? cameraTrack;
    
    if (widget.participant is lk.LocalParticipant) {
      final localParticipant = widget.participant as lk.LocalParticipant;
      for (final publication in localParticipant.videoTrackPublications) {
        final track = publication.track;
        // Only consider tracks that are not muted (camera off = muted)
        if (track != null && track is lk.VideoTrack && !publication.muted) {
          final name = publication.name?.toLowerCase() ?? '';
          final sid = publication.sid ?? '';
          final isScreenShare = name.contains('screen') || 
                                name.contains('screenshare') ||
                                name.contains('screen-share') ||
                                sid.contains('screen');
          if (isScreenShare) {
            screenShareTrack = track;
          } else {
            cameraTrack = track;
          }
        }
      }
    } else if (widget.participant is lk.RemoteParticipant) {
      final remoteParticipant = widget.participant as lk.RemoteParticipant;
      final videoTracks = remoteParticipant.videoTrackPublications;
      final videoTrackCount = videoTracks.length;
      
      for (final publication in videoTracks) {
        final track = publication.track;
        final isSubscribed = publication.subscribed;
        // Only consider tracks that are subscribed, not muted, and have a track
        if (track != null && isSubscribed && track is lk.VideoTrack && !publication.muted) {
          final name = publication.name?.toLowerCase() ?? '';
          final sid = publication.sid ?? '';
          
          // Check explicit indicators first
          bool isScreenShare = name.contains('screen') || 
                              name.contains('screenshare') ||
                              name.contains('screen-share') ||
                              sid.contains('screen');
          
          // If no explicit indicator, use heuristic for empty names
          if (!isScreenShare && name.isEmpty && isSubscribed) {
            final isCameraEnabled = remoteParticipant.isCameraEnabled();
            // For multiple tracks: empty name is likely screen share
            // For single track: only if camera is disabled
            if (videoTrackCount > 1) {
              isScreenShare = true;
            } else if (!isCameraEnabled) {
              isScreenShare = true;
            }
          }
          
          if (isScreenShare) {
            screenShareTrack = track;
          } else {
            cameraTrack = track;
          }
        }
      }
    }
    
    // If forceScreenShareOnly is true, return only screen share track
    if (widget.forceScreenShareOnly) {
      return screenShareTrack;
    }
    
    // If forceCameraOnly is true, return only camera track
    if (widget.forceCameraOnly) {
      return cameraTrack;
    }
    
    // Prioritize screen share over camera
    return screenShareTrack ?? cameraTrack;
  }
  
  bool _hasScreenShare() {
    if (widget.participant is lk.LocalParticipant) {
      final localParticipant = widget.participant as lk.LocalParticipant;
      for (final publication in localParticipant.videoTrackPublications) {
        final name = publication.name?.toLowerCase() ?? '';
        final sid = publication.sid ?? '';
        final isScreenShare = name.contains('screen') || 
                              name.contains('screenshare') ||
                              name.contains('screen-share') ||
                              sid.contains('screen');
        if (isScreenShare && publication.track != null) {
          return true;
        }
      }
    } else if (widget.participant is lk.RemoteParticipant) {
      final remoteParticipant = widget.participant as lk.RemoteParticipant;
      final videoTracks = remoteParticipant.videoTrackPublications;
      final videoTrackCount = videoTracks.length;
      
      for (final publication in videoTracks) {
        final name = publication.name?.toLowerCase() ?? '';
        final sid = publication.sid ?? '';
        final isSubscribed = publication.subscribed;
        final track = publication.track;
        
        // Check explicit indicators first
        bool isScreenShare = name.contains('screen') || 
                            name.contains('screenshare') ||
                            name.contains('screen-share') ||
                            sid.contains('screen');
        
        // If no explicit indicator, use heuristic for empty names
        if (!isScreenShare && name.isEmpty && isSubscribed && track != null) {
          final isCameraEnabled = remoteParticipant.isCameraEnabled();
          // For multiple tracks: empty name is likely screen share
          // For single track: only if camera is disabled
          if (videoTrackCount > 1) {
            isScreenShare = true;
          } else if (!isCameraEnabled) {
            isScreenShare = true;
          }
        }
        
        if (isScreenShare && isSubscribed && track != null) {
          return true;
        }
      }
    }
    return false;
  }

  bool _isCameraEnabled() {
    if (widget.participant is lk.LocalParticipant) {
      return (widget.participant as lk.LocalParticipant).isCameraEnabled();
    } else if (widget.participant is lk.RemoteParticipant) {
      return (widget.participant as lk.RemoteParticipant).isCameraEnabled();
    }
    return false;
  }

  bool _isMicrophoneEnabled() {
    if (widget.participant is lk.LocalParticipant) {
      return (widget.participant as lk.LocalParticipant).isMicrophoneEnabled();
    } else if (widget.participant is lk.RemoteParticipant) {
      return (widget.participant as lk.RemoteParticipant).isMicrophoneEnabled();
    }
    return false;
  }

  String _getParticipantName() {
    if (widget.participant is lk.LocalParticipant) {
      return (widget.participant as lk.LocalParticipant).name ?? 'You';
    } else if (widget.participant is lk.RemoteParticipant) {
      return (widget.participant as lk.RemoteParticipant).name ?? 'Participant';
    }
    return 'Unknown';
  }

  String _getParticipantInitial() {
    final name = _getParticipantName().trim();
    if (name.isEmpty) return 'U';
    return name.substring(0, 1).toUpperCase();
  }

  Widget _buildParticipantOverlay(BuildContext context) {
    final micEnabled = _isMicrophoneEnabled();
    final theme = Theme.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        // Adjust padding and spacing based on available width and device type
        final availableWidth = constraints.maxWidth;
        final isPhone = Responsive.isPhone(context);
        final isTablet = Responsive.isTablet(context);
        final isExtremelyNarrow = availableWidth < 70;
        final isVeryNarrow = availableWidth < 100;
        
        // Responsive sizing based on device type
        final horizontalPadding = Responsive.value(
          context,
          phone: isExtremelyNarrow ? 4.0 : (isVeryNarrow ? 8.0 : 12.0),
          tablet: isExtremelyNarrow ? 6.0 : (isVeryNarrow ? 10.0 : 16.0),
        );
        final iconSize = Responsive.value(
          context,
          phone: isExtremelyNarrow ? 14.0 : (isVeryNarrow ? 16.0 : 18.0),
          tablet: isExtremelyNarrow ? 16.0 : (isVeryNarrow ? 18.0 : 20.0),
        );
        final spacing = Responsive.value(
          context,
          phone: isExtremelyNarrow ? 2.0 : (isVeryNarrow ? 4.0 : 8.0),
          tablet: isExtremelyNarrow ? 4.0 : (isVeryNarrow ? 6.0 : 10.0),
        );
        final fontSize = Responsive.value(
          context,
          phone: isVeryNarrow ? 12.0 : 14.0,
          tablet: isVeryNarrow ? 13.0 : 15.0,
        );
        final showLocalBadge = widget.isLocal && !isExtremelyNarrow;
        final showName = !isExtremelyNarrow;
        
        return Container(
          padding: EdgeInsets.symmetric(
            horizontal: horizontalPadding,
            vertical: Responsive.value(context, phone: 8.0, tablet: 10.0),
          ),
          decoration: BoxDecoration(
            color: AppColors.overlayDark,
            borderRadius: BorderRadius.circular(
              Responsive.value(context, phone: 16.0, tablet: 18.0),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Icon(
                micEnabled ? Icons.mic : Icons.mic_off,
                size: iconSize,
                color: micEnabled ? AppColors.success : AppColors.danger,
              ),
              if (showName) ...[
                SizedBox(width: spacing),
                Flexible(
                  child: Text(
                    _getParticipantName(),
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: fontSize,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    softWrap: false,
                  ),
                ),
              ],
              if (showLocalBadge) ...[
                SizedBox(width: spacing),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: Responsive.value(context, phone: 4.0, tablet: 6.0),
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'You',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: Responsive.value(context, phone: 10.0, tablet: 11.0),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
