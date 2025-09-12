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
    
    if (participant is lk.LocalParticipant) {
      final localParticipant = participant as lk.LocalParticipant;
      // Get the first available video track
      for (final publication in localParticipant.videoTrackPublications) {
        if (publication.track != null) {
          videoTrack = publication.track as lk.VideoTrack;
          break;
        }
      }
    } else if (participant is lk.RemoteParticipant) {
      final remoteParticipant = participant as lk.RemoteParticipant;
      // Get the first available video track
      for (final publication in remoteParticipant.videoTrackPublications) {
        if (publication.track != null) {
          videoTrack = publication.track as lk.VideoTrack;
          break;
        }
      }
    }

    // If we have a video track and camera is enabled, render it
    if (videoTrack != null && _isCameraEnabled()) {
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
    if (participant is lk.LocalParticipant) {
      return (participant as lk.LocalParticipant).name ?? 'You';
    } else if (participant is lk.RemoteParticipant) {
      return (participant as lk.RemoteParticipant).name ?? 'Participant';
    }
    return 'Unknown';
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
    // For now, return false until we implement proper screen sharing detection
    return false;
  }
}
