import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/logger.dart';

/// Video quality preference
enum VideoQualityPreference {
  low,
  medium,
  high,
  auto,
}

/// Media quality store for managing video quality preferences
class MediaQualityStore extends ChangeNotifier {
  static const String _videoQualityKey = 'video_quality_preference';
  static const String _screenShareQualityKey = 'screen_share_quality_preference';
  static const String _dataSaverKey = 'data_saver_mode';

  VideoQualityPreference _videoQuality = VideoQualityPreference.auto;
  VideoQualityPreference _screenShareQuality = VideoQualityPreference.medium;
  bool _dataSaverMode = false;
  bool _isInitialized = false;

  VideoQualityPreference get videoQuality => _videoQuality;
  VideoQualityPreference get screenShareQuality => _screenShareQuality;
  bool get dataSaverMode => _dataSaverMode;
  bool get isInitialized => _isInitialized;

  /// Initialize store and load preferences
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      
      // Load video quality preference
      final videoQualityStr = prefs.getString(_videoQualityKey);
      if (videoQualityStr != null) {
        _videoQuality = _parseQualityPreference(videoQualityStr);
      }

      // Load screen share quality preference
      final screenShareQualityStr = prefs.getString(_screenShareQualityKey);
      if (screenShareQualityStr != null) {
        _screenShareQuality = _parseQualityPreference(screenShareQualityStr);
      }

      // Load data saver mode
      _dataSaverMode = prefs.getBool(_dataSaverKey) ?? false;

      _isInitialized = true;
      Logger.debug('MediaQualityStore initialized', 'MediaQualityStore');
      notifyListeners();
    } catch (e) {
      Logger.error('Failed to initialize MediaQualityStore: $e', e, null, 'MediaQualityStore');
    }
  }

  /// Parse quality preference from string
  VideoQualityPreference _parseQualityPreference(String value) {
    switch (value.toLowerCase()) {
      case 'low':
        return VideoQualityPreference.low;
      case 'medium':
        return VideoQualityPreference.medium;
      case 'high':
        return VideoQualityPreference.high;
      case 'auto':
      default:
        return VideoQualityPreference.auto;
    }
  }

  /// Convert quality preference to string
  String _qualityPreferenceToString(VideoQualityPreference quality) {
    switch (quality) {
      case VideoQualityPreference.low:
        return 'low';
      case VideoQualityPreference.medium:
        return 'medium';
      case VideoQualityPreference.high:
        return 'high';
      case VideoQualityPreference.auto:
        return 'auto';
    }
  }

  /// Set video quality preference
  Future<void> setVideoQuality(VideoQualityPreference quality) async {
    if (_videoQuality == quality) return;

    _videoQuality = quality;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_videoQualityKey, _qualityPreferenceToString(quality));
      Logger.debug('Video quality preference saved: $quality', 'MediaQualityStore');
    } catch (e) {
      Logger.error('Failed to save video quality preference: $e', e, null, 'MediaQualityStore');
    }
  }

  /// Set screen share quality preference
  Future<void> setScreenShareQuality(VideoQualityPreference quality) async {
    if (_screenShareQuality == quality) return;

    _screenShareQuality = quality;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_screenShareQualityKey, _qualityPreferenceToString(quality));
      Logger.debug('Screen share quality preference saved: $quality', 'MediaQualityStore');
    } catch (e) {
      Logger.error('Failed to save screen share quality preference: $e', e, null, 'MediaQualityStore');
    }
  }

  /// Set data saver mode
  Future<void> setDataSaverMode(bool enabled) async {
    if (_dataSaverMode == enabled) return;

    _dataSaverMode = enabled;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_dataSaverKey, enabled);
      Logger.debug('Data saver mode saved: $enabled', 'MediaQualityStore');
    } catch (e) {
      Logger.error('Failed to save data saver mode: $e', e, null, 'MediaQualityStore');
    }
  }

  /// Reset to defaults
  Future<void> reset() async {
    _videoQuality = VideoQualityPreference.auto;
    _screenShareQuality = VideoQualityPreference.medium;
    _dataSaverMode = false;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_videoQualityKey);
      await prefs.remove(_screenShareQualityKey);
      await prefs.remove(_dataSaverKey);
      Logger.debug('MediaQualityStore reset to defaults', 'MediaQualityStore');
    } catch (e) {
      Logger.error('Failed to reset MediaQualityStore: $e', e, null, 'MediaQualityStore');
    }
  }
}

