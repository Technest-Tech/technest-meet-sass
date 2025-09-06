import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/livekit_service.dart';

class ConferenceControls extends StatelessWidget {
  final String participantType;
  final VoidCallback onToggleWhiteboard;
  final VoidCallback onToggleCamera;
  final VoidCallback onToggleMicrophone;
  final VoidCallback onStartScreenShare;
  final VoidCallback onStopScreenShare;
  final VoidCallback onLeaveMeeting;

  const ConferenceControls({
    super.key,
    required this.participantType,
    required this.onToggleWhiteboard,
    required this.onToggleCamera,
    required this.onToggleMicrophone,
    required this.onStartScreenShare,
    required this.onStopScreenShare,
    required this.onLeaveMeeting,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.black87,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
            ),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top row - Main controls
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Microphone Toggle
                    _buildControlButton(
                      icon: liveKitService.localParticipant?.isMicrophoneEnabled() == true
                          ? Icons.mic
                          : Icons.mic_off,
                      label: 'Mic',
                      isActive: liveKitService.localParticipant?.isMicrophoneEnabled() == true,
                      onPressed: onToggleMicrophone,
                    ),
                    
                    // Camera Toggle
                    _buildControlButton(
                      icon: liveKitService.localParticipant?.isCameraEnabled() == true
                          ? Icons.videocam
                          : Icons.videocam_off,
                      label: 'Camera',
                      isActive: liveKitService.localParticipant?.isCameraEnabled() == true,
                      onPressed: onToggleCamera,
                    ),
                    
                    // Screen Share Toggle
                    _buildControlButton(
                      icon: liveKitService.isScreenSharing
                          ? Icons.stop_screen_share
                          : Icons.screen_share,
                      label: 'Share',
                      isActive: liveKitService.isScreenSharing,
                      isLoading: liveKitService.isStartingScreenShare,
                      isPulsing: liveKitService.isScreenSharing,
                      onPressed: liveKitService.isStartingScreenShare
                          ? null
                          : (liveKitService.isScreenSharing
                              ? onStopScreenShare
                              : onStartScreenShare),
                    ),
                    
                    // Leave Meeting
                    _buildControlButton(
                      icon: Icons.call_end,
                      label: 'Leave',
                      isActive: false,
                      onPressed: onLeaveMeeting,
                      backgroundColor: Colors.red,
                    ),
                  ],
                ),
                
                const SizedBox(height: 16),
                
                // Bottom row - Additional controls (Host only)
                if (participantType.toLowerCase() == 'host')
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Whiteboard Toggle
                      _buildControlButton(
                        icon: liveKitService.isWhiteboardOpen
                            ? Icons.close
                            : Icons.edit,
                        label: 'Whiteboard',
                        isActive: liveKitService.isWhiteboardOpen,
                        onPressed: onToggleWhiteboard,
                      ),
                      
                      // More controls can be added here
                      const SizedBox(width: 60), // Spacer
                      const SizedBox(width: 60), // Spacer
                      const SizedBox(width: 60), // Spacer
                    ],
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    bool isLoading = false,
    bool isPulsing = false,
  }) {
    Widget buttonContent = Container(
      width: 60,
      height: 60,
      decoration: BoxDecoration(
        color: backgroundColor ?? (isActive ? Colors.white : Colors.grey.shade700),
        shape: BoxShape.circle,
      ),
      child: isLoading
          ? const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            )
          : IconButton(
              onPressed: onPressed,
              icon: Icon(
                icon,
                color: backgroundColor != null 
                    ? Colors.white 
                    : (isActive ? Colors.black : Colors.white),
                size: 24,
              ),
            ),
    );

    // Add pulsing animation if needed
    if (isPulsing) {
      buttonContent = AnimatedBuilder(
        animation: AlwaysStoppedAnimation(0.0), // We'll use a simple repeating animation
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.red.withOpacity(0.8),
                  blurRadius: 15,
                  spreadRadius: 3,
                ),
                BoxShadow(
                  color: Colors.red.withOpacity(0.4),
                  blurRadius: 25,
                  spreadRadius: 8,
                ),
              ],
            ),
            child: child,
          );
        },
        child: buttonContent,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        buttonContent,
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
