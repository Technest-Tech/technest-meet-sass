import 'dart:async';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import 'connection_monitor_service.dart';
import 'network_adapter_service.dart';
import '../store/media_quality_store.dart';

/// Service to manage adaptive streaming for video quality
class AdaptiveStreamManager {
  lk.Room? _room;
  ConnectionMonitorService? _connectionMonitor;
  NetworkAdapterService? _networkAdapter;
  MediaQualityStore? _qualityStore;
  
  QualityLevel _lastNetworkQuality = QualityLevel.good;
  final Map<String, QualityLevel> _participantQualityMap = {};
  
  // Debouncing: track pending quality updates per track
  final Map<String, Timer> _qualityChangeTimeouts = {};
  
  // Hysteresis: track last quality per track
  final Map<String, lk.VideoQuality> _lastQualityMap = {};
  
  // Error recovery: track failure counts per track
  final Map<String, int> _failureCountMap = {};
  
  // Track last successful update time for failure recovery
  final Map<String, DateTime> _lastSuccessTimeMap = {};
  
  // Track last quality change time for stability requirement
  final Map<String, DateTime> _lastQualityChangeTimeMap = {};
  
  lk.EventsListener<lk.RoomEvent>? _roomListener;
  
  static const int debounceDelayMs = 500;
  static const int stabilityRequiredMs = 2500; // 2.5 seconds
  static const int successResetMs = 30000; // 30 seconds
  static const int maxFailures = 3;

  /// Initialize adaptive stream manager
  void initialize({
    required lk.Room room,
    required ConnectionMonitorService connectionMonitor,
    required NetworkAdapterService networkAdapter,
    required MediaQualityStore qualityStore,
  }) {
    _room = room;
    _connectionMonitor = connectionMonitor;
    _networkAdapter = networkAdapter;
    _qualityStore = qualityStore;
    
    Logger.debug('Initializing AdaptiveStreamManager', 'AdaptiveStreamManager');
    
    // Setup connection monitor callbacks
    _connectionMonitor!.setCallbacks(ConnectionMonitorCallbacks(
      onQualityChanged: (quality, stats) {
        _lastNetworkQuality = quality;
        _networkAdapter!.adaptToNetworkConditions(quality);
        _applyQualityToRemoteTracks(quality);
      },
      onPoorConnection: (stats) {
        _applyQualityToRemoteTracks(QualityLevel.poor);
      },
    ));
    
    // Setup room event listeners
    _setupRoomListeners();
    
    // Apply initial quality
    _applyQualityToRemoteTracks(_lastNetworkQuality);
  }

  /// Setup room event listeners
  void _setupRoomListeners() {
    if (_room == null) return;
    
    _roomListener = _room!.createListener();
    
    // Note: LiveKit Dart SDK may not have ConnectionQualityChangedEvent
    // We'll poll connection quality periodically instead
    // Connection quality changes will be detected during periodic quality updates
    
    // Handle new participants joining
    _roomListener!.on<lk.ParticipantConnectedEvent>((event) {
      if (event.participant == _room?.localParticipant) {
        return;
      }
      
      // Initialize quality for new participant
      final remoteConnectionQuality = event.participant.connectionQuality ?? lk.ConnectionQuality.poor;
      final remoteQuality = _mapLiveKitQuality(remoteConnectionQuality);
      _participantQualityMap[event.participant.identity] = remoteQuality;
      
      // Apply quality to their tracks
      final effectiveQuality = _getEffectiveQuality(_lastNetworkQuality, remoteQuality);
      _applyQualityToParticipant(event.participant, effectiveQuality);
    });
    
    // Clean up participant quality when they disconnect
    _roomListener!.on<lk.ParticipantDisconnectedEvent>((event) {
      final participantIdentity = event.participant.identity;
      _participantQualityMap.remove(participantIdentity);
      
      // Clean up all tracking data for this participant
      _cleanupParticipantData(participantIdentity);
    });
    
    // Handle track subscriptions
    _roomListener!.on<lk.TrackSubscribedEvent>((event) {
      if (event.participant == _room?.localParticipant) {
        return;
      }
      
      // Skip if connection is lost
      if (event.participant.connectionQuality == lk.ConnectionQuality.lost) {
        return;
      }
      
      // Get effective quality based on both local and remote connection
      final remoteConnectionQuality = event.participant.connectionQuality ?? lk.ConnectionQuality.poor;
      final remoteQuality = _mapLiveKitQuality(remoteConnectionQuality);
      final effectiveQuality = _getEffectiveQuality(_lastNetworkQuality, remoteQuality);
      
      // Check if this is a video track (using string comparison as fallback)
      final isVideoTrack = event.publication.kind.toString().toLowerCase().contains('video');
      if (isVideoTrack) {
        final target = _determineTargetQuality(event.publication, effectiveQuality);
        if (target != null) {
          _setVideoQualitySafely(event.publication, target, event.participant.identity, {
            'localQuality': _lastNetworkQuality,
            'remoteQuality': remoteQuality,
            'effectiveQuality': effectiveQuality,
          });
        }
      }
    });
  }

  /// Map LiveKit ConnectionQuality to QualityLevel
  QualityLevel _mapLiveKitQuality(lk.ConnectionQuality quality) {
    switch (quality) {
      case lk.ConnectionQuality.excellent:
        return QualityLevel.excellent;
      case lk.ConnectionQuality.good:
        return QualityLevel.good;
      case lk.ConnectionQuality.poor:
        return QualityLevel.fair;
      case lk.ConnectionQuality.lost:
        return QualityLevel.poor;
      default:
        return QualityLevel.poor;
    }
  }

  /// Get effective quality based on both local and remote connection quality
  QualityLevel _getEffectiveQuality(QualityLevel localQuality, QualityLevel remoteQuality) {
    // Quality hierarchy: poor < fair < good < excellent
    const qualityOrder = [QualityLevel.poor, QualityLevel.fair, QualityLevel.good, QualityLevel.excellent];
    final localIndex = qualityOrder.indexOf(localQuality);
    final remoteIndex = qualityOrder.indexOf(remoteQuality);
    
    // Return the worse (lower index) quality
    return qualityOrder[localIndex < remoteIndex ? localIndex : remoteIndex];
  }

  /// Map QualityLevel to VideoQuality
  lk.VideoQuality _qualityFromNetwork(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return lk.VideoQuality.HIGH;
      case QualityLevel.good:
        return lk.VideoQuality.MEDIUM;
      case QualityLevel.fair:
      case QualityLevel.poor:
      default:
        return lk.VideoQuality.LOW;
    }
  }

  /// Map quality preference to VideoQuality
  lk.VideoQuality? _qualityFromPreference(VideoQualityPreference pref) {
    switch (pref) {
      case VideoQualityPreference.high:
        return lk.VideoQuality.HIGH;
      case VideoQualityPreference.medium:
        return lk.VideoQuality.MEDIUM;
      case VideoQualityPreference.low:
        return lk.VideoQuality.LOW;
      case VideoQualityPreference.auto:
        return null;
    }
  }

  /// Determine target quality for a track
  lk.VideoQuality? _determineTargetQuality(
    lk.RemoteTrackPublication publication,
    QualityLevel networkQuality,
  ) {
    // Get network-based quality first
    final networkBasedQuality = _qualityFromNetwork(networkQuality);
    
    // Check if this is screen share (by checking publication name)
    final name = publication.name?.toLowerCase() ?? '';
    final isScreenShare = name.contains('screen') || 
                          name.contains('screenshare') ||
                          name.contains('screen-share');
    
    if (isScreenShare) {
      // Use screen share quality preference
      final manualChoice = _qualityStore!.screenShareQuality != VideoQualityPreference.auto
        ? _qualityFromPreference(_qualityStore!.screenShareQuality)
        : null;
      if (manualChoice != null) {
        // Cap manual choice based on network quality
        const qualityOrder = [lk.VideoQuality.LOW, lk.VideoQuality.MEDIUM, lk.VideoQuality.HIGH];
        final manualIndex = qualityOrder.indexOf(manualChoice);
        final networkIndex = qualityOrder.indexOf(networkBasedQuality);
        return qualityOrder[manualIndex < networkIndex ? manualIndex : networkIndex];
      }
      return networkBasedQuality;
    }

    // For regular video tracks
    final manualChoice = _qualityStore!.videoQuality != VideoQualityPreference.auto
      ? _qualityFromPreference(_qualityStore!.videoQuality)
      : null;
    if (manualChoice != null) {
      // Cap manual choice based on network quality
      const qualityOrder = [lk.VideoQuality.LOW, lk.VideoQuality.MEDIUM, lk.VideoQuality.HIGH];
      final manualIndex = qualityOrder.indexOf(manualChoice);
      final networkIndex = qualityOrder.indexOf(networkBasedQuality);
      return qualityOrder[manualIndex < networkIndex ? manualIndex : networkIndex];
    }

    return networkBasedQuality;
  }

  /// Set video quality with debouncing, validation, hysteresis, and error recovery
  void _setVideoQualitySafely(
    lk.RemoteTrackPublication publication,
    lk.VideoQuality target,
    String participantIdentity,
    Map<String, dynamic> context,
  ) {
    // Generate unique key for this track
    final trackSid = publication.sid ?? '${publication.name ?? 'unknown'}-${DateTime.now().millisecondsSinceEpoch}';
    final participantKey = '$participantIdentity-$trackSid';
    
    // Track state validation: check if track is valid
    if (publication.track == null || !publication.subscribed) {
      Logger.debug('Skipping quality update for invalid track state', 'AdaptiveStreamManager');
      return;
    }

    // Error recovery: check if we've had too many failures
    final failures = _failureCountMap[participantKey] ?? 0;
    final lastSuccess = _lastSuccessTimeMap[participantKey];
    
    // Reset failure count if track has been successful for 30+ seconds
    if (lastSuccess != null && DateTime.now().difference(lastSuccess).inMilliseconds >= successResetMs) {
      _failureCountMap.remove(participantKey);
      Logger.debug('Reset failure count after successful period', 'AdaptiveStreamManager');
    } else if (failures >= maxFailures) {
      Logger.debug('Skipping quality update due to repeated failures', 'AdaptiveStreamManager');
      return;
    }

    // Hysteresis: check if quality actually needs to change
    final lastQuality = _lastQualityMap[participantKey];
    if (lastQuality == target) {
      // No change needed
      return;
    }

    // Hysteresis: require stability for upgrades, allow immediate downgrades
    const qualityOrder = [lk.VideoQuality.LOW, lk.VideoQuality.MEDIUM, lk.VideoQuality.HIGH];
    final lastIndex = lastQuality != null ? qualityOrder.indexOf(lastQuality) : -1;
    final targetIndex = qualityOrder.indexOf(target);
    
      // If upgrading (target > last), require stability period
      if (targetIndex > lastIndex && lastQuality != null) {
        final lastChangeTime = _lastQualityChangeTimeMap[participantKey];
        if (lastChangeTime != null) {
          final timeSinceLastChange = DateTime.now().difference(lastChangeTime).inMilliseconds;
          if (timeSinceLastChange < stabilityRequiredMs) {
          Logger.debug('Skipping quality upgrade - connection not stable enough', 'AdaptiveStreamManager');
          return;
        }
      }
    }
    // Allow immediate downgrades (target < last) for stability

    // Debouncing: clear existing timeout
    final existingTimeout = _qualityChangeTimeouts[participantKey];
    if (existingTimeout != null) {
      existingTimeout.cancel();
    }

    // Set new timeout for debounced quality update
      final timeout = Timer(Duration(milliseconds: debounceDelayMs), () {
      try {
        // Set video quality on remote track publication
        final isVideoTrack = publication.kind.toString().toLowerCase().contains('video');
        if (isVideoTrack && publication.track != null) {
          // Set video quality - API confirmed to exist in LiveKit Dart SDK
          publication.setVideoQuality(target);
          Logger.debug('Set video quality: $target', 'AdaptiveStreamManager');
        }
        
        // Success: update last quality, reset failure count, and track success time
        _lastQualityMap[participantKey] = target;
        _failureCountMap.remove(participantKey);
        _lastSuccessTimeMap[participantKey] = DateTime.now();
        _lastQualityChangeTimeMap[participantKey] = DateTime.now();
        
        Logger.debug('Set video quality successfully', 'AdaptiveStreamManager');
      } catch (error) {
        // Error recovery: increment failure count
        final newFailures = (_failureCountMap[participantKey] ?? 0) + 1;
        _failureCountMap[participantKey] = newFailures;
        
        Logger.warning('Failed to set video quality: $error', 'AdaptiveStreamManager');
      } finally {
        // Clean up timeout reference
        _qualityChangeTimeouts.remove(participantKey);
      }
    });

    _qualityChangeTimeouts[participantKey] = timeout;
  }

  /// Apply quality to all remote participants' tracks
  void _applyQualityToRemoteTracks(QualityLevel networkQuality) {
    if (_room == null) return;

    for (final participant in _room!.remoteParticipants.values) {
      // Skip if connection is lost
      if (participant.connectionQuality == lk.ConnectionQuality.lost) {
        Logger.debug('Skipping quality update for disconnected participant', 'AdaptiveStreamManager');
        continue;
      }
      
      // Get this remote participant's connection quality
      final remoteConnectionQuality = participant.connectionQuality ?? lk.ConnectionQuality.poor;
      final remoteQuality = _mapLiveKitQuality(remoteConnectionQuality);
      
      // Store participant quality for reference
      _participantQualityMap[participant.identity] = remoteQuality;
      
      // Determine effective quality based on BOTH local and remote connection
      final effectiveQuality = _getEffectiveQuality(networkQuality, remoteQuality);
      
      _applyQualityToParticipant(participant, effectiveQuality);
    }
  }

  /// Apply quality to a specific participant
  void _applyQualityToParticipant(lk.RemoteParticipant participant, QualityLevel effectiveQuality) {
    participant.videoTrackPublications.forEach((publication) {
      final target = _determineTargetQuality(publication, effectiveQuality);
      if (target != null) {
        _setVideoQualitySafely(publication, target, participant.identity, {
          'localQuality': _lastNetworkQuality,
          'remoteQuality': _participantQualityMap[participant.identity] ?? QualityLevel.good,
          'effectiveQuality': effectiveQuality,
        });
      }
    });
  }

  /// Clean up tracking data for a participant
  void _cleanupParticipantData(String participantIdentity) {
    final keysToDelete = <String>[];
    
    // Find all keys belonging to this participant
    _qualityChangeTimeouts.forEach((key, timeout) {
      if (key.startsWith('$participantIdentity-')) {
        timeout.cancel();
        keysToDelete.add(key);
      }
    });
    
    // Clean up all maps for this participant
    for (final key in keysToDelete) {
      _qualityChangeTimeouts.remove(key);
      _lastQualityMap.remove(key);
      _failureCountMap.remove(key);
      _lastSuccessTimeMap.remove(key);
      _lastQualityChangeTimeMap.remove(key);
    }
    
    Logger.debug('Cleaned up tracking data for disconnected participant', 'AdaptiveStreamManager');
  }

  /// Apply camera quality changes when user changes preference
  Future<void> applyCameraQuality() async {
    if (_room == null || _room!.connectionState != lk.ConnectionState.connected) {
      return;
    }

    final localParticipant = _room!.localParticipant;
    if (localParticipant == null) {
      return;
    }
    final isCameraEnabled = localParticipant.isCameraEnabled == true;
    if (!isCameraEnabled) {
      return; // Don't apply if camera is off
    }

    // Get network-based quality first
    final networkBasedQuality = _qualityFromNetwork(_lastNetworkQuality);
    final manualChoice = _qualityStore!.videoQuality != VideoQualityPreference.auto
      ? _qualityFromPreference(_qualityStore!.videoQuality)
      : null;

    // Cap manual choice based on network quality
    lk.VideoQuality targetQuality;
    if (manualChoice != null) {
      const qualityOrder = [lk.VideoQuality.LOW, lk.VideoQuality.MEDIUM, lk.VideoQuality.HIGH];
      final manualIndex = qualityOrder.indexOf(manualChoice);
      final networkIndex = qualityOrder.indexOf(networkBasedQuality);
      targetQuality = qualityOrder[manualIndex < networkIndex ? manualIndex : networkIndex];
    } else {
      targetQuality = networkBasedQuality;
    }

    try {
      // Note: VideoTrackSettings API is not available in LiveKit Dart SDK 2.5.0
      // Local camera quality control is limited - we can only enable/disable
      // Quality is controlled by the SDK's adaptive streaming and RoomOptions
      await localParticipant.setCameraEnabled(true);
      Logger.debug('Applied camera quality change (target: $targetQuality) - Note: VideoTrackSettings not available, using SDK defaults', 'AdaptiveStreamManager');
    } catch (error) {
      Logger.warning('Failed to apply camera quality change: $error', 'AdaptiveStreamManager');
    }
  }

  /// Dispose resources
  void dispose() {
    // Cancel all pending timeouts
    _qualityChangeTimeouts.forEach((_, timeout) => timeout.cancel());
    _qualityChangeTimeouts.clear();
    
    _roomListener?.dispose();
    _roomListener = null;
    
    Logger.debug('AdaptiveStreamManager disposed', 'AdaptiveStreamManager');
  }
}

