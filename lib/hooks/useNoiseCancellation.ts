'use client';

import { useState, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';
import { isLowPowerDevice } from '../client-utils';

// Dynamically import Krisp noise filter to avoid SSR issues
let NoiseFilter: any = null;
let isNoiseFilterLoading = false;

// Load noise filter on client side
if (typeof window !== 'undefined') {
  import('@livekit/krisp-noise-filter')
    .then((module) => {
      // Try different export patterns
      NoiseFilter = module.default || module.NoiseFilter || module;
      isNoiseFilterLoading = false;
    })
    .catch((error) => {
      console.error('Failed to load Krisp noise filter:', error);
      isNoiseFilterLoading = false;
    });
}

interface UseNoiseCancellationOptions {
  enabled?: boolean;
  featureEnabled?: boolean;
}

interface UseNoiseCancellationReturn {
  isEnabled: boolean;
  isPending: boolean;
  error: string | null;
  toggle: () => Promise<void>;
}

export function useNoiseCancellation(
  options: UseNoiseCancellationOptions = {}
): UseNoiseCancellationReturn {
  const { enabled = false, featureEnabled = false } = options;
  const room = useRoomContext();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processorRef = useRef<any | null>(null);
  const isApplyingRef = useRef(false);

  // Check if feature is available
  const isFeatureAvailable = featureEnabled && !isLowPowerDevice();

  // Apply or remove noise cancellation filter
  useEffect(() => {
    if (!room || !isFeatureAvailable) {
      return;
    }

    const localParticipant = room.localParticipant;
    if (!localParticipant) {
      return;
    }

    // If noise cancellation is disabled, remove processor if it exists
    if (!isEnabled) {
      if (processorRef.current) {
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;
        if (micTrack instanceof LocalAudioTrack) {
          micTrack
            .removeProcessor(processorRef.current)
            .then(() => {
              processorRef.current = null;
              setError(null);
            })
            .catch((err) => {
              console.error('Failed to remove noise filter:', err);
              setError('Failed to disable noise cancellation');
            });
        }
      }
      return;
    }

    // Only apply if microphone is enabled
    if (!localParticipant.isMicrophoneEnabled) {
      return;
    }

    // If already applying or already has processor, skip
    if (isApplyingRef.current || processorRef.current) {
      return;
    }

    const applyNoiseCancellation = async () => {
      try {
        isApplyingRef.current = true;
        setIsPending(true);
        setError(null);

        // Wait for noise filter to load if not already loaded
        if (!NoiseFilter && typeof window !== 'undefined') {
          try {
            const module = await import('@livekit/krisp-noise-filter');
            NoiseFilter = module.default || module.NoiseFilter || module;
          } catch (importError) {
            console.error('Failed to load Krisp noise filter:', importError);
            setError('Noise cancellation not available');
            setIsEnabled(false);
            return;
          }
        }

        if (!NoiseFilter) {
          setError('Noise cancellation not available');
          setIsEnabled(false);
          return;
        }

        // Get the microphone track
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;

        if (!micTrack || !(micTrack instanceof LocalAudioTrack)) {
          setError('Microphone track not found');
          setIsEnabled(false);
          return;
        }

        // Create and apply the noise filter processor
        // Use aggressiveness: 3 for maximum noise reduction (~90%)
        let noiseFilterProcessor;
        try {
          // Try different instantiation patterns
          if (typeof NoiseFilter === 'function') {
            noiseFilterProcessor = new NoiseFilter({
              aggressiveness: 3, // Maximum noise reduction
            });
          } else if (NoiseFilter.default && typeof NoiseFilter.default === 'function') {
            noiseFilterProcessor = new NoiseFilter.default({
              aggressiveness: 3,
            });
          } else {
            // If it's already an instance or has a different API
            noiseFilterProcessor = NoiseFilter;
          }

          await micTrack.setProcessor(noiseFilterProcessor);
          processorRef.current = noiseFilterProcessor;
          console.log('✅ Noise cancellation enabled with Krisp filter');
          setError(null);
        } catch (processorError: any) {
          console.error('Failed to apply noise filter:', processorError);
          setError(processorError?.message || 'Failed to enable noise cancellation');
          setIsEnabled(false);
        }
      } catch (err: any) {
        console.error('Failed to toggle noise cancellation:', err);
        setError(err?.message || 'Failed to enable noise cancellation');
        setIsEnabled(false);
      } finally {
        setIsPending(false);
        isApplyingRef.current = false;
      }
    };

    // Small delay to ensure track is ready
    const timeoutId = setTimeout(() => {
      applyNoiseCancellation();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isEnabled, room, isFeatureAvailable]);

  // Cleanup on unmount or when microphone is disabled
  useEffect(() => {
    if (!room) return;

    const localParticipant = room.localParticipant;
    if (!localParticipant) return;

    const handleMicrophoneDisabled = () => {
      if (processorRef.current) {
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;
        if (micTrack instanceof LocalAudioTrack) {
          micTrack.removeProcessor(processorRef.current).catch(console.error);
          processorRef.current = null;
        }
      }
    };

    // Listen for microphone state changes
    const checkMicrophoneState = () => {
      if (!localParticipant.isMicrophoneEnabled && processorRef.current) {
        handleMicrophoneDisabled();
      }
    };

    // Check immediately
    checkMicrophoneState();

    // Listen for track published/unpublished events
    const handleTrackPublished = () => {
      // Track was published, but we'll handle it in the main effect
    };

    const handleTrackUnpublished = () => {
      if (processorRef.current) {
        handleMicrophoneDisabled();
      }
    };

    localParticipant.on('trackPublished', handleTrackPublished);
    localParticipant.on('trackUnpublished', handleTrackUnpublished);

    return () => {
      localParticipant.off('trackPublished', handleTrackPublished);
      localParticipant.off('trackUnpublished', handleTrackUnpublished);
      
      // Cleanup processor on unmount
      if (processorRef.current) {
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;
        if (micTrack instanceof LocalAudioTrack) {
          micTrack.removeProcessor(processorRef.current).catch(console.error);
        }
        processorRef.current = null;
      }
    };
  }, [room]);

  const toggle = async () => {
    if (!isFeatureAvailable || isPending) {
      return;
    }

    setIsEnabled((prev) => !prev);
  };

  return {
    isEnabled,
    isPending,
    error,
    toggle,
  };
}

