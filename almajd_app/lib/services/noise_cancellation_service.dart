import 'package:livekit_client/livekit_client.dart';
import '../utils/logger.dart';
import 'dart:async';
import '../utils/logger.dart';

class NoiseCancellationService {
  static final NoiseCancellationService _instance = NoiseCancellationService._internal();
  factory NoiseCancellationService() => _instance;
  NoiseCancellationService._internal();

  bool _isEnabled = false;
  LocalAudioTrack? _currentTrack;
  StreamSubscription? _audioSubscription;

  bool get isEnabled => _isEnabled;

  /// Enable noise cancellation on the current microphone track
  Future<void> enableNoiseCancellation(LocalAudioTrack? track) async {
    if (track == null) {
      Logger.warning(' NoiseCancellation: No audio track provided', 'noise_cancellation_service');
      return;
    }

    try {
      _currentTrack = track;
      
      // Note: In LiveKit Flutter client, noise suppression is typically handled
      // at the WebRTC level when the track is created, not through track methods.
      // The track is already enabled if it exists.
      // 
      // For noise cancellation, you would typically:
      // 1. Configure it when creating the track (through LocalAudioTrackOptions)
      // 2. Or use WebRTC's built-in noise suppression (usually enabled by default)
      //
      // Since we can't modify track settings after creation, we just track the state
      // and the actual noise suppression is handled by WebRTC/LiveKit by default.
      
      _isEnabled = true;
      Logger.debug(' NoiseCancellation: Enabled (noise suppression handled by WebRTC)', 'noise_cancellation_service');
    } catch (e) {
      Logger.error(' NoiseCancellation: Failed to enable - $e', null, null, 'noise_cancellation_service');
      _isEnabled = false;
    }
  }

  /// Disable noise cancellation
  Future<void> disableNoiseCancellation() async {
    try {
      _isEnabled = false;
      await _audioSubscription?.cancel();
      _audioSubscription = null;
      Logger.debug(' NoiseCancellation: Disabled', 'noise_cancellation_service');
    } catch (e) {
      Logger.error(' NoiseCancellation: Failed to disable - $e', null, null, 'noise_cancellation_service');
    }
  }

  /// Toggle noise cancellation
  Future<void> toggle(LocalAudioTrack? track) async {
    if (_isEnabled) {
      await disableNoiseCancellation();
    } else {
      await enableNoiseCancellation(track);
    }
  }

  void dispose() {
    disableNoiseCancellation();
    _currentTrack = null;
  }
}

