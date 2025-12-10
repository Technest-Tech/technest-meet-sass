import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:permission_handler/permission_handler.dart';
import '../utils/logger.dart';
import '../utils/debouncer.dart';
import '../models/room.dart';
import 'api_service.dart';
import 'screen_capture_service.dart';
import 'screen_recording_service.dart';
import 'noise_cancellation_service.dart';
import 'connection_monitor_service.dart';
import 'network_adapter_service.dart';
import 'adaptive_stream_manager.dart';
import '../store/media_quality_store.dart';

class LiveKitService extends ChangeNotifier {
  lk.Room? _room;
  bool _isConnected = false;
  bool _isConnecting = false;
  String? _error;
  List<lk.RemoteParticipant> _participants = [];
  lk.LocalParticipant? _localParticipant;
  bool _isScreenSharing = false;
  bool _isStartingScreenShare = false;
  bool _isWhiteboardOpen = false;
  bool _speakerEnabled = true;
  final NoiseCancellationService _noiseCancellation = NoiseCancellationService();
  bool _isRecording = false;
  bool _isRecordingPaused = false; // Track pause state
  bool _isProcessingRecording = false;
  bool _isSimpleRecording = false; // Track if using simple recording
  String? _currentRoomName;
  DateTime? _recordingStartTime;
  Duration _pausedDuration = Duration.zero; // Track total paused time
  DateTime? _pauseStartTime; // Track when pause started
  String? _lastEgressId; // Store egress ID for download
  final ScreenRecordingService _screenRecordingService = ScreenRecordingService();
  
  // Connection stability
  Timer? _keepaliveTimer;
  Timer? _connectionMonitorTimer;
  DateTime? _lastConnectionTime;
  int _disconnectionCount = 0;
  
  // Store connection details for reconnection
  String? _lastLivekitUrl;
  String? _lastToken;
  String? _lastRoomName;
  String? _lastParticipantName;
  String? _lastParticipantType;
  
  // Reconnection state
  int _reconnectionAttempts = 0;
  static const int MAX_RECONNECTION_ATTEMPTS = 5;
  Timer? _reconnectionTimer;
  
  // Screen share optimization - store original camera settings
  // Note: VideoPreset type not available in SDK, storing as reference only
  String? _originalCameraPreset;
  int? _originalCameraBitrate;
  
  // Adaptive streaming services
  ConnectionMonitorService? _connectionMonitor;
  NetworkAdapterService? _networkAdapter;
  AdaptiveStreamManager? _adaptiveStreamManager;
  MediaQualityStore? _qualityStore;
  
  // Data listener for whiteboard collaboration
  lk.EventsListener<lk.RoomEvent>? _dataListener;
  lk.EventsListener<lk.RoomEvent>? _participantListener;
  
  // Debouncer for notifyListeners to prevent excessive rebuilds
  final Debouncer _notifyDebouncer = Debouncer(delay: const Duration(milliseconds: 100));

  // Getters
  lk.Room? get room => _room;
  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  String? get error => _error;
  List<lk.RemoteParticipant> get participants => _participants;
  lk.LocalParticipant? get localParticipant => _localParticipant;
  bool get isScreenSharing => _isScreenSharing;
  bool get isStartingScreenShare => _isStartingScreenShare;
  
  // Check if any participant (local or remote) is screen sharing
  bool get hasAnyScreenShare {
    // Check local participant
    if (_localParticipant != null) {
      for (final publication in _localParticipant!.videoTrackPublications) {
        final name = publication.name?.toLowerCase() ?? '';
        final sid = publication.sid ?? '';
        final isScreenShare = name.contains('screen') || 
                              name.contains('screenshare') ||
                              name.contains('screen-share') ||
                              sid.contains('screen');
        if (isScreenShare && publication.track != null) {
          Logger.debug('LiveKit: Found local screen share - name: $name, sid: $sid', 'LiveKitService');
          return true;
        }
      }
    }
    
    // Check remote participants
    for (final participant in _participants) {
      final videoTracks = participant.videoTrackPublications;
      final videoTrackCount = videoTracks.length;
      
      // If participant has multiple video tracks, one is likely screen share
      // If they have 1 track and it's high resolution, it might be screen share
      if (videoTrackCount > 1) {
        // Multiple tracks - check each one
        for (final publication in videoTracks) {
          final name = publication.name?.toLowerCase() ?? '';
          final sid = publication.sid ?? '';
          final isSubscribed = publication.subscribed;
          final hasTrack = publication.track != null;
          
          Logger.debug('LiveKit: Checking remote track - participant: ${participant.identity}, name: $name, sid: $sid, subscribed: $isSubscribed, hasTrack: $hasTrack', 'LiveKitService');
          
          // Check explicit indicators first
          bool isScreenShare = name.contains('screen') || 
                              name.contains('screenshare') ||
                              name.contains('screen-share') ||
                              sid.contains('screen');
          
          // If no explicit indicator and multiple tracks, empty name might be screen share
          if (!isScreenShare && name.isEmpty && videoTrackCount > 1 && isSubscribed && hasTrack) {
            Logger.debug('LiveKit: Using heuristic - empty name with multiple tracks = likely screen share', 'LiveKitService');
            isScreenShare = true;
          }
          
          if (isScreenShare && isSubscribed && hasTrack) {
            Logger.debug('LiveKit: Found remote screen share (multiple tracks) - participant: ${participant.identity}, name: $name, sid: $sid', 'LiveKitService');
            return true;
          }
        }
      } else if (videoTrackCount == 1) {
        // Single track - check explicit indicators first, then use heuristic if needed
        final publication = videoTracks.first;
        final name = publication.name?.toLowerCase() ?? '';
        final sid = publication.sid ?? '';
        final isSubscribed = publication.subscribed;
        final hasTrack = publication.track != null;
        final track = publication.track;
        
        Logger.debug('LiveKit: Checking remote track - participant: ${participant.identity}, name: $name, sid: $sid, subscribed: $isSubscribed, hasTrack: $hasTrack', 'LiveKitService');
        
        // Check explicit screen share indicators first
        bool isScreenShare = name.contains('screen') || 
                            name.contains('screenshare') ||
                            name.contains('screen-share') ||
                            sid.contains('screen');
        
        // If no explicit indicator, use heuristic: empty name + subscribed + track exists
        // This handles web clients that don't set track names for screen share
        if (!isScreenShare && name.isEmpty && isSubscribed && hasTrack && track != null) {
          // Additional check: if camera is disabled, the single track is likely screen share
          final isCameraEnabled = participant.isCameraEnabled();
          if (!isCameraEnabled) {
            Logger.debug('LiveKit: Using heuristic - empty name, camera off, single track = likely screen share', 'LiveKitService');
            isScreenShare = true;
          }
        }
        
        if (isScreenShare && isSubscribed && hasTrack) {
          Logger.debug('LiveKit: Found remote screen share (single track) - participant: ${participant.identity}, name: $name, sid: $sid', 'LiveKitService');
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Get the participant who is screen sharing (local or remote)
  dynamic? get screenSharingParticipant {
    // Collect all screen sharing participants (both local and remote)
    // Priority: Check ALL participants (remote first, then local) and return the FIRST active screen sharer
    // This ensures ANY participant's screen share can replace the current one in the main area
    // When a new participant starts screen sharing, it will be shown in the main screen share section
    
    Logger.debug('LiveKit: Checking for screen sharing participants - Remote count: ${_participants.length}, Local: ${_localParticipant?.identity ?? "null"}', 'LiveKitService');
    
    // First, check ALL remote participants (to allow remote screen shares to replace local/host ones)
    for (final participant in _participants) {
      final participantIdentity = participant.identity ?? 'unknown';
      Logger.debug('LiveKit: Checking remote participant: $participantIdentity', 'LiveKitService');
      
      // Check if participant has screen share enabled (if method exists)
      try {
        if (participant is lk.RemoteParticipant) {
          final isScreenShareEnabled = participant.isScreenShareEnabled();
          Logger.debug('LiveKit: Participant $participantIdentity - isScreenShareEnabled: $isScreenShareEnabled', 'LiveKitService');
          
          if (isScreenShareEnabled) {
            // Double-check by looking at tracks
            final videoTracks = participant.videoTrackPublications;
            bool foundScreenShareTrack = false;
            
            for (final publication in videoTracks) {
              final name = publication.name?.toLowerCase() ?? '';
              final sid = publication.sid ?? '';
              final source = publication.source.toString().toLowerCase();
              final isSubscribed = publication.subscribed;
              final hasTrack = publication.track != null;
              
              Logger.debug('LiveKit: Track check - name: "$name", sid: "$sid", source: "$source", subscribed: $isSubscribed, hasTrack: $hasTrack', 'LiveKitService');
              
              // Check multiple indicators for screen share
              bool isScreenShare = name.contains('screen') || 
                                  name.contains('screenshare') ||
                                  name.contains('screen-share') ||
                                  sid.contains('screen') ||
                                  source.contains('screen');
              
              if (isScreenShare && isSubscribed && hasTrack) {
                foundScreenShareTrack = true;
                Logger.debug('LiveKit: ✅ Found screen share track for participant: $participantIdentity', 'LiveKitService');
                break;
              }
            }
            
            if (foundScreenShareTrack) {
              Logger.debug('LiveKit: ✅ Returning screen sharing participant (remote): $participantIdentity', 'LiveKitService');
              return participant;
            }
          }
        }
      } catch (e) {
        Logger.warning('LiveKit: Error checking isScreenShareEnabled for $participantIdentity: $e', 'LiveKitService');
      }
      
      // Fallback: Check tracks directly if isScreenShareEnabled doesn't work
      final videoTracks = participant.videoTrackPublications;
      final videoTrackCount = videoTracks.length;
      Logger.debug('LiveKit: Participant $participantIdentity has $videoTrackCount video track(s)', 'LiveKitService');
      
      for (final publication in videoTracks) {
        final name = publication.name?.toLowerCase() ?? '';
        final sid = publication.sid ?? '';
        final source = publication.source.toString().toLowerCase();
        final isSubscribed = publication.subscribed;
        final hasTrack = publication.track != null;
        
        // Check explicit indicators first
        bool isScreenShare = name.contains('screen') || 
                            name.contains('screenshare') ||
                            name.contains('screen-share') ||
                            sid.contains('screen') ||
                            source.contains('screen');
        
        // If no explicit indicator and multiple tracks, check if this is the screen share track
        if (!isScreenShare && videoTrackCount > 1 && isSubscribed && hasTrack) {
          // If camera is enabled, the other track is likely screen share
          try {
            final isCameraEnabled = participant.isCameraEnabled();
            if (isCameraEnabled && (name.isEmpty || name == 'camera' || source.contains('camera'))) {
              // This is likely the camera track, skip it
              continue;
            } else if (!isCameraEnabled || name.isEmpty) {
              // Likely screen share if camera is off or name is empty
              Logger.debug('LiveKit: Using heuristic - participant has multiple tracks, this might be screen share', 'LiveKitService');
              isScreenShare = true;
            }
          } catch (e) {
            // If we can't check camera, use empty name as indicator
            if (name.isEmpty) {
              Logger.debug('LiveKit: Using heuristic - empty name with multiple tracks = likely screen share', 'LiveKitService');
              isScreenShare = true;
            }
          }
        }
        
        if (isScreenShare && isSubscribed && hasTrack) {
          Logger.debug('LiveKit: ✅ Found screen share for participant (remote): $participantIdentity', 'LiveKitService');
          return participant;
        }
      }
    }
    
    // Then check local participant (fallback if no remote screen shares)
    if (_localParticipant != null) {
      Logger.debug('LiveKit: Checking local participant: ${_localParticipant!.identity}', 'LiveKitService');
      
      try {
        final isScreenShareEnabled = _localParticipant!.isScreenShareEnabled();
        Logger.debug('LiveKit: Local participant - isScreenShareEnabled: $isScreenShareEnabled', 'LiveKitService');
        
        if (isScreenShareEnabled) {
          Logger.debug('LiveKit: ✅ Returning screen sharing participant (local): ${_localParticipant!.identity}', 'LiveKitService');
          return _localParticipant;
        }
      } catch (e) {
        Logger.warning('LiveKit: Error checking local isScreenShareEnabled: $e', 'LiveKitService');
      }
      
      // Fallback: Check tracks directly
      for (final publication in _localParticipant!.videoTrackPublications) {
        final name = publication.name?.toLowerCase() ?? '';
        final sid = publication.sid ?? '';
        final source = publication.source.toString().toLowerCase();
        final isScreenShare = name.contains('screen') || 
                            name.contains('screenshare') ||
                            name.contains('screen-share') ||
                            sid.contains('screen') ||
                            source.contains('screen');
        if (isScreenShare && publication.track != null) {
          Logger.debug('LiveKit: ✅ Returning screen sharing participant (local, fallback): ${_localParticipant!.identity}', 'LiveKitService');
          return _localParticipant;
        }
      }
    }
    
    Logger.debug('LiveKit: ❌ No screen sharing participant found', 'LiveKitService');
    return null;
  }
  bool get isWhiteboardOpen => _isWhiteboardOpen;
  List<Map<String, dynamic>> get chatMessages => List.unmodifiable(_chatMessages);
  bool get speakerEnabled => _speakerEnabled;
  bool get isRecording => _isRecording;
  bool get isRecordingPaused => _isRecordingPaused;
  bool get isProcessingRecording => _isProcessingRecording;
  DateTime? get recordingStartTime => _recordingStartTime;
  

  // Connect to room
  Future<void> connectToRoom({
    required String roomName,
    required String participantName,
    required String participantType,
    bool cameraEnabled = true,
    bool microphoneEnabled = true,
    bool speakerEnabled = true,
  }) async {
    try {
      _isConnecting = true;
      _error = null;
      notifyListeners();

      Logger.debug('Starting connection to room: $roomName', 'LiveKitService');

      // Request permissions
      Logger.debug('Requesting permissions...', 'LiveKitService');
      await _requestPermissions();
      Logger.debug('Permissions granted', 'LiveKitService');

      // Get LiveKit token
      Logger.debug('Getting LiveKit token...', 'LiveKitService');
      LiveKitTokenResponse tokenResponse;
      
      try {
        tokenResponse = await ApiService.getLiveKitToken(
          roomName: roomName,
          participantName: participantName,
          participantType: participantType,
        );
        Logger.debug('Token received: ${tokenResponse.livekitUrl}', 'LiveKitService');
      } on RoomRestrictedException catch (e) {
        // If room doesn't allow multi participants and user is not host, retry as host
        if (e.isMultiParticipantsRestricted && participantType.toUpperCase() != 'HOST') {
          Logger.debug('Room restriction detected - multi participants not allowed. Retrying as HOST...', 'LiveKitService');
          try {
            tokenResponse = await ApiService.getLiveKitToken(
              roomName: roomName,
              participantName: participantName,
              participantType: 'HOST', // Retry as host
            );
            Logger.debug('Token received as HOST: ${tokenResponse.livekitUrl}', 'LiveKitService');
          } catch (retryError) {
            Logger.error(' LiveKit: Failed to connect as HOST after restriction: $retryError', retryError, null, 'LiveKitService');
            _isConnecting = false;
            _error = 'Room access restricted. Unable to connect as host.';
            notifyListeners();
            rethrow;
          }
        } else {
          // Other restriction types or already host - rethrow
          Logger.error(' LiveKit: Room access restricted: $e', e, null, 'LiveKitService');
          _isConnecting = false;
          _error = e.message;
          notifyListeners();
          rethrow;
        }
      } on RoomNotFoundException catch (e) {
        Logger.error(' LiveKit: Room not found: $e', e, null, 'LiveKitService');
        _isConnecting = false;
        _error = 'Room not found';
        notifyListeners();
        rethrow;
      }

      // Create room
      Logger.debug('Creating room instance...', 'LiveKitService');
      _room = lk.Room();
      
      // Reset screen sharing state when connecting to a new room
      _isScreenSharing = false;

      // Add event listeners
      Logger.debug('Adding event listeners...', 'LiveKitService');
      _room!.addListener(_onRoomChanged);
      
      // Add explicit participant event listeners to catch participants joining/leaving
      // This is especially important for observers joining rooms already in progress
      _participantListener = _room!.createListener();
      _participantListener!.on<lk.ParticipantConnectedEvent>((event) {
        Logger.debug('LiveKit: Participant connected - ${event.participant.identity}, metadata: ${event.participant.metadata}', 'LiveKitService');
        _onRoomChanged(); // Trigger immediate update
      });

      _participantListener!.on<lk.ParticipantDisconnectedEvent>((event) {
        Logger.debug('LiveKit: Participant disconnected - ${event.participant.identity}', 'LiveKitService');
        _onRoomChanged(); // Trigger immediate update
      });

      // Track subscription events to ensure observers can see participants
      _participantListener!.on<lk.TrackSubscribedEvent>((event) {
        final trackName = event.publication.name ?? event.publication.sid ?? 'unknown';
        Logger.debug('LiveKit: Track subscribed - participant: ${event.participant.identity}, track: $trackName', 'LiveKitService');
        _onRoomChanged(); // Trigger update when tracks are subscribed
      });
      
      // Add data received listener for whiteboard collaboration
      _dataListener = _room!.createListener();
      _dataListener!.on<lk.DataReceivedEvent>(_onDataReceived);

          // Connect to room with enhanced stability options
      Logger.debug('Connecting to LiveKit server...', 'LiveKitService');
      Logger.debug('LiveKit URL: ${tokenResponse.livekitUrl}', 'LiveKitService');
      Logger.debug('Token length: ${tokenResponse.token.length}', 'LiveKitService');
      
      // Set connection options for better reliability and stability
      // Enable background audio/video for PiP support
      final connectOptions = lk.ConnectOptions(
        autoSubscribe: true,
      );
      
      // Try connection with retry logic
      int retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          Logger.debug('LiveKit: Connection attempt ${retryCount + 1}/$maxRetries', 'LiveKitService');
          
          // Add a small delay between retries
          if (retryCount > 0) {
            await Future.delayed(Duration(milliseconds: 1000 * retryCount));
          }
          
          await _room!.connect(
            tokenResponse.livekitUrl,
            tokenResponse.token,
            connectOptions: connectOptions,
          );
          
          Logger.debug('LiveKit: Connection successful on attempt ${retryCount + 1}', 'LiveKitService');
          break; // Success, exit retry loop
          
        } catch (e) {
          retryCount++;
          Logger.error(' LiveKit: Connection attempt ${retryCount} failed: $e', e, null, 'LiveKitService');
          
          if (retryCount >= maxRetries) {
            Logger.error('LiveKit: All connection attempts failed', null, null, 'LiveKitService');
            rethrow; // Re-throw the last error
          }
          
          // Create a new room instance for retry
          _room?.removeListener(_onRoomChanged);
          _room = lk.Room();
          _room!.addListener(_onRoomChanged);
        }
      }
      Logger.debug('Connected to room successfully', 'LiveKitService');

      // Immediately check for existing participants (don't wait)
      if (_room != null) {
        final immediateParticipants = _room!.remoteParticipants.values.toList();
        Logger.debug('LiveKit: Immediate check - Remote participants count: ${immediateParticipants.length}', 'LiveKitService');
        Logger.debug('LiveKit: Room connection state: ${_room!.connectionState}', 'LiveKitService');
        Logger.debug('LiveKit: Local participant: ${_room!.localParticipant?.identity}', 'LiveKitService');
        
        for (final participant in immediateParticipants) {
          Logger.debug('LiveKit: Immediate participant - identity: ${participant.identity}, metadata: ${participant.metadata}', 'LiveKitService');
        }
        
        // Force an immediate update
        _onRoomChanged();
      }

      // For observers joining rooms already in progress, ensure we can see existing participants
      // Wait a bit for the room state to fully initialize
      Future.delayed(const Duration(milliseconds: 500), () async {
        if (_room != null && _room!.connectionState == lk.ConnectionState.connected) {
          // Force an initial room state update to get existing participants
          _onRoomChanged();
          
          // Log current participants for debugging
          final existingParticipants = _room!.remoteParticipants.values.toList();
          Logger.debug('LiveKit: Existing remote participants after connection: ${existingParticipants.length}', 'LiveKitService');
          
          for (final participant in existingParticipants) {
            Logger.debug('LiveKit: Existing participant - identity: ${participant.identity}, metadata: ${participant.metadata}', 'LiveKitService');
            
            // For observers, ensure subscriptions are active for all existing participants
            // This handles the case where observer joins a room already in progress
            if (participantType == 'observer') {
              // Ensure all track publications are subscribed
              // With autoSubscribe: true, subscriptions should happen automatically,
              // but we verify and log the state
              for (final publication in participant.trackPublications.values) {
                final trackName = publication.name ?? publication.sid ?? 'unknown';
                Logger.debug('Observer: Checking track - participant: ${participant.identity}, track: $trackName, subscribed: ${publication.subscribed}, kind: ${publication.kind}', 'LiveKitService');
                
                // If not subscribed and autoSubscribe didn't work, try to subscribe
                // Note: With autoSubscribe: true, this should rarely be needed
                if (!publication.subscribed) {
                  Logger.debug('Observer: Track not subscribed, waiting for auto-subscribe...', 'LiveKitService');
                  // The autoSubscribe option should handle this, but we log for debugging
                }
              }
            }
          }
          
          // Trigger another update after ensuring subscriptions
          _onRoomChanged();
          notifyListeners();
        }
      });

      _isConnected = true;
      _isConnecting = false;
      _lastConnectionTime = DateTime.now();
      _disconnectionCount = 0;
      _speakerEnabled = speakerEnabled;
      _currentRoomName = roomName;
      
      // Store connection details for potential reconnection
      _lastLivekitUrl = tokenResponse.livekitUrl;
      _lastToken = tokenResponse.token;
      _lastRoomName = roomName;
      _lastParticipantName = participantName;
      _lastParticipantType = participantType;
      _reconnectionAttempts = 0; // Reset on successful connection
      
      // Check actual local screen share state after connection
      _isScreenSharing = _checkLocalScreenShare();
      Logger.debug('LiveKit: Initial screen share state after connection: $_isScreenSharing', 'LiveKitService');
      
      notifyListeners();

      // Start connection monitoring
      _startConnectionMonitoring();

      // Enable camera, microphone, and speaker based on requested preferences
      Logger.debug('Applying device preferences (camera: $cameraEnabled, mic: $microphoneEnabled, speaker: $speakerEnabled)', 'LiveKitService');
      await Future.delayed(const Duration(milliseconds: 500));
      await _applyInitialDeviceStates(
        cameraEnabled: cameraEnabled,
        microphoneEnabled: microphoneEnabled,
        speakerEnabled: speakerEnabled,
      );
      notifyListeners();

    } on RoomRestrictedException catch (e) {
      // Already handled above, but catch here to prevent double handling
      Logger.error(' LiveKit: Room restriction error: $e', e, null, 'LiveKitService');
      _isConnecting = false;
      _isConnected = false;
      _error = e.message;
      notifyListeners();
      rethrow; // Re-throw to let UI handle it
    } on RoomNotFoundException catch (e) {
      // Already handled above, but catch here to prevent double handling
      Logger.error(' LiveKit: Room not found error: $e', e, null, 'LiveKitService');
      _isConnecting = false;
      _isConnected = false;
      _error = 'Room not found';
      notifyListeners();
      rethrow; // Re-throw to let UI handle it
    } catch (e) {
      Logger.error(' Connection failed: $e', e, null, 'LiveKitService');
      _isConnecting = false;
      _isConnected = false;
      _error = e.toString();
      notifyListeners();
      rethrow; // Re-throw to let UI handle it
    }
  }

  // Disconnect from room
  Future<void> disconnect() async {
    try {
      Logger.debug('LiveKit: Starting disconnect process', 'LiveKitService');
      
      // Stop monitoring timers
      _stopConnectionMonitoring();
      
      if (_room != null) {
        Logger.debug('LiveKit: Disconnecting from room...', 'LiveKitService');
        await _room!.disconnect();
        _room = null;
        Logger.debug('LiveKit: Room disconnected successfully', 'LiveKitService');
      } else {
        Logger.warning('LiveKit: No room to disconnect from', 'LiveKitService');
      }
      
      // Reset all state
      _isConnected = false;
      _isConnecting = false;
      _error = null;
      _participants.clear();
      _localParticipant = null;
      _isScreenSharing = false;
      _isWhiteboardOpen = false;
      _speakerEnabled = true;
      _isRecording = false;
      _isRecordingPaused = false;
      _isProcessingRecording = false;
      _isSimpleRecording = false;
      _recordingStartTime = null;
      _pausedDuration = Duration.zero;
      _pauseStartTime = null;
      _lastEgressId = null;
      _currentRoomName = null;
      _lastConnectionTime = null;
      _disconnectionCount = 0;
      _lastLivekitUrl = null;
      _lastToken = null;
      _dataListener?.dispose();
      _dataListener = null;
      _participantListener?.dispose();
      _participantListener = null;
      
      Logger.debug('LiveKit: State reset completed', 'LiveKitService');
      notifyListeners();
    } catch (e) {
      Logger.error(' LiveKit: Disconnect error: $e', e, null, 'LiveKitService');
      _error = e.toString();
      notifyListeners();
    }
  }

  // Current camera position
  lk.CameraPosition _currentCameraPosition = lk.CameraPosition.front;

  // Get current camera position
  lk.CameraPosition get currentCameraPosition => _currentCameraPosition;

  // Toggle camera
  Future<void> toggleCamera() async {
    if (_room?.localParticipant != null) {
      final isEnabled = _room!.localParticipant!.isCameraEnabled();
      await _room!.localParticipant!.setCameraEnabled(!isEnabled);
      notifyListeners();
    }
  }

  // Switch camera position (front/back)
  Future<void> switchCamera() async {
    if (_room?.localParticipant == null) {
      Logger.warning('LiveKit: Cannot switch camera - no local participant', 'LiveKitService');
      return;
    }

    try {
      final wasEnabled = _room!.localParticipant!.isCameraEnabled();
      
      // Toggle camera position
      _currentCameraPosition = _currentCameraPosition == lk.CameraPosition.front
          ? lk.CameraPosition.back
          : lk.CameraPosition.front;

      Logger.debug('LiveKit: Switching camera to ${_currentCameraPosition == lk.CameraPosition.front ? "front" : "back"}', 'LiveKitService');

      // If camera was enabled, we need to recreate the track with new position
      if (wasEnabled) {
        // Disable camera first
        await _room!.localParticipant!.setCameraEnabled(false);
        
        // Small delay to ensure track is properly stopped
        await Future.delayed(const Duration(milliseconds: 100));
        
        // Enable camera with new position
        // Note: LiveKit SDK's setCameraEnabled doesn't directly support camera position
        // We need to unpublish the current track and create a new one
        await _recreateCameraTrack();
      }
      
      notifyListeners();
    } catch (e) {
      Logger.error(' LiveKit: Failed to switch camera: $e', e, null, 'LiveKitService');
      _error = 'Failed to switch camera: $e';
      notifyListeners();
      rethrow;
    }
  }

  // Recreate camera track with current position
  Future<void> _recreateCameraTrack() async {
    if (_room?.localParticipant == null) return;

    try {
      // Find and unpublish the current camera track
      // First disable the camera to stop the current track
      await _room!.localParticipant!.setCameraEnabled(false);
      
      // Wait a moment for the track to be fully stopped
      await Future.delayed(const Duration(milliseconds: 100));
      
      // Find and remove camera track publications
      final videoPublications = _room!.localParticipant!.videoTrackPublications.toList();
      for (final publication in videoPublications) {
        // Check if this is a camera track (not screen share)
        final name = publication.name?.toLowerCase() ?? '';
        final isScreenShare = name.contains('screen') || 
                            name.contains('screenshare') ||
                            name.contains('screen-share');
        
        if (!isScreenShare && publication.track != null) {
          // Stop the track
          await publication.track!.stop();
          Logger.debug('LiveKit: Stopped old camera track', 'LiveKitService');
        }
      }

      // Create new camera track with new position
      final newTrack = await lk.LocalVideoTrack.createCameraTrack(
        lk.CameraCaptureOptions(
          cameraPosition: _currentCameraPosition,
        ),
      );

      // Publish the new track
      await _room!.localParticipant!.publishVideoTrack(newTrack);
      Logger.debug('LiveKit: Published new camera track with position: ${_currentCameraPosition == lk.CameraPosition.front ? "front" : "back"}', 'LiveKitService');
      
      // Ensure camera is enabled after publishing
      await _room!.localParticipant!.setCameraEnabled(true);
    } catch (e) {
      Logger.error(' LiveKit: Failed to recreate camera track: $e', e, null, 'LiveKitService');
      // Try to re-enable camera with old method as fallback
      try {
        await _room!.localParticipant!.setCameraEnabled(true);
      } catch (fallbackError) {
        Logger.error(' LiveKit: Fallback camera enable also failed: $fallbackError', fallbackError, null, 'LiveKitService');
      }
      rethrow;
    }
  }

  // Toggle microphone
  Future<void> toggleMicrophone() async {
    if (_room?.localParticipant != null) {
      final isEnabled = _room!.localParticipant!.isMicrophoneEnabled();
      await _room!.localParticipant!.setMicrophoneEnabled(!isEnabled);
      notifyListeners();
    }
  }

  /// Toggle noise cancellation
  Future<void> toggleNoiseCancellation() async {
    if (_room == null || _room!.localParticipant == null) return;
    
    try {
      // Find the microphone audio track by checking all audio track publications
      lk.LocalAudioTrack? micTrack;
      for (final publication in _room!.localParticipant!.audioTrackPublications) {
        final track = publication.track;
        if (track is lk.LocalAudioTrack) {
          // Check if this is a microphone track (not screen share audio)
          final name = publication.name?.toLowerCase() ?? '';
          final isMicrophone = !name.contains('screen') && 
                               !name.contains('screenshare');
          if (isMicrophone) {
            micTrack = track;
            break;
          }
        }
      }
      
      if (micTrack != null) {
        await _noiseCancellation.toggle(micTrack);
        notifyListeners();
      } else {
        Logger.warning('LiveKit: No microphone track found for noise cancellation', 'LiveKitService');
      }
    } catch (e) {
      Logger.error(' LiveKit: Failed to toggle noise cancellation: $e', e, null, 'LiveKitService');
    }
  }

  /// Check if noise cancellation is enabled
  bool get isNoiseCancellationEnabled => _noiseCancellation.isEnabled;

  Future<void> setSpeakerphoneEnabled(bool enabled, {bool notify = true}) async {
    _speakerEnabled = enabled;
    if (_room != null) {
      try {
        await _room!.setSpeakerOn(enabled);
        Logger.debug('LiveKit: Speakerphone set to ${enabled ? "on" : "off"}', 'LiveKitService');
      } catch (e) {
        Logger.warning('LiveKit: Unable to switch speaker state: $e', 'LiveKitService');
      }
    }
    if (notify) {
      notifyListeners();
    }
  }

  // Toggle speaker
  Future<void> toggleSpeaker() async {
    await setSpeakerphoneEnabled(!_speakerEnabled);
  }

  // Enable background mode for PiP
  Future<void> enableBackgroundMode() async {
    if (_room != null) {
      try {
        // Ensure audio tracks continue in background
        // LiveKit client handles this automatically, but we can ensure
        // all remote tracks are subscribed and active
        int audioTrackCount = 0;
        int videoTrackCount = 0;
        
        for (final participant in _participants) {
          for (final publication in participant.audioTrackPublications) {
            if (publication.subscribed) {
              // Track is already subscribed, will continue in background
              audioTrackCount++;
            }
          }
          for (final publication in participant.videoTrackPublications) {
            if (publication.subscribed) {
              // Track is already subscribed, will continue in background
              videoTrackCount++;
            }
          }
        }
        
        Logger.debug('LiveKit: ${audioTrackCount} audio track(s) will continue in background', 'LiveKitService');
        Logger.debug('LiveKit: ${videoTrackCount} video track(s) will continue in background', 'LiveKitService');
        Logger.debug('LiveKit: Background mode enabled - tracks will continue', 'LiveKitService');
      } catch (e) {
        Logger.warning('LiveKit: Error enabling background mode: $e', 'LiveKitService');
      }
    }
  }

  Future<void> _applyInitialDeviceStates({
    required bool cameraEnabled,
    required bool microphoneEnabled,
    required bool speakerEnabled,
  }) async {
    if (_room?.localParticipant != null) {
      try {
        await _room!.localParticipant!.setCameraEnabled(cameraEnabled);
        Logger.debug('LiveKit: Camera ${cameraEnabled ? "enabled" : "disabled"}', 'LiveKitService');
      } catch (e) {
        Logger.warning('LiveKit: Failed to set camera state: $e', 'LiveKitService');
      }

      try {
        await _room!.localParticipant!.setMicrophoneEnabled(microphoneEnabled);
        Logger.debug('LiveKit: Microphone ${microphoneEnabled ? "enabled" : "disabled"}', 'LiveKitService');
      } catch (e) {
        Logger.warning('LiveKit: Failed to set microphone state: $e', 'LiveKitService');
      }
    } else {
      Logger.warning('LiveKit: Local participant not available for device state update', 'LiveKitService');
    }

    try {
      await setSpeakerphoneEnabled(speakerEnabled, notify: false);
    } catch (e) {
      Logger.warning('LiveKit: Failed to set speaker state: $e', 'LiveKitService');
    }
  }

  // Start screen sharing
  Future<void> startScreenSharing() async {
    try {
      Logger.debug('LiveKit: Starting screen share...', 'LiveKitService');
      _isStartingScreenShare = true;
      notifyListeners();
      
      // Start the foreground service first
      await ScreenCaptureService.startService();
      
      if (_room?.localParticipant != null) {
        // Optimize camera quality before starting screen share
        await _optimizeForScreenShare();
        
        await _room!.localParticipant!.setScreenShareEnabled(true);
        // Verify the actual state after starting
        _isScreenSharing = _checkLocalScreenShare();
        Logger.debug('LiveKit: Screen share started successfully, verified state: $_isScreenSharing', 'LiveKitService');
      }
    } catch (e) {
      Logger.error(' LiveKit: Screen share failed: $e', e, null, 'LiveKitService');
      _error = e.toString();
      // Verify state even on error
      _isScreenSharing = _checkLocalScreenShare();
    } finally {
      _isStartingScreenShare = false;
      notifyListeners();
    }
  }

  // Stop screen sharing
  Future<void> stopScreenSharing() async {
    try {
      Logger.debug('LiveKit: Stopping screen share...', 'LiveKitService');
      
      if (_room?.localParticipant != null) {
        await _room!.localParticipant!.setScreenShareEnabled(false);
        // Verify the actual state after stopping
        _isScreenSharing = _checkLocalScreenShare();
        Logger.debug('LiveKit: Screen share stopped successfully, verified state: $_isScreenSharing', 'LiveKitService');
        notifyListeners();
      }
      
      // Stop the foreground service
      await ScreenCaptureService.stopService();
      
      // Restore camera quality after stopping screen share
      await _restoreCameraAfterScreenShare();
    } catch (e) {
      Logger.error(' LiveKit: Stop screen share failed: $e', e, null, 'LiveKitService');
      _error = e.toString();
      // Verify state even on error
      _isScreenSharing = _checkLocalScreenShare();
      // Still try to restore camera quality
      await _restoreCameraAfterScreenShare();
      notifyListeners();
    }
  }
  
  /// Optimize camera quality for screen sharing (reduce to preserve bandwidth)
  Future<void> _optimizeForScreenShare() async {
    if (_room?.localParticipant == null) return;
    final isCameraEnabled = _room!.localParticipant!.isCameraEnabled == true;
    if (!isCameraEnabled) return;
    
    try {
      // Store original camera settings reference
      // Note: VideoTrackSettings API not available, so we can't actually get/set quality
      // This is for future use if API becomes available
      _originalCameraPreset = 'h540'; // Reference only
      _originalCameraBitrate = 1500000; // Reference only
      
      // Note: VideoTrackSettings API is not available in LiveKit Dart SDK 2.5.0
      // Camera quality reduction during screen share is handled by SDK's adaptive streaming
      // We keep camera enabled - the SDK will automatically adjust based on bandwidth
      await _room!.localParticipant!.setCameraEnabled(true);
      Logger.debug('LiveKit: Camera kept on during screen share - quality managed by SDK adaptive streaming', 'LiveKitService');
    } catch (e) {
      Logger.warning('LiveKit: Failed to optimize camera for screen share: $e', 'LiveKitService');
    }
  }
  
  /// Restore camera quality after screen share stops
  Future<void> _restoreCameraAfterScreenShare() async {
    if (_room?.localParticipant == null) return;
    final isCameraEnabled = _room!.localParticipant!.isCameraEnabled == true;
    if (!isCameraEnabled) return;
    if (_originalCameraPreset == null || _originalCameraBitrate == null) return;
    
    try {
      // Note: VideoTrackSettings API is not available in LiveKit Dart SDK 2.5.0
      // Camera quality restoration is handled automatically by SDK's adaptive streaming
      // We just ensure camera is still enabled
      if (_originalCameraPreset != null && _originalCameraBitrate != null) {
        await _room!.localParticipant!.setCameraEnabled(true);
        Logger.debug('LiveKit: Camera quality restored by SDK adaptive streaming after screen share', 'LiveKitService');
      } else {
        Logger.debug('LiveKit: No original camera settings to restore', 'LiveKitService');
      }
      
      // Clear stored settings
      _originalCameraPreset = null;
      _originalCameraBitrate = null;
      
      Logger.debug('LiveKit: Restored camera quality after screen share', 'LiveKitService');
      
      // Also trigger adaptive stream manager to apply current quality settings
      _adaptiveStreamManager?.applyCameraQuality();
    } catch (e) {
      Logger.warning('LiveKit: Failed to restore camera quality: $e', 'LiveKitService');
    }
  }

  // Toggle whiteboard
  void toggleWhiteboard() {
    _isWhiteboardOpen = !_isWhiteboardOpen;
    
    // Send whiteboard toggle command to all participants (web version)
    final action = _isWhiteboardOpen ? 'open' : 'close';
    final data = {
      'type': 'whiteboard_toggle',
      'isHost': true,
      'action': action,
    };
    
    Logger.debug('LiveKit: Sending whiteboard toggle command - $action', 'LiveKitService');
    sendWhiteboardData(data);
    
    notifyListeners();
  }

  // Send whiteboard data
  Future<void> sendWhiteboardData(Map<String, dynamic> data) async {
    if (_room == null) {
      Logger.warning('LiveKit: Cannot send whiteboard data - no room', 'LiveKitService');
      return;
    }
    
    if (_room!.localParticipant == null) {
      Logger.warning('LiveKit: Cannot send whiteboard data - no local participant', 'LiveKitService');
      return;
    }
    
    if (!_isConnected) {
      Logger.warning('LiveKit: Cannot send whiteboard data - not connected', 'LiveKitService');
      return;
    }
    
    try {
      // Remove sender field if present (web doesn't use it)
      data.remove('sender');
      
      // Convert to JSON string using dart:convert
      final jsonString = jsonEncode(data);
      final encodedData = utf8.encode(jsonString);
      
      // Check data size limit (16KB) - same as web
      if (encodedData.length > 16384) {
        Logger.error('LiveKit: Data too large for whiteboard: ${encodedData.length} bytes', null, null, 'LiveKitService');
        return;
      }
      
      // Send with timeout
      await _room!.localParticipant!.publishData(
        encodedData,
        reliable: true,
        topic: 'whiteboard',
      ).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          Logger.error('LiveKit: Timeout sending whiteboard data', null, null, 'LiveKitService');
          throw TimeoutException('Timeout sending whiteboard data');
        },
      );
      
      Logger.debug(' LiveKit: Whiteboard data sent - ${data['type']} (${encodedData.length} bytes)');
    } on TimeoutException catch (e) {
      Logger.error(' LiveKit: Timeout sending whiteboard data: $e', e, null, 'LiveKitService');
      _error = 'Timeout: ${e.toString()}';
      notifyListeners();
    } catch (e) {
      Logger.error(' LiveKit: Failed to send whiteboard data: $e', e, null, 'LiveKitService');
      _error = e.toString();
      notifyListeners();
    }
  }

  // Whiteboard data callback
  void Function(Map<String, dynamic>)? _onWhiteboardDataReceived;

  // Set whiteboard data callback
  void setWhiteboardDataCallback(void Function(Map<String, dynamic>) callback) {
    _onWhiteboardDataReceived = callback;
  }

  // Chat data callback
  void Function(Map<String, dynamic>)? _onChatDataReceived;
  
  // Persistent chat messages storage
  final List<Map<String, dynamic>> _chatMessages = [];

  // Set chat data callback
  void setChatDataCallback(void Function(Map<String, dynamic>) callback) {
    _onChatDataReceived = callback;
  }

  // Mute control data callback
  void Function(Map<String, dynamic>)? _onMuteControlDataReceived;

  // Set mute control data callback
  void setMuteControlDataCallback(void Function(Map<String, dynamic>) callback) {
    _onMuteControlDataReceived = callback;
  }

  // Reaction data callback
  void Function(Map<String, dynamic>)? _onReactionDataReceived;

  // Set reaction data callback
  void setReactionDataCallback(void Function(Map<String, dynamic>) callback) {
    _onReactionDataReceived = callback;
  }

  // Raise hand data callback
  void Function(Map<String, dynamic>)? _onRaiseHandDataReceived;

  // Set raise hand data callback
  void setRaiseHandDataCallback(void Function(Map<String, dynamic>) callback) {
    _onRaiseHandDataReceived = callback;
  }

  // PDF viewer data callback
  void Function(Map<String, dynamic>)? _onPdfViewerDataReceived;

  // Set PDF viewer data callback
  void setPdfViewerDataCallback(void Function(Map<String, dynamic>) callback) {
    _onPdfViewerDataReceived = callback;
  }

  // Send PDF annotation data
  Future<void> sendPdfAnnotationData(Map<String, dynamic> data) async {
    if (_room == null) {
      Logger.warning('LiveKit: Cannot send PDF annotation data - no room', 'LiveKitService');
      return;
    }
    
    if (_room!.localParticipant == null) {
      Logger.warning('LiveKit: Cannot send PDF annotation data - no local participant', 'LiveKitService');
      return;
    }
    
    if (!_isConnected) {
      Logger.warning('LiveKit: Cannot send PDF annotation data - not connected', 'LiveKitService');
      return;
    }
    
    try {
      // Convert to JSON string using dart:convert
      final jsonString = jsonEncode(data);
      final encodedData = utf8.encode(jsonString);
      
      // Check data size limit (16KB) - same as web
      if (encodedData.length > 16384) {
        Logger.error('LiveKit: Data too large for PDF annotation: ${encodedData.length} bytes', null, null, 'LiveKitService');
        return;
      }
      
      // Determine topic based on data type
      String topic = 'pdf-annotation';
      if (data['type'] == 'pdf_viewer_open' || data['type'] == 'pdf_viewer_close') {
        topic = 'pdf-viewer';
      } else if (data['type'] == 'pdf_scroll_sync') {
        topic = 'pdf-scroll';
      }
      
      // Send with timeout
      await _room!.localParticipant!.publishData(
        encodedData,
        reliable: true,
        topic: topic,
      ).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          Logger.error('LiveKit: Timeout sending PDF annotation data', null, null, 'LiveKitService');
          throw TimeoutException('Timeout sending PDF annotation data');
        },
      );
      
      Logger.debug(' LiveKit: PDF annotation data sent - ${data['type']} (${encodedData.length} bytes)');
    } on TimeoutException catch (e) {
      Logger.error(' LiveKit: Timeout sending PDF annotation data: $e', e, null, 'LiveKitService');
      _error = 'Timeout: ${e.toString()}';
      notifyListeners();
    } catch (e) {
      Logger.error(' LiveKit: Failed to send PDF annotation data: $e', e, null, 'LiveKitService');
      _error = e.toString();
      notifyListeners();
    }
  }

  // Send chat data
  Future<void> sendChatData(Map<String, dynamic> data) async {
    if (_room?.localParticipant != null) {
      try {
        // Store the message locally first
        _chatMessages.add(data);
        Logger.debug('LiveKit: Stored local chat message, total messages: ${_chatMessages.length}', 'LiveKitService');
        
        // Convert to JSON string using dart:convert
        final jsonString = jsonEncode(data);
        final encodedData = utf8.encode(jsonString);
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: true,
          topic: 'chat',
        );
        Logger.debug(' LiveKit: Chat data sent - ${data['type']}');
      } catch (e) {
        Logger.error(' LiveKit: Failed to send chat data: $e', e, null, 'LiveKitService');
        _error = e.toString();
        notifyListeners();
        rethrow;
      }
    }
  }

  // Send reaction data
  Future<void> sendReactionData(String reactionType) async {
    if (_room?.localParticipant != null) {
      try {
        final reactionData = {
          'type': 'reaction',
          'reactionType': reactionType,
          'sender': _localParticipant!.identity,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'id': '${DateTime.now().millisecondsSinceEpoch}-${_localParticipant!.identity}',
        };

        final jsonString = jsonEncode(reactionData);
        final encodedData = utf8.encode(jsonString);
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: false, // Reactions don't need to be reliable
          topic: 'reaction',
        );
        Logger.debug('LiveKit: Reaction data sent - $reactionType', 'LiveKitService');
      } catch (e) {
        Logger.error(' LiveKit: Failed to send reaction data: $e', e, null, 'LiveKitService');
        _error = e.toString();
        notifyListeners();
        rethrow;
      }
    }
  }

  // Send raise hand data
  Future<void> sendRaiseHandData(bool isRaised) async {
    if (_room?.localParticipant != null) {
      try {
        final raiseHandData = {
          'type': 'raise-hand',
          'sender': _localParticipant!.identity,
          'isRaised': isRaised,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'id': '${DateTime.now().millisecondsSinceEpoch}-${_localParticipant!.identity}',
        };

        final jsonString = jsonEncode(raiseHandData);
        final encodedData = utf8.encode(jsonString);
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: true,
          topic: 'raise-hand',
        );
        Logger.debug('LiveKit: Raise hand data sent - isRaised: $isRaised', 'LiveKitService');
      } catch (e) {
        Logger.error(' LiveKit: Failed to send raise hand data: $e', e, null, 'LiveKitService');
        _error = e.toString();
        notifyListeners();
        rethrow;
      }
    }
  }

  // Send video request data
  Future<void> sendVideoRequest({
    required String targetParticipant,
    required bool turnOn,
  }) async {
    if (_room?.localParticipant != null) {
      try {
        final videoRequestData = {
          'type': turnOn ? 'video_request_on' : 'video_request_off',
          'targetParticipant': targetParticipant,
          'requestType': turnOn ? 'camera_on' : 'camera_off',
          'sender': _localParticipant!.identity,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'id': 'request-${DateTime.now().millisecondsSinceEpoch}',
        };

        final jsonString = jsonEncode(videoRequestData);
        final encodedData = utf8.encode(jsonString);
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: true,
          topic: 'video-request',
        );
        Logger.debug('LiveKit: Video request sent - target: $targetParticipant, turnOn: $turnOn', 'LiveKitService');
      } catch (e) {
        Logger.error(' LiveKit: Failed to send video request: $e', e, null, 'LiveKitService');
        _error = e.toString();
        notifyListeners();
        rethrow;
      }
    }
  }

  // Send mute control command via data channel
  Future<void> sendMuteControlCommand({
    required String targetParticipant,
    required bool mute,
    bool allowUnmute = true,
  }) async {
    if (_room?.localParticipant != null) {
      try {
        final muteControlData = {
          'type': mute ? 'mute_command' : 'unmute_command',
          'targetParticipant': targetParticipant,
          'sender': _localParticipant!.identity,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'allowUnmute': allowUnmute,
        };

        final jsonString = jsonEncode(muteControlData);
        final encodedData = utf8.encode(jsonString);
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: true,
          topic: 'mute-control',
        );
        Logger.debug('LiveKit: Mute control command sent - target: $targetParticipant, mute: $mute', 'LiveKitService');
      } catch (e) {
        Logger.error(' LiveKit: Failed to send mute control command: $e', e, null, 'LiveKitService');
        _error = e.toString();
        notifyListeners();
        rethrow;
      }
    }
  }

  // Send mute all command via data channel
  Future<void> sendMuteAllCommand({bool allowUnmute = true}) async {
    if (_room?.localParticipant != null) {
      try {
        final muteControlData = {
          'type': 'mute_all_command',
          'sender': _localParticipant!.identity,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
          'allowUnmute': allowUnmute,
        };

        final jsonString = jsonEncode(muteControlData);
        final encodedData = utf8.encode(jsonString);
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: true,
          topic: 'mute-control',
        );
        Logger.debug('LiveKit: Mute all command sent', 'LiveKitService');
      } catch (e) {
        Logger.error(' LiveKit: Failed to send mute all command: $e', e, null, 'LiveKitService');
        _error = e.toString();
        notifyListeners();
        rethrow;
      }
    }
  }

  // Request permissions
  Future<void> _requestPermissions() async {
    Logger.debug('LiveKit: Starting permission request process', 'LiveKitService');
    
    final permissions = [
      Permission.camera,
      Permission.microphone,
    ];

    for (final permission in permissions) {
      final permissionName = permission.toString().split('.').last;
      Logger.debug('LiveKit: Checking permission: $permissionName', 'LiveKitService');
      
      final status = await permission.status;
      Logger.debug('LiveKit: Permission $permissionName status: $status', 'LiveKitService');
      
      if (status.isDenied) {
        Logger.debug('LiveKit: Permission $permissionName is denied, requesting...', 'LiveKitService');
        final requestResult = await permission.request();
        Logger.debug('LiveKit: Permission $permissionName request result: $requestResult', 'LiveKitService');
        
        if (!requestResult.isGranted) {
          Logger.error('LiveKit: Permission $permissionName denied by user', null, null, 'LiveKitService');
          throw Exception('Permission denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        Logger.error('LiveKit: Permission $permissionName is permanently denied', null, null, 'LiveKitService');
        throw Exception('Permission permanently denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        Logger.error('LiveKit: Permission $permissionName is not granted', null, null, 'LiveKitService');
        throw Exception('Permission not granted: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else {
        Logger.debug('LiveKit: Permission $permissionName is already granted', 'LiveKitService');
      }
    }
    
    Logger.debug('LiveKit: All permissions granted successfully', 'LiveKitService');
  }

  // Check if local participant is screen sharing
  bool _checkLocalScreenShare() {
    if (_localParticipant == null) {
      return false;
    }
    
    // Check local participant's video track publications for screen share
    for (final publication in _localParticipant!.videoTrackPublications) {
      final name = publication.name?.toLowerCase() ?? '';
      final sid = publication.sid ?? '';
      final isScreenShare = name.contains('screen') || 
                            name.contains('screenshare') ||
                            name.contains('screen-share') ||
                            sid.contains('screen');
      if (isScreenShare && publication.track != null) {
        Logger.debug('LiveKit: Local participant is screen sharing - name: $name, sid: $sid', 'LiveKitService');
        return true;
      }
    }
    
    return false;
  }

  // Room event handler - optimized to reduce excessive logging and rebuilds
  void _onRoomChanged() {
    if (_room != null) {
      final previousCount = _participants.length;
      _participants = _room!.remoteParticipants.values.toList();
      _localParticipant = _room!.localParticipant;
      
      // Always log for debugging (especially important for observers)
      Logger.debug('LiveKit: _onRoomChanged called - Remote: ${_participants.length} (was $previousCount), Local: ${_localParticipant?.identity}', 'LiveKitService');
      
      // Debug logging for participant tracking (especially important for observers)
      if (_participants.length != previousCount || _participants.length > 0) {
        Logger.debug('LiveKit: Participant count changed - Remote: ${_participants.length} (was $previousCount), Local: ${_localParticipant?.identity}', 'LiveKitService');
        
        // Log each participant for debugging
        for (final participant in _participants) {
          Logger.debug('LiveKit: Remote participant - identity: ${participant.identity}, metadata: ${participant.metadata}, tracks: ${participant.trackPublications.length}', 'LiveKitService');
        }
      }
      
      // Check connection state
      final connectionState = _room!.connectionState;
      
      // Check for LOCAL screen share and update state (only check local participant, not remote)
      final localHasScreenShare = _checkLocalScreenShare();
      bool needsImmediateNotify = false;
      
      if (localHasScreenShare != _isScreenSharing) {
        Logger.debug('LiveKit: Local screen share state changed - was: $_isScreenSharing, now: $localHasScreenShare', 'LiveKitService');
        _isScreenSharing = localHasScreenShare;
        needsImmediateNotify = true; // Screen share changes need immediate update
      }
      
      // Update connection status based on room state
      final wasConnected = _isConnected;
      if (connectionState == lk.ConnectionState.connected) {
        _isConnected = true;
        _isConnecting = false;
        _error = null;
      } else if (connectionState == lk.ConnectionState.connecting) {
        _isConnecting = true;
        _isConnected = false;
      } else if (connectionState == lk.ConnectionState.disconnected) {
        _isConnected = false;
        _isConnecting = false;
        if (_error == null) {
          _error = 'Connection lost';
        }
        needsImmediateNotify = true; // Connection state changes need immediate update
      }
      
      // Use debounced notify for regular updates, immediate for critical changes
      if (needsImmediateNotify || wasConnected != _isConnected) {
        notifyListeners();
      } else {
        _notifyDebouncer.call(() {
          if (_room != null) {
            notifyListeners();
          }
        });
      }
    }
  }

  // Data received handler for whiteboard collaboration - optimized to reduce logging
  void _onDataReceived(lk.DataReceivedEvent event) {
    try {
      // Convert List<int> to String using UTF-8 decoding
      final dataString = utf8.decode(event.data);
      
      // Parse the data - it should be a JSON-like string
      final data = _parseData(dataString);
      
      if (data != null) {
        // Handle different data types based on topic or data type
        if (event.topic == 'whiteboard' || (event.topic == null && data['type'] == 'whiteboard_toggle')) {
          // Whiteboard data - filter own messages (like web version)
          final senderIdentity = event.participant?.identity;
          final localIdentity = _localParticipant?.identity;
          
          if (senderIdentity == localIdentity) {
            return; // Ignore own messages
          }
          
          // Handle whiteboard_toggle message to open/close whiteboard
          if (data['type'] == 'whiteboard_toggle') {
            final isHost = data['isHost'] as bool? ?? false;
            final action = data['action'] as String?;
            
            if (isHost && action != null) {
              _isWhiteboardOpen = action == 'open';
              notifyListeners();
              
              // Also forward to whiteboard callback if set
              if (_onWhiteboardDataReceived != null) {
                _onWhiteboardDataReceived!(data);
              }
              return;
            }
          }
          
          if (_onWhiteboardDataReceived != null) {
            _onWhiteboardDataReceived!(data);
          }
        } else if (event.topic == 'chat' || data['type'] == 'chat_message') {
          // Chat data - store persistently
          _chatMessages.add(data);
          
          if (_onChatDataReceived != null) {
            _onChatDataReceived!(data);
          }
        } else if (event.topic == 'reaction' || data['type'] == 'reaction') {
          // Reaction data
          if (_onReactionDataReceived != null) {
            _onReactionDataReceived!(data);
          }
        } else if (event.topic == 'raise-hand' || data['type'] == 'raise-hand') {
          // Raise hand data
          if (_onRaiseHandDataReceived != null) {
            _onRaiseHandDataReceived!(data);
          }
        } else if (event.topic == 'mute-control' || 
                   data['type'] == 'mute_command' || 
                   data['type'] == 'unmute_command' || 
                   data['type'] == 'mute_all_command') {
          // Mute control data
          if (_onMuteControlDataReceived != null) {
            _onMuteControlDataReceived!(data);
          }
        } else if (event.topic == 'pdf-annotation' || 
                   event.topic == 'pdf-viewer' || 
                   event.topic == 'pdf-scroll' ||
                   (data['type'] as String?)?.startsWith('pdf_') == true) {
          // PDF viewer/annotation data - filter own messages
          final senderIdentity = event.participant?.identity;
          final localIdentity = _localParticipant?.identity;
          
          Logger.debug('LiveKit: PDF data received - topic: ${event.topic}, type: ${data['type']}, sender: $senderIdentity, local: $localIdentity', 'LiveKitService');
          
          if (senderIdentity == localIdentity) {
            Logger.debug('LiveKit: Ignoring own PDF message', 'LiveKitService');
            return; // Ignore own messages
          }
          
          if (_onPdfViewerDataReceived != null) {
            Logger.debug('LiveKit: Calling PDF viewer callback with data: ${data.toString()}', 'LiveKitService');
            _onPdfViewerDataReceived!(data);
          } else {
            Logger.warning('LiveKit: PDF viewer callback is null', 'LiveKitService');
          }
        }
      }
    } catch (e) {
      // Only log actual errors, not every data packet
      Logger.error('Error processing received data: $e', e, null, 'LiveKitService');
    }
  }

  // Parse data from string
  Map<String, dynamic>? _parseData(String dataString) {
    try {
      // Try to parse as JSON first
      final data = jsonDecode(dataString);
      if (data is Map<String, dynamic>) {
        return data;
      }
      return null;
    } catch (e) {
      // Only log parsing errors in debug mode
      Logger.warning('Error parsing data as JSON: $e', 'LiveKitService');
      return null;
    }
  }


  // Start connection monitoring
  void _startConnectionMonitoring() {
    Logger.debug('LiveKit: Starting connection monitoring', 'LiveKitService');
    
    // Stop any existing timers
    _stopConnectionMonitoring();
    
    // Keepalive timer - send ping every 15 seconds (more frequent)
    _keepaliveTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      _sendKeepalive();
    });
    
    // Connection monitor timer - check connection health every 5 seconds (more frequent)
    _connectionMonitorTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _checkConnectionHealth();
    });
  }
  
  // Stop connection monitoring
  void _stopConnectionMonitoring() {
    Logger.debug('LiveKit: Stopping connection monitoring', 'LiveKitService');
    _keepaliveTimer?.cancel();
    _keepaliveTimer = null;
    _connectionMonitorTimer?.cancel();
    _connectionMonitorTimer = null;
  }
  
  // Send keepalive ping
  void _sendKeepalive() {
    if (_room != null && _isConnected) {
      try {
        // Simple keepalive by checking connection state
        final connectionState = _room!.connectionState;
        Logger.debug('LiveKit: Keepalive check - Connection state: $connectionState', 'LiveKitService');
        
        // If connection is stable, just log it
        if (connectionState == lk.ConnectionState.connected) {
          Logger.debug('LiveKit: Connection is stable', 'LiveKitService');
        } else {
          Logger.warning('LiveKit: Connection state changed during keepalive: $connectionState', 'LiveKitService');
        }
      } catch (e) {
        Logger.warning('LiveKit: Keepalive failed: $e', 'LiveKitService');
      }
    }
  }
  
  // Check connection health
  void _checkConnectionHealth() {
    if (_room != null && _isConnected) {
      final connectionState = _room!.connectionState;
      final now = DateTime.now();
      
      // Check if connection is stable
      if (connectionState == lk.ConnectionState.connected) {
        _lastConnectionTime = now;
        _disconnectionCount = 0;
      } else if (connectionState == lk.ConnectionState.disconnected) {
        _disconnectionCount++;
        Logger.warning('LiveKit: Connection health check - disconnected (count: $_disconnectionCount)', 'LiveKitService');
        
        // If we've been disconnected for too long, try to reconnect
        if (_lastConnectionTime != null) {
          final timeSinceLastConnection = now.difference(_lastConnectionTime!);
          if (timeSinceLastConnection.inSeconds > 30) { // Reduced from 60 to 30 seconds
            Logger.debug('LiveKit: Attempting reconnection due to long disconnection (${timeSinceLastConnection.inSeconds}s)', 'LiveKitService');
            _attemptReconnection();
          }
        } else {
          // If we don't have a last connection time, try to reconnect immediately
          Logger.debug('LiveKit: No last connection time, attempting immediate reconnection', 'LiveKitService');
          _attemptReconnection();
        }
      }
    }
  }
  
  // Attempt reconnection with exponential backoff and token refresh
  Future<void> _attemptReconnection() async {
    if (_isConnecting) {
      Logger.warning('LiveKit: Already attempting reconnection, skipping', 'LiveKitService');
      return;
    }
    
    // Check if we've exceeded max attempts
    if (_reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
      Logger.warning('LiveKit: Max reconnection attempts reached ($MAX_RECONNECTION_ATTEMPTS)', 'LiveKitService');
      _error = 'Connection lost. Please reconnect manually.';
      notifyListeners();
      return;
    }
    
    // Need room details for token refresh
    if (_lastRoomName == null || _lastParticipantName == null || _lastParticipantType == null) {
      Logger.warning('LiveKit: No connection details available for reconnection', 'LiveKitService');
      return;
    }
    
    try {
      _reconnectionAttempts++;
      Logger.debug('LiveKit: Starting reconnection attempt $_reconnectionAttempts/$MAX_RECONNECTION_ATTEMPTS', 'LiveKitService');
      _isConnecting = true;
      notifyListeners();
      
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      final backoffDelay = Duration(seconds: 1 << (_reconnectionAttempts - 1));
      Logger.debug('LiveKit: Waiting ${backoffDelay.inSeconds}s before reconnection...', 'LiveKitService');
      await Future.delayed(backoffDelay);
      
      // Refresh token before reconnecting (tokens may expire)
      Logger.debug('LiveKit: Refreshing token for reconnection...', 'LiveKitService');
      LiveKitTokenResponse tokenResponse;
      try {
        tokenResponse = await ApiService.getLiveKitToken(
          roomName: _lastRoomName!,
          participantName: _lastParticipantName!,
          participantType: _lastParticipantType!,
        );
        
        // Update stored connection details
        _lastLivekitUrl = tokenResponse.livekitUrl;
        _lastToken = tokenResponse.token;
        Logger.debug('LiveKit: Token refreshed successfully', 'LiveKitService');
      } catch (e) {
        Logger.error('LiveKit: Failed to refresh token: $e', e, null, 'LiveKitService');
        // Try with old token as fallback
        if (_lastLivekitUrl == null || _lastToken == null) {
          throw Exception('No valid token available for reconnection');
        }
        Logger.debug('LiveKit: Using stored token as fallback', 'LiveKitService');
        // Create a simple token response object for reconnection
        // Note: This is a fallback - ideally we'd refresh the token
        tokenResponse = LiveKitTokenResponse(
          token: _lastToken!,
          livekitUrl: _lastLivekitUrl!,
          roomName: _lastRoomName ?? '',
          participantName: _lastParticipantName ?? '',
          participantType: _lastParticipantType ?? 'guest',
        );
      }
      
      if (_room != null) {
        // Try to reconnect with refreshed token
        await _room!.connect(
          tokenResponse.livekitUrl,
          tokenResponse.token,
        );
        
        Logger.debug('LiveKit: Reconnection successful', 'LiveKitService');
        _reconnectionAttempts = 0; // Reset on success
        _error = null;
        _isConnecting = false;
        notifyListeners();
      } else {
        // Room was disposed, need full reconnection
        Logger.debug('LiveKit: Room was disposed, attempting full reconnection...', 'LiveKitService');
        await connectToRoom(
          roomName: _lastRoomName!,
          participantName: _lastParticipantName!,
          participantType: _lastParticipantType!,
          cameraEnabled: (_localParticipant?.isCameraEnabled ?? true) as bool,
          microphoneEnabled: (_localParticipant?.isMicrophoneEnabled ?? true) as bool,
          speakerEnabled: _speakerEnabled,
        );
      }
    } catch (e) {
      Logger.error('LiveKit: Reconnection attempt $_reconnectionAttempts failed: $e', e, null, 'LiveKitService');
      _isConnecting = false;
      
      // Schedule next reconnection attempt if we haven't exceeded max attempts
      if (_reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
        final nextBackoffDelay = Duration(seconds: 1 << _reconnectionAttempts);
        Logger.debug('LiveKit: Scheduling next reconnection attempt in ${nextBackoffDelay.inSeconds}s', 'LiveKitService');
        
        _reconnectionTimer?.cancel();
        _reconnectionTimer = Timer(nextBackoffDelay, () {
          _attemptReconnection();
        });
      } else {
        _error = 'Connection lost after $MAX_RECONNECTION_ATTEMPTS attempts. Please reconnect manually.';
        notifyListeners();
      }
    }
  }

  // Start recording - client-side screen recording
  Future<void> startRecording() async {
    if (_isProcessingRecording) {
      Logger.warning('LiveKit: Recording request already in progress', 'LiveKitService');
      return;
    }
    
    try {
      _isProcessingRecording = true;
      notifyListeners();
      
      Logger.debug('LiveKit: Starting client-side screen recording', 'LiveKitService');
      
      // Start client-side screen recording
      final recordingPath = await _screenRecordingService.startRecording();
      
      _isRecording = true;
      _isRecordingPaused = false;
      _recordingStartTime = DateTime.now();
      _pausedDuration = Duration.zero;
      _pauseStartTime = null;
      _lastEgressId = recordingPath;
      _isSimpleRecording = true; // Client-side recording
      
      Logger.debug('LiveKit: Screen recording started successfully: $recordingPath', 'LiveKitService');
      notifyListeners();
    } catch (e) {
      Logger.error(' LiveKit: Failed to start recording: $e', e, null, 'LiveKitService');
      final errorMessage = e.toString();
      
      // Provide user-friendly error message
      if (errorMessage.contains('Internal service panic') || 
          errorMessage.contains('egress') ||
          errorMessage.contains('not configured')) {
        _error = 'Recording is not available. The LiveKit server egress service may not be configured. Please contact your administrator.';
      } else {
        _error = errorMessage;
      }
      
      notifyListeners();
      rethrow;
    } finally {
      _isProcessingRecording = false;
      notifyListeners();
    }
  }

  // Set server-side recording state (for API-based recording)
  void setServerRecordingState(bool isRecording, {DateTime? startTime}) {
    _isRecording = isRecording;
    _recordingStartTime = startTime;
    if (!isRecording) {
      _isRecordingPaused = false;
      _recordingStartTime = null;
    }
    notifyListeners();
    Logger.debug('LiveKit: Server recording state updated - isRecording: $isRecording', 'LiveKitService');
  }

  // Stop recording - client-side screen recording
  Future<Map<String, dynamic>?> stopRecording() async {
    if (_isProcessingRecording) {
      Logger.warning('LiveKit: Recording request already in progress', 'LiveKitService');
      return null;
    }
    
    try {
      _isProcessingRecording = true;
      notifyListeners();
      
      Logger.debug('LiveKit: Stopping client-side screen recording', 'LiveKitService');
      
      // Stop client-side screen recording
      final recordingPath = await _screenRecordingService.stopRecording();
      
      _isRecording = false;
      _isRecordingPaused = false;
      _isSimpleRecording = false;
      final recordingStartTime = _recordingStartTime;
      _recordingStartTime = null;
      _pausedDuration = Duration.zero;
      _pauseStartTime = null;
      
      if (recordingPath != null) {
        // Extract filename from path
        final file = File(recordingPath);
        final filename = file.path.split('/').last;
        
        Logger.debug('LiveKit: Screen recording stopped successfully: $recordingPath', 'LiveKitService');
        
        // Return the local file path for direct access
        notifyListeners();
        return {
          'filePath': recordingPath,
          'filename': filename,
          'isLocalFile': true,
        };
      } else {
        Logger.warning('LiveKit: No recording file available', 'LiveKitService');
      }
      
      notifyListeners();
      return null;
    } catch (e) {
      Logger.error(' LiveKit: Failed to stop recording: $e', e, null, 'LiveKitService');
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isProcessingRecording = false;
      notifyListeners();
    }
  }

  // Pause/Resume recording
  void toggleRecordingPause() {
    if (!_isRecording) return;
    
    if (_isRecordingPaused) {
      // Resume recording
      if (_pauseStartTime != null) {
        _pausedDuration += DateTime.now().difference(_pauseStartTime!);
        _pauseStartTime = null;
      }
      _isRecordingPaused = false;
      _screenRecordingService.resumeRecording();
      Logger.debug('LiveKit: Recording resumed', 'LiveKitService');
    } else {
      // Pause recording
      _pauseStartTime = DateTime.now();
      _isRecordingPaused = true;
      _screenRecordingService.pauseRecording();
      Logger.debug('LiveKit: Recording paused', 'LiveKitService');
    }
    notifyListeners();
  }

  /// Initialize adaptive streaming services
  void _initializeAdaptiveStreaming() {
    if (_room == null) return;

    try {
      // Initialize quality store if not already initialized
      _qualityStore ??= MediaQualityStore();
      _qualityStore!.initialize();

      // Initialize connection monitor
      _connectionMonitor ??= ConnectionMonitorService();
      _connectionMonitor!.startMonitoring(_room!);

      // Initialize network adapter
      _networkAdapter ??= NetworkAdapterService();
      _networkAdapter!.setRoom(_room!);

      // Initialize adaptive stream manager
      _adaptiveStreamManager ??= AdaptiveStreamManager();
      _adaptiveStreamManager!.initialize(
        room: _room!,
        connectionMonitor: _connectionMonitor!,
        networkAdapter: _networkAdapter!,
        qualityStore: _qualityStore!,
      );

      Logger.debug('Adaptive streaming initialized', 'LiveKitService');
    } catch (e) {
      Logger.error('Failed to initialize adaptive streaming: $e', e, null, 'LiveKitService');
    }
  }

  /// Get quality store (for UI access)
  MediaQualityStore? get qualityStore => _qualityStore;

  /// Get connection monitor (for UI access)
  ConnectionMonitorService? get connectionMonitor => _connectionMonitor;

  @override
  void dispose() {
    _stopConnectionMonitoring();
    _reconnectionTimer?.cancel();
    _adaptiveStreamManager?.dispose();
    _connectionMonitor?.dispose();
    _notifyDebouncer.dispose();
    _room?.removeListener(_onRoomChanged);
    _dataListener?.dispose();
    _participantListener?.dispose();
    disconnect();
    super.dispose();
  }
}
