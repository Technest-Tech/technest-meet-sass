import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../services/livekit_service.dart';
import '../services/call_service.dart';
import '../widgets/conference_controls.dart';
import '../widgets/video_participant_widget.dart';
import '../widgets/whiteboard_widget.dart';

class VideoConferenceScreen extends StatefulWidget {
  final String roomName;
  final String participantName;
  final String participantType;

  const VideoConferenceScreen({
    super.key,
    required this.roomName,
    required this.participantName,
    required this.participantType,
  });

  @override
  State<VideoConferenceScreen> createState() => _VideoConferenceScreenState();
}

class _VideoConferenceScreenState extends State<VideoConferenceScreen> with WidgetsBindingObserver {
  // Track microphone state to maintain it during app lifecycle changes
  bool _wasMicrophoneEnabled = true;

  @override
  void initState() {
    super.initState();
    // Add lifecycle observer to handle app state changes
    WidgetsBinding.instance.addObserver(this);
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _connectToRoom();
    });
  }

  @override
  void dispose() {
    // Remove lifecycle observer
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    // Handle app lifecycle state changes
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    
    switch (state) {
      case AppLifecycleState.resumed:
        print('📱 App resumed - restoring audio state');
        // Restore microphone state when app resumes
        _restoreMicrophoneState(liveKitService);
        break;
      case AppLifecycleState.paused:
        print('📱 App paused - saving and maintaining audio state');
        // Save current mic state before pausing
        _saveMicrophoneState(liveKitService);
        // Configure audio for background operation
        CallService.configureAudioForBackground();
        // Keep audio tracks enabled even when app is paused
        _ensureAudioTracksEnabled(liveKitService);
        break;
      case AppLifecycleState.inactive:
        print('📱 App inactive - maintaining audio connection');
        CallService.configureAudioForBackground();
        _ensureAudioTracksEnabled(liveKitService);
        break;
      case AppLifecycleState.detached:
        print('📱 App detached');
        break;
      case AppLifecycleState.hidden:
        print('📱 App hidden - maintaining audio connection');
        _ensureAudioTracksEnabled(liveKitService);
        break;
    }
  }

  // Save microphone state before app goes to background
  void _saveMicrophoneState(LiveKitService liveKitService) {
    try {
      _wasMicrophoneEnabled = liveKitService.localParticipant?.isMicrophoneEnabled() ?? false;
      print('💾 Saved microphone state: $_wasMicrophoneEnabled');
    } catch (e) {
      print('⚠️ Error saving microphone state: $e');
    }
  }

  // Restore microphone state when app returns to foreground
  void _restoreMicrophoneState(LiveKitService liveKitService) async {
    try {
      print('🔄 Restoring microphone state to: $_wasMicrophoneEnabled');
      if (_wasMicrophoneEnabled) {
        await liveKitService.room?.localParticipant?.setMicrophoneEnabled(true);
        print('✅ Microphone state restored successfully');
      }
    } catch (e) {
      print('⚠️ Error restoring microphone state: $e');
    }
  }

  // Ensure audio tracks remain enabled
  void _ensureAudioTracksEnabled(LiveKitService liveKitService) async {
    try {
      if (liveKitService.room?.localParticipant != null) {
        final localParticipant = liveKitService.localParticipant;
        final isMicEnabled = localParticipant?.isMicrophoneEnabled() ?? false;
        
        print('📱 Audio track status - Mic enabled: $isMicEnabled');
        
        // If microphone was enabled before backgrounding, keep it enabled
        if (isMicEnabled) {
          print('📱 Ensuring microphone stays enabled in background...');
          
          // Force enable microphone again to prevent auto-muting
          try {
            await liveKitService.room?.localParticipant?.setMicrophoneEnabled(true);
            print('✅ Microphone re-enabled successfully');
          } catch (e) {
            print('⚠️ Error re-enabling microphone: $e');
          }
        }
      }
    } catch (e) {
      print('⚠️ Error ensuring audio tracks: $e');
    }
  }

  Future<void> _connectToRoom() async {
    try {
      print('🚀 VideoConferenceScreen: Starting room connection');
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      await liveKitService.connectToRoom(
        roomName: widget.roomName,
        participantName: widget.participantName,
        participantType: widget.participantType.toUpperCase(),
      );
      print('✅ VideoConferenceScreen: Room connection completed');
    } catch (e) {
      print('❌ VideoConferenceScreen: Connection error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Connection failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (didPop) return;
        
        // Show confirmation dialog when back button is pressed
        final shouldLeave = await _showLeaveMeetingDialog();
        if (shouldLeave == true && mounted) {
          try {
            print('🚪 VideoConferenceScreen: User confirmed leaving meeting via back button');
            final liveKitService = Provider.of<LiveKitService>(context, listen: false);
            await liveKitService.disconnect();
            print('✅ VideoConferenceScreen: Successfully disconnected from meeting');
            Navigator.pop(context, 'left_meeting');
          } catch (e) {
            print('❌ VideoConferenceScreen: Error disconnecting: $e');
            Navigator.pop(context, 'left_meeting');
          }
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          title: Text('Room: ${widget.roomName}'),
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              icon: const Icon(Icons.exit_to_app),
              onPressed: () async {
                final shouldLeave = await _showLeaveMeetingDialog();
                if (shouldLeave == true) {
                  try {
                    print('🚪 VideoConferenceScreen: User requested to leave meeting');
                    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
                    await liveKitService.disconnect();
                    print('✅ VideoConferenceScreen: Successfully disconnected from meeting');
                    if (mounted) {
                      Navigator.pop(context, 'left_meeting');
                    }
                  } catch (e) {
                    print('❌ VideoConferenceScreen: Error disconnecting: $e');
                    if (mounted) {
                      Navigator.pop(context, 'left_meeting');
                    }
                  }
                }
              },
            ),
          ],
        ),
      body: Consumer<LiveKitService>(
        builder: (context, liveKitService, child) {
          print('🔄 VideoConferenceScreen: Rebuilding with state - connecting: ${liveKitService.isConnecting}, connected: ${liveKitService.isConnected}, error: ${liveKitService.error}');
          
          if (liveKitService.isConnecting) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Colors.white),
                  SizedBox(height: 16),
                  Text(
                    'Connecting to room...',
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ],
              ),
            );
          }

          if (liveKitService.error != null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.error,
                      color: Colors.red,
                      size: 64,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Connection Error',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      liveKitService.error!,
                      style: const TextStyle(color: Colors.white70),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        ElevatedButton(
                          onPressed: () async {
                            await _connectToRoom();
                          },
                          child: const Text('Retry Connection'),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context, 'left_meeting');
                          },
                          child: const Text('Leave Meeting'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }

          if (!liveKitService.isConnected) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.wifi_off,
                    color: Colors.grey,
                    size: 64,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Not connected',
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () async {
                      await _connectToRoom();
                    },
                    child: const Text('Reconnect'),
                  ),
                ],
              ),
            );
          }

          // Full video conference interface with all controls
          return Stack(
            children: [
              // Main video grid
              _buildVideoGrid(liveKitService),
              
              // Screen sharing indicator overlay
              if (liveKitService.isScreenSharing)
                Positioned(
                  top: 16,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.9),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.screen_share,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'You are sharing your screen',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => liveKitService.stopScreenSharing(),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Icon(
                              Icons.close,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              
              // Whiteboard overlay (if enabled)
              if (liveKitService.isWhiteboardOpen)
                Positioned.fill(
                  child: WhiteboardWidget(
                    onClose: () {
                      liveKitService.toggleWhiteboard();
                    },
                    onSendData: (data) => liveKitService.sendWhiteboardData(data),
                  ),
                ),
              
              // Conference controls at the bottom
              ConferenceControls(
                participantType: widget.participantType,
                roomName: widget.roomName,
                onToggleWhiteboard: () => liveKitService.toggleWhiteboard(),
                onToggleCamera: () => liveKitService.toggleCamera(),
                onToggleMicrophone: () => liveKitService.toggleMicrophone(),
                onStartScreenShare: () => liveKitService.startScreenSharing(),
                onStopScreenShare: () => liveKitService.stopScreenSharing(),
                onLeaveMeeting: () async {
                  final shouldLeave = await _showLeaveMeetingDialog();
                  if (shouldLeave == true) {
                    try {
                      print('🚪 VideoConferenceScreen: User clicked Leave Meeting button');
                      await liveKitService.disconnect();
                      print('✅ VideoConferenceScreen: Successfully disconnected from meeting');
                      if (mounted) {
                        Navigator.pop(context, 'left_meeting');
                      }
                    } catch (e) {
                      print('❌ VideoConferenceScreen: Error disconnecting: $e');
                      if (mounted) {
                        Navigator.pop(context, 'left_meeting');
                      }
                    }
                  }
                },
              ),
            ],
          );
        },
      ),
      ),
    );
  }

  /// Shows a confirmation dialog when user tries to leave the meeting
  Future<bool?> _showLeaveMeetingDialog() async {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.grey[900],
          title: const Text(
            'Leave Meeting?',
            style: TextStyle(color: Colors.white),
          ),
          content: const Text(
            'Are you sure you want to leave the meeting? You will be disconnected from all participants.',
            style: TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: Colors.grey),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              child: const Text('Leave Meeting'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildVideoGrid(LiveKitService liveKitService) {
    // Create a combined list of all participants (local + remote)
    final List<dynamic> allParticipants = [];
    
    // Add local participant first if it exists
    if (liveKitService.localParticipant != null) {
      allParticipants.add(liveKitService.localParticipant);
    }
    
    // Add remote participants
    allParticipants.addAll(liveKitService.participants);
    
    if (allParticipants.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.person,
              color: Colors.grey,
              size: 64,
            ),
            SizedBox(height: 16),
            Text(
              'Waiting for participants...',
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
          ],
        ),
      );
    }

    // Check if anyone is sharing their screen
    dynamic screenSharingParticipant;
    for (final participant in allParticipants) {
      if (_isParticipantSharingScreen(participant)) {
        screenSharingParticipant = participant;
        break;
      }
    }

    // If someone is sharing screen, show in large view with others in sidebar
    if (screenSharingParticipant != null) {
      return _buildScreenShareLayout(
        liveKitService,
        allParticipants,
        screenSharingParticipant,
      );
    }

    // Normal grid layout when no screen sharing
    // Calculate grid layout based on number of participants
    int crossAxisCount = 1;
    if (allParticipants.length <= 2) {
      crossAxisCount = 1;
    } else if (allParticipants.length <= 4) {
      crossAxisCount = 2;
    } else if (allParticipants.length <= 9) {
      crossAxisCount = 3;
    } else {
      crossAxisCount = 4;
    }

    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 8.0,
          mainAxisSpacing: 8.0,
          childAspectRatio: 16 / 9, // Standard video aspect ratio
        ),
        itemCount: allParticipants.length,
        itemBuilder: (context, index) {
          final participant = allParticipants[index];
          final isLocal = participant == liveKitService.localParticipant;
          
          return VideoParticipantWidget(
            participant: participant,
            isLocal: isLocal,
          );
        },
      ),
    );
  }

  // Check if a participant is sharing their screen
  bool _isParticipantSharingScreen(dynamic participant) {
    if (participant is lk.LocalParticipant) {
      for (final publication in participant.videoTrackPublications) {
        if (publication.source == lk.TrackSource.screenShareVideo && publication.track != null) {
          return true;
        }
      }
    } else if (participant is lk.RemoteParticipant) {
      for (final publication in participant.videoTrackPublications) {
        if (publication.source == lk.TrackSource.screenShareVideo && publication.track != null) {
          return true;
        }
      }
    }
    return false;
  }

  // Build layout with screen share prominently displayed
  Widget _buildScreenShareLayout(
    LiveKitService liveKitService,
    List<dynamic> allParticipants,
    dynamic screenSharingParticipant,
  ) {
    final isLocalSharing = screenSharingParticipant == liveKitService.localParticipant;
    
    // Get other participants (not the one sharing screen)
    final otherParticipants = allParticipants
        .where((p) => p != screenSharingParticipant)
        .toList();

    return Stack(
      children: [
        // Main large screen share view (covers most of screen)
        Positioned.fill(
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              children: [
                // Screen share indicator banner
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.screen_share, color: Colors.white, size: 16),
                      const SizedBox(width: 8),
                      Text(
                        isLocalSharing ? 'You are sharing your screen' : 'Screen being shared',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                
                // Large screen share video
                Expanded(
                  child: VideoParticipantWidget(
                    participant: screenSharingParticipant,
                    isLocal: isLocalSharing,
                  ),
                ),
              ],
            ),
          ),
        ),
        
        // Floating sidebar with other participants (small thumbnails)
        if (otherParticipants.isNotEmpty)
          Positioned(
            top: 60,
            right: 8,
            child: Container(
              width: 120,
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.6,
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: otherParticipants.length,
                itemBuilder: (context, index) {
                  final participant = otherParticipants[index];
                  final isLocal = participant == liveKitService.localParticipant;
                  
                  return Container(
                    height: 90,
                    margin: const EdgeInsets.only(bottom: 8),
                    child: VideoParticipantWidget(
                      participant: participant,
                      isLocal: isLocal,
                    ),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }

}
