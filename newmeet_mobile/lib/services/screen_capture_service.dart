import 'package:flutter/services.dart';

class ScreenCaptureService {
  static const MethodChannel _channel = MethodChannel('com.newmeet.app.newmeet_mobile/screen_capture');

  static Future<void> startService() async {
    try {
      await _channel.invokeMethod('startScreenCaptureService');
      print('✅ Screen capture service started');
    } catch (e) {
      print('❌ Failed to start screen capture service: $e');
      rethrow;
    }
  }

  static Future<void> stopService() async {
    try {
      await _channel.invokeMethod('stopScreenCaptureService');
      print('✅ Screen capture service stopped');
    } catch (e) {
      print('❌ Failed to stop screen capture service: $e');
      rethrow;
    }
  }
}
