import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/livekit_service.dart';
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

class _VideoConferenceScreenState extends State<VideoConferenceScreen> {
  bool _isBottomControlsVisible = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _connectToRoom();
    });
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
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text('Room: ${widget.roomName}'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.exit_to_app),
            onPressed: () async {
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
                      // Auto-show controls when whiteboard closes
                      setState(() {
                        _isBottomControlsVisible = true;
                      });
                    },
                    onSendData: (data) => liveKitService.sendWhiteboardData(data),
                  ),
                ),
              
              // Conference controls at the bottom (collapsible)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Toggle button for controls
                    if (liveKitService.isWhiteboardOpen)
                      Container(
                        width: double.infinity,
                        height: 40,
                        color: Colors.black87,
                        child: Center(
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _isBottomControlsVisible = !_isBottomControlsVisible;
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade700,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    _isBottomControlsVisible ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_up,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    _isBottomControlsVisible ? 'Hide Controls' : 'Show Controls',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    
                    // Conference controls
                    if (_isBottomControlsVisible)
                      ConferenceControls(
                        participantType: widget.participantType,
                        roomName: widget.roomName,
                        onToggleWhiteboard: () => liveKitService.toggleWhiteboard(),
                        onToggleCamera: () => liveKitService.toggleCamera(),
                        onToggleMicrophone: () => liveKitService.toggleMicrophone(),
                        onStartScreenShare: () => liveKitService.startScreenSharing(),
                        onStopScreenShare: () => liveKitService.stopScreenSharing(),
                        onLeaveMeeting: () async {
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
                        },
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
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

}
