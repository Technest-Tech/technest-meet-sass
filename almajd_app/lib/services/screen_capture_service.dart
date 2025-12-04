import 'package:flutter/services.dart';
import '../utils/logger.dart';

class ScreenCaptureService {
  static const MethodChannel _channel = MethodChannel('com.newmeet.app.newmeet_mobile/screen_capture');

  static Future<void> startService() async {
    try {
      await _channel.invokeMethod('startScreenCaptureService');
      Logger.debug(' Screen capture service started', 'screen_capture_service');
    } catch (e) {
      Logger.error(' Failed to start screen capture service: $e', e, null, 'screen_capture_service');
      rethrow;
    }
  }

  static Future<void> stopService() async {
    try {
      await _channel.invokeMethod('stopScreenCaptureService');
      Logger.debug(' Screen capture service stopped', 'screen_capture_service');
    } catch (e) {
      Logger.error(' Failed to stop screen capture service: $e', e, null, 'screen_capture_service');
      rethrow;
    }
  }
}
