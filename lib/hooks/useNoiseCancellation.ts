'use client';

import { useState, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';
import { isLowPowerDevice } from '../client-utils';

// Dynamically import Krisp noise filter to avoid SSR issues
let KrispNoiseFilter: any = null;
let isKrispNoiseFilterSupported: any = null;

// Load noise filter on client side
if (typeof window !== 'undefined') {
  import('@livekit/krisp-noise-filter')
    .then((module) => {
      // Import the named export KrispNoiseFilter function
      KrispNoiseFilter = module.KrispNoiseFilter || module.default?.KrispNoiseFilter;
      isKrispNoiseFilterSupported = module.isKrispNoiseFilterSupported || module.default?.isKrispNoiseFilterSupported;
    })
    .catch((error) => {
      console.error('Failed to load Krisp noise filter:', error);
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
  const isCleaningUpRef = useRef(false);
  const mountedRef = useRef(true);

  // Check if feature is available
  const isFeatureAvailable = featureEnabled && !isLowPowerDevice();

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      if (processorRef.current && !isCleaningUpRef.current) {
        isCleaningUpRef.current = true;
        const removeProcessor = async () => {
          try {
            // Check if room and participant still exist
            if (!room || !room.localParticipant || !mountedRef.current) {
              processorRef.current = null;
              return;
            }

            const currentLocalParticipant = room.localParticipant;
            const micPublication = currentLocalParticipant.getTrackPublication(Track.Source.Microphone);
            const micTrack = micPublication?.track;
            
            // First try to destroy the processor if it has a destroy method
            if (processorRef.current && typeof processorRef.current.destroy === 'function') {
              try {
                await processorRef.current.destroy();
              } catch (destroyErr) {
                // Silently handle destroy errors - processor might already be destroyed
                console.warn('Error destroying processor (non-critical):', destroyErr);
              }
            }
            
            // Then remove it from the track if track is valid
            if (micTrack && micTrack instanceof LocalAudioTrack && typeof micTrack.removeProcessor === 'function') {
              try {
                await micTrack.removeProcessor(processorRef.current);
              } catch (removeErr) {
                // Track might have been replaced or already removed - this is OK
                console.warn('Error removing processor from track (non-critical):', removeErr);
              }
            }
          } catch (err) {
            // All errors are non-critical during cleanup - just log and continue
            console.warn('Error removing noise filter (non-critical):', err);
          } finally {
            // Always clear refs, even on error
            processorRef.current = null;
            isCleaningUpRef.current = false;
            if (mountedRef.current) {
              setError(null);
            }
          }
        };
        
        // Fire and forget - don't await to prevent blocking
        removeProcessor().catch(() => {
          // Final catch to prevent any unhandled rejections
          processorRef.current = null;
          isCleaningUpRef.current = false;
        });
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
        if (mountedRef.current) {
          setIsPending(true);
          setError(null);
        }

        // Check if room/participant still exist
        if (!room || !room.localParticipant || !mountedRef.current) {
          isApplyingRef.current = false;
          return;
        }

        // Wait for noise filter to load if not already loaded
        if (!KrispNoiseFilter && typeof window !== 'undefined') {
          try {
            const module = await import('@livekit/krisp-noise-filter');
            KrispNoiseFilter = module.KrispNoiseFilter || module.default?.KrispNoiseFilter;
            isKrispNoiseFilterSupported = module.isKrispNoiseFilterSupported || module.default?.isKrispNoiseFilterSupported;
          } catch (importError) {
            console.error('Failed to load Krisp noise filter:', importError);
            if (mountedRef.current) {
              setError('Noise cancellation not available');
              setIsEnabled(false);
            }
            return;
          }
        }

        if (!KrispNoiseFilter) {
          if (mountedRef.current) {
            setError('Noise cancellation not available');
            setIsEnabled(false);
          }
          return;
        }

        // Check if Krisp is supported on this device
        if (isKrispNoiseFilterSupported && typeof isKrispNoiseFilterSupported === 'function') {
          const isSupported = isKrispNoiseFilterSupported();
          if (!isSupported) {
            if (mountedRef.current) {
              setError('Noise cancellation is not supported on this device');
              setIsEnabled(false);
            }
            return;
          }
        }

        // Re-check room/participant after async operations
        if (!room || !room.localParticipant || !mountedRef.current) {
          isApplyingRef.current = false;
          return;
        }

        const currentLocalParticipant = room.localParticipant;
        
        // Get the microphone track
        const micPublication = currentLocalParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track;

        if (!micTrack || !(micTrack instanceof LocalAudioTrack)) {
          if (mountedRef.current) {
            setError('Microphone track not found');
            setIsEnabled(false);
          }
          return;
        }

        // Create and apply the noise filter processor
        // KrispNoiseFilter is a function that returns a processor instance
        // Use quality: "high" for maximum noise reduction (~90%)
        try {
          const noiseFilterProcessor = KrispNoiseFilter({
            quality: 'high', // Maximum noise reduction: "low" | "medium" | "high"
            debugLogs: false, // Set to true for debugging if needed
          });

          // Final check before applying
          if (!mountedRef.current || !room || !room.localParticipant) {
            return;
          }

          await micTrack.setProcessor(noiseFilterProcessor);
          processorRef.current = noiseFilterProcessor;
          console.log('✅ Noise cancellation enabled with Krisp filter');
          if (mountedRef.current) {
            setError(null);
          }
        } catch (processorError: any) {
          console.error('Failed to apply noise filter:', processorError);
          if (mountedRef.current) {
            setError(processorError?.message || 'Failed to enable noise cancellation');
            setIsEnabled(false);
          }
        }
      } catch (err: any) {
        console.error('Failed to toggle noise cancellation:', err);
        if (mountedRef.current) {
          setError(err?.message || 'Failed to enable noise cancellation');
          setIsEnabled(false);
        }
      } finally {
        if (mountedRef.current) {
          setIsPending(false);
        }
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

    const handleMicrophoneDisabled = async () => {
      if (processorRef.current && !isCleaningUpRef.current) {
        isCleaningUpRef.current = true;
        try {
          // Check if room/participant still exist
          if (!room || !room.localParticipant || !mountedRef.current) {
            processorRef.current = null;
            isCleaningUpRef.current = false;
            return;
          }

          const currentLocalParticipant = room.localParticipant;
          
          // First try to destroy the processor if it has a destroy method
          if (processorRef.current && typeof processorRef.current.destroy === 'function') {
            try {
              await processorRef.current.destroy();
            } catch (destroyErr) {
              // Non-critical - processor might already be destroyed
              console.warn('Error destroying processor on mic disable (non-critical):', destroyErr);
            }
          }
          
          const micPublication = currentLocalParticipant.getTrackPublication(Track.Source.Microphone);
          const micTrack = micPublication?.track;
          if (micTrack && micTrack instanceof LocalAudioTrack && typeof micTrack.removeProcessor === 'function') {
            try {
              await micTrack.removeProcessor(processorRef.current);
            } catch (removeErr) {
              // Non-critical - track might have been replaced
              console.warn('Error removing processor on mic disable (non-critical):', removeErr);
            }
          }
        } catch (err) {
          // All errors are non-critical during cleanup
          console.warn('Error removing processor on mic disable (non-critical):', err);
        } finally {
          processorRef.current = null;
          isCleaningUpRef.current = false;
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
      try {
        if (localParticipant) {
          localParticipant.off('trackPublished', handleTrackPublished);
          localParticipant.off('trackUnpublished', handleTrackUnpublished);
        }
      } catch (err) {
        // Non-critical - participant might already be cleaned up
        console.warn('Error removing event listeners (non-critical):', err);
      }
      
      // Cleanup processor on unmount
      if (processorRef.current && !isCleaningUpRef.current) {
        isCleaningUpRef.current = true;
        const cleanup = async () => {
          try {
            // Check if room/participant still exist
            if (!room || !room.localParticipant) {
              processorRef.current = null;
              isCleaningUpRef.current = false;
              return;
            }

            const currentLocalParticipant = room.localParticipant;
            
            // First try to destroy the processor if it has a destroy method
            if (processorRef.current && typeof processorRef.current.destroy === 'function') {
              try {
                await processorRef.current.destroy();
              } catch (destroyErr) {
                // Non-critical - processor might already be destroyed
                console.warn('Error destroying processor on unmount (non-critical):', destroyErr);
              }
            }
            
            const micPublication = currentLocalParticipant.getTrackPublication(Track.Source.Microphone);
            const micTrack = micPublication?.track;
            if (micTrack && micTrack instanceof LocalAudioTrack && typeof micTrack.removeProcessor === 'function') {
              try {
                await micTrack.removeProcessor(processorRef.current);
              } catch (removeErr) {
                // Non-critical - track might have been replaced or already removed
                console.warn('Error removing processor on unmount (non-critical):', removeErr);
              }
            }
          } catch (err) {
            // All errors are non-critical during cleanup
            console.warn('Error removing processor on unmount (non-critical):', err);
          } finally {
            // Always clear refs, even on error
            processorRef.current = null;
            isCleaningUpRef.current = false;
          }
        };
        
        // Run cleanup but don't await (cleanup in useEffect return should be synchronous)
        // Add final catch to prevent any unhandled rejections
        cleanup().catch(() => {
          processorRef.current = null;
          isCleaningUpRef.current = false;
        });
      }
    };
  }, [room]);

  const toggle = async () => {
    // Prevent toggling if:
    // 1. Feature not available
    // 2. Already pending (processing)
    // 3. Currently cleaning up
    // 4. Component unmounted
    if (!isFeatureAvailable || isPending || isCleaningUpRef.current || !mountedRef.current) {
      return;
    }

    // Safely update state only if component is still mounted
    if (mountedRef.current) {
      setIsEnabled((prev) => !prev);
    }
  };

  return {
    isEnabled,
    isPending,
    error,
    toggle,
  };
}

