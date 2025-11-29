import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../ui/components/modal/app_error_dialog.dart';
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
import '../widgets/pdf_viewer_widget.dart';
import '../widgets/file_sharing_widget.dart';
import '../services/reaction_sound_service.dart';
import '../services/api_service.dart';
import '../models/room.dart';
import '../utils/observer_filter.dart';
import '../utils/responsive.dart';
import 'room_entry_screen.dart';

class VideoConferenceScreen extends StatefulWidget {
  final String roomName;
  final String participantName;
  final String participantType;
  final bool initialCameraEnabled;
  final bool initialMicEnabled;
  final bool initialSpeakerEnabled;
  final RoomFeatures? roomFeatures;
  final bool joinedFromDeepLink; // Track if joined from deep link

  const VideoConferenceScreen({
    super.key,
    required this.roomName,
    required this.participantName,
    required this.participantType,
    this.initialCameraEnabled = true,
    this.initialMicEnabled = true,
    this.initialSpeakerEnabled = true,
    this.roomFeatures,
    this.joinedFromDeepLink = false, // Default to false for manual joins
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
  bool _isScreenShareFullScreen = false;
  dynamic _fullScreenScreenSharingParticipant;
  Map<String, bool> _fullScreenRaisedHands = {};
  bool _isNavigatingAway = false; // Prevent multiple navigation attempts
  
  // PDF viewer state
  bool _isPdfViewerOpen = false;
  Map<String, dynamic>? _selectedPdfFile;
  bool _isFileSharingOpen = false;
  String? _pendingFileUpload; // Store file path if widget is disposed during file picker
  
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
    Logger.debug(' VideoConferenceScreen: Disposing widget', 'video_conference_screen');
    _callTimer?.cancel();
    _pipService?.removeListener(_onPipStateChanged);
    _pipService?.dispose();
    WidgetsBinding.instance.removeObserver(this);
    // Reset navigation flag on dispose
    _isNavigatingAway = false;
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
        // Don't enter PiP mode if file sharing is open (file picker might be active)
        // This prevents the widget from being disposed during file selection
        if (_isFileSharingOpen) {
          // Just enable background mode for LiveKit, but don't enter PiP
          liveKitService.enableBackgroundMode();
          Logger.debug('App paused/inactive but file sharing is open, skipping PiP mode', 'video_conference_screen');
          break;
        }
        
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
        
        // Process pending file upload if file sharing widget is open
        if (_pendingFileUpload != null && _isFileSharingOpen && mounted) {
          // File was selected but widget might have been disposed
          // Re-open file sharing to process the upload
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _pendingFileUpload != null) {
              // The FileSharingWidget should handle the file when it's recreated
              // For now, just clear the pending upload - the widget will handle it
              setState(() {
                _pendingFileUpload = null;
              });
            }
          });
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
        // Show modern error dialog
        AppErrorDialog.showFromError(
          context: context,
          error: e,
          onRetry: () {
            Navigator.of(context).pop(); // Close dialog
            _connectToRoom(); // Retry connection
          },
          onDismiss: () {
            Navigator.of(context).pop(); // Close dialog
            Navigator.of(context).pop(); // Go back to previous screen
          },
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

    // PDF viewer callback
    liveKitService.setPdfViewerDataCallback((data) {
      if (!mounted) return;
      
      final type = data['type'] as String?;
      final localIdentity = liveKitService.localParticipant?.identity;
      final sender = data['sender'] as String?;
      
      Logger.debug('PDF Viewer Data Received: type=$type, sender=$sender, localIdentity=$localIdentity, participantType=${widget.participantType}', 'video_conference_screen');
      Logger.debug('PDF Viewer Data: isHost=${data['isHost']}, file=${data['file']}', 'video_conference_screen');
      
      // Only guests should respond to host's PDF viewer controls
      final isGuest = widget.participantType.toLowerCase() != 'host';
      
      // Check if message is from host (isHost flag or sender contains _host_)
      // Handle different boolean representations (true, "true", 1, etc.)
      final isHostFlag = data['isHost'];
      final isHostFromFlag = isHostFlag == true || 
                            isHostFlag == 'true' || 
                            isHostFlag == 1;
      final isHostFromSender = sender != null && sender.toLowerCase().contains('_host_');
      final isHostMessage = isHostFromFlag || isHostFromSender;
      
      Logger.debug('PDF Viewer: isGuest=$isGuest, isHostFromFlag=$isHostFromFlag, isHostFromSender=$isHostFromSender, isHostMessage=$isHostMessage, senderMatch=${sender == localIdentity}', 'video_conference_screen');
      
      // For guests: respond to host's PDF viewer controls
      // Handle close events first (simpler logic - just check if it's from host)
      if (type == 'pdf_viewer_close' && isGuest && sender != localIdentity) {
        // Close if message is from host (check both flag and sender identity)
        if (isHostMessage || sender?.toLowerCase().contains('_host_') == true) {
          Logger.debug('PDF viewer close received from host, closing PDF viewer', 'video_conference_screen');
          setState(() {
            _isPdfViewerOpen = false;
            _selectedPdfFile = null;
          });
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Host closed PDF viewer')),
            );
          }
          return; // Early return after handling close
        }
      }
      
      // Handle open events
      if (isGuest && sender != localIdentity && isHostMessage) {
        Logger.debug('PDF Viewer: Processing host message - type=$type', 'video_conference_screen');
        // Handle PDF viewer open
        if (type == 'pdf_viewer_open') {
          final fileData = data['file'];
          if (fileData != null) {
            Logger.debug('PDF viewer open received from host, opening PDF viewer. File: $fileData', 'video_conference_screen');
            try {
              Map<String, dynamic> fileMap;
              if (fileData is Map<String, dynamic>) {
                fileMap = fileData;
              } else if (fileData is Map) {
                fileMap = Map<String, dynamic>.from(fileData);
              } else {
                Logger.warning('File data is not a Map, cannot process', 'video_conference_screen');
                return;
              }
              setState(() {
                _selectedPdfFile = fileMap;
                _isPdfViewerOpen = true;
              });
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Host opened PDF: ${fileMap['originalName'] ?? 'PDF'}')),
                );
              }
            } catch (e) {
              Logger.error('Error processing PDF file data: $e', e, null, 'video_conference_screen');
            }
          } else {
            Logger.warning('PDF viewer open received but file data is null', 'video_conference_screen');
          }
        }
      } else if (type != 'pdf_viewer_close') {
        Logger.debug('PDF Viewer: Conditions not met - isGuest=$isGuest, senderMatch=${sender == localIdentity}, isHostMessage=$isHostMessage, type=$type', 'video_conference_screen');
      }
      
      // Fallback: Handle open events if sender contains _host_ but isHostMessage check failed
      // This ensures synchronization works even if the flag is not set or parsed incorrectly
      if (type == 'pdf_viewer_open' && isGuest && sender != localIdentity && !isHostMessage) {
        final senderIsHost = sender?.toLowerCase().contains('_host_') == true;
        Logger.debug('PDF Viewer: Fallback check - senderIsHost=$senderIsHost', 'video_conference_screen');
        if (senderIsHost) {
          final fileData = data['file'];
          if (fileData != null) {
            Logger.debug('PDF viewer open received (fallback - sender contains _host_), opening PDF viewer', 'video_conference_screen');
            try {
              Map<String, dynamic> fileMap;
              if (fileData is Map<String, dynamic>) {
                fileMap = fileData;
              } else if (fileData is Map) {
                fileMap = Map<String, dynamic>.from(fileData);
              } else {
                Logger.warning('File data is not a Map (fallback), cannot process', 'video_conference_screen');
                return;
              }
              setState(() {
                _selectedPdfFile = fileMap;
                _isPdfViewerOpen = true;
              });
            } catch (e) {
              Logger.error('Error processing PDF file data (fallback): $e', e, null, 'video_conference_screen');
            }
          }
        }
      }
    });
  }

  Future<void> _broadcastPdfViewerOpen(Map<String, dynamic> file) async {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    final room = liveKitService.room;
    final localParticipant = liveKitService.localParticipant;

    if (room == null || localParticipant == null) return;

    try {
      final openData = {
        'type': 'pdf_viewer_open',
        'fileId': file['id'],
        'pageNumber': 1,
        'sender': localParticipant.identity,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'id': 'open-${DateTime.now().millisecondsSinceEpoch}',
        'isHost': true,
        'file': file,
      };
      await liveKitService.sendPdfAnnotationData(openData);
    } catch (e) {
      Logger.error('Error broadcasting PDF open: $e', e, null, 'video_conference_screen');
    }
  }

  Future<void> _broadcastPdfViewerClose() async {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    final room = liveKitService.room;
    final localParticipant = liveKitService.localParticipant;

    if (room == null || localParticipant == null || _selectedPdfFile == null) return;

    try {
      final closeData = {
        'type': 'pdf_viewer_close',
        'fileId': _selectedPdfFile!['id'],
        'pageNumber': 1,
        'sender': localParticipant.identity,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'id': 'close-${DateTime.now().millisecondsSinceEpoch}',
        'isHost': true,
      };
      await liveKitService.sendPdfAnnotationData(closeData);
    } catch (e) {
      Logger.error('Error broadcasting PDF close: $e', e, null, 'video_conference_screen');
    }
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

                // Check if we're navigating away before showing reconnect state
                // This prevents showing "You are not connected" when user is intentionally leaving
                if (!liveKitService.isConnected && !_isNavigatingAway) {
                  return _buildReconnectState(context);
                }

                // If navigating away, show leaving state instead of reconnect state
                if (_isNavigatingAway) {
                  return _buildLeavingState(context);
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
                    // Full screen overlay for screen sharing - renders at top level to fill entire screen
                    if (_isScreenShareFullScreen && _fullScreenScreenSharingParticipant != null)
                      Positioned.fill(
                        child: _buildFullScreenOverlay(context, liveKitService),
                      ),
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
                    // PDF Viewer
                    if (_isPdfViewerOpen && 
                        widget.roomFeatures?.enablePdfViewer == true)
                      Positioned.fill(
                        child: PdfViewerWidget(
                          isOpen: _isPdfViewerOpen,
                          onClose: () async {
                            // Broadcast close if host
                            if (widget.participantType.toLowerCase() == 'host' && 
                                _selectedPdfFile != null) {
                              await _broadcastPdfViewerClose();
                            }
                            if (mounted) {
                              setState(() {
                                _isPdfViewerOpen = false;
                                _selectedPdfFile = null;
                              });
                            }
                          },
                          file: _selectedPdfFile,
                          roomName: widget.roomName,
                          isHost: widget.participantType.toLowerCase() == 'host',
                        ),
                      ),
                    // File Sharing
                    if (_isFileSharingOpen && 
                        widget.roomFeatures?.enableFileSharing == true)
                      Positioned.fill(
                        child: FileSharingWidget(
                          isOpen: _isFileSharingOpen,
                          onClose: () {
                            setState(() {
                              _isFileSharingOpen = false;
                            });
                          },
                          roomName: widget.roomName,
                          isHost: widget.participantType.toLowerCase() == 'host',
                          onFileSelect: (file) {
                            if (file['fileType'] == 'application/pdf') {
                              setState(() {
                                _selectedPdfFile = file;
                                _isPdfViewerOpen = true;
                                _isFileSharingOpen = false;
                              });
                              // Broadcast PDF open if host
                              if (widget.participantType.toLowerCase() == 'host') {
                                _broadcastPdfViewerOpen(file);
                              }
                            }
                          },
                          onFileSelected: (filePath) async {
                            // Process file upload directly here, so it continues even if widget is disposed
                            // This handles the case where the app enters PiP mode during file picker
                            try {
                              Logger.debug('Processing file upload from parent: $filePath', 'video_conference_screen');
                              final file = File(filePath);
                              final liveKitService = Provider.of<LiveKitService>(context, listen: false);
                              final uploadedBy = liveKitService.localParticipant?.identity ?? 'unknown';
                              
                              final uploadedFile = await ApiService.uploadRoomFile(
                                roomName: widget.roomName,
                                file: file,
                                uploadedBy: uploadedBy,
                              );
                              
                              // Broadcast file upload
                              final uploadData = {
                                'type': 'file_upload',
                                'file': uploadedFile,
                                'sender': uploadedBy,
                              };
                              await liveKitService.sendPdfAnnotationData(uploadData);
                              
                              // Reload files in the widget if it's still open
                              if (mounted && _isFileSharingOpen) {
                                // Trigger a rebuild to refresh the file list
                                setState(() {
                                  _pendingFileUpload = null;
                                });
                              }
                              
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('File uploaded successfully'),
                                    backgroundColor: AppColors.success,
                                  ),
                                );
                              }
                            } catch (e) {
                              Logger.error('Error uploading file from parent: $e', e, null, 'video_conference_screen');
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Upload failed: $e'),
                                    backgroundColor: AppColors.danger,
                                  ),
                                );
                              }
                            }
                          },
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
        bottomBar: (_isChatVisible || _isScreenShareFullScreen || _isPdfViewerOpen)
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
    Logger.debug(' VideoConferenceScreen: User confirmed leave', 'video_conference_screen');
    
    // Prevent multiple navigation attempts
    if (_isNavigatingAway) {
      Logger.warning('Navigation already in progress, ignoring duplicate call', 'video_conference_screen');
      return;
    }
    
    _isNavigatingAway = true;
    
    // Disconnect from LiveKit first
    try {
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      await liveKitService.disconnect();
      Logger.debug(' VideoConferenceScreen: Disconnected from LiveKit', 'video_conference_screen');
    } catch (e) {
      Logger.error(' VideoConferenceScreen: Error during disconnect: $e', e, null, 'video_conference_screen');
      // Continue with exit/navigation even if disconnect fails
    }
    
    // Wait longer to ensure disconnect completes and state is fully reset
    await Future.delayed(const Duration(milliseconds: 500));
    
    // If joined from deep link, exit the app instead of navigating
    if (widget.joinedFromDeepLink) {
      Logger.info(' VideoConferenceScreen: Joined from deep link, exiting app', 'video_conference_screen');
      try {
        // Use SystemNavigator.pop() which is the recommended way to exit app
        SystemNavigator.pop();
      } catch (e) {
        Logger.error('SystemNavigator.pop() failed, trying exit(0): $e', e, null, 'video_conference_screen');
        // Fallback to exit(0) if SystemNavigator fails
        exit(0);
      }
      return;
    }
    
    // For manual joins, navigate to RoomEntryScreen
    // Capture context before async operations to ensure it's valid
    final BuildContext? navigationContext = mounted ? context : null;
    
    if (navigationContext == null) {
      Logger.warning('Context not available, cannot navigate', 'video_conference_screen');
      return;
    }
    
    // Add additional delay to ensure widget tree is stable before navigation
    await Future.delayed(const Duration(milliseconds: 200));
    
    // Check if widget is still mounted
    if (!mounted) {
      Logger.warning('Widget not mounted after delays, cannot navigate', 'video_conference_screen');
      return;
    }
    
    // Navigate using post-frame callback to ensure navigation happens after current frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Double-check widget is still mounted
      if (!mounted) {
        Logger.warning('Widget not mounted in post-frame callback', 'video_conference_screen');
        return;
      }
      
      // Try to get a valid context
      BuildContext? ctx;
      try {
        ctx = navigationContext;
        // Verify context is still valid
        if (ctx != null && !mounted) {
          ctx = null;
        }
      } catch (e) {
        Logger.warning('Context validation failed: $e', 'video_conference_screen');
        ctx = null;
      }
      
      if (ctx == null || !mounted) {
        Logger.warning('No valid context available for navigation', 'video_conference_screen');
        return;
      }
      
      // Use pushAndRemoveUntil with a predicate that keeps the first route
      // This ensures Navigator always has at least one route while clearing the stack
      
      // Try rootNavigator first
      try {
        final rootNavigator = Navigator.of(ctx, rootNavigator: true);
        // Push RoomEntryScreen and remove all routes except the first one
        // The first route will be kept, then RoomEntryScreen will be on top
        rootNavigator.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (context) => const RoomEntryScreen(),
            settings: const RouteSettings(name: '/room-entry'),
          ),
          (route) {
            // Keep the first route to ensure Navigator is never empty
            // RoomEntryScreen will be pushed on top of it
            return route.isFirst;
          },
        );
        Logger.debug(' VideoConferenceScreen: Successfully navigated using rootNavigator (pushAndRemoveUntil)', 'video_conference_screen');
        return;
      } catch (e) {
        Logger.warning('Navigation with rootNavigator failed, trying fallback: $e', 'video_conference_screen');
      }
      
      // Fallback: try regular navigator with same approach
      if (!mounted) return;
      try {
        final navigator = Navigator.of(ctx);
        navigator.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (context) => const RoomEntryScreen(),
            settings: const RouteSettings(name: '/room-entry'),
          ),
          (route) => route.isFirst,
        );
        Logger.debug(' VideoConferenceScreen: Successfully navigated using regular navigator (pushAndRemoveUntil)', 'video_conference_screen');
        return;
      } catch (e) {
        Logger.warning('Navigation with regular navigator failed, trying last resort: $e', 'video_conference_screen');
      }
      
      // Last resort: pop until first, then replace
      if (!mounted) return;
      try {
        final navigator = Navigator.of(ctx);
        if (navigator.canPop()) {
          navigator.popUntil((route) => route.isFirst);
        }
        navigator.pushReplacement(
          MaterialPageRoute(
            builder: (context) => const RoomEntryScreen(),
          ),
        );
        Logger.debug(' VideoConferenceScreen: Successfully navigated using popUntil + pushReplacement (last resort)', 'video_conference_screen');
      } catch (e) {
        Logger.error('All navigation methods failed: $e', e, null, 'video_conference_screen');
      }
    });
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

    // Calculate responsive grid layout based on number of participants and device type
    final crossAxisCount = Responsive.getVideoGridColumns(context, allParticipants.length);
    final spacing = Responsive.spacing(context, phone: 6.0, tablet: 8.0);
    final padding = Responsive.padding(context, all: 4.0);

    return Padding(
      padding: padding,
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: spacing,
          mainAxisSpacing: spacing,
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
    final isLandscape = Responsive.isLandscape(context);
    
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

    // Adjust spacing based on orientation - reduce in landscape to prevent overflow
    final topPadding = MediaQuery.of(context).padding.top + (isLandscape ? spacing.xs : spacing.md);
    final horizontalPadding = spacing.xs;
    final bodyTopPadding = isLandscape ? spacing.xs : spacing.md;

    final stageChildren = <Widget>[
      Padding(
        padding: EdgeInsets.only(
          top: topPadding,
          left: horizontalPadding,
          right: horizontalPadding,
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
            horizontalPadding,
            bodyTopPadding,
            horizontalPadding,
            0,
          ),
          child: _buildParticipantBody(liveKitService),
        ),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
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

    // Reset full screen state if screen sharing stopped
    if (!hasScreenShare && _isScreenShareFullScreen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _isScreenShareFullScreen = false;
            _fullScreenScreenSharingParticipant = null;
            _fullScreenRaisedHands = {};
          });
          SystemChrome.setEnabledSystemUIMode(
            SystemUiMode.edgeToEdge,
            overlays: SystemUiOverlay.values,
          );
        }
      });
    }

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
    
    // Ensure we log when returning to normal mode
    if (!hasScreenShare) {
      Logger.debug(' VideoConferenceScreen: No screen share - returning to normal participant view', 'video_conference_screen');
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
    // Include the screen sharing participant in the participants list for page 1
    // They will show their camera feed (not screen share) in the participants grid
    // The screen share will be shown on page 0 (main area)
    // Priority: Screen share in main area, camera in participants section
    final participantsWithCamera = allParticipants.toList();
    
    Logger.debug(' VideoConferenceScreen: Building screen share layout - Screen sharer: ${screenSharingParticipant.identity}, Total participants (including screen sharer camera): ${participantsWithCamera.length}', 'video_conference_screen');
    Logger.debug(' VideoConferenceScreen: Priority - Screen share in main area (page 0), Camera in participants section (page 1)', 'video_conference_screen');
    
    // Create a PageView controller for swiping between screen share and participants
    return _ScreenSharePageView(
      key: key,
      screenSharingParticipant: screenSharingParticipant,
      otherParticipants: participantsWithCamera, // Include screen sharer to show their camera
      liveKitService: liveKitService,
      raisedHands: _raisedHands,
      isParentFullScreen: _isScreenShareFullScreen,
      onFullScreenChanged: (isFullScreen, participant, raisedHands) {
        setState(() {
          _isScreenShareFullScreen = isFullScreen;
          _fullScreenScreenSharingParticipant = participant;
          _fullScreenRaisedHands = raisedHands ?? {};
        });
      },
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

  Widget _buildLeavingState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 20),
          Text(
            'Leaving meeting...',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, String error) {
    // Show error dialog when error state is displayed
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        AppErrorDialog.showFromError(
          context: context,
          error: error,
          onRetry: () {
            Navigator.of(context).pop(); // Close dialog
            _connectToRoom(); // Retry connection
          },
          onDismiss: () {
            Navigator.of(context).pop(); // Close dialog
            Navigator.of(context).pop(); // Go back to previous screen
          },
        );
      }
    });

    // Return loading state while dialog is shown
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 20),
          Text(
            'Handling error...',
            style: Theme.of(context).textTheme.titleMedium,
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

  Widget _buildFullScreenOverlay(BuildContext context, LiveKitService liveKitService) {
    // Get orientation and screen size for responsive layout
    final orientation = MediaQuery.of(context).orientation;
    final padding = MediaQuery.of(context).padding;
    
    return LayoutBuilder(
      builder: (context, constraints) {
        // Get full screen dimensions - these will update automatically on orientation change
        final fullWidth = constraints.maxWidth;
        final fullHeight = constraints.maxHeight;
        
        Logger.debug(' VideoConferenceScreen: Full screen overlay - Orientation: $orientation, Size: ${fullWidth}x${fullHeight}', 'video_conference_screen');
        
        return Stack(
          children: [
            // Full screen video - fills entire screen regardless of orientation
            Positioned.fill(
              child: Container(
                width: fullWidth,
                height: fullHeight,
                color: Colors.black,
                child: VideoParticipantWidget(
                  key: ValueKey('${_fullScreenScreenSharingParticipant.identity}_${orientation}_${fullWidth}_${fullHeight}'),
                  participant: _fullScreenScreenSharingParticipant,
                  isLocal: _fullScreenScreenSharingParticipant == liveKitService.localParticipant,
                  hasRaisedHand: _fullScreenRaisedHands.containsKey(_fullScreenScreenSharingParticipant.identity),
                ),
              ),
            ),
            // Exit full screen button - positioned based on orientation and safe area
            Positioned(
              top: padding.top + 16,
              right: 16,
              child: Material(
                color: AppColors.overlayDark.withOpacity(0.8),
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () {
                    setState(() {
                      _isScreenShareFullScreen = false;
                      _fullScreenScreenSharingParticipant = null;
                      _fullScreenRaisedHands = {};
                    });
                    SystemChrome.setEnabledSystemUIMode(
                      SystemUiMode.edgeToEdge,
                      overlays: SystemUiOverlay.values,
                    );
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    child: const Icon(
                      Icons.fullscreen_exit,
                      color: AppColors.textPrimary,
                      size: 24,
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
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
    
    // File Sharing - not for observers
    if (!isObserver) {
      final canUseFileSharing = widget.roomFeatures?.enableFileSharing == true;
      actions.add(
        MeetingQuickAction(
          icon: Icons.folder,
          title: _isFileSharingOpen ? 'Close file sharing' : 'File sharing',
          showProBadge: !canUseFileSharing,
          isDisabled: !canUseFileSharing,
          onTap: canUseFileSharing
              ? () {
                  setState(() {
                    _isFileSharingOpen = !_isFileSharingOpen;
                  });
                }
              : () {
                  _showProFeatureDialog(context, 'File Sharing');
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

    // Calculate responsive participants per page (more on tablets)
    final participantsPerPage = Responsive.value(
      context,
      phone: 4,
      tablet: 6,
    );
    final pageCount = (widget.participants.length / participantsPerPage).ceil();
    final sliderHeight = Responsive.value(
      context,
      phone: 100.0,
      tablet: 120.0,
    );
    final margin = Responsive.spacing(context, phone: 16.0, tablet: 24.0);

    return Container(
      constraints: BoxConstraints(maxHeight: sliderHeight + 30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: EdgeInsets.symmetric(horizontal: margin),
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
                height: sliderHeight,
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
  final bool isParentFullScreen;
  final Function(bool, dynamic, Map<String, bool>?) onFullScreenChanged;

  const _ScreenSharePageView({
    Key? key,
    required this.screenSharingParticipant,
    required this.otherParticipants,
    required this.liveKitService,
    required this.raisedHands,
    required this.isParentFullScreen,
    required this.onFullScreenChanged,
  }) : super(key: key);

  @override
  State<_ScreenSharePageView> createState() => _ScreenSharePageViewState();
}

class _ScreenSharePageViewState extends State<_ScreenSharePageView> with WidgetsBindingObserver {
  late PageController _pageController;
  int _currentPage = 0;
  bool _isFullScreen = false;
  bool _previousHasScreenShare = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pageController = PageController(initialPage: 0);
    _previousHasScreenShare = widget.liveKitService.hasAnyScreenShare;
    _currentPage = 0; // Ensure we start at page 0
    
    // Listen to screen sharing state changes
    widget.liveKitService.addListener(_onScreenShareStateChanged);
  }

  /// Helper function to check if a participant has both screen share and camera tracks
  bool _participantHasBothTracks(dynamic participant) {
    bool hasScreenShare = false;
    bool hasCamera = false;
    
    if (participant is lk.LocalParticipant) {
      for (final publication in participant.videoTrackPublications) {
        if (publication.track != null && !publication.muted) {
          final name = publication.name?.toLowerCase() ?? '';
          final sid = publication.sid ?? '';
          final isScreenShare = name.contains('screen') || 
                              name.contains('screenshare') ||
                              name.contains('screen-share') ||
                              sid.contains('screen');
          if (isScreenShare) {
            hasScreenShare = true;
          } else {
            hasCamera = true;
          }
        }
      }
    } else if (participant is lk.RemoteParticipant) {
      for (final publication in participant.videoTrackPublications) {
        if (publication.track != null && publication.subscribed && !publication.muted) {
          final name = publication.name?.toLowerCase() ?? '';
          final sid = publication.sid ?? '';
          
          // Check explicit indicators first
          bool isScreenShare = name.contains('screen') || 
                              name.contains('screenshare') ||
                              name.contains('screen-share') ||
                              sid.contains('screen');
          
          // If no explicit indicator, use heuristic for empty names
          if (!isScreenShare && name.isEmpty) {
            final videoTrackCount = participant.videoTrackPublications.length;
            final isCameraEnabled = participant.isCameraEnabled();
            // For multiple tracks: empty name is likely screen share
            // For single track: only if camera is disabled
            if (videoTrackCount > 1) {
              isScreenShare = true;
            } else if (!isCameraEnabled) {
              isScreenShare = true;
            }
          }
          
          if (isScreenShare) {
            hasScreenShare = true;
          } else {
            hasCamera = true;
          }
        }
      }
    }
    
    return hasScreenShare && hasCamera;
  }

  @override
  void didUpdateWidget(_ScreenSharePageView oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // Sync full screen state with parent
    if (oldWidget.isParentFullScreen && !widget.isParentFullScreen && _isFullScreen) {
      // Parent exited full screen, sync child state
      setState(() {
        _isFullScreen = false;
      });
      SystemChrome.setEnabledSystemUIMode(
        SystemUiMode.edgeToEdge,
        overlays: SystemUiOverlay.values,
      );
    }
    
    // Check if screen sharing stopped - this widget should be removed from tree when screen sharing stops
    // but if it's still here, reset everything
    final currentHasScreenShare = widget.liveKitService.hasAnyScreenShare;
    if (_previousHasScreenShare && !currentHasScreenShare) {
      // Screen sharing stopped - reset to page 0 and exit full screen if active
      Logger.debug(' VideoConferenceScreen: Screen sharing stopped in didUpdateWidget, resetting state', 'video_conference_screen');
      if (_isFullScreen) {
        _exitFullScreen();
      }
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
      setState(() {
        _currentPage = 0;
      });
    }
    _previousHasScreenShare = currentHasScreenShare;
  }

  void _onScreenShareStateChanged() {
    if (!mounted) return;
    
    final currentHasScreenShare = widget.liveKitService.hasAnyScreenShare;
    if (_previousHasScreenShare && !currentHasScreenShare) {
      // Screen sharing stopped - reset to page 0 and exit full screen if active
      Logger.debug(' VideoConferenceScreen: Screen sharing stopped (listener), resetting state', 'video_conference_screen');
      if (_isFullScreen) {
        _exitFullScreen();
      }
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
      setState(() {
        _currentPage = 0;
      });
    }
    _previousHasScreenShare = currentHasScreenShare;
  }

  @override
  void dispose() {
    widget.liveKitService.removeListener(_onScreenShareStateChanged);
    WidgetsBinding.instance.removeObserver(this);
    _pageController.dispose();
    // Ensure we exit full screen on dispose
    if (_isFullScreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }

  void _enterFullScreen() {
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.immersiveSticky,
      overlays: [],
    );
    setState(() {
      _isFullScreen = true;
    });
    // Notify parent about full screen state change
    widget.onFullScreenChanged(true, widget.screenSharingParticipant, widget.raisedHands);
    Logger.debug(' VideoConferenceScreen: Entered full screen mode', 'video_conference_screen');
  }

  void _exitFullScreen() {
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.edgeToEdge,
      overlays: SystemUiOverlay.values,
    );
    setState(() {
      _isFullScreen = false;
    });
    // Notify parent about full screen state change
    widget.onFullScreenChanged(false, null, null);
    Logger.debug(' VideoConferenceScreen: Exited full screen mode', 'video_conference_screen');
  }

  @override
  Widget build(BuildContext context) {
    // When in full screen mode, still render the PageView but it will be hidden by the overlay
    // This ensures the widget tree is maintained and state is preserved
    // The parent overlay will cover it, but we keep the structure intact

    // Normal mode with PageView
    return Stack(
      children: [
        // PageView for swiping between screen share and participants
        PageView(
          controller: _pageController,
          onPageChanged: (index) {
            setState(() {
              _currentPage = index;
              // Exit full screen if user swipes to participants page
              if (index == 1 && _isFullScreen) {
                _exitFullScreen();
              }
            });
          },
          children: [
            // Page 0: Screen share (and camera if available)
            _buildScreenSharePage(widget.screenSharingParticipant, widget.liveKitService),
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
        // Top bar with page indicators and full screen button
        Positioned(
          top: MediaQuery.of(context).padding.top + 16,
          left: 16,
          right: 16,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: Page indicators aligned to the left
              Row(
                mainAxisAlignment: MainAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildPageIndicator(0, 'Screen Share'),
                  const SizedBox(width: 12),
                  _buildPageIndicator(1, 'Participants'),
                ],
              ),
              // Right: Full screen button (only on screen share page)
              if (_currentPage == 0)
                IconButton(
                  onPressed: _enterFullScreen,
                  icon: const Icon(
                    Icons.fullscreen,
                    color: AppColors.textPrimary,
                    size: 24,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  visualDensity: VisualDensity.compact,
                )
              else
                const SizedBox.shrink(), // No spacer needed
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isActive ? AppColors.primary : AppColors.outline.withOpacity(0.5),
              ),
            ),
            const SizedBox(width: 10),
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

  /// Builds the screen share page (Page 0) - shows ONLY screen share (camera appears in participants section)
  Widget _buildScreenSharePage(dynamic participant, LiveKitService liveKitService) {
    // Always show only screen share in main area - camera will appear in participants section
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.black,
        ),
        child: VideoParticipantWidget(
          key: ValueKey('${participant.identity}_screenshare_main'),
          participant: participant,
          isLocal: participant == liveKitService.localParticipant,
          hasRaisedHand: widget.raisedHands.containsKey(participant.identity),
          forceScreenShareOnly: true, // Force screen share only - camera will be in participants section
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

    // Calculate responsive grid layout based on number of participants and device type
    final crossAxisCount = Responsive.getVideoGridColumns(context, participants.length);
    final spacing = Responsive.spacing(context, phone: 6.0, tablet: 8.0);
    final padding = Responsive.padding(context, all: 4.0);

    return Padding(
      padding: padding,
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: spacing,
          mainAxisSpacing: spacing,
          childAspectRatio: 16 / 9,
        ),
        itemCount: participants.length,
        itemBuilder: (context, index) {
          final participant = participants[index];
          final isLocal = participant == liveKitService.localParticipant;
          final isScreenSharingParticipant = participant == widget.screenSharingParticipant;
          
          String? participantIdentity;
          if (participant is lk.LocalParticipant) {
            participantIdentity = participant.identity;
          } else if (participant is lk.RemoteParticipant) {
            participantIdentity = participant.identity;
          }
          final hasRaisedHand = participantIdentity != null && widget.raisedHands.containsKey(participantIdentity);
          
          // If this is the screen sharing participant, show their camera feed (not screen share)
          // Use a special key to differentiate from the screen share view
          return VideoParticipantWidget(
            key: ValueKey('${participantIdentity ?? index}_camera_${isScreenSharingParticipant}'),
            participant: participant,
            isLocal: isLocal,
            hasRaisedHand: hasRaisedHand,
            forceCameraOnly: isScreenSharingParticipant, // Force camera only for screen sharing participant
          );
        },
      ),
    );
  }
}
