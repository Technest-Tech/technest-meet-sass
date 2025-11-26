import { Room, VideoPresets, VideoQuality, Track } from 'livekit-client';
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
    
    // Check if screen sharing is active
    const isScreenSharing = localParticipant.isScreenShareEnabled;
    
    // If screen sharing, use more conservative video settings to preserve audio
    const effectiveSettings = isScreenSharing ? {
      ...settings,
      maxBitrate: Math.min(settings.maxBitrate, 1000000), // Cap at 1 Mbps when screen sharing
      videoQuality: settings.videoQuality === VideoQuality.HIGH 
        ? VideoQuality.MEDIUM 
        : settings.videoQuality, // Downgrade high to medium when screen sharing
    } : settings;
    
    // Respect the user's current camera preference. If the camera is off we
    // should not turn it back on just to update quality settings.
    if (!localParticipant.isCameraEnabled) {
      logger.debug('Skipping video settings update because camera is disabled', {
        settings: effectiveSettings,
      });
      return;
    }

    const cameraPublication = localParticipant.getTrackPublication('camera');
    
    if (cameraPublication && cameraPublication.track) {
      try {
        // Update video encoding parameters while keeping the camera state intact.
        await localParticipant.setCameraEnabled(true, {
          resolution: this.getVideoPreset(effectiveSettings.videoQuality),
          maxBitrate: effectiveSettings.maxBitrate,
        });

        logger.debug('Applied video settings:', {
          quality: effectiveSettings.videoQuality,
          maxBitrate: effectiveSettings.maxBitrate,
          screenSharing: isScreenSharing,
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

  /**
   * Apply screen share quality settings
   */
  async applyScreenShareSettings(quality: VideoQuality): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      logger.warn('Cannot apply screen share settings: room not connected');
      return;
    }

    const localParticipant = this.room.localParticipant;
    const screenSharePublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);
    
    if (!screenSharePublication || !screenSharePublication.track) {
      logger.debug('No active screen share to apply quality settings');
      return;
    }

    try {
      // Get bitrate based on quality
      const maxBitrate = this.getBitrateForQuality(quality);
      const resolution = this.getVideoPreset(quality);

      // Note: LiveKit doesn't have a direct API to change screen share quality after it's started
      // The quality is typically set when starting the screen share.
      // However, we can log this for debugging and future implementation
      logger.info('Screen share quality preference:', {
        quality,
        maxBitrate,
        resolution: `${resolution.width}x${resolution.height}`,
        note: 'Quality should be set when starting screen share'
      });

      // If there's a way to update the track encoding, it would go here
      // For now, we'll rely on the quality being set when screen share starts
      
    } catch (error) {
      logger.error('Failed to apply screen share settings:', error);
    }
  }

  /**
   * Get bitrate for quality level (conservative values for screen sharing to preserve audio)
   */
  private getBitrateForQuality(quality: VideoQuality): number {
    switch (quality) {
      case VideoQuality.HIGH:
        return 1500000; // 1.5 Mbps (reduced from 2.5 Mbps)
      case VideoQuality.MEDIUM:
        return 1000000; // 1 Mbps (reduced from 1.5 Mbps)
      case VideoQuality.LOW:
        return 500000; // 500 kbps (reduced from 750 kbps)
      default:
        return 1000000;
    }
  }
}















