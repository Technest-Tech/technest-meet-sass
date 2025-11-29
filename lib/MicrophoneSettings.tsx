import React, { useState, useEffect } from 'react';
import { TrackToggle } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';
import { isLowPowerDevice } from './client-utils';

// Dynamically import noise suppression processor to avoid SSR issues
// Note: NoiseSuppressionProcessor is not available in @livekit/track-processors
// This feature may not be available in the current version
type NoiseProcessorType = any;
let NoiseSuppressionProcessor: NoiseProcessorType | null = null;

interface MicrophoneSettingsProps {
  roomFeatures?: {
    enableNoiseCancellation?: boolean;
  };
}

export function MicrophoneSettings({ roomFeatures }: MicrophoneSettingsProps) {
  const room = useRoomContext();
  const [isNoiseFilterEnabled, setIsNoiseFilterEnabled] = useState(false);
  const [isNoiseFilterPending, setIsNoiseFilterPending] = useState(false);
  const [processor, setProcessor] = useState<NoiseProcessorType | null>(null);

  // Apply or remove noise cancellation filter
  useEffect(() => {
    if (!room || !roomFeatures?.enableNoiseCancellation) return;

    const localParticipant = room.localParticipant;
    if (!localParticipant) {
      return;
    }

    // Only apply if microphone is enabled and noise cancellation is enabled
    if (!localParticipant.isMicrophoneEnabled || !isNoiseFilterEnabled) {
      // If noise cancellation is disabled but processor exists, remove it
      if (!isNoiseFilterEnabled && processor) {
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;
        if (micTrack instanceof LocalAudioTrack) {
          micTrack.removeProcessor(processor).catch(console.error);
          setProcessor(null);
        }
      }
      return;
    }

    const applyNoiseCancellation = async () => {
      try {
        setIsNoiseFilterPending(true);
        
        // Get the microphone track
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;
        
        if (!micTrack || !(micTrack instanceof LocalAudioTrack)) {
          console.warn('No microphone track found');
          return;
        }

        // Only apply if not already applied
        if (isNoiseFilterEnabled && !processor) {
          // Noise suppression processor is not available in current @livekit/track-processors version
          // This feature is disabled until a compatible processor is available
          console.warn('Noise suppression is not available in the current version of @livekit/track-processors');
          setIsNoiseFilterEnabled(false);
          return;
        }
      } catch (error) {
        console.error('Failed to toggle noise cancellation:', error);
        // Revert state on error
        setIsNoiseFilterEnabled(false);
      } finally {
        setIsNoiseFilterPending(false);
      }
    };

    applyNoiseCancellation();

    // Cleanup on unmount or when microphone is disabled
    return () => {
      if (processor && localParticipant) {
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;
        if (micTrack instanceof LocalAudioTrack) {
          micTrack.removeProcessor(processor).catch(console.error);
        }
      }
    };
  }, [isNoiseFilterEnabled, room, processor, roomFeatures?.enableNoiseCancellation]);

  const toggleNoiseFilter = () => {
    if (!isNoiseFilterPending && roomFeatures?.enableNoiseCancellation) {
      setIsNoiseFilterEnabled(!isNoiseFilterEnabled);
    }
  };

  const isFeatureEnabled = roomFeatures?.enableNoiseCancellation ?? false;
  const isDisabled = isNoiseFilterPending || !isFeatureEnabled || isLowPowerDevice();

  return (
    <div
      dir="ltr"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <section className="lk-button-group">
        <TrackToggle source={Track.Source.Microphone}>Microphone</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput" />
        </div>
      </section>

      <button
        className="lk-button"
        onClick={toggleNoiseFilter}
        disabled={isDisabled}
        aria-pressed={isNoiseFilterEnabled}
        title={
          !isFeatureEnabled
            ? 'Noise cancellation not available in your plan'
            : isLowPowerDevice()
            ? 'Noise cancellation not available on low-power devices'
            : isNoiseFilterEnabled
            ? 'Disable noise cancellation'
            : 'Enable noise cancellation'
        }
      >
        {isNoiseFilterPending
          ? '...'
          : isNoiseFilterEnabled
          ? '🔇 Disable Noise Cancellation'
          : '🔊 Enable Noise Cancellation'}
      </button>
    </div>
  );
}
