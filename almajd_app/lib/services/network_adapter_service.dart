import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import 'connection_monitor_service.dart';

/// Adaptation settings for network conditions
class AdaptationSettings {
  final lk.VideoQuality videoQuality;
  final int maxBitrate; // bits per second
  final bool simulcast;
  final bool audioOnly;

  AdaptationSettings({
    required this.videoQuality,
    required this.maxBitrate,
    required this.simulcast,
    required this.audioOnly,
  });
}

/// Service to adapt video quality based on network conditions
class NetworkAdapterService {
  lk.Room? _room;
  QualityLevel _currentQuality = QualityLevel.good;
  bool _isDataSaverMode = false;

  /// Set the room instance
  void setRoom(lk.Room room) {
    _room = room;
  }

  /// Adapt to current network conditions based on connection quality
  Future<void> adaptToNetworkConditions(QualityLevel quality) async {
    if (_room == null || _room!.connectionState != lk.ConnectionState.connected) {
      Logger.warning('Cannot adapt network settings: room not connected', 'NetworkAdapterService');
      return;
    }

    _currentQuality = quality;
    final settings = _getAdaptationSettings(quality);

    Logger.info('Adapting to network conditions: $quality', 'NetworkAdapterService');

    try {
      // Apply video quality settings
      await _applyVideoSettings(settings);
      
      // Apply audio settings if needed
      if (settings.audioOnly) {
        await _switchToAudioOnly();
      }

    } catch (error) {
      Logger.error('Failed to adapt network settings: $error', error, null, 'NetworkAdapterService');
    }
  }

  /// Get adaptation settings for a given quality level
  AdaptationSettings _getAdaptationSettings(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return AdaptationSettings(
          videoQuality: lk.VideoQuality.HIGH,
          maxBitrate: 2500000, // 2.5 Mbps
          simulcast: true,
          audioOnly: false,
        );

      case QualityLevel.good:
        return AdaptationSettings(
          videoQuality: lk.VideoQuality.MEDIUM,
          maxBitrate: 1500000, // 1.5 Mbps
          simulcast: true,
          audioOnly: false,
        );

      case QualityLevel.fair:
        return AdaptationSettings(
          videoQuality: lk.VideoQuality.LOW,
          maxBitrate: 750000, // 750 kbps
          simulcast: false,
          audioOnly: false,
        );

      case QualityLevel.poor:
        return AdaptationSettings(
          videoQuality: lk.VideoQuality.LOW,
          maxBitrate: 300000, // 300 kbps
          simulcast: false,
          audioOnly: true, // Switch to audio-only for poor connections
        );
    }
  }

  /// Apply video quality settings
  Future<void> _applyVideoSettings(AdaptationSettings settings) async {
    if (_room == null) return;

    final localParticipant = _room!.localParticipant;
    if (localParticipant == null) return;
    
    // Check if screen sharing is active
    final isScreenSharing = localParticipant.isScreenShareEnabled == true;
    
    // If screen sharing, use more conservative video settings to preserve audio
    final effectiveSettings = isScreenSharing ? AdaptationSettings(
      videoQuality: settings.videoQuality == lk.VideoQuality.HIGH 
        ? lk.VideoQuality.MEDIUM 
        : settings.videoQuality, // Downgrade high to medium when screen sharing
      maxBitrate: settings.maxBitrate > 1000000 
        ? 1000000 
        : settings.maxBitrate, // Cap at 1 Mbps when screen sharing
      simulcast: settings.simulcast,
      audioOnly: settings.audioOnly,
    ) : settings;
    
    // Respect the user's current camera preference
    final isCameraEnabled = localParticipant.isCameraEnabled == true;
    if (!isCameraEnabled) {
      Logger.debug('Skipping video settings update because camera is disabled', 'NetworkAdapterService');
      return;
    }

    try {
      // Note: VideoTrackSettings API is not available in LiveKit Dart SDK 2.5.0
      // Local camera quality is controlled by RoomOptions set during connection
      // We can only enable/disable camera here, not adjust quality dynamically
      await localParticipant.setCameraEnabled(true);
      Logger.debug('Applied video settings (quality: ${effectiveSettings.videoQuality}, bitrate: ${effectiveSettings.maxBitrate}, screenSharing: $isScreenSharing) - Note: VideoTrackSettings not available, using SDK adaptive streaming', 'NetworkAdapterService');
    } catch (error) {
      Logger.error('Failed to apply video settings: $error', error, null, 'NetworkAdapterService');
    }
  }

  /// Get video preset for quality level
  /// Note: VideoPresets not available in SDK, this is for reference only
  String _getVideoPreset(lk.VideoQuality quality) {
    switch (quality) {
      case lk.VideoQuality.HIGH:
        return 'h720';
      case lk.VideoQuality.MEDIUM:
        return 'h540';
      case lk.VideoQuality.LOW:
        return 'h360';
      default:
        return 'h540';
    }
  }

  /// Switch to audio-only mode
  Future<void> _switchToAudioOnly() async {
    if (_room == null) return;

    final localParticipant = _room!.localParticipant;
    if (localParticipant == null) return;

    try {
      // Disable camera
      await localParticipant.setCameraEnabled(false);
      
      Logger.info('Switched to audio-only mode due to poor connection', 'NetworkAdapterService');

    } catch (error) {
      Logger.error('Failed to switch to audio-only mode: $error', error, null, 'NetworkAdapterService');
    }
  }

  /// Enable data saver mode (aggressive bandwidth saving)
  Future<void> enableDataSaver() async {
    if (_room == null || _isDataSaverMode) return;

    _isDataSaverMode = true;
    Logger.info('Enabling data saver mode', 'NetworkAdapterService');

    try {
      final localParticipant = _room!.localParticipant;
      if (localParticipant == null) return;

      // Disable video
      await localParticipant.setCameraEnabled(false);

      Logger.debug('Data saver mode enabled', 'NetworkAdapterService');

    } catch (error) {
      Logger.error('Failed to enable data saver mode: $error', error, null, 'NetworkAdapterService');
      _isDataSaverMode = false;
    }
  }

  /// Disable data saver mode
  Future<void> disableDataSaver() async {
    if (_room == null || !_isDataSaverMode) return;

    _isDataSaverMode = false;
    Logger.info('Disabling data saver mode', 'NetworkAdapterService');

    try {
      final localParticipant = _room!.localParticipant;
      if (localParticipant == null) return;

      // Re-enable video with current quality settings
      final settings = _getAdaptationSettings(_currentQuality);
      await _applyVideoSettings(settings);

      Logger.debug('Data saver mode disabled', 'NetworkAdapterService');

    } catch (error) {
      Logger.error('Failed to disable data saver mode: $error', error, null, 'NetworkAdapterService');
    }
  }

  /// Check if in data saver mode
  bool isInDataSaverMode() {
    return _isDataSaverMode;
  }

  /// Get current quality level
  QualityLevel getCurrentQuality() {
    return _currentQuality;
  }

  /// Apply screen share quality settings
  Future<void> applyScreenShareSettings(lk.VideoQuality quality) async {
    if (_room == null || _room!.connectionState != lk.ConnectionState.connected) {
      Logger.warning('Cannot apply screen share settings: room not connected', 'NetworkAdapterService');
      return;
    }

    final localParticipant = _room!.localParticipant;
    if (localParticipant == null) return;
    
    // Check if screen sharing is active
    final isScreenShareEnabled = localParticipant.isScreenShareEnabled == true;
    if (!isScreenShareEnabled) {
      Logger.debug('No active screen share to apply quality settings', 'NetworkAdapterService');
      return;
    }

    try {
      // Get bitrate based on quality
      final maxBitrate = _getBitrateForQuality(quality);
      final resolution = _getVideoPreset(quality);

      // Note: LiveKit Dart SDK may require screen share quality to be set when starting
      // This logs the preference for reference
      Logger.info('Screen share quality preference: quality=$quality, maxBitrate=$maxBitrate, resolution=$resolution', 'NetworkAdapterService');
      
    } catch (error) {
      Logger.error('Failed to apply screen share settings: $error', error, null, 'NetworkAdapterService');
    }
  }

  /// Get bitrate for quality level (conservative values for screen sharing)
  int _getBitrateForQuality(lk.VideoQuality quality) {
    switch (quality) {
      case lk.VideoQuality.HIGH:
        return 1500000; // 1.5 Mbps (reduced from 2.5 Mbps)
      case lk.VideoQuality.MEDIUM:
        return 1000000; // 1 Mbps (reduced from 1.5 Mbps)
      case lk.VideoQuality.LOW:
        return 500000; // 500 kbps (reduced from 750 kbps)
      default:
        return 1000000;
    }
  }
}

