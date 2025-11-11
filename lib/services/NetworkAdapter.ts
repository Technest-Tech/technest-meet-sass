import { Room, VideoPresets, VideoQuality } from 'livekit-client';
import { logger } from '../utils/logger';
import { QualityLevel } from './ConnectionMonitor';

export interface AdaptationSettings {
  videoQuality: VideoQuality;
  maxBitrate: number;
  simulcast: boolean;
  audioOnly: boolean;
}

export class NetworkAdapter {
  private room: Room | null = null;
  private currentQuality: QualityLevel = 'good';
  private isDataSaverMode = false;

  constructor() {}

  /**
   * Set the room instance
   */
  setRoom(room: Room) {
    this.room = room;
  }

  /**
   * Adapt to current network conditions based on connection quality
   */
  async adaptToNetworkConditions(quality: QualityLevel): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      logger.warn('Cannot adapt network settings: room not connected');
      return;
    }

    this.currentQuality = quality;
    const settings = this.getAdaptationSettings(quality);

    logger.info('Adapting to network conditions:', {
      quality,
      settings
    });

    try {
      // Apply video quality settings
      await this.applyVideoSettings(settings);
      
      // Apply audio settings if needed
      if (settings.audioOnly) {
        await this.switchToAudioOnly();
      }

    } catch (error) {
      logger.error('Failed to adapt network settings:', error);
    }
  }

  /**
   * Get adaptation settings for a given quality level
   */
  private getAdaptationSettings(quality: QualityLevel): AdaptationSettings {
    switch (quality) {
      case 'excellent':
        return {
          videoQuality: VideoQuality.HIGH,
          maxBitrate: 2500000, // 2.5 Mbps
          simulcast: true,
          audioOnly: false
        };

      case 'good':
        return {
          videoQuality: VideoQuality.MEDIUM,
          maxBitrate: 1500000, // 1.5 Mbps
          simulcast: true,
          audioOnly: false
        };

      case 'fair':
        return {
          videoQuality: VideoQuality.LOW,
          maxBitrate: 750000, // 750 kbps
          simulcast: false,
          audioOnly: false
        };

      case 'poor':
        return {
          videoQuality: VideoQuality.LOW,
          maxBitrate: 300000, // 300 kbps
          simulcast: false,
          audioOnly: true // Switch to audio-only for poor connections
        };

      default:
        return {
          videoQuality: VideoQuality.MEDIUM,
          maxBitrate: 1500000,
          simulcast: true,
          audioOnly: false
        };
    }
  }

  /**
   * Apply video quality settings
   */
  private async applyVideoSettings(settings: AdaptationSettings): Promise<void> {
    if (!this.room) return;

    const localParticipant = this.room.localParticipant;
    
    // Get camera track
    const cameraPublication = localParticipant.getTrackPublication('camera');
    
    if (cameraPublication && cameraPublication.track) {
      try {
        // Update video encoding parameters
        await localParticipant.setCameraEnabled(true, {
          resolution: this.getVideoPreset(settings.videoQuality),
          maxBitrate: settings.maxBitrate
        });

        logger.debug('Applied video settings:', {
          quality: settings.videoQuality,
          maxBitrate: settings.maxBitrate
        });

      } catch (error) {
        logger.error('Failed to apply video settings:', error);
      }
    }
  }

  /**
   * Get video preset for quality level
   */
  private getVideoPreset(quality: VideoQuality): typeof VideoPresets.h720 {
    switch (quality) {
      case VideoQuality.HIGH:
        return VideoPresets.h720;
      case VideoQuality.MEDIUM:
        return VideoPresets.h540;
      case VideoQuality.LOW:
        return VideoPresets.h360;
      default:
        return VideoPresets.h540;
    }
  }

  /**
   * Switch to audio-only mode
   */
  private async switchToAudioOnly(): Promise<void> {
    if (!this.room) return;

    const localParticipant = this.room.localParticipant;

    try {
      // Disable camera
      await localParticipant.setCameraEnabled(false);
      
      logger.info('Switched to audio-only mode due to poor connection');

    } catch (error) {
      logger.error('Failed to switch to audio-only mode:', error);
    }
  }

  /**
   * Enable data saver mode (aggressive bandwidth saving)
   */
  async enableDataSaver(): Promise<void> {
    if (!this.room || this.isDataSaverMode) return;

    this.isDataSaverMode = true;
    logger.info('Enabling data saver mode');

    try {
      const localParticipant = this.room.localParticipant;

      // Disable video
      await localParticipant.setCameraEnabled(false);

      // Lower audio quality if needed
      // Note: LiveKit doesn't have direct audio quality control via participant API
      // but you could implement this via custom track settings

      logger.success('Data saver mode enabled');

    } catch (error) {
      logger.error('Failed to enable data saver mode:', error);
      this.isDataSaverMode = false;
    }
  }

  /**
   * Disable data saver mode
   */
  async disableDataSaver(): Promise<void> {
    if (!this.room || !this.isDataSaverMode) return;

    this.isDataSaverMode = false;
    logger.info('Disabling data saver mode');

    try {
      const localParticipant = this.room.localParticipant;

      // Re-enable video with current quality settings
      const settings = this.getAdaptationSettings(this.currentQuality);
      await this.applyVideoSettings(settings);

      logger.success('Data saver mode disabled');

    } catch (error) {
      logger.error('Failed to disable data saver mode:', error);
    }
  }

  /**
   * Check if in data saver mode
   */
  isInDataSaverMode(): boolean {
    return this.isDataSaverMode;
  }

  /**
   * Get current quality level
   */
  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }
}





