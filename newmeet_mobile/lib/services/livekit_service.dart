import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:permission_handler/permission_handler.dart';
import 'api_service.dart';
import 'screen_capture_service.dart';
import '../config/app_config.dart';

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
  
  // Connection stability
  Timer? _keepaliveTimer;
  Timer? _connectionMonitorTimer;
  DateTime? _lastConnectionTime;
  int _disconnectionCount = 0;
  
  // Store connection details for reconnection
  String? _lastLivekitUrl;
  String? _lastToken;
  
  // Data listener for whiteboard collaboration
  lk.EventsListener<lk.RoomEvent>? _dataListener;

  // Getters
  lk.Room? get room => _room;
  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  String? get error => _error;
  List<lk.RemoteParticipant> get participants => _participants;
  lk.LocalParticipant? get localParticipant => _localParticipant;
  bool get isScreenSharing => _isScreenSharing;
  bool get isStartingScreenShare => _isStartingScreenShare;
  bool get isWhiteboardOpen => _isWhiteboardOpen;

  // Connect to room
  Future<void> connectToRoom({
    required String roomName,
    required String participantName,
    required String participantType,
  }) async {
    try {
      _isConnecting = true;
      _error = null;
      notifyListeners();

      print('🔗 Starting connection to room: $roomName');

      // Request permissions
      print('📱 Requesting permissions...');
      await _requestPermissions();
      print('✅ Permissions granted');

      // Get LiveKit token
      print('🎫 Getting LiveKit token...');
      final tokenResponse = await ApiService.getLiveKitToken(
        roomName: roomName,
        participantName: participantName,
        participantType: participantType,
      );
      print('✅ Token received: ${tokenResponse.livekitUrl}');

      // Create room
      print('🏠 Creating room instance...');
      _room = lk.Room();

      // Add event listeners
      print('👂 Adding event listeners...');
      _room!.addListener(_onRoomChanged);
      
      // Add data received listener for whiteboard collaboration
      _dataListener = _room!.createListener();
      _dataListener!.on<lk.DataReceivedEvent>(_onDataReceived);

          // Connect to room with enhanced stability options
      print('🔌 Connecting to LiveKit server...');
      print('🔌 LiveKit URL: ${tokenResponse.livekitUrl}');
      print('🔌 Token length: ${tokenResponse.token.length}');
      
      // Set connection options for better reliability and stability
      final connectOptions = lk.ConnectOptions(
        autoSubscribe: true,
      );
      
      // Try connection with retry logic
      int retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          print('🔄 LiveKit: Connection attempt ${retryCount + 1}/$maxRetries');
          
          // Add a small delay between retries
          if (retryCount > 0) {
            await Future.delayed(Duration(milliseconds: 1000 * retryCount));
          }
          
          await _room!.connect(
            tokenResponse.livekitUrl,
            tokenResponse.token,
            connectOptions: connectOptions,
          );
          
          print('✅ LiveKit: Connection successful on attempt ${retryCount + 1}');
          break; // Success, exit retry loop
          
        } catch (e) {
          retryCount++;
          print('❌ LiveKit: Connection attempt ${retryCount} failed: $e');
          
          if (retryCount >= maxRetries) {
            print('❌ LiveKit: All connection attempts failed');
            rethrow; // Re-throw the last error
          }
          
          // Create a new room instance for retry
          _room?.removeListener(_onRoomChanged);
          _room = lk.Room();
          _room!.addListener(_onRoomChanged);
        }
      }
      print('✅ Connected to room successfully');

      _isConnected = true;
      _isConnecting = false;
      _lastConnectionTime = DateTime.now();
      _disconnectionCount = 0;
      
      // Store connection details for potential reconnection
      _lastLivekitUrl = tokenResponse.livekitUrl;
      _lastToken = tokenResponse.token;
      
      notifyListeners();

      // Start connection monitoring
      _startConnectionMonitoring();

      // Enable camera and microphone with delay
      print('📹 Enabling camera and microphone...');
      await Future.delayed(const Duration(milliseconds: 500));
      if (_room!.localParticipant != null) {
        try {
          await _room!.localParticipant!.setCameraEnabled(true);
          print('✅ Camera enabled');
        } catch (e) {
          print('⚠️ Camera enable failed: $e');
        }
        
        try {
          await _room!.localParticipant!.setMicrophoneEnabled(true);
          print('✅ Microphone enabled');
        } catch (e) {
          print('⚠️ Microphone enable failed: $e');
        }
      }

    } catch (e) {
      print('❌ Connection failed: $e');
      _error = e.toString();
      _isConnecting = false;
      _isConnected = false;
      notifyListeners();
    }
  }

  // Disconnect from room
  Future<void> disconnect() async {
    try {
      print('🔌 LiveKit: Starting disconnect process');
      
      // Stop monitoring timers
      _stopConnectionMonitoring();
      
      if (_room != null) {
        print('🔌 LiveKit: Disconnecting from room...');
        await _room!.disconnect();
        _room = null;
        print('✅ LiveKit: Room disconnected successfully');
      } else {
        print('⚠️ LiveKit: No room to disconnect from');
      }
      
      // Reset all state
      _isConnected = false;
      _isConnecting = false;
      _error = null;
      _participants.clear();
      _localParticipant = null;
      _isScreenSharing = false;
      _isWhiteboardOpen = false;
      _lastConnectionTime = null;
      _disconnectionCount = 0;
      _lastLivekitUrl = null;
      _lastToken = null;
      _dataListener?.dispose();
      _dataListener = null;
      
      print('🔌 LiveKit: State reset completed');
      notifyListeners();
    } catch (e) {
      print('❌ LiveKit: Disconnect error: $e');
      _error = e.toString();
      notifyListeners();
    }
  }

  // Toggle camera
  Future<void> toggleCamera() async {
    if (_room?.localParticipant != null) {
      final isEnabled = _room!.localParticipant!.isCameraEnabled();
      await _room!.localParticipant!.setCameraEnabled(!isEnabled);
      notifyListeners();
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

  // Start screen sharing
  Future<void> startScreenSharing() async {
    try {
      print('📺 LiveKit: Starting screen share...');
      _isStartingScreenShare = true;
      notifyListeners();
      
      // Start the foreground service first
      await ScreenCaptureService.startService();
      
      if (_room?.localParticipant != null) {
        await _room!.localParticipant!.setScreenShareEnabled(true);
        _isScreenSharing = true;
        print('✅ LiveKit: Screen share started successfully');
      }
    } catch (e) {
      print('❌ LiveKit: Screen share failed: $e');
      _error = e.toString();
    } finally {
      _isStartingScreenShare = false;
      notifyListeners();
    }
  }

  // Stop screen sharing
  Future<void> stopScreenSharing() async {
    try {
      print('📺 LiveKit: Stopping screen share...');
      
      if (_room?.localParticipant != null) {
        await _room!.localParticipant!.setScreenShareEnabled(false);
        _isScreenSharing = false;
        print('✅ LiveKit: Screen share stopped successfully');
        notifyListeners();
      }
      
      // Stop the foreground service
      await ScreenCaptureService.stopService();
    } catch (e) {
      print('❌ LiveKit: Stop screen share failed: $e');
      _error = e.toString();
      notifyListeners();
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
    
    print('📤 LiveKit: Sending whiteboard toggle command - $action');
    sendWhiteboardData(data);
    
    notifyListeners();
  }

  // Send whiteboard data
  Future<void> sendWhiteboardData(Map<String, dynamic> data) async {
    if (_room?.localParticipant != null) {
      try {
        // Convert to JSON string using dart:convert
        final jsonString = jsonEncode(data);
        final encodedData = jsonString.codeUnits;
        await _room!.localParticipant!.publishData(
          encodedData,
          reliable: true,
          topic: 'whiteboard',
        );
        print('📤 LiveKit: Whiteboard data sent - ${data['type']}');
      } catch (e) {
        print('❌ LiveKit: Failed to send whiteboard data: $e');
        _error = e.toString();
        notifyListeners();
      }
    }
  }

  // Whiteboard data callback
  Function(Map<String, dynamic>)? _onWhiteboardDataReceived;

  // Set whiteboard data callback
  void setWhiteboardDataCallback(Function(Map<String, dynamic>) callback) {
    _onWhiteboardDataReceived = callback;
  }

  // Request permissions
  Future<void> _requestPermissions() async {
    print('📱 LiveKit: Starting permission request process');
    
    final permissions = [
      Permission.camera,
      Permission.microphone,
    ];

    for (final permission in permissions) {
      final permissionName = permission.toString().split('.').last;
      print('📱 LiveKit: Checking permission: $permissionName');
      
      final status = await permission.status;
      print('📱 LiveKit: Permission $permissionName status: $status');
      
      if (status.isDenied) {
        print('📱 LiveKit: Permission $permissionName is denied, requesting...');
        final requestResult = await permission.request();
        print('📱 LiveKit: Permission $permissionName request result: $requestResult');
        
        if (!requestResult.isGranted) {
          print('❌ LiveKit: Permission $permissionName denied by user');
          throw Exception('Permission denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        print('❌ LiveKit: Permission $permissionName is permanently denied');
        throw Exception('Permission permanently denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        print('❌ LiveKit: Permission $permissionName is not granted');
        throw Exception('Permission not granted: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else {
        print('✅ LiveKit: Permission $permissionName is already granted');
      }
    }
    
    print('✅ LiveKit: All permissions granted successfully');
  }

  // Room event handler
  void _onRoomChanged() {
    print('🔄 LiveKit: Room state changed');
    if (_room != null) {
      _participants = _room!.remoteParticipants.values.toList();
      _localParticipant = _room!.localParticipant;
      
      // Check connection state
      final connectionState = _room!.connectionState;
      print('🔄 LiveKit: Connection state: $connectionState');
      print('🔄 LiveKit: Participants updated - Remote: ${_participants.length}, Local: ${_localParticipant != null ? "present" : "null"}');
      
      // Update connection status based on room state
      if (connectionState == lk.ConnectionState.connected) {
        _isConnected = true;
        _isConnecting = false;
        _error = null;
        print('✅ LiveKit: Successfully connected to room');
      } else if (connectionState == lk.ConnectionState.connecting) {
        _isConnecting = true;
        _isConnected = false;
        print('🔄 LiveKit: Connecting to room...');
      } else if (connectionState == lk.ConnectionState.disconnected) {
        _isConnected = false;
        _isConnecting = false;
        if (_error == null) {
          _error = 'Connection lost';
        }
        print('❌ LiveKit: Disconnected from room');
      }
      
      notifyListeners();
    } else {
      print('⚠️ LiveKit: Room is null in _onRoomChanged');
    }
  }

  // Data received handler for whiteboard collaboration
  void _onDataReceived(lk.DataReceivedEvent event) {
    try {
      print('📥 LiveKit: Data received from ${event.participant?.identity}');
      print('📥 LiveKit: Event topic: ${event.topic}');
      print('📥 LiveKit: Data length: ${event.data.length}');
      
      // Check if this is whiteboard data (web version might not set topic)
      if (event.topic == 'whiteboard' || event.topic == null) {
        // Convert List<int> to String
        final dataString = String.fromCharCodes(event.data);
        print('📥 LiveKit: Whiteboard data string: $dataString');
        print('📥 LiveKit: Data string length: ${dataString.length}');
        print('📥 LiveKit: First 100 chars: ${dataString.length > 100 ? dataString.substring(0, 100) : dataString}');
        
        // Parse the data - it should be a JSON-like string
        // The web version sends data as JSON, but we need to handle the format
        final data = _parseWhiteboardData(dataString);
        
        if (data != null) {
          print('📥 LiveKit: Parsed data: $data');
          if (_onWhiteboardDataReceived != null) {
            print('📥 LiveKit: Forwarding whiteboard data to callback');
            _onWhiteboardDataReceived!(data);
          } else {
            print('⚠️ LiveKit: No whiteboard callback set');
          }
        } else {
          print('❌ LiveKit: Failed to parse whiteboard data');
        }
      } else {
        print('📥 LiveKit: Ignoring non-whiteboard data with topic: ${event.topic}');
      }
    } catch (e) {
      print('❌ LiveKit: Error processing received data: $e');
    }
  }

  // Parse whiteboard data from string
  Map<String, dynamic>? _parseWhiteboardData(String dataString) {
    try {
      // Try to parse as JSON first
      final data = jsonDecode(dataString);
      if (data is Map<String, dynamic>) {
        return data;
      }
      
      print('⚠️ LiveKit: Data is not a Map: $dataString');
      return null;
    } catch (e) {
      print('❌ LiveKit: Error parsing whiteboard data as JSON: $e');
      print('❌ LiveKit: Raw data: $dataString');
      return null;
    }
  }


  // Start connection monitoring
  void _startConnectionMonitoring() {
    print('🔍 LiveKit: Starting connection monitoring');
    
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
    print('🔍 LiveKit: Stopping connection monitoring');
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
        print('💓 LiveKit: Keepalive check - Connection state: $connectionState');
        
        // If connection is stable, just log it
        if (connectionState == lk.ConnectionState.connected) {
          print('💓 LiveKit: Connection is stable');
        } else {
          print('⚠️ LiveKit: Connection state changed during keepalive: $connectionState');
        }
      } catch (e) {
        print('⚠️ LiveKit: Keepalive failed: $e');
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
        print('⚠️ LiveKit: Connection health check - disconnected (count: $_disconnectionCount)');
        
        // If we've been disconnected for too long, try to reconnect
        if (_lastConnectionTime != null) {
          final timeSinceLastConnection = now.difference(_lastConnectionTime!);
          if (timeSinceLastConnection.inSeconds > 30) { // Reduced from 60 to 30 seconds
            print('🔄 LiveKit: Attempting reconnection due to long disconnection (${timeSinceLastConnection.inSeconds}s)');
            _attemptReconnection();
          }
        } else {
          // If we don't have a last connection time, try to reconnect immediately
          print('🔄 LiveKit: No last connection time, attempting immediate reconnection');
          _attemptReconnection();
        }
      }
    }
  }
  
  // Attempt reconnection
  Future<void> _attemptReconnection() async {
    if (_isConnecting) {
      print('⚠️ LiveKit: Already attempting reconnection, skipping');
      return;
    }
    
    if (_lastLivekitUrl == null || _lastToken == null) {
      print('⚠️ LiveKit: No connection details available for reconnection');
      return;
    }
    
    try {
      print('🔄 LiveKit: Starting reconnection attempt');
      _isConnecting = true;
      notifyListeners();
      
      // Wait a bit before reconnecting
      await Future.delayed(const Duration(milliseconds: 500));
      
      if (_room != null) {
        // Try to reconnect with stored details
        await _room!.connect(
          _lastLivekitUrl!,
          _lastToken!,
        );
        print('✅ LiveKit: Reconnection successful');
      }
    } catch (e) {
      print('❌ LiveKit: Reconnection failed: $e');
      _error = 'Reconnection failed: $e';
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _stopConnectionMonitoring();
    _room?.removeListener(_onRoomChanged);
    _dataListener?.dispose();
    disconnect();
    super.dispose();
  }
}
