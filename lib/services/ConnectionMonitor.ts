import { Room, RoomEvent, Participant, ConnectionQuality } from 'livekit-client';
import { logger } from '../utils/logger';

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface ConnectionStats {
  quality: QualityLevel;
  bitrate: number;
  packetLoss: number;
  latency: number;
  jitter: number;
  lastUpdated: number;
}

export interface ConnectionMonitorCallbacks {
  onQualityChanged?: (quality: QualityLevel, stats: ConnectionStats) => void;
  onPoorConnection?: (stats: ConnectionStats) => void;
}

export class ConnectionMonitor {
  private room: Room | null = null;
  private callbacks: ConnectionMonitorCallbacks = {};
  private monitoringInterval: NodeJS.Timeout | null = null;
  private currentQuality: QualityLevel = 'good';
  private readonly MONITORING_INTERVAL_MS = 5000; // Check every 5 seconds
  private stats: ConnectionStats = {
    quality: 'good',
    bitrate: 0,
    packetLoss: 0,
    latency: 0,
    jitter: 0,
    lastUpdated: Date.now()
  };

  constructor(callbacks?: ConnectionMonitorCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Start monitoring the connection
   */
  startMonitoring(room: Room) {
    this.room = room;
    this.stopMonitoring(); // Clear any existing monitoring

    logger.debug('Starting connection monitoring');

    // Setup LiveKit connection quality events
    this.setupQualityListeners();

    // Start periodic stats collection
    this.monitoringInterval = setInterval(() => {
      this.collectStats();
    }, this.MONITORING_INTERVAL_MS);

    // Collect initial stats
    this.collectStats();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.room) {
      this.room.off(RoomEvent.ConnectionQualityChanged, this.handleQualityChange);
    }

    logger.debug('Stopped connection monitoring');
  }

  /**
   * Setup LiveKit quality listeners
   */
  private setupQualityListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.ConnectionQualityChanged, this.handleQualityChange);
  }

  /**
   * Handle LiveKit connection quality change event
   */
  private handleQualityChange = (quality: ConnectionQuality, participant: Participant | undefined) => {
    // Only monitor local participant quality
    if (participant && participant !== this.room?.localParticipant) {
      return;
    }

    logger.debug('Connection quality changed:', quality);

    // Map LiveKit quality to our quality levels
    const qualityLevel = this.mapLiveKitQuality(quality);
    this.updateQuality(qualityLevel);
  };

  /**
   * Map LiveKit ConnectionQuality to our QualityLevel
   */
  private mapLiveKitQuality(quality: ConnectionQuality): QualityLevel {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 'excellent';
      case ConnectionQuality.Good:
        return 'good';
      case ConnectionQuality.Poor:
        return 'fair';
      case ConnectionQuality.Lost:
        return 'poor';
      default:
        return 'poor'; // Changed from 'good' to be conservative and consistent
    }
  }

  /**
   * Collect connection statistics
   */
  private async collectStats() {
    if (!this.room || this.room.state !== 'connected') {
      return;
    }

    try {
      // Get stats from local participant
      const localParticipant = this.room.localParticipant;
      
      if (!localParticipant) {
        return;
      }

      // Get the first video or audio track to get connection stats
      const tracks = Array.from(localParticipant.trackPublications.values());
      if (tracks.length === 0) {
        return;
      }

      const track = tracks[0].track;
      if (!track || !track.mediaStreamTrack) {
        return;
      }

      // Get WebRTC stats via RTCPeerConnection
      const rtcStats = await track.sender?.getStats();
      
      if (!rtcStats) {
        return;
      }

      // Parse stats to extract relevant metrics
      let totalBitrate = 0;
      let totalPacketLoss = 0;
      let totalLatency = 0;
      let totalJitter = 0;
      let statsCount = 0;

      rtcStats.forEach((report) => {
        // Outbound RTP stats
        if (report.type === 'outbound-rtp') {
          if (report.bytesSent) {
            // Validate time difference before calculating bitrate
            const timeDiff = Date.now() - this.stats.lastUpdated;
            const MIN_TIME_THRESHOLD_MS = 100; // Minimum 100ms for valid calculation
            
            if (timeDiff >= MIN_TIME_THRESHOLD_MS && timeDiff < 60000) {
              // Only calculate if time difference is reasonable (between 100ms and 60 seconds)
              const bytesPerSecond = report.bytesSent / timeDiff * 1000;
            totalBitrate += bytesPerSecond * 8; // Convert to bits per second
            } else {
              // Use previous bitrate if time difference is invalid
              totalBitrate += this.stats.bitrate;
              logger.debug('Using previous bitrate due to invalid time difference', {
                timeDiff,
                lastUpdated: this.stats.lastUpdated,
                now: Date.now(),
              });
            }
          }
          
          if (report.fractionLost !== undefined) {
            totalPacketLoss += report.fractionLost * 100;
          }
          
          statsCount++;
        }

        // Candidate pair stats (for RTT/latency)
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime !== undefined) {
            totalLatency += report.currentRoundTripTime * 1000; // Convert to ms
          }
          statsCount++;
        }

        // Remote inbound RTP stats (for jitter)
        if (report.type === 'remote-inbound-rtp') {
          if (report.jitter !== undefined) {
            totalJitter += report.jitter * 1000; // Convert to ms
          }
          statsCount++;
        }
      });

      // Calculate averages
      if (statsCount > 0) {
        this.stats = {
          quality: this.currentQuality,
          bitrate: totalBitrate / statsCount,
          packetLoss: totalPacketLoss / statsCount,
          latency: totalLatency / statsCount,
          jitter: totalJitter / statsCount,
          lastUpdated: Date.now()
        };

        // Determine quality based on stats
        const calculatedQuality = this.calculateQualityFromStats(this.stats);
        this.updateQuality(calculatedQuality);
      }

    } catch (error) {
      logger.warn('Failed to collect connection stats:', error);
    }
  }

  /**
   * Calculate quality level from statistics
   */
  private calculateQualityFromStats(stats: ConnectionStats): QualityLevel {
    let score = 100;

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
      return 'excellent';
    } else if (score >= 70) {
      return 'good';
    } else if (score >= 50) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Update quality and notify callbacks
   */
  private updateQuality(newQuality: QualityLevel) {
    const previousQuality = this.currentQuality;
    this.currentQuality = newQuality;
    this.stats.quality = newQuality;

    // Notify if quality changed
    if (previousQuality !== newQuality) {
      logger.info('Connection quality changed:', {
        from: previousQuality,
        to: newQuality,
        stats: this.stats
      });

      this.callbacks.onQualityChanged?.(newQuality, this.stats);

      // Notify if connection is poor
      if (newQuality === 'poor') {
        this.callbacks.onPoorConnection?.(this.stats);
      }
    }
  }

  /**
   * Get current connection quality
   */
  getConnectionQuality(): QualityLevel {
    return this.currentQuality;
  }

  /**
   * Get current stats
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: ConnectionMonitorCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}















