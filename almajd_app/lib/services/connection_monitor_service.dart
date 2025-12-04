import 'dart:async';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';

/// Quality levels for connection monitoring
enum QualityLevel {
  excellent,
  good,
  fair,
  poor,
}

/// Connection statistics
class ConnectionStats {
  final QualityLevel quality;
  final double bitrate; // bits per second
  final double packetLoss; // percentage
  final double latency; // milliseconds
  final double jitter; // milliseconds
  final DateTime lastUpdated;

  ConnectionStats({
    required this.quality,
    required this.bitrate,
    required this.packetLoss,
    required this.latency,
    required this.jitter,
    required this.lastUpdated,
  });

  ConnectionStats copyWith({
    QualityLevel? quality,
    double? bitrate,
    double? packetLoss,
    double? latency,
    double? jitter,
    DateTime? lastUpdated,
  }) {
    return ConnectionStats(
      quality: quality ?? this.quality,
      bitrate: bitrate ?? this.bitrate,
      packetLoss: packetLoss ?? this.packetLoss,
      latency: latency ?? this.latency,
      jitter: jitter ?? this.jitter,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}

/// Callbacks for connection monitoring
class ConnectionMonitorCallbacks {
  final void Function(QualityLevel quality, ConnectionStats stats)? onQualityChanged;
  final void Function(ConnectionStats stats)? onPoorConnection;

  ConnectionMonitorCallbacks({
    this.onQualityChanged,
    this.onPoorConnection,
  });
}

/// Service to monitor connection quality and collect WebRTC statistics
class ConnectionMonitorService {
  lk.Room? _room;
  ConnectionMonitorCallbacks _callbacks = ConnectionMonitorCallbacks();
  Timer? _monitoringInterval;
  QualityLevel _currentQuality = QualityLevel.good;
  ConnectionStats _stats = ConnectionStats(
    quality: QualityLevel.good,
    bitrate: 0,
    packetLoss: 0,
    latency: 0,
    jitter: 0,
    lastUpdated: DateTime.now(),
  );
  
  static const int MONITORING_INTERVAL_MS = 5000; // Check every 5 seconds
  lk.EventsListener<lk.RoomEvent>? _qualityListener;

  /// Start monitoring the connection
  void startMonitoring(lk.Room room) {
    _room = room;
    stopMonitoring(); // Clear any existing monitoring

    Logger.debug('Starting connection monitoring', 'ConnectionMonitorService');

    // Setup LiveKit connection quality events
    _setupQualityListeners();

    // Start periodic stats collection
    _monitoringInterval = Timer.periodic(
      const Duration(milliseconds: MONITORING_INTERVAL_MS),
      (_) => _collectStats(),
    );

    // Collect initial stats
    _collectStats();
  }

  /// Stop monitoring
  void stopMonitoring() {
    if (_monitoringInterval != null) {
      _monitoringInterval?.cancel();
      _monitoringInterval = null;
    }

    _qualityListener?.dispose();
    _qualityListener = null;

    Logger.debug('Stopped connection monitoring', 'ConnectionMonitorService');
  }

  /// Setup LiveKit quality listeners
  void _setupQualityListeners() {
    if (_room == null) return;

    // Note: LiveKit Dart SDK may not have ConnectionQualityChangedEvent
    // We'll poll connection quality in _collectStats instead
    // This method is kept for future compatibility
  }

  /// Map LiveKit ConnectionQuality to our QualityLevel
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
        return QualityLevel.poor; // Conservative default
    }
  }

  /// Collect connection statistics
  Future<void> _collectStats() async {
    if (_room == null || _room!.connectionState != lk.ConnectionState.connected) {
      return;
    }

    try {
      // Get stats from local participant
      final localParticipant = _room!.localParticipant;
      
      if (localParticipant == null) {
        return;
      }

      // Get connection stats from room
      // Note: LiveKit Dart SDK may have different API for stats
      // This is a simplified version - actual implementation may need adjustment
      
      // Try to get stats from tracks
      double totalBitrate = 0;
      double totalPacketLoss = 0;
      double totalLatency = 0;
      double totalJitter = 0;
      int statsCount = 0;

      // Get stats from video tracks
      for (final publication in localParticipant.videoTrackPublications) {
        final track = publication.track;
        if (track != null && track is lk.LocalVideoTrack) {
          // Note: LiveKit Dart SDK stats collection may differ
          // This is a placeholder - actual stats collection needs LiveKit SDK support
          statsCount++;
        }
      }

      // Get stats from audio tracks
      for (final publication in localParticipant.audioTrackPublications) {
        final track = publication.track;
        if (track != null && track is lk.LocalAudioTrack) {
          statsCount++;
        }
      }

      // Use LiveKit's connection quality as primary indicator
      final liveKitQuality = localParticipant.connectionQuality ?? lk.ConnectionQuality.good;
      final qualityLevel = _mapLiveKitQuality(liveKitQuality);

      // Calculate quality from stats if available
      if (statsCount > 0) {
        // Update stats (simplified - actual implementation would parse WebRTC stats)
        _stats = _stats.copyWith(
          quality: qualityLevel,
          bitrate: totalBitrate / statsCount,
          packetLoss: totalPacketLoss / statsCount,
          latency: totalLatency / statsCount,
          jitter: totalJitter / statsCount,
          lastUpdated: DateTime.now(),
        );

        // Determine quality based on stats
        final calculatedQuality = _calculateQualityFromStats(_stats);
        _updateQuality(calculatedQuality);
      } else {
        // Fallback to LiveKit quality if no stats available
        _updateQuality(qualityLevel);
      }

    } catch (error) {
      Logger.warning('Failed to collect connection stats: $error', 'ConnectionMonitorService');
    }
  }

  /// Calculate quality level from statistics
  QualityLevel _calculateQualityFromStats(ConnectionStats stats) {
    double score = 100;

    // Deduct points for packet loss (0-40 points)
    if (stats.packetLoss > 10) {
      score -= 40;
    } else if (stats.packetLoss > 5) {
      score -= 30;
    } else if (stats.packetLoss > 2) {
      score -= 20;
    } else if (stats.packetLoss > 0.5) {
      score -= 10;
    }

    // Deduct points for latency (0-30 points)
    if (stats.latency > 300) {
      score -= 30;
    } else if (stats.latency > 200) {
      score -= 20;
    } else if (stats.latency > 100) {
      score -= 10;
    }

    // Deduct points for jitter (0-20 points)
    if (stats.jitter > 50) {
      score -= 20;
    } else if (stats.jitter > 30) {
      score -= 15;
    } else if (stats.jitter > 15) {
      score -= 10;
    }

    // Deduct points for low bitrate (0-10 points)
    if (stats.bitrate < 100000) { // < 100 kbps
      score -= 10;
    } else if (stats.bitrate < 500000) { // < 500 kbps
      score -= 5;
    }

    // Map score to quality level
    if (score >= 85) {
      return QualityLevel.excellent;
    } else if (score >= 70) {
      return QualityLevel.good;
    } else if (score >= 50) {
      return QualityLevel.fair;
    } else {
      return QualityLevel.poor;
    }
  }

  /// Update quality and notify callbacks
  void _updateQuality(QualityLevel newQuality) {
    final previousQuality = _currentQuality;
    _currentQuality = newQuality;
    _stats = _stats.copyWith(
      quality: newQuality,
      lastUpdated: DateTime.now(),
    );

    // Notify if quality changed
    if (previousQuality != newQuality) {
      Logger.info('Connection quality changed: $previousQuality -> $newQuality', 'ConnectionMonitorService');

      _callbacks.onQualityChanged?.call(newQuality, _stats);

      // Notify if connection is poor
      if (newQuality == QualityLevel.poor) {
        _callbacks.onPoorConnection?.call(_stats);
      }
    }
  }

  /// Get current connection quality
  QualityLevel getConnectionQuality() {
    return _currentQuality;
  }

  /// Get current stats
  ConnectionStats getStats() {
    return ConnectionStats(
      quality: _stats.quality,
      bitrate: _stats.bitrate,
      packetLoss: _stats.packetLoss,
      latency: _stats.latency,
      jitter: _stats.jitter,
      lastUpdated: _stats.lastUpdated,
    );
  }

  /// Set callbacks
  void setCallbacks(ConnectionMonitorCallbacks callbacks) {
    _callbacks = callbacks;
  }

  /// Dispose resources
  void dispose() {
    stopMonitoring();
  }
}

