import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import '../services/livekit_service.dart';
import '../services/pip_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../ui/components/meeting/meeting_control_dock.dart';
import '../ui/components/meeting/meeting_info_bar.dart';
import '../ui/components/modal/app_bottom_sheet.dart';
import '../ui/layout/app_scaffold.dart';
import '../widgets/chat_widget.dart';
import '../widgets/participant_manager_widget.dart';
import '../widgets/video_participant_widget.dart';
import '../widgets/pip_meeting_widget.dart';
import '../widgets/whiteboard_widget.dart';
import '../widgets/floating_reactions_widget.dart';
import '../widgets/recording_indicator_widget.dart';
import '../widgets/raise_hand_indicator_widget.dart';
import '../widgets/waiting_list_widget.dart';
import '../services/reaction_sound_service.dart';
import '../services/api_service.dart';
import '../models/room.dart';
import '../utils/observer_filter.dart';

class VideoConferenceScreen extends StatefulWidget {
  final String roomName;
  final String participantName;
  final String participantType;
  final bool initialCameraEnabled;
  final bool initialMicEnabled;
  final bool initialSpeakerEnabled;
  final RoomFeatures? roomFeatures;

  const VideoConferenceScreen({
    super.key,
    required this.roomName,
    required this.participantName,
    required this.participantType,
    this.initialCameraEnabled = true,
    this.initialMicEnabled = true,
    this.initialSpeakerEnabled = true,
    this.roomFeatures,
  });

  @override
  State<VideoConferenceScreen> createState() => _VideoConferenceScreenState();
}

class _VideoConferenceScreenState extends State<VideoConferenceScreen>
    with WidgetsBindingObserver {
  bool _isChatVisible = false;
  bool _handRaised = false;
  int _unreadChatCount = 0;
  Timer? _callTimer;
  Duration _callDuration = Duration.zero;
  PipService? _pipService;
  bool _isInPipMode = false;
  
  // Reactions
  final FloatingReactionsManager _reactionsManager = FloatingReactionsManager();
  final ReactionSoundService _soundService = ReactionSoundService();
  
  // Raise hand tracking
  final Map<String, bool> _raisedHands = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pipService = PipService();
    _pipService?.addListener(_onPipStateChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _connectToRoom();
      _setupMuteControlListener();
    });
  }
  
  void _setupMuteControlListener() {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    liveKitService.setMuteControlDataCallback((data) {
      if (!mounted) return;
      
      final localParticipant = liveKitService.localParticipant;
      if (localParticipant == null) return;
      
      final messageType = data['type'] as String?;
      final targetParticipant = data['targetParticipant'] as String?;
      final myIdentity = localParticipant.identity;
      final allowUnmute = data['allowUnmute'] as bool? ?? true;
      
      Logger.debug(' LiveKit: Received mute control data - type: $messageType, target: $targetParticipant, myIdentity: $myIdentity', 'video_conference_screen');
      
      // Check if this command is for me
      // mute_all_command applies to everyone, individual commands check targetParticipant
      final isForMe = messageType == 'mute_all_command' || 
                      targetParticipant == null || 
                      targetParticipant == myIdentity;
      
      Logger.debug(' LiveKit: Is command for me? $isForMe', 'video_conference_screen');
      
      if (!isForMe) {
        Logger.debug(' LiveKit: Ignoring command - not for me', 'video_conference_screen');
        return;
      }
      
      if (messageType == 'mute_command' || messageType == 'mute_all_command') {
        Logger.debug(' LiveKit: Received mute command, muting microphone...', 'video_conference_screen');
        localParticipant.setMicrophoneEnabled(false).then((_) {
          Logger.debug(' LiveKit: Microphone muted successfully', 'video_conference_screen');
          // Notify LiveKitService listeners so UI updates
          liveKitService.notifyListeners();
          if (mounted) {
            // UI will update via Consumer/Selector automatically
            // Show notification to user
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    Icon(Icons.mic_off, color: Colors.white),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        messageType == 'mute_all_command' 
                            ? 'Host muted all participants' 
                            : 'Host muted your microphone',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ],
                ),
                backgroundColor: AppColors.warning,
                duration: const Duration(seconds: 3),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        }).catchError((e) {
          Logger.error(' LiveKit: Failed to mute microphone: $e', e, null, 'video_conference_screen');
        });
      } else if (messageType == 'unmute_command' && allowUnmute) {
        Logger.debug(' LiveKit: Received unmute command, unmuting microphone...', 'video_conference_screen');
        localParticipant.setMicrophoneEnabled(true).then((_) {
          Logger.debug(' LiveKit: Microphone unmuted successfully', 'video_conference_screen');
          // Notify LiveKitService listeners so UI updates
          liveKitService.notifyListeners();
          if (mounted) {
            // UI will update via Consumer/Selector automatically
            // Show notification to user
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    Icon(Icons.mic, color: Colors.white),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Host unmuted your microphone',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ],
                ),
                backgroundColor: AppColors.success,
                duration: const Duration(seconds: 3),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        }).catchError((e) {
          Logger.error(' LiveKit: Failed to unmute microphone: $e', e, null, 'video_conference_screen');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.white),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Failed to unmute microphone: $e',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ],
                ),
                backgroundColor: AppColors.danger,
                duration: const Duration(seconds: 3),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        });
      } else if (messageType == 'unmute_command' && !allowUnmute) {
        // Show notification that unmute was blocked
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  Icon(Icons.block, color: Colors.white),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Unmute request was blocked',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
              backgroundColor: AppColors.danger,
              duration: const Duration(seconds: 3),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    });
  }

  @override
  void dispose() {
    _callTimer?.cancel();
    _pipService?.removeListener(_onPipStateChanged);
    _pipService?.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onPipStateChanged() {
    if (mounted) {
      setState(() {
        _isInPipMode = _pipService?.isPipMode ?? false;
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    
    if (!liveKitService.isConnected) {
      return;
    }

    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        // Enter PiP mode when app goes to background
        if (_pipService?.isPipSupported == true && 
            _pipService?.isPipAvailable == true) {
          // Enable background mode for LiveKit tracks
          liveKitService.enableBackgroundMode();
          _pipService?.enterPipMode();
        } else {
          // For iOS or unsupported devices, enable background mode
          liveKitService.enableBackgroundMode();
          _pipService?.enableBackgroundMode();
        }
        break;
      case AppLifecycleState.resumed:
        // Exit PiP mode when app comes to foreground
        if (_isInPipMode) {
          _pipService?.exitPipMode();
        } else {
          _pipService?.disableBackgroundMode();
        }
        break;
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        break;
    }
  }

  Future<void> _connectToRoom() async {
    try {
      Logger.info(' VideoConferenceScreen: Starting room connection', 'video_conference_screen');
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      await liveKitService.connectToRoom(
        roomName: widget.roomName,
        participantName: widget.participantName,
        participantType: widget.participantType.toUpperCase(),
        cameraEnabled: widget.initialCameraEnabled,
        microphoneEnabled: widget.initialMicEnabled,
        speakerEnabled: widget.initialSpeakerEnabled,
      );
      Logger.debug(' VideoConferenceScreen: Room connection completed', 'video_conference_screen');
      
      // Set up data channel callbacks
      _setupDataChannelCallbacks(liveKitService);
      
      _startCallTimer();
    } catch (e) {
      Logger.error(' VideoConferenceScreen: Connection error: $e', e, null, 'video_conference_screen');
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

  void _setupDataChannelCallbacks(LiveKitService liveKitService) {
    // Reaction callback
    liveKitService.setReactionDataCallback((data) {
      if (mounted) {
        final reactionType = data['reactionType'] as String?;
        final sender = data['sender'] as String?;
        final localIdentity = liveKitService.localParticipant?.identity;
        
        if (reactionType != null && sender != null && sender != localIdentity) {
          // Play sound for received reactions
          _soundService.playReactionSound(reactionType);
          
          // Add floating reaction
          final screenSize = MediaQuery.of(context).size;
          _reactionsManager.addReaction(reactionType, screenSize);
          // Reactions widget will update via its own state management
        }
      }
    });

    // Raise hand callback
    liveKitService.setRaiseHandDataCallback((data) {
      if (mounted) {
        final sender = data['sender'] as String?;
        final isRaised = data['isRaised'] as bool?;
        final localIdentity = liveKitService.localParticipant?.identity;
        
        if (sender != null && sender != localIdentity && isRaised != null) {
          // Play sound for received raise hand events
          _soundService.playRaiseHandSound(isRaised);
          
          // Update raised hands map
          setState(() {
            if (isRaised) {
              _raisedHands[sender] = true;
            } else {
              _raisedHands.remove(sender);
            }
          });
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // If in PiP mode, show simplified PiP widget
    if (_isInPipMode) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: PipMeetingWidget(
            onTap: () {
              // Tap to return to full screen
              _pipService?.exitPipMode();
            },
            onEndCall: () async {
              final shouldLeave = await _showLeaveMeetingDialog();
              if (shouldLeave == true && mounted) {
                await _disconnectAndExit();
              }
            },
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (didPop) return;

        final shouldLeave = await _showLeaveMeetingDialog();
        if (shouldLeave == true && mounted) {
          await _disconnectAndExit();
        }
      },
      child: AppScaffold(
        extendBodyBehindAppBar: true,
        body: Stack(
          children: [
            Consumer<LiveKitService>(
              builder: (context, liveKitService, child) {
                print(
                    '🔄 VideoConferenceScreen: Rebuilding with state - connecting: ${liveKitService.isConnecting}, connected: ${liveKitService.isConnected}, error: ${liveKitService.error}');

                if (liveKitService.isConnecting) {
                  return _buildLoadingState(context);
                }

                if (liveKitService.error != null && !liveKitService.isConnected) {
                  return _buildErrorState(context, liveKitService.error!);
                }

                if (!liveKitService.isConnected) {
                  return _buildReconnectState(context);
                }

                // Count visible participants (excluding observers)
                final allParticipants = <dynamic>[];
                final isObserver = widget.participantType.toLowerCase() == 'observer';
                if (liveKitService.localParticipant != null) {
                  // Always hide observer's own video tile
                  if (!isObserver && !ObserverFilter.isObserver(liveKitService.localParticipant!)) {
                    allParticipants.add(liveKitService.localParticipant);
                  }
                }
                allParticipants.addAll(ObserverFilter.filterObservers(liveKitService.participants));
                final participantCount = allParticipants.length;

                return Stack(
                  children: [
                    Positioned.fill(child: _buildParticipantStage(liveKitService)),
                    // Only show banner if local participant is screen sharing
                    if (liveKitService.isScreenSharing && 
                        liveKitService.screenSharingParticipant == liveKitService.localParticipant)
                      Positioned(
                        top: MediaQuery.of(context).padding.top + 120,
                        left: 24,
                        right: 24,
                        child: _buildScreenShareBanner(liveKitService),
                      ),
                    if (liveKitService.isRecording && liveKitService.recordingStartTime != null &&
                        widget.roomFeatures?.canRecord == true)
                      Positioned(
                        top: MediaQuery.of(context).padding.top + 80,
                        left: 24,
                        child: RecordingIndicatorWidget(
                          startTime: liveKitService.recordingStartTime!,
                          isPaused: liveKitService.isRecordingPaused,
                          onPauseToggle: () => liveKitService.toggleRecordingPause(),
                        ),
                      ),
                    if (_raisedHands.isNotEmpty && widget.roomFeatures?.enableRaiseHand == true)
                      RaiseHandIndicatorWidget(raisedHands: _raisedHands),
                    Positioned.fill(
                      child: FloatingReactionsWidget(
                        reactions: _reactionsManager.reactions,
                      ),
                    ),
                    if (liveKitService.isWhiteboardOpen && 
                        widget.roomFeatures?.enableCollaborativeWhiteboard == true)
                      Positioned.fill(
                        child: WhiteboardWidget(
                          onClose: () {
                            liveKitService.toggleWhiteboard();
                          },
                          onSendData: (data) => liveKitService.sendWhiteboardData(data),
                        ),
                      ),
                    // Always render ChatWidget to keep callback active, but only show when visible
                    Positioned.fill(
                      child: ChatWidget(
                        isOpen: _isChatVisible && (widget.roomFeatures?.enablePrivateChat == true),
                        onClose: () {
                          setState(() {
                            _isChatVisible = false;
                          });
                        },
                        onUnreadCountChange: (count) {
                          // Defer setState to avoid calling it during build
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) {
                              setState(() {
                                _unreadChatCount = count;
                                print('📬 VideoConferenceScreen: Unread count updated to $count');
                              });
                            }
                          });
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
            // Waiting List Widget - Polls for waiting guests and shows confirmation alerts
            // Placed outside the Consumer to avoid rebuilds, and uses SizedBox.shrink() so it doesn't affect layout
            if (widget.participantType.toLowerCase() == 'host')
              WaitingListWidget(
                roomName: widget.roomName,
                isHost: true,
              ),
          ],
        ),
        bottomBar: _isChatVisible
            ? null
            : Selector<LiveKitService, Map<String, dynamic>>(
              selector: (_, service) => {
                'cameraEnabled': service.localParticipant?.isCameraEnabled() ?? false,
                'micEnabled': service.localParticipant?.isMicrophoneEnabled() ?? false,
                'participantCount': service.participants.length + 1,
                'hasScreenShare': service.hasAnyScreenShare,
              },
              builder: (context, state, child) {
                final cameraEnabled = state['cameraEnabled'] as bool;
                final micEnabled = state['micEnabled'] as bool;
                final participantCount = state['participantCount'] as int;
                final liveKitService = Provider.of<LiveKitService>(context, listen: false);
                final isObserver = widget.participantType.toLowerCase() == 'observer';
                final isHost = widget.participantType.toLowerCase() == 'host';

                return MeetingControlDock(
                  cameraEnabled: cameraEnabled,
                  microphoneEnabled: micEnabled,
                  participantCount: participantCount,
                  chatUnread: _unreadChatCount,
                  handRaised: _handRaised,
                  chatEnabled: !isObserver && (widget.roomFeatures?.enablePrivateChat == true),
                  raiseHandEnabled: !isObserver && (widget.roomFeatures?.enableRaiseHand == true),
                  isObserver: isObserver,
                  quickActions: _buildQuickActions(context, liveKitService),
                  onToggleCamera: isObserver ? null : () => liveKitService.toggleCamera(),
                  onToggleMicrophone: isObserver ? null : () => liveKitService.toggleMicrophone(),
                  onToggleChat: () {
                    if (isObserver) return;
                    if (widget.roomFeatures?.enablePrivateChat == true) {
                      setState(() {
                        _isChatVisible = !_isChatVisible;
                        if (_isChatVisible) {
                          _unreadChatCount = 0;
                        }
                      });
                    } else {
                      _showProFeatureDialog(context, 'Private Chat');
                    }
                  },
                  onToggleHand: () async {
                    if (widget.participantType.toLowerCase() == 'observer') return;
                    if (widget.roomFeatures?.enableRaiseHand != true) {
                      _showProFeatureDialog(context, 'Raise Hand');
                      return;
                    }
                    
                    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
                    final newState = !_handRaised;
                    setState(() {
                      _handRaised = newState;
                    });
                
                // Play sound
                _soundService.playRaiseHandSound(newState);
                
                // Send raise hand data
                try {
                  await liveKitService.sendRaiseHandData(newState);
                  
                  // Update local raised hands map
                  if (mounted) {
                    setState(() {
                      final localIdentity = liveKitService.localParticipant?.identity;
                      if (localIdentity != null) {
                        if (newState) {
                          _raisedHands[localIdentity] = true;
                        } else {
                          _raisedHands.remove(localIdentity);
                        }
                      }
                    });
                  }
                } catch (e) {
                  Logger.error(' VideoConferenceScreen: Error sending raise hand: $e', e, null, 'video_conference_screen');
                  // Revert state on error
                  if (mounted) {
                    setState(() {
                      _handRaised = !newState;
                    });
                  }
                }
              },
              onLeave: () async {
                final shouldLeave = await _showLeaveMeetingDialog();
                if (shouldLeave == true) {
                  await _disconnectAndExit();
                }
              },
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

  Future<void> _disconnectAndExit() async {
    try {
      Logger.debug(' VideoConferenceScreen: User confirmed leave', 'video_conference_screen');
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      await liveKitService.disconnect();
    } catch (e) {
      Logger.error(' VideoConferenceScreen: Error during disconnect: $e', e, null, 'video_conference_screen');
    } finally {
      if (mounted) {
        Navigator.pop(context, 'left_meeting');
      }
    }
  }

  Widget _buildVideoGrid(LiveKitService liveKitService) {
    // Create a combined list of all participants (local + remote)
    final List<dynamic> allParticipants = [];
    final isObserver = widget.participantType.toLowerCase() == 'observer';
    
    // Add local participant first if it exists (but skip if observer)
    if (liveKitService.localParticipant != null) {
      // For observers, always hide their own video tile
      if (!isObserver && !ObserverFilter.isObserver(liveKitService.localParticipant!)) {
        allParticipants.add(liveKitService.localParticipant);
      }
    }
    
    // Add remote participants (filter out observers)
    final allRemoteParticipants = liveKitService.participants;
    final visibleRemoteParticipants = ObserverFilter.filterObservers(allRemoteParticipants);
    Logger.debug(' VideoConferenceScreen: _buildVideoGrid - Total remote participants: ${allRemoteParticipants.length}, Visible (after filter): ${visibleRemoteParticipants.length}, isObserver: $isObserver', 'video_conference_screen');
    allParticipants.addAll(visibleRemoteParticipants);
    
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
      padding: const EdgeInsets.all(4.0),
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 6.0,
          mainAxisSpacing: 6.0,
          childAspectRatio: 16 / 9, // Standard video aspect ratio
        ),
        itemCount: allParticipants.length,
        itemBuilder: (context, index) {
          final participant = allParticipants[index];
          final isLocal = participant == liveKitService.localParticipant;
          
          // Get participant identity to check for raised hand
          String? participantIdentity;
          if (participant is lk.LocalParticipant) {
            participantIdentity = participant.identity;
          } else if (participant is lk.RemoteParticipant) {
            participantIdentity = participant.identity;
          }
          final hasRaisedHand = participantIdentity != null && _raisedHands.containsKey(participantIdentity);
          
          return VideoParticipantWidget(
            key: ValueKey(participantIdentity ?? participant.hashCode),
            participant: participant,
            isLocal: isLocal,
            hasRaisedHand: hasRaisedHand,
          );
        },
      ),
    );
  }

  Widget _buildParticipantStage(LiveKitService liveKitService) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final isObserver = widget.participantType.toLowerCase() == 'observer';
    
    // Count visible participants (excluding observers)
    final allParticipants = <dynamic>[];
    if (liveKitService.localParticipant != null) {
      // Don't count observer's own tile - always hide if user is observer
      if (!isObserver && !ObserverFilter.isObserver(liveKitService.localParticipant!)) {
        allParticipants.add(liveKitService.localParticipant);
      }
    }
    allParticipants.addAll(ObserverFilter.filterObservers(liveKitService.participants));
    final participantCount = allParticipants.length;

    final stageChildren = <Widget>[
      Padding(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + spacing.md,
          left: spacing.xs,
          right: spacing.xs,
        ),
        child: MeetingInfoBar(
          title: widget.participantName,
          duration: _callDuration,
          participantCount: participantCount,
          isSpeakerOn: liveKitService.speakerEnabled,
          showObserverBadge: isObserver,
          onSpeakerTap: () {
            liveKitService.toggleSpeaker();
          },
        ),
      ),
      Expanded(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            spacing.xs,
            spacing.md,
            spacing.xs,
            0,
          ),
          child: _buildParticipantBody(liveKitService),
        ),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: stageChildren,
    );
  }

  Widget _buildParticipantBody(LiveKitService liveKitService) {
    final isObserver = widget.participantType.toLowerCase() == 'observer';
    final participants = <dynamic>[];
    
    // Add local participant (but skip if observer)
    if (liveKitService.localParticipant != null) {
      // Always hide observer's own video tile
      if (!isObserver && !ObserverFilter.isObserver(liveKitService.localParticipant!)) {
        participants.add(liveKitService.localParticipant);
      }
    }
    
    // Add remote participants (filter out observers)
    final allRemoteParticipants = liveKitService.participants;
    final visibleRemoteParticipants = ObserverFilter.filterObservers(allRemoteParticipants);
    Logger.debug(' VideoConferenceScreen: _buildParticipantBody - Total remote participants: ${allRemoteParticipants.length}, Visible (after filter): ${visibleRemoteParticipants.length}, isObserver: $isObserver', 'video_conference_screen');
    participants.addAll(visibleRemoteParticipants);

    // Check if anyone is screen sharing
    final screenSharingParticipant = liveKitService.screenSharingParticipant;
    final hasScreenShare = liveKitService.hasAnyScreenShare;

    Logger.debug(' VideoConferenceScreen: _buildParticipantBody - hasScreenShare: $hasScreenShare, screenSharingParticipant: ${screenSharingParticipant?.identity}, total participants: ${participants.length}', 'video_conference_screen');

    if (hasScreenShare && screenSharingParticipant != null) {
      // Screen share mode: Show screen share prominently with other participants in slider
      final otherParticipants = participants.where((p) => p != screenSharingParticipant).toList();
      Logger.debug(' VideoConferenceScreen: Screen share mode - Screen sharer: ${screenSharingParticipant.identity}, Other participants: ${otherParticipants.length}', 'video_conference_screen');
      return _buildScreenShareLayout(
        liveKitService, 
        screenSharingParticipant, 
        participants,
        key: ValueKey('screen_share_${screenSharingParticipant.identity}_${hasScreenShare}'),
      );
    }

    if (participants.isEmpty || participants.length == 1) {
      final participant =
          participants.isNotEmpty ? participants.first : null;
      return ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFF1B1B2B),
                Color(0xFF0E0E16),
              ],
            ),
          ),
          child: participant == null
              ? const Center(
                  child: Text(
                    'Waiting for participants...',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                )
              : VideoParticipantWidget(
                  key: ValueKey(participant.identity ?? participant.hashCode),
                  participant: participant,
                  isLocal: participant == liveKitService.localParticipant,
                  hasRaisedHand: _raisedHands.containsKey(participant.identity),
                ),
        ),
      );
    }

    return _buildVideoGrid(liveKitService);
  }
  
  Widget _buildScreenShareLayout(
    LiveKitService liveKitService,
    dynamic screenSharingParticipant,
    List<dynamic> allParticipants, {
    Key? key,
  }) {
    // Filter out the screen sharing participant from the list
    final otherParticipants = allParticipants
        .where((p) => p != screenSharingParticipant)
        .toList();
    
    Logger.debug(' VideoConferenceScreen: Building screen share layout - Screen sharer: ${screenSharingParticipant.identity}, Other participants: ${otherParticipants.length}', 'video_conference_screen');
    
    // Create a PageView controller for swiping between screen share and participants
    return _ScreenSharePageView(
      key: key,
      screenSharingParticipant: screenSharingParticipant,
      otherParticipants: otherParticipants,
      liveKitService: liveKitService,
      raisedHands: _raisedHands,
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 20),
          Text(
            'Connecting to room...',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, String error) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: AppColors.danger),
          const SizedBox(height: 20),
          Text(
            'Connection Error',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          Text(
            error,
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: [
              OutlinedButton(
                onPressed: _connectToRoom,
                child: const Text('Retry Connection'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, 'left_meeting'),
                child: const Text('Leave Meeting'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReconnectState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off, size: 64, color: AppColors.textMuted),
          const SizedBox(height: 16),
          Text(
            'You are not connected',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          Text(
            'Please check your connection or try reconnecting to the room.',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _connectToRoom,
            child: const Text('Reconnect'),
          )
        ],
      ),
    );
  }

  Widget _buildScreenShareBanner(LiveKitService service) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.danger.withOpacity(0.9),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.danger.withOpacity(0.4),
            blurRadius: 18,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.screen_share, color: AppColors.textPrimary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'You are sharing your screen',
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(color: AppColors.textPrimary),
            ),
          ),
          TextButton(
            onPressed: () => service.stopScreenSharing(),
            child: const Text('Stop'),
          ),
        ],
      ),
    );
  }

  void _showParticipantsModal(BuildContext context, LiveKitService liveKitService) {
    AppBottomSheet.show(
      context: context,
      title: 'Manage Participants',
      trailing: IconButton(
        icon: const Icon(Icons.close, color: AppColors.textSecondary),
        onPressed: () => Navigator.of(context).pop(),
      ),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.6,
          child: ParticipantManagerWidget(
            participantType: widget.participantType,
            roomName: widget.roomName,
          ),
        ),
      ],
    );
  }

  void _startCallTimer() {
    _callTimer?.cancel();
    _callDuration = Duration.zero;
    // Use AnimatedBuilder pattern to avoid setState every second
    _callTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      // Only update if duration actually changed (avoid unnecessary rebuilds)
      final newDuration = _callDuration + const Duration(seconds: 1);
      if (newDuration != _callDuration) {
        setState(() {
          _callDuration = newDuration;
        });
      }
    });
  }

  double _connectionScore(LiveKitService service) {
    if (!service.isConnected) return 0;
    final participants = service.participants.length;
    final hasScreenShare = service.isScreenSharing;
    double score = 0.8;
    if (participants > 5) score -= 0.1;
    if (hasScreenShare) score -= 0.05;
    return score.clamp(0.3, 1.0);
  }

  void _showReactionPicker(BuildContext context) {
    AppBottomSheet.show(
      context: context,
      title: 'Send Reaction',
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.0,
          ),
          itemCount: 7, // Number of reactions
          itemBuilder: (context, index) {
            final reactions = ['👍', '❤️', '😂', '👏', '🎉', '😮', '🙌'];
            final reaction = reactions[index];
            return GestureDetector(
              onTap: () {
                Navigator.of(context).pop();
                _handleReactionSelected(reaction);
              },
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppColors.outline.withOpacity(0.6),
                    width: 1,
                  ),
                ),
                child: Center(
                  child: Text(
                    reaction,
                    style: const TextStyle(fontSize: 32),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  void _handleReactionSelected(String reactionType) async {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    
    // Play sound immediately
    _soundService.playReactionSound(reactionType);
    
    // Add local floating reaction
    final screenSize = MediaQuery.of(context).size;
    _reactionsManager.addReaction(reactionType, screenSize);
    // Reactions widget will update via its own state management
    
    // Send reaction data
    try {
      await liveKitService.sendReactionData(reactionType);
    } catch (e) {
      Logger.error(' VideoConferenceScreen: Error sending reaction: $e', e, null, 'video_conference_screen');
    }
  }

  List<MeetingQuickAction> _buildQuickActions(
    BuildContext context,
    LiveKitService liveKitService,
  ) {
    final actions = <MeetingQuickAction>[];
    final isObserver = widget.participantType.toLowerCase() == 'observer';
    final isHost = widget.participantType.toLowerCase() == 'host';
    
    // For observers, no quick actions
    if (isObserver) {
      return actions;
    }
    
    // Manage Participants - only for hosts, show with pro badge if disabled
    if (isHost) {
      final canManageParticipants = widget.roomFeatures?.enableManageParticipants == true;
      actions.add(
        MeetingQuickAction(
          icon: Icons.group,
          title: 'Manage Participants',
          showProBadge: !canManageParticipants,
          isDisabled: !canManageParticipants,
          onTap: canManageParticipants
              ? () {
                  _showParticipantsModal(context, liveKitService);
                }
              : () {
                  _showProFeatureDialog(context, 'Manage Participants');
                },
        ),
      );
    }
    
    // Screen Sharing - not available for observers
    if (!isObserver) {
      actions.add(
        MeetingQuickAction(
          icon: liveKitService.isScreenSharing
              ? Icons.stop_screen_share
              : Icons.screen_share,
          title: liveKitService.isScreenSharing
              ? 'Stop screen share'
              : 'Start screen share',
          onTap: () {
            if (liveKitService.isScreenSharing) {
              liveKitService.stopScreenSharing();
            } else {
              liveKitService.startScreenSharing();
            }
          },
        ),
      );
    }
    
    // Whiteboard - only works if collaborative whiteboard is enabled (PRO feature), not for observers
    if (!isObserver) {
      final canUseWhiteboard = widget.roomFeatures?.enableCollaborativeWhiteboard == true;
      actions.add(
        MeetingQuickAction(
          icon: Icons.draw,
          title: liveKitService.isWhiteboardOpen
              ? 'Close whiteboard'
              : 'Open whiteboard',
          showProBadge: !canUseWhiteboard,
          isDisabled: !canUseWhiteboard,
          onTap: canUseWhiteboard
              ? () => liveKitService.toggleWhiteboard()
              : () {
                  _showProFeatureDialog(context, 'Collaborative Whiteboard');
                },
        ),
      );
    }
    
    // Reactions - show with pro badge if disabled, not for observers
    if (!isObserver) {
      final canUseReactions = widget.roomFeatures?.enableReactions == true;
      actions.add(
        MeetingQuickAction(
          icon: Icons.sentiment_satisfied_alt,
          title: 'Send Reaction',
          showProBadge: !canUseReactions,
          isDisabled: !canUseReactions,
          onTap: canUseReactions
              ? () {
                  _showReactionPicker(context);
                }
              : () {
                  _showProFeatureDialog(context, 'Reactions');
                },
        ),
      );
    }
    
    // Noise Cancellation - show with pro badge if disabled, not for observers
    if (!isObserver) {
      final canUseNoiseCancellation = widget.roomFeatures?.enableNoiseCancellation == true;
      actions.add(
        MeetingQuickAction(
          icon: liveKitService.isNoiseCancellationEnabled
              ? Icons.hearing_disabled
              : Icons.hearing,
          title: liveKitService.isNoiseCancellationEnabled
              ? 'Disable Noise Cancellation'
              : 'Enable Noise Cancellation',
          showProBadge: !canUseNoiseCancellation,
          isDisabled: !canUseNoiseCancellation,
          isHighlighted: liveKitService.isNoiseCancellationEnabled,
          onTap: canUseNoiseCancellation
              ? () async {
                  Logger.debug(' VideoConference: Toggling noise cancellation from quick actions...', 'video_conference_screen');
                  await liveKitService.toggleNoiseCancellation();
                  Logger.debug(' VideoConference: Noise cancellation toggled, new state: ${liveKitService.isNoiseCancellationEnabled}', 'video_conference_screen');
                  // UI will update via Consumer/Selector automatically
                }
              : () {
                  _showProFeatureDialog(context, 'Noise Cancellation');
                },
        ),
      );
    }
    
    // Recording - show with pro badge if disabled (host only)
    if (isHost) {
      final canRecord = widget.roomFeatures?.canRecord == true;
      actions.add(
        MeetingQuickAction(
          icon: Icons.radio_button_unchecked,
          title: liveKitService.isRecording ? 'Stop recording' : 'Start recording',
          isHighlighted: liveKitService.isRecording,
          highlightColor: AppColors.danger,
          showProBadge: !canRecord,
          isDisabled: !canRecord,
          onTap: canRecord
              ? () async {
                  try {
                    if (liveKitService.isRecording) {
                      await ApiService.stopRecording(roomName: widget.roomName);
                      liveKitService.setServerRecordingState(false);
                    } else {
                      await ApiService.startRecording(roomName: widget.roomName);
                      liveKitService.setServerRecordingState(true, startTime: DateTime.now());
                    }
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            Icon(Icons.error_outline, color: Colors.white),
                            SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Failed to ${liveKitService.isRecording ? "stop" : "start"} recording: $e',
                                style: TextStyle(color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                        backgroundColor: AppColors.danger,
                        duration: const Duration(seconds: 3),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  }
                }
              : () {
                  _showProFeatureDialog(context, 'Recording');
                },
        ),
      );
    }

    return actions;
  }

  void _showProFeatureDialog(BuildContext context, String featureName) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceElevated,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'PRO',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 1,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Premium Feature',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          content: Text(
            '$featureName is available in the Pro plan. Upgrade to unlock this feature and more.',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Close',
                style: TextStyle(color: AppColors.textMuted),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                // TODO: Navigate to subscription page
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Upgrade to Pro'),
            ),
          ],
        );
      },
    );
  }
}

// Swipeable participant slider widget for screen share mode
class _ParticipantSliderWidget extends StatefulWidget {
  final List<dynamic> participants;
  final LiveKitService liveKitService;
  final Map<String, bool> raisedHands;

  const _ParticipantSliderWidget({
    required this.participants,
    required this.liveKitService,
    required this.raisedHands,
  });

  @override
  State<_ParticipantSliderWidget> createState() => _ParticipantSliderWidgetState();
}

class _ParticipantSliderWidgetState extends State<_ParticipantSliderWidget> {
  late PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.participants.isEmpty) {
      return const SizedBox.shrink();
    }

    Logger.debug(' ParticipantSliderWidget: Building slider with ${widget.participants.length} participants', 'video_conference_screen');

    // Calculate number of pages (4 participants per page)
    const participantsPerPage = 4;
    final pageCount = (widget.participants.length / participantsPerPage).ceil();

    return Container(
      constraints: const BoxConstraints(maxHeight: 120),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.5),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Container(
                color: AppColors.overlayDark.withOpacity(0.95),
                height: 100,
                child: PageView.builder(
                  controller: _pageController,
                  scrollDirection: Axis.horizontal,
                  itemCount: pageCount,
                  onPageChanged: (index) {
                    setState(() {
                      _currentPage = index;
                    });
                  },
                  itemBuilder: (context, pageIndex) {
                    final startIndex = pageIndex * participantsPerPage;
                    final endIndex = (startIndex + participantsPerPage).clamp(0, widget.participants.length);
                    final pageParticipants = widget.participants.sublist(startIndex, endIndex);

                    Logger.debug(' ParticipantSliderWidget: Building page $pageIndex with ${pageParticipants.length} participants', 'video_conference_screen');

                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: pageParticipants.map((participant) {
                          return Expanded(
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppColors.outline.withOpacity(0.5),
                                  width: 2,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.3),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(11),
                                child: AspectRatio(
                                  aspectRatio: 16 / 9,
                                  child: VideoParticipantWidget(
                                    key: ValueKey(participant.identity ?? participant.hashCode),
                                    participant: participant,
                                    isLocal: participant == widget.liveKitService.localParticipant,
                                    hasRaisedHand: widget.raisedHands.containsKey(participant.identity),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
          // Page indicator dots
          if (pageCount > 1)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(pageCount, (index) {
                  return Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _currentPage == index
                          ? AppColors.primary
                          : AppColors.outline.withOpacity(0.5),
                    ),
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }
}

// Full-screen PageView for screen share mode - swipe between screen share and participants
class _ScreenSharePageView extends StatefulWidget {
  final dynamic screenSharingParticipant;
  final List<dynamic> otherParticipants;
  final LiveKitService liveKitService;
  final Map<String, bool> raisedHands;

  const _ScreenSharePageView({
    Key? key,
    required this.screenSharingParticipant,
    required this.otherParticipants,
    required this.liveKitService,
    required this.raisedHands,
  }) : super(key: key);

  @override
  State<_ScreenSharePageView> createState() => _ScreenSharePageViewState();
}

class _ScreenSharePageViewState extends State<_ScreenSharePageView> {
  late PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // PageView for swiping between screen share and participants
        PageView(
          controller: _pageController,
          onPageChanged: (index) {
            setState(() {
              _currentPage = index;
            });
          },
          children: [
            // Page 0: Screen share (full screen)
            ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.black,
                ),
                child: VideoParticipantWidget(
                  key: ValueKey(widget.screenSharingParticipant.identity ?? widget.screenSharingParticipant.hashCode),
                  participant: widget.screenSharingParticipant,
                  isLocal: widget.screenSharingParticipant == widget.liveKitService.localParticipant,
                  hasRaisedHand: widget.raisedHands.containsKey(widget.screenSharingParticipant.identity),
                ),
              ),
            ),
            // Page 1: Other participants in grid view
            if (widget.otherParticipants.isNotEmpty)
              _buildParticipantsGrid(widget.otherParticipants, widget.liveKitService)
            else
              const Center(
                child: Text(
                  'No other participants',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
          ],
        ),
        // Page indicator at the top
        Positioned(
          top: MediaQuery.of(context).padding.top + 16,
          left: 0,
          right: 0,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildPageIndicator(0, 'Screen Share'),
              const SizedBox(width: 16),
              _buildPageIndicator(1, 'Participants'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPageIndicator(int pageIndex, String label) {
    final isActive = _currentPage == pageIndex;
    return GestureDetector(
      onTap: () {
        _pageController.animateToPage(
          pageIndex,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive 
              ? AppColors.primary.withOpacity(0.2)
              : AppColors.overlayDark.withOpacity(0.5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? AppColors.primary : AppColors.outline.withOpacity(0.3),
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isActive ? AppColors.primary : AppColors.outline.withOpacity(0.5),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primary : AppColors.textSecondary,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildParticipantsGrid(List<dynamic> participants, LiveKitService liveKitService) {
    if (participants.isEmpty) {
      return const Center(
        child: Text(
          'No other participants',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      );
    }

    // Calculate grid layout based on number of participants
    int crossAxisCount = 1;
    if (participants.length <= 2) {
      crossAxisCount = 1;
    } else if (participants.length <= 4) {
      crossAxisCount = 2;
    } else if (participants.length <= 9) {
      crossAxisCount = 3;
    } else {
      crossAxisCount = 4;
    }

    return Padding(
      padding: const EdgeInsets.all(4.0),
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 6.0,
          mainAxisSpacing: 6.0,
          childAspectRatio: 16 / 9,
        ),
        itemCount: participants.length,
        itemBuilder: (context, index) {
          final participant = participants[index];
          final isLocal = participant == liveKitService.localParticipant;
          
          String? participantIdentity;
          if (participant is lk.LocalParticipant) {
            participantIdentity = participant.identity;
          } else if (participant is lk.RemoteParticipant) {
            participantIdentity = participant.identity;
          }
          final hasRaisedHand = participantIdentity != null && widget.raisedHands.containsKey(participantIdentity);
          
          // Use key to prevent unnecessary rebuilds when participant list changes
          return VideoParticipantWidget(
            key: ValueKey(participantIdentity ?? index),
            participant: participant,
            isLocal: isLocal,
            hasRaisedHand: hasRaisedHand,
          );
        },
      ),
    );
  }
}
