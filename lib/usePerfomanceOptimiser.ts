import {
  Room,
  ParticipantEvent,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  VideoQuality,
  LocalVideoTrack,
  isVideoTrack,
  Track,
  LocalTrackPublication,
} from 'livekit-client';
import * as React from 'react';

export type LowCPUOptimizerOptions = {
  reducePublisherVideoQuality: boolean;
  reduceSubscriberVideoQuality: boolean;
  disableVideoProcessing: boolean;
};

const defaultOptions: LowCPUOptimizerOptions = {
  reducePublisherVideoQuality: true,
  reduceSubscriberVideoQuality: true,
  disableVideoProcessing: false,
} as const;

/**
 * This hook ensures that on devices with low CPU, the performance is optimised when needed.
 * This is done by primarily reducing the video quality to low when the CPU is constrained.
 * 
 * CRITICAL FIX: When CPU is constrained, video processors (like virtual backgrounds) are stopped.
 * When CPU improves or track is republished, processors are restored.
 */
export function useLowCPUOptimizer(room: Room, options: Partial<LowCPUOptimizerOptions> = {}) {
  const [lowPowerMode, setLowPowerMode] = React.useState(false);
  const opts = React.useMemo(() => ({ ...defaultOptions, ...options }), [options]);
  
  // CRITICAL FIX: Store processor info before stopping so we can restore it
  const stoppedProcessorsRef = React.useRef<Map<string, {
    processor: any;
    trackSid: string;
    timestamp: number;
  }>>(new Map());
  
  // Track CPU constraint state per track
  const cpuConstrainedTracksRef = React.useRef<Set<string>>(new Set());
  
  React.useEffect(() => {
    if (!room) return;
    
    const handleCpuConstrained = async (track: LocalVideoTrack) => {
      setLowPowerMode(true);
      const trackSid = track.sid;
      cpuConstrainedTracksRef.current.add(trackSid);
      
      console.warn('Local track CPU constrained', track);
      
      if (opts.reducePublisherVideoQuality) {
        track.prioritizePerformance();
      }
      
      if (opts.disableVideoProcessing && isVideoTrack(track)) {
        // CRITICAL FIX: Store processor info before stopping
        try {
          const processor = track.getProcessor();
          if (processor) {
            stoppedProcessorsRef.current.set(trackSid, {
              processor: processor,
              trackSid: trackSid,
              timestamp: Date.now(),
            });
            console.log('Stored processor before stopping due to CPU constraint:', trackSid);
          }
          track.stopProcessor();
        } catch (error) {
          console.warn('Error stopping processor due to CPU constraint:', error);
        }
      }
      
      if (opts.reduceSubscriberVideoQuality) {
        room.remoteParticipants.forEach((participant) => {
          participant.videoTrackPublications.forEach((publication) => {
            publication.setVideoQuality(VideoQuality.LOW);
          });
        });
      }
    };

    // CRITICAL FIX: Monitor track republish events to restore processors
    const handleTrackPublished = async (publication: LocalTrackPublication) => {
      if (publication.source !== Track.Source.Camera) return;
      if (!publication.track || !isVideoTrack(publication.track)) return;
      
      const track = publication.track as LocalVideoTrack;
      const trackSid = track.sid;
      
      // Check if this track had a processor stopped due to CPU constraint
      // Note: Track SID might change on republish, so we check all stored processors
      let processorToRestore: { processor: any; trackSid: string; timestamp: number } | null = null;
      
      // Find the most recent stopped processor (might be from previous track instance)
      for (const [sid, info] of stoppedProcessorsRef.current.entries()) {
        if (!processorToRestore || info.timestamp > processorToRestore.timestamp) {
          processorToRestore = info;
        }
      }
      
      // If we found a processor to restore and we're no longer in low power mode
      if (processorToRestore && !lowPowerMode) {
        try {
          // Small delay to ensure track is ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if track still exists and is ready
          if (track && track.mediaStreamTrack && track.mediaStreamTrack.readyState === 'live') {
            // Try to restore the processor
            // Note: Processor objects might not be reusable, so this might fail
            // In that case, the virtual background hook will reapply it
            try {
              await track.setProcessor(processorToRestore.processor);
              // Clean up all stored processors since we restored one
              stoppedProcessorsRef.current.clear();
              cpuConstrainedTracksRef.current.clear();
              console.log('✅ Restored video processor after CPU constraint resolved:', trackSid);
            } catch (processorError) {
              // Processor might not be reusable - that's okay, virtual background hook will handle it
              console.debug('Could not reuse processor object (will be reapplied by virtual background hook):', processorError);
              // Clean up old processor references
              stoppedProcessorsRef.current.delete(processorToRestore.trackSid);
            }
          }
        } catch (error) {
          console.warn('Failed to restore processor after CPU constraint:', error);
          // Clean up if restoration fails
          stoppedProcessorsRef.current.delete(processorToRestore.trackSid);
        }
      }
    };

    // CRITICAL FIX: Monitor for CPU improvement by checking if lowPowerMode should be cleared
    // Use a timer to periodically check if we should exit low power mode
    const checkCpuImprovement = () => {
      // If we've been in low power mode for a while and no new constraints,
      // we can try to restore processors
      if (lowPowerMode && stoppedProcessorsRef.current.size > 0) {
        // Check if any tracks are still constrained
        const hasActiveConstraints = cpuConstrainedTracksRef.current.size > 0;
        
        // If no constraints for 30 seconds, assume CPU improved
        const now = Date.now();
        const processorTimestamps = Array.from(stoppedProcessorsRef.current.values()).map(info => info.timestamp);
        const oldestConstraint = processorTimestamps.length > 0 ? Math.min(...processorTimestamps) : now;
        const timeSinceLastConstraint = now - oldestConstraint;
        
        if (!hasActiveConstraints && timeSinceLastConstraint > 30000) {
          // No active constraints for 30+ seconds, clear low power mode
          // Processors will be restored by virtual background hook when track is republished
          setLowPowerMode(false);
          // Clean up old processor references (they'll be reapplied by virtual background hook)
          stoppedProcessorsRef.current.clear();
          cpuConstrainedTracksRef.current.clear();
          console.log('✅ CPU constraints resolved, clearing low power mode');
        }
      } else if (!lowPowerMode && stoppedProcessorsRef.current.size > 0) {
        // Low power mode cleared but processors still stored - clean them up
        stoppedProcessorsRef.current.clear();
        cpuConstrainedTracksRef.current.clear();
      }
    };

    room.localParticipant.on(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstrained);
    room.localParticipant.on('trackPublished', handleTrackPublished);
    
    // Check for CPU improvement every 10 seconds
    const cpuCheckInterval = setInterval(checkCpuImprovement, 10000);
    
    return () => {
      room.localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstrained);
      room.localParticipant.off('trackPublished', handleTrackPublished);
      clearInterval(cpuCheckInterval);
    };
  }, [room, opts.reducePublisherVideoQuality, opts.reduceSubscriberVideoQuality, opts.disableVideoProcessing, lowPowerMode]);

  React.useEffect(() => {
    const lowerQuality = (_: RemoteTrack, publication: RemoteTrackPublication) => {
      publication.setVideoQuality(VideoQuality.LOW);
    };
    if (lowPowerMode && opts.reduceSubscriberVideoQuality) {
      room.on(RoomEvent.TrackSubscribed, lowerQuality);
    }

    return () => {
      room.off(RoomEvent.TrackSubscribed, lowerQuality);
    };
  }, [lowPowerMode, room, opts.reduceSubscriberVideoQuality]);

  return lowPowerMode;
}
