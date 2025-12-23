'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { isLocalTrack, Track } from 'livekit-client';
import { trackLock } from '../utils/trackLock';
import { logger } from '../utils/logger';

// Dynamically import track processors
let BackgroundBlur: any, VirtualBackground: any;
let processorsPromise: Promise<void> | null = null;

// Load processors once
if (typeof window !== 'undefined' && !processorsPromise) {
  processorsPromise = import('@livekit/track-processors').then(({ BackgroundBlur: BB, VirtualBackground: VB }) => {
    BackgroundBlur = BB;
    VirtualBackground = VB;
  }).catch((error) => {
    console.error('Failed to load track processors:', error);
  });
}

type BackgroundType = 'none' | 'blur' | 'image';

interface AutoApplySettings {
  enabled: boolean;
  type: BackgroundType;
  imagePath: string | null;
}

/**
 * Hook to auto-apply virtual background when camera track becomes available
 * This runs independently of the CameraSettings component
 */
export function useVirtualBackgroundAutoApply(
  isHost: boolean,
  isVirtualBackgroundEnabled: boolean
) {
  const { cameraTrack } = useLocalParticipant();
  const [processorsLoaded, setProcessorsLoaded] = useState(false);
  const hasAutoAppliedRef = useRef<string | null>(null); // Track by trackSid to handle track changes
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkRetryCountRef = useRef(0);
  const applyRetryCountRef = useRef(0);
  const maxCheckRetries = 10; // More retries for checking readiness
  const maxApplyRetries = 5; // Fewer retries for actual application

  // Load processors
  useEffect(() => {
    if (processorsPromise) {
      processorsPromise.then(() => {
        if (BackgroundBlur && VirtualBackground) {
          setProcessorsLoaded(true);
        }
      });
    }
  }, []);

  // Auto-apply background when conditions are met
  useEffect(() => {
    // Only run for hosts/teachers
    if (!isHost || !isVirtualBackgroundEnabled) {
      return;
    }

    // Check if auto-apply is enabled
    const autoApplySetting = typeof window !== 'undefined' 
      ? localStorage.getItem('virtualBackground_autoApply')
      : null;
    
    if (autoApplySetting !== 'true') {
      return;
    }

    // Load settings from localStorage
    const savedType = typeof window !== 'undefined'
      ? (localStorage.getItem('virtualBackground_type') as BackgroundType | null)
      : null;
    const savedImagePath = typeof window !== 'undefined'
      ? localStorage.getItem('virtualBackground_imagePath')
      : null;

    if (!savedType || savedType === 'none') {
      return;
    }

    // Check if processors are loaded
    if (!processorsLoaded || !BackgroundBlur || !VirtualBackground) {
      return;
    }

    // Check if we have a valid camera track
    if (!cameraTrack || !isLocalTrack(cameraTrack.track)) {
      return;
    }

    const track = cameraTrack.track;
    const trackSid = track.sid || track.mediaStreamTrack?.id || 'unknown';

    // Skip if we've already applied to this track
    if (hasAutoAppliedRef.current === trackSid) {
      return;
    }

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Function to check if track is ready and producing frames
    const isTrackReady = (): boolean => {
      const mediaStreamTrack = track.mediaStreamTrack;
      if (!mediaStreamTrack) return false;
      
      // Check if track is live
      if (mediaStreamTrack.readyState !== 'live') return false;
      
      // Check if track is enabled
      if (!mediaStreamTrack.enabled) return false;
      
      // Check if track is muted (if muted, it might not be producing frames)
      if (mediaStreamTrack.muted) return false;
      
      return true;
    };

    // Function to apply the background
    const applyBackground = async () => {
      const trackId = `camera-vbg-${track.sid}`;
      
      // CRITICAL FIX: Check if track was modified in last 5 seconds (quality change, etc.)
      if (trackLock.wasRecentlyModified(trackId)) {
        const timeUntilModifiable = trackLock.getTimeUntilModifiable(trackId);
        logger.debug('Track recently modified, waiting before applying background', {
          timeUntilModifiable,
        });
        
        // Wait until track is stable
        await new Promise(resolve => setTimeout(resolve, timeUntilModifiable + 100));
        
        // Re-check if track is still valid
        if (!isTrackReady()) {
          logger.debug('Track no longer ready after waiting, skipping background application');
          return;
        }
      }
      
      // Check if another component is modifying this track
      if (trackLock.isLocked(trackId)) {
        logger.debug('Track locked, skipping auto-apply');
        return;
      }
      
      const acquired = await trackLock.acquire(trackId);
      if (!acquired) {
        logger.debug('Could not acquire lock for auto-apply');
        return;
      }
      
      try {
        // Check if track is ready
        if (!isTrackReady()) {
          throw new Error('Track not ready or not producing frames');
        }

        // Wait for track to be fully initialized and producing frames
        // This helps prevent "Empty video frame" errors
        await new Promise(resolve => setTimeout(resolve, 500));

        // Double-check track is still ready after delay
        if (!isTrackReady()) {
          throw new Error('Track became unavailable during delay');
        }

        // Check one more time that track is still valid before applying
        if (!track || !track.mediaStreamTrack || track.mediaStreamTrack.readyState !== 'live') {
          throw new Error('Track is closed or invalid');
        }

        // Apply the processor
        if (savedType === 'blur') {
          await track.setProcessor(BackgroundBlur());
          console.log('✅ Auto-applied blur background');
        } else if (savedType === 'image' && savedImagePath) {
          await track.setProcessor(VirtualBackground(savedImagePath));
          console.log('✅ Auto-applied image background');
        }

        // Mark as applied
        hasAutoAppliedRef.current = trackSid;
        applyRetryCountRef.current = 0;
      } catch (error: any) {
        // Don't retry on stream closed errors or empty frame errors - track might not be ready yet
        // Check multiple variations of the error
        const isStreamClosed = 
          error?.name === 'InvalidStateError' ||
          error?.message?.includes('Stream closed') ||
          error?.message?.includes('stream closed') ||
          error?.message?.includes('stream is closed') ||
          error?.toString()?.includes('Stream closed') ||
          error?.toString()?.includes('stream closed');
        const isEmptyFrame = 
          error?.message?.includes('Empty video frame') || 
          error?.message?.includes('Empty');
        
        if (isStreamClosed || isEmptyFrame) {
          // These are expected during track transitions, don't spam console
          if (applyRetryCountRef.current === 0) {
            console.warn('⚠️ Track not ready yet, will retry:', error.message || error.name);
          }
        } else {
          console.warn('⚠️ Error auto-applying background, will retry:', error.message || error.name);
        }
        
        // Retry logic - but don't retry if stream is closed and we've tried a few times
        if (isStreamClosed && applyRetryCountRef.current >= 2) {
          // Stream is closed, likely track was replaced - reset and wait for new track
          hasAutoAppliedRef.current = null;
          applyRetryCountRef.current = 0;
          return;
        }
        
        if (applyRetryCountRef.current < maxApplyRetries) {
          applyRetryCountRef.current += 1;
          const delay = Math.min(1000 * applyRetryCountRef.current, 3000); // Exponential backoff, max 3s
          
          retryTimeoutRef.current = setTimeout(() => {
            applyBackground();
          }, delay);
        } else {
          console.error('❌ Failed to auto-apply background after', maxApplyRetries, 'retries');
          applyRetryCountRef.current = 0;
        }
      } finally {
        trackLock.release(trackId);
      }
    };

    // Poll for track readiness with exponential backoff
    const checkAndApply = () => {
      const mediaStreamTrack = track.mediaStreamTrack;
      
      if (mediaStreamTrack && mediaStreamTrack.readyState === 'live' && mediaStreamTrack.enabled && !mediaStreamTrack.muted) {
        // Track appears ready, try applying
        applyRetryCountRef.current = 0; // Reset apply retry count
        applyBackground();
      } else {
        // Track not ready yet, retry with delay
        if (checkRetryCountRef.current < maxCheckRetries) {
          checkRetryCountRef.current += 1;
          const delay = Math.min(500 * checkRetryCountRef.current, 2000);
          retryTimeoutRef.current = setTimeout(() => {
            checkAndApply();
          }, delay);
        } else {
          // Give up checking, but still try to apply (might work)
          console.warn('⚠️ Track readiness check timed out, attempting to apply anyway');
          applyBackground();
        }
      }
    };

    // Initial delay to ensure track has time to initialize
    const initialTimeout = setTimeout(() => {
      checkAndApply();
    }, 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [
    cameraTrack,
    processorsLoaded,
    isHost,
    isVirtualBackgroundEnabled
  ]);

  // Reset hasAutoApplied when track changes (camera off/on, device change)
  useEffect(() => {
    if (cameraTrack?.track) {
      const trackSid = cameraTrack.track.sid || cameraTrack.track.mediaStreamTrack?.id || 'unknown';
      
      // If track changed, reset the applied flag
      if (hasAutoAppliedRef.current && hasAutoAppliedRef.current !== trackSid) {
        hasAutoAppliedRef.current = null;
        checkRetryCountRef.current = 0;
        applyRetryCountRef.current = 0;
      }
    } else {
      // Camera turned off, reset
      hasAutoAppliedRef.current = null;
      checkRetryCountRef.current = 0;
      applyRetryCountRef.current = 0;
    }
  }, [cameraTrack]);
}
