import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/livekit_service.dart';
import 'participant_manager_widget.dart';
import 'chat_widget.dart';

class ConferenceControls extends StatefulWidget {
  final String participantType;
  final String roomName;
  final VoidCallback onToggleWhiteboard;
  final VoidCallback onToggleCamera;
  final VoidCallback onToggleMicrophone;
  final VoidCallback onStartScreenShare;
  final VoidCallback onStopScreenShare;
  final VoidCallback onLeaveMeeting;

  const ConferenceControls({
    super.key,
    required this.participantType,
    required this.roomName,
    required this.onToggleWhiteboard,
    required this.onToggleCamera,
    required this.onToggleMicrophone,
    required this.onStartScreenShare,
    required this.onStopScreenShare,
    required this.onLeaveMeeting,
  });

  @override
  State<ConferenceControls> createState() => _ConferenceControlsState();
}

class _ConferenceControlsState extends State<ConferenceControls> {
  bool _isChatOpen = false;
  int _unreadCount = 0;

  @override
  Widget build(BuildContext context) {
    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Chat Widget
            ChatWidget(
              isOpen: _isChatOpen,
              onClose: () {
                setState(() {
                  _isChatOpen = false;
                });
              },
              onUnreadCountChange: (count) {
                setState(() {
                  _unreadCount = count;
                });
              },
            ),
            
            // Conference Controls
            Container(
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
                // Participant Manager (Host only)
                if (widget.participantType.toLowerCase() == 'host')
                  ParticipantManagerWidget(
                    participantType: widget.participantType,
                    roomName: widget.roomName,
                  ),
                
                const SizedBox(height: 16),
                
                // Single row with all controls organized by priority
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Audio Controls
                    _buildControlButton(
                      icon: liveKitService.localParticipant?.isMicrophoneEnabled() == true
                          ? Icons.mic
                          : Icons.mic_off,
                      label: 'Mic',
                      isActive: liveKitService.localParticipant?.isMicrophoneEnabled() == true,
                      onPressed: widget.onToggleMicrophone,
                    ),
                    
                    // Video Controls
                    _buildControlButton(
                      icon: liveKitService.localParticipant?.isCameraEnabled() == true
                          ? Icons.videocam
                          : Icons.videocam_off,
                      label: 'Camera',
                      isActive: liveKitService.localParticipant?.isCameraEnabled() == true,
                      onPressed: widget.onToggleCamera,
                    ),
                    
                    // Whiteboard Controls (Host only)
                    if (widget.participantType.toLowerCase() == 'host')
                      _buildControlButton(
                        icon: liveKitService.isWhiteboardOpen
                            ? Icons.close
                            : Icons.edit,
                        label: 'Whiteboard',
                        isActive: liveKitService.isWhiteboardOpen,
                        onPressed: widget.onToggleWhiteboard,
                      ),
                    
                    // Chat Controls (All participants)
                    _buildControlButton(
                      icon: _isChatOpen ? Icons.close : Icons.chat,
                      label: 'Chat',
                      isActive: _isChatOpen,
                      onPressed: () {
                        setState(() {
                          _isChatOpen = !_isChatOpen;
                        });
                      },
                      badge: _unreadCount > 0 && !_isChatOpen ? _unreadCount : null,
                    ),
                    
                    // Screen Share Controls
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
                              ? widget.onStopScreenShare
                              : widget.onStartScreenShare),
                    ),
                    
                    // Leave Meeting (Always last)
                    _buildControlButton(
                      icon: Icons.call_end,
                      label: 'Leave',
                      isActive: false,
                      onPressed: widget.onLeaveMeeting,
                      backgroundColor: Colors.red,
                    ),
                  ],
                ),
                  ],
                ),
              ),
            ),
          ],
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
    int? badge,
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
        Stack(
          children: [
            buttonContent,
            if (badge != null && badge > 0)
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                  ),
                  constraints: const BoxConstraints(
                    minWidth: 20,
                    minHeight: 20,
                  ),
                  child: Text(
                    badge > 99 ? '99+' : badge.toString(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
          ],
        ),
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
