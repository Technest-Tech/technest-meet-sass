import 'package:flutter/services.dart';

class CallService {
  static const platform = MethodChannel('com.newmeet.app.newmeet_mobile/call_service');

  /// Start the foreground call service to maintain microphone access in background
  static Future<void> startService() async {
    try {
      print('📞 CallService: Starting foreground call service...');
      await platform.invokeMethod('startCallService');
      print('✅ CallService: Foreground service started successfully');
      
      // Also configure audio for background
      await configureAudioForBackground();
    } on PlatformException catch (e) {
      print('❌ CallService: Failed to start service: ${e.message}');
      rethrow;
    }
  }

  /// Stop the foreground call service
  static Future<void> stopService() async {
    try {
      print('📞 CallService: Stopping foreground call service...');
      await platform.invokeMethod('stopCallService');
      print('✅ CallService: Foreground service stopped successfully');
    } on PlatformException catch (e) {
      print('❌ CallService: Failed to stop service: ${e.message}');
      rethrow;
    }
  }
  
  /// Configure audio for background operation
  static Future<void> configureAudioForBackground() async {
    try {
      print('🔊 CallService: Configuring audio for background...');
      await platform.invokeMethod('configureAudioForBackground');
      print('✅ CallService: Audio configured for background successfully');
    } on PlatformException catch (e) {
      print('❌ CallService: Failed to configure audio: ${e.message}');
    }
  }
}

