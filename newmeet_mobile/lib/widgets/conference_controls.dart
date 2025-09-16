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
  bool _showMoreOptions = false;
  bool _showParticipantManager = false;

  @override
  Widget build(BuildContext context) {
    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        // Get keyboard height to adjust layout
        final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;

        return GestureDetector(
          onTap: () {
            // Close dropdown and participant manager when tapping outside
            if (_showMoreOptions || _showParticipantManager) {
              setState(() {
                _showMoreOptions = false;
                _showParticipantManager = false;
              });
            }
          },
          child: Stack(
            children: [
              // Conference Controls (always present)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.only(
                    left: 16,
                    right: 16,
                    top: 16,
                    bottom: keyboardHeight > 0
                        ? 16
                        : 16 + MediaQuery.of(context).padding.bottom,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      topRight: Radius.circular(16),
                    ),
                  ),
                  child: SafeArea(
                    bottom: false, // Don't use SafeArea bottom to allow proper keyboard handling
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Participant Manager (Host only) - shown when toggled from More dropdown
                        if (widget.participantType.toLowerCase() == 'host' &&
                            _showParticipantManager)
                          ParticipantManagerWidget(
                            participantType: widget.participantType,
                            roomName: widget.roomName,
                          ),

                        if (widget.participantType.toLowerCase() == 'host' &&
                            _showParticipantManager)
                          const SizedBox(height: 16),

                        // Compact single row with More dropdown
                        Column(
                          children: [
                            // Main controls row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                // Audio Controls
                                _buildControlButton(
                                  icon: (liveKitService.localParticipant?.isMicrophoneEnabled() ?? false)
                                      ? Icons.mic
                                      : Icons.mic_off,
                                  label: 'Mic',
                                  isActive: liveKitService.localParticipant?.isMicrophoneEnabled() ?? false,
                                  onPressed: widget.onToggleMicrophone,
                                ),

                                // Video Controls
                                _buildControlButton(
                                  icon: (liveKitService.localParticipant?.isCameraEnabled() ?? false)
                                      ? Icons.videocam
                                      : Icons.videocam_off,
                                  label: 'Camera',
                                  isActive: liveKitService.localParticipant?.isCameraEnabled() ?? false,
                                  onPressed: widget.onToggleCamera,
                                ),

                                // Chat Controls
                                _buildControlButton(
                                  icon: _isChatOpen ? Icons.close : Icons.chat,
                                  label: 'Chat',
                                  isActive: _isChatOpen,
                                  onPressed: () {
                                    setState(() {
                                      _isChatOpen = !_isChatOpen;
                                    });
                                  },
                                  badge: _unreadCount > 0 && !_isChatOpen
                                      ? _unreadCount
                                      : null,
                                ),

                                // More Options Dropdown
                                _buildMoreOptionsButton(liveKitService),
                              ],
                            ),

                            // More options dropdown content
                            if (_showMoreOptions)
                              _buildMoreOptionsDropdown(liveKitService),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Chat Widget (overlay when open)
              if (_isChatOpen)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: ChatWidget(
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
                ),
            ],
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

  Widget _buildMoreOptionsButton(LiveKitService liveKitService) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: _showMoreOptions ? Colors.blue : Colors.grey.shade700,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            onPressed: () {
              setState(() {
                _showMoreOptions = !_showMoreOptions;
              });
            },
            icon: Icon(
              _showMoreOptions ? Icons.keyboard_arrow_up : Icons.more_horiz,
              color: Colors.white,
              size: 24,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'More',
          style: TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildMoreOptionsDropdown(LiveKitService liveKitService) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade600),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Participants Controls (Host only)
          if (widget.participantType.toLowerCase() == 'host')
            _buildDropdownOption(
              icon: Icons.people,
              label: 'Manage Participants',
              isActive: _showParticipantManager,
              onPressed: () {
                setState(() {
                  _showParticipantManager = !_showParticipantManager;
                  _showMoreOptions = false;
                });
              },
            ),
          
          // Whiteboard Controls (Host only)
          if (widget.participantType.toLowerCase() == 'host')
            _buildDropdownOption(
              icon: liveKitService.isWhiteboardOpen ? Icons.close : Icons.edit,
              label: 'Whiteboard',
              isActive: liveKitService.isWhiteboardOpen,
              onPressed: () {
                widget.onToggleWhiteboard();
                setState(() {
                  _showMoreOptions = false;
                });
              },
            ),
          
          // Screen Share Controls
          _buildDropdownOption(
            icon: liveKitService.isScreenSharing
                ? Icons.stop_screen_share
                : Icons.screen_share,
            label: 'Screen Share',
            isActive: liveKitService.isScreenSharing,
            isLoading: liveKitService.isStartingScreenShare,
            onPressed: liveKitService.isStartingScreenShare
                ? null
                : () {
                    if (liveKitService.isScreenSharing) {
                      widget.onStopScreenShare();
                    } else {
                      widget.onStartScreenShare();
                    }
                    setState(() {
                      _showMoreOptions = false;
                    });
                  },
          ),
          
          // Leave Meeting
          _buildDropdownOption(
            icon: Icons.call_end,
            label: 'Leave Meeting',
            isActive: false,
            onPressed: () {
              widget.onLeaveMeeting();
              setState(() {
                _showMoreOptions = false;
              });
            },
            backgroundColor: Colors.red,
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownOption({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    bool isLoading = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: backgroundColor ?? (isActive ? Colors.blue.withOpacity(0.2) : Colors.transparent),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: backgroundColor ?? (isActive ? Colors.blue : Colors.grey.shade600),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              if (isLoading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              else
                Icon(
                  icon,
                  color: backgroundColor != null 
                      ? Colors.white 
                      : (isActive ? Colors.blue : Colors.white),
                  size: 20,
                ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  color: backgroundColor != null 
                      ? Colors.white 
                      : (isActive ? Colors.blue : Colors.white),
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
