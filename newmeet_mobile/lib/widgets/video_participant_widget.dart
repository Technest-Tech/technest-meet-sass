import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' as lk;

class VideoParticipantWidget extends StatelessWidget {
  final dynamic participant;
  final bool isLocal;

  const VideoParticipantWidget({
    super.key,
    required this.participant,
    this.isLocal = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade900,
        borderRadius: BorderRadius.circular(8),
        border: isLocal ? Border.all(color: Colors.blue, width: 2) : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            // Video Track
            _buildVideoTrack(),
            
            // Participant Info Overlay
            Positioned(
              bottom: 8,
              left: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  children: [
                    // Microphone Status
                    Icon(
                      _isMicrophoneEnabled() ? Icons.mic : Icons.mic_off,
                      color: _isMicrophoneEnabled() ? Colors.green : Colors.red,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    
                    // Participant Name
                    Expanded(
                      child: Text(
                        _getParticipantName(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    
                    // Screen Share Indicator
                    if (_isScreenSharing())
                      const Icon(
                        Icons.screen_share,
                        color: Colors.blue,
                        size: 16,
                      ),
                  ],
                ),
              ),
            ),
            
            // Local Participant Indicator
            if (isLocal)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.blue,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'You',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoTrack() {
    // Try to get video track from participant
    lk.VideoTrack? videoTrack;
    lk.VideoTrack? screenShareTrack;
    lk.VideoTrack? cameraTrack;
    
    if (participant is lk.LocalParticipant) {
      final localParticipant = participant as lk.LocalParticipant;
      // Separate screen share and camera tracks
      for (final publication in localParticipant.videoTrackPublications) {
        if (publication.track != null) {
          final track = publication.track as lk.VideoTrack;
          // Check if it's a screen share track
          if (publication.source == lk.TrackSource.screenShareVideo) {
            screenShareTrack = track;
          } else {
            cameraTrack = track;
          }
        }
      }
    } else if (participant is lk.RemoteParticipant) {
      final remoteParticipant = participant as lk.RemoteParticipant;
      // Separate screen share and camera tracks
      for (final publication in remoteParticipant.videoTrackPublications) {
        if (publication.track != null) {
          final track = publication.track as lk.VideoTrack;
          // Check if it's a screen share track
          if (publication.source == lk.TrackSource.screenShareVideo) {
            screenShareTrack = track;
          } else {
            cameraTrack = track;
          }
        }
      }
    }
    
    // Prioritize screen share over camera
    videoTrack = screenShareTrack ?? cameraTrack;

    // If we have a video track, render it
    // Show video if: screen share is active OR camera is enabled
    if (videoTrack != null && (screenShareTrack != null || _isCameraEnabled())) {
      return lk.VideoTrackRenderer(videoTrack);
    }

    // Fallback to placeholder when no video track or camera is off
    return Container(
      color: Colors.grey.shade800,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Camera status indicator
            Icon(
              _isCameraEnabled() ? Icons.videocam : Icons.videocam_off,
              size: 48,
              color: _isCameraEnabled() ? Colors.green : Colors.grey.shade400,
            ),
            const SizedBox(height: 8),
            
            // Microphone status indicator
            Icon(
              _isMicrophoneEnabled() ? Icons.mic : Icons.mic_off,
              size: 32,
              color: _isMicrophoneEnabled() ? Colors.green : Colors.red,
            ),
            const SizedBox(height: 8),
            
            // Participant name
            Text(
              _getParticipantName(),
              style: TextStyle(
                color: Colors.grey.shade400,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            
            // Camera status text
            if (!_isCameraEnabled())
              Text(
                'Camera Off',
                style: TextStyle(
                  color: Colors.grey.shade500,
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _isCameraEnabled() {
    if (participant is lk.LocalParticipant) {
      return (participant as lk.LocalParticipant).isCameraEnabled();
    } else if (participant is lk.RemoteParticipant) {
      return (participant as lk.RemoteParticipant).isCameraEnabled();
    }
    return false;
  }

  String _getParticipantName() {
    String rawName;
    if (participant is lk.LocalParticipant) {
      rawName = (participant as lk.LocalParticipant).name ?? 'You';
    } else if (participant is lk.RemoteParticipant) {
      rawName = (participant as lk.RemoteParticipant).name ?? 'Participant';
    } else {
      return 'Unknown';
    }
    
    // Remove timestamp suffix for cleaner display (e.g., "Host-1234567890" -> "Host")
    if (rawName.contains('-') && rawName.split('-').last.length >= 13) {
      // If the last part looks like a timestamp (13+ digits), remove it
      final parts = rawName.split('-');
      if (int.tryParse(parts.last) != null) {
        return parts.sublist(0, parts.length - 1).join('-');
      }
    }
    
    return rawName;
  }

  bool _isMicrophoneEnabled() {
    if (participant is lk.LocalParticipant) {
      return (participant as lk.LocalParticipant).isMicrophoneEnabled();
    } else if (participant is lk.RemoteParticipant) {
      return (participant as lk.RemoteParticipant).isMicrophoneEnabled();
    }
    return false;
  }

  bool _isScreenSharing() {
    // Check if participant has any screen share tracks
    if (participant is lk.LocalParticipant) {
      final localParticipant = participant as lk.LocalParticipant;
      for (final publication in localParticipant.videoTrackPublications) {
        if (publication.source == lk.TrackSource.screenShareVideo && publication.track != null) {
          return true;
        }
      }
    } else if (participant is lk.RemoteParticipant) {
      final remoteParticipant = participant as lk.RemoteParticipant;
      for (final publication in remoteParticipant.videoTrackPublications) {
        if (publication.source == lk.TrackSource.screenShareVideo && publication.track != null) {
          return true;
        }
      }
    }
    return false;
  }
}
