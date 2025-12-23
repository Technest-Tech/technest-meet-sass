'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useRemoteParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import toast from 'react-hot-toast';

interface SimpleRecordingControlProps {
  isHost: boolean;
  isFeatureEnabled: boolean;
  showProBadge?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onStopRecording?: () => void;
}

export function SimpleRecordingControl({
  isHost,
  isFeatureEnabled,
  showProBadge = false,
  onRecordingStateChange,
  onStopRecording,
}: SimpleRecordingControlProps) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  
  const [isRecording, setIsRecording] = useState(false);
  const [processingRecRequest, setProcessingRecRequest] = useState(false);
  const [converting, setConverting] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0); // Recording duration in seconds
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{ filename: string; format: string } | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const isIntentionalStopRef = useRef(false); // Track if stop was intentional
  const recordingLockRef = useRef(false); // Lock recording to prevent accidental stops
  const streamMonitorIntervalRef = useRef<NodeJS.Timeout | null>(null); // Monitor stream health
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      // Cleanup on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamMonitorIntervalRef.current) {
        clearInterval(streamMonitorIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      videoElementsRef.current.forEach(video => {
        video.srcObject = null;
      });
      videoElementsRef.current.clear();
    };
  }, []);

  // Auto-save recording when tab/page is closed
  const isAutoSavingRef = useRef(false);
  
  useEffect(() => {
    if (!isRecording) {
      isAutoSavingRef.current = false;
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Stop recording if it's still running
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' && !isAutoSavingRef.current) {
        isAutoSavingRef.current = true;
        e.preventDefault();
        e.returnValue = 'Recording is in progress. It will be saved automatically.';
        
        // Stop the recording synchronously (we can't await in beforeunload)
        try {
          // Mark as auto-save by storing in a way the onstop handler can access
          (mediaRecorderRef.current as any).__isAutoSave = true;
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        } catch (error) {
          console.error('Error stopping recording on page close:', error);
        }
      }
    };

    // Don't stop recording on visibility change - only on page close
    // This allows users to switch tabs without stopping the recording
    const handleVisibilityChange = () => {
      // Do nothing - let users switch tabs while recording
      // Recording will only stop on actual page close (beforeunload)
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRecording]);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingStartTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
          setRecordingTime(elapsed);
        }
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      recordingStartTimeRef.current = null;
      setRecordingTime(0);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get total participant count with video tracks
  const getParticipantCount = useCallback(() => {
    let count = 0;
    
    // Count local participant with video
    if (localParticipant) {
      const hasLocalVideo = Array.from(localParticipant.videoTrackPublications.values()).some(
        pub => pub.isEnabled && pub.track
      );
      if (hasLocalVideo) count++;
    }
    
    // Count remote participants with video
    remoteParticipants.forEach(participant => {
      const hasVideo = Array.from(participant.videoTrackPublications.values()).some(
        pub => pub.isEnabled && pub.track
      );
      if (hasVideo) count++;
    });
    
    return count || 1; // At least 1 for layout calculation
  }, [localParticipant, remoteParticipants]);

  // Update participant count
  useEffect(() => {
    if (isRecording) {
      const count = getParticipantCount();
      setParticipantCount(count);
    }
  }, [isRecording, remoteParticipants, localParticipant, getParticipantCount]);

  // Don't show recording controls if not a host
  if (!isHost) {
    return null;
  }

  // Create canvas for compositing
  const createCompositingCanvas = useCallback((): HTMLCanvasElement => {
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      canvasRef.current = canvas;
    }
    return canvasRef.current;
  }, []);

  // Create video element for a track
  const createVideoElement = useCallback((trackId: string, track: MediaStreamTrack): HTMLVideoElement => {
    if (!videoElementsRef.current.has(trackId)) {
      const video = document.createElement('video');
      video.srcObject = new MediaStream([track]);
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Audio handled separately
      
      // Ensure video loads and plays - handle interruptions gracefully
      const playVideo = async () => {
        try {
          if (video.readyState >= 2) {
            await video.play();
          }
        } catch (error) {
          // Ignore AbortError - video play was interrupted, but that's okay
          // The video will continue to work for canvas drawing even if play() was interrupted
          if (error instanceof Error && error.name !== 'AbortError') {
            console.warn('Video play error (non-critical):', error);
          }
        }
      };
      
      video.addEventListener('loadedmetadata', playVideo);
      
      // Start playing immediately - but don't let interruptions stop recording
      playVideo();
      
      videoElementsRef.current.set(trackId, video);
    }
    return videoElementsRef.current.get(trackId)!;
  }, []);

  // Collect all video tracks
  const collectAllVideoTracks = useCallback((): Array<{ track: MediaStreamTrack; participantId: string; isLocal: boolean }> => {
    const videoTracks: Array<{ track: MediaStreamTrack; participantId: string; isLocal: boolean }> = [];
    
    // Local participant video tracks
    if (localParticipant) {
      localParticipant.videoTrackPublications.forEach((pub) => {
        if (pub.track && pub.isEnabled && pub.track.mediaStreamTrack) {
          videoTracks.push({ 
            track: pub.track.mediaStreamTrack, 
            participantId: localParticipant.identity,
            isLocal: true
          });
        }
      });
    }
    
    // Remote participants video tracks
    remoteParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((pub) => {
        if (pub.track && pub.isEnabled && pub.track.mediaStreamTrack) {
          videoTracks.push({ 
            track: pub.track.mediaStreamTrack, 
            participantId: participant.identity,
            isLocal: false
          });
        }
      });
    });
    
    return videoTracks;
  }, [localParticipant, remoteParticipants]);

  // Collect all audio tracks - get raw tracks not affected by speaker volume
  const collectAllAudioTracks = useCallback((): MediaStreamTrack[] => {
    const audioTracks: MediaStreamTrack[] = [];
    
    // Local participant audio
    if (localParticipant) {
      localParticipant.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.isEnabled && !pub.isMuted && pub.track.mediaStreamTrack) {
          audioTracks.push(pub.track.mediaStreamTrack);
        }
      });
    }
    
    // Remote participants audio - get raw tracks, not affected by speaker volume
    remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        // CRITICAL: Ensure track is subscribed and get raw track
        // This ensures we get the audio regardless of local speaker volume settings
        if (pub.track && pub.isEnabled && !pub.isMuted && pub.isSubscribed) {
          const mediaStreamTrack = pub.track.mediaStreamTrack;
          
          if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
            // Create isolated MediaStream to ensure track is independent
            // This prevents the track from being affected by local audio output settings
            const isolatedStream = new MediaStream([mediaStreamTrack]);
            const isolatedTrack = isolatedStream.getAudioTracks()[0];
            
            if (isolatedTrack && isolatedTrack.readyState === 'live') {
              audioTracks.push(isolatedTrack);
            }
          }
        }
      });
    });
    
    return audioTracks;
  }, [localParticipant, remoteParticipants]);

  // Draw all video tracks to canvas in grid layout
  const drawToCanvas = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const videoTracks = collectAllVideoTracks();
    
    if (videoTracks.length === 0) {
      // No video tracks - fill with black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Calculate grid layout
    const count = videoTracks.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each video
    videoTracks.forEach(({ track, participantId }, index) => {
      try {
        const video = createVideoElement(`${participantId}-${track.id}`, track);
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const x = col * cellWidth;
        const y = row * cellHeight;
        
        // Wait for video to be ready (HAVE_CURRENT_DATA or HAVE_FUTURE_DATA)
        // Even if play() was interrupted, we can still draw frames if the video has data
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            // Draw video frame to canvas
            ctx.drawImage(video, x, y, cellWidth, cellHeight);
          } catch (error) {
            // Video might not be ready yet, skip this frame
            // Don't log AbortError as it's expected when other components open
            if (error instanceof Error && error.name !== 'AbortError') {
              console.debug('Video not ready for drawing:', error);
            }
          }
        } else {
          // Draw placeholder while video loads
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.fillStyle = '#666';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Loading...', x + cellWidth / 2, y + cellHeight / 2);
        }
      } catch (error) {
        // If video element creation fails, just skip this participant for this frame
        // Don't let it stop the entire recording
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug('Error creating video element for drawing:', error);
        }
      }
    });
  }, [collectAllVideoTracks, createVideoElement]);

  // Mix audio tracks using Web Audio API
  const mixAudioTracks = useCallback(async (audioTracks: MediaStreamTrack[]): Promise<MediaStream | null> => {
    if (audioTracks.length === 0) {
      return null;
    }

    try {
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
      
      // Clear previous sources
      audioSourcesRef.current.forEach(source => source.disconnect());
      audioSourcesRef.current = [];

      // Add all audio tracks to audio context
      for (const track of audioTracks) {
        try {
          // Create isolated stream for each track to prevent cross-contamination
          // This ensures each participant's audio is captured independently
          const isolatedStream = new MediaStream([track]);
          const source = audioContextRef.current.createMediaStreamSource(isolatedStream);
          
          // Connect directly to destination (no volume adjustments)
          // This preserves the original audio levels from each participant
          source.connect(audioDestinationRef.current!);
          audioSourcesRef.current.push(source);
        } catch (error) {
          console.warn('Failed to add audio track to mix:', error);
        }
      }

      return audioDestinationRef.current.stream;
    } catch (error) {
      console.error('Failed to create audio mix:', error);
      return null;
    }
  }, []);

  // Convert WebM to MP4 using FFmpeg.wasm (client-side) - Updated for FFmpeg 0.12.x API
  const convertToMP4Client = useCallback(async (webmBlob: Blob): Promise<Blob | null> => {
    try {
      setConverting(true);
      toast.loading('Converting to MP4...', { id: 'converting' });
      
      // Import FFmpeg with new v0.12 API
      let ffmpeg: any;
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');
        
        ffmpeg = new FFmpeg();
        
        // Set up event handlers for logging (optional)
        ffmpeg.on('log', ({ message }: { message: string }) => {
          // Uncomment for debugging: console.log('FFmpeg log:', message);
        });
        
        // Load FFmpeg with CDN URLs
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      } catch (loadError) {
        console.error('Failed to load FFmpeg.wasm:', loadError);
        toast.dismiss('converting');
        // Don't throw - just return null to fall back to server conversion or WebM
        return null;
      }
      
      // Write input file
      try {
        const data = new Uint8Array(await webmBlob.arrayBuffer());
        await ffmpeg.writeFile('input.webm', data);
      } catch (writeError) {
        console.error('Failed to write input file:', writeError);
        toast.dismiss('converting');
        throw new Error('Failed to prepare video for conversion');
      }
      
      // Convert to MP4
      try {
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-movflags', '+faststart',
          'output.mp4'
        ]);
      } catch (runError) {
        console.error('FFmpeg conversion failed:', runError);
        toast.dismiss('converting');
        throw new Error('Video conversion failed');
      }
      
      // Read output file
      let mp4Blob: Blob;
      try {
        const data = await ffmpeg.readFile('output.mp4');
        mp4Blob = new Blob([data], { type: 'video/mp4' });
      } catch (readError) {
        console.error('Failed to read output file:', readError);
        toast.dismiss('converting');
        throw new Error('Failed to read converted video');
      }
      
      // Cleanup
      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile('output.mp4');
      } catch (cleanupError) {
        console.warn('Failed to cleanup FFmpeg files:', cleanupError);
      }
      
      toast.success('Converted to MP4!', { id: 'converting' });
      // Dismiss after a short delay to show success message
      setTimeout(() => {
        toast.dismiss('converting');
      }, 2000);
      return mp4Blob;
    } catch (error) {
      console.error('Client-side MP4 conversion failed:', error);
      toast.dismiss('converting');
      return null;
    } finally {
      setConverting(false);
    }
  }, []);

  // Upload and convert on server (fallback)
  const convertToMP4Server = useCallback(async (webmBlob: Blob): Promise<Blob | null> => {
    try {
      setConverting(true);
      toast.loading('Uploading and converting to MP4...', { id: 'uploading' });
      
      const formData = new FormData();
      formData.append('video', webmBlob, `recording-${room.name}-${Date.now()}.webm`);
      
      const response = await fetch('/api/record/convert', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server conversion failed: ${response.statusText}`);
      }
      
      const mp4Blob = await response.blob();
      
        if (mp4Blob.size === 0) {
          toast.dismiss('uploading');
          throw new Error('Server returned empty file');
        }
        
        toast.success('Converted to MP4!', { id: 'uploading' });
        // Dismiss after a short delay to show success message
        setTimeout(() => {
          toast.dismiss('uploading');
        }, 2000);
        return mp4Blob;
    } catch (error) {
      console.error('Server conversion failed:', error);
      toast.dismiss('uploading');
      
      // Don't show error toast here - let the fallback in onstop handle it
      // This prevents duplicate error messages
      return null;
    } finally {
      setConverting(false);
    }
  }, [room.name]);

  const downloadRecording = useCallback((blob: Blob, fileExtension: string = 'mp4') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `meeting-recording-${room.name}-${timestamp}.${fileExtension}`;
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Show completion modal
    setDownloadInfo({ filename, format: fileExtension.toUpperCase() });
    setShowCompletionModal(true);
  }, [room.name]);

  const startClientSideRecording = useCallback(async () => {
    try {
      // Check browser support
      if (typeof MediaRecorder === 'undefined') {
        toast.error('Recording Unavailable', {
          description: 'Your browser does not support recording. Please use Chrome, Firefox, or Edge.',
          duration: 5000,
          icon: '⚠️',
        });
        return;
      }

      // Check if we have any video tracks
      const videoTracks = collectAllVideoTracks();
      if (videoTracks.length === 0) {
        toast.error('No Video Available', {
          description: 'Please enable your camera or wait for participants to join before starting recording.',
          duration: 5000,
          icon: '📹',
        });
        return;
      }

      // Create canvas for compositing
      const canvas = createCompositingCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Canvas Initialization Failed', {
          description: 'Unable to initialize recording canvas. Please refresh the page and try again.',
          duration: 5000,
          icon: '❌',
        });
        return;
      }

      // Collect and mix audio tracks
      const audioTracks = collectAllAudioTracks();
      const mixedAudioStream = await mixAudioTracks(audioTracks);

      // Create canvas stream
      const canvasStream = canvas.captureStream(30); // 30 FPS
      canvasStreamRef.current = canvasStream;
      
      // Create combined stream: canvas video + mixed audio
      const combinedStream = new MediaStream();
      
      // Add canvas video track
      canvasStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // Add mixed audio track if available
      if (mixedAudioStream) {
        mixedAudioStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      recordedChunksRef.current = [];

      // Use WebM format (more reliable than MP4 in browsers)
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            toast.error('Your browser does not support video recording. Please use Chrome, Firefox, or Edge.');
            return;
          }
        }
      }

      // Create MediaRecorder
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType,
          videoBitsPerSecond: 2500000, // 2.5 Mbps
          audioBitsPerSecond: 128000,   // 128 kbps
        });
      } catch (error) {
        console.error('Failed to create MediaRecorder:', error);
        toast.error('Recorder Initialization Failed', {
          description: error instanceof Error ? error.message : 'Unable to start recording. Please try again.',
          duration: 5000,
          icon: '❌',
        });
        return;
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Check if this is an auto-save (page closing)
        const isAutoSave = !!(mediaRecorderRef.current as any)?.__isAutoSave;
        const isIntentional = isIntentionalStopRef.current;
        
        // Check if the stream is still active (tracks are still live)
        const streamStillActive = mediaRecorder.stream && 
          mediaRecorder.stream.getTracks().some(track => track.readyState === 'live');
        
        // CRITICAL: If recording is active and stop wasn't intentional/auto-save, completely ignore it
        // This prevents accidental stops when other components (FileSharing, ScreenAnnotation) open
        // Also check if stream is still active - if it is, the stop was likely accidental
        // Also check recording lock - if locked, the stop should be ignored
        if (isRecording && !isAutoSave && !isIntentional) {
          // If recording is locked, this is definitely an accidental stop
          if (recordingLockRef.current) {
            console.warn('MediaRecorder stopped unexpectedly while recording is locked - ignoring stop event to prevent interruption from other components');
            isIntentionalStopRef.current = false;
            return;
          }
          
          if (streamStillActive) {
            console.warn('MediaRecorder stopped unexpectedly while recording was active and stream is still live - ignoring stop event to prevent interruption');
            // Reset the flag for next time
            isIntentionalStopRef.current = false;
            // Don't process this stop - recording should continue
            // The stream is still active, so we can continue
            return;
          } else {
            console.warn('MediaRecorder stopped and stream became inactive - this may be a real stop');
            // Stream is inactive, but recording state says we should be recording
            // This might be a browser issue or track interruption
            // For now, we'll still ignore it to prevent accidental stops
            isIntentionalStopRef.current = false;
            return;
          }
        }
        
        // Only process stop if recording was actually stopped intentionally or was already false
        if (!isRecording && !isAutoSave && !isIntentional) {
          console.warn('MediaRecorder stopped but recording state was already false and not intentional - ignoring stop event');
          // Reset the flag for next time
          isIntentionalStopRef.current = false;
          return;
        }
        
        // Reset the intentional stop flag after processing
        isIntentionalStopRef.current = false;
        
        // Unlock recording now that we're processing a legitimate stop
        recordingLockRef.current = false;
        
        try {
          // Stop stream monitoring
          if (streamMonitorIntervalRef.current) {
            clearInterval(streamMonitorIntervalRef.current);
            streamMonitorIntervalRef.current = null;
          }
          
          // Stop drawing loop
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // Cleanup video elements
          videoElementsRef.current.forEach(video => {
            try {
              video.srcObject = null;
            } catch (error) {
              console.warn('Error cleaning up video element:', error);
            }
          });
          videoElementsRef.current.clear();

          // Cleanup audio context
          if (audioContextRef.current) {
            try {
              await audioContextRef.current.close();
            } catch (error) {
              console.warn('Error closing audio context:', error);
            }
            audioContextRef.current = null;
          }
          audioSourcesRef.current = [];
          audioDestinationRef.current = null;

          // Stop stream monitoring
          if (streamMonitorIntervalRef.current) {
            clearInterval(streamMonitorIntervalRef.current);
            streamMonitorIntervalRef.current = null;
          }
          
          // Stop canvas stream
          if (canvasStreamRef.current) {
            canvasStreamRef.current.getTracks().forEach(track => {
              try {
                track.stop();
              } catch (error) {
                console.warn('Error stopping canvas track:', error);
              }
            });
            canvasStreamRef.current = null;
          }

          if (recordedChunksRef.current.length === 0) {
            if (!isAutoSave) {
              toast.error('Empty Recording', {
                description: 'No recording data was captured. Please try recording again.',
                duration: 4000,
                icon: '⚠️',
              });
            }
            return;
          }

          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          
          // For auto-save (page closing), download as WebM immediately for speed
          if (isAutoSave) {
            downloadRecording(blob, 'webm');
            return;
          }
          
          // Convert to MP4 (try client-side first, then server)
          let mp4Blob: Blob | null = null;
          if (mimeType.includes('webm')) {
            try {
              mp4Blob = await convertToMP4Client(blob);
            } catch (error) {
              console.warn('Client-side conversion failed:', error);
            }
            
            if (!mp4Blob) {
              try {
                mp4Blob = await convertToMP4Server(blob);
              } catch (error) {
                console.warn('Server-side conversion failed:', error);
              }
            }
          }

          // Ensure any remaining conversion toasts are dismissed
          toast.dismiss('converting');
          toast.dismiss('uploading');
          
          if (mp4Blob) {
            downloadRecording(mp4Blob, 'mp4');
          } else {
            // Fallback: download as WebM with info message
            toast('MP4 conversion unavailable. Downloading as WebM.', {
              icon: 'ℹ️',
              duration: 4000,
            });
            downloadRecording(blob, 'webm');
          }
        } catch (error) {
          console.error('Error processing recording:', error);
          if (!isAutoSave) {
            toast.error('Processing Error', {
              description: error instanceof Error ? error.message : 'An error occurred while processing the recording. Please try again.',
              duration: 5000,
              icon: '❌',
            });
          }
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        // Don't stop recording on error - try to continue
        // Only show error if MediaRecorder actually stopped
        if (mediaRecorderRef.current?.state === 'inactive') {
          // Only stop recording if we were actually recording (not if it was already stopped)
          if (isRecording) {
            toast.error('Recording Error', {
              description: 'An error occurred during recording. The recording may be incomplete.',
              duration: 5000,
              icon: '❌',
            });
            setIsRecording(false);
            setProcessingRecRequest(false);
          }
        } else {
          // MediaRecorder is still active, just log the error
          console.warn('MediaRecorder error but still recording:', event);
        }
      };

      // Reset intentional stop flag when starting new recording
      isIntentionalStopRef.current = false;
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      // Lock recording to prevent accidental stops
      recordingLockRef.current = true;
      
      // Monitor stream health and restart MediaRecorder if it stops unexpectedly
      const monitorStreamHealth = () => {
        if (!mediaRecorderRef.current || !isRecording) {
          if (streamMonitorIntervalRef.current) {
            clearInterval(streamMonitorIntervalRef.current);
            streamMonitorIntervalRef.current = null;
          }
          return;
        }
        
        const recorder = mediaRecorderRef.current;
        const stream = recorder.stream;
        
        // Check if MediaRecorder stopped unexpectedly
        if (recorder.state === 'inactive' && isRecording && !isIntentionalStopRef.current) {
          // Check if source tracks are still available
          const canvasStream = canvasStreamRef.current;
          const videoTracks = collectAllVideoTracks();
          const audioTracks = collectAllAudioTracks();
          
          // If we have tracks and canvas stream, try to restart
          if (canvasStream && (videoTracks.length > 0 || audioTracks.length > 0)) {
            console.warn('MediaRecorder stopped unexpectedly but tracks are still available - attempting to restart');
            
            // Check if canvas stream tracks are still active
            const canvasTracksActive = canvasStream.getTracks().some(track => track.readyState === 'live');
            
            if (canvasTracksActive) {
              try {
                // Recreate the combined stream
                const newCombinedStream = new MediaStream();
                
                // Add canvas video track
                canvasStream.getVideoTracks().forEach(track => {
                  if (track.readyState === 'live') {
                    newCombinedStream.addTrack(track);
                  }
                });
                
                // Re-mix audio if needed
                mixAudioTracks(audioTracks).then(mixedAudio => {
                  if (mixedAudio) {
                    mixedAudio.getAudioTracks().forEach(track => {
                      if (track.readyState === 'live') {
                        newCombinedStream.addTrack(track);
                      }
                    });
                  }
                  
                  // Create a new MediaRecorder with the new stream
                  const mimeType = recorder.mimeType || 'video/webm;codecs=vp9,opus';
                  const newRecorder = new MediaRecorder(newCombinedStream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: 2500000,
                    audioBitsPerSecond: 128000,
                  });
                  
                  // Copy event handlers
                  newRecorder.ondataavailable = recorder.ondataavailable;
                  newRecorder.onerror = recorder.onerror;
                  newRecorder.onstop = recorder.onstop;
                  
                  // Start the new recorder
                  newRecorder.start(1000);
                  mediaRecorderRef.current = newRecorder;
                  
                  console.log('MediaRecorder restarted successfully after unexpected stop');
                }).catch(error => {
                  console.error('Failed to re-mix audio for restart:', error);
                });
              } catch (error) {
                console.error('Failed to restart MediaRecorder:', error);
              }
            }
          }
        }
      };
      
      // Monitor every 2 seconds
      streamMonitorIntervalRef.current = setInterval(monitorStreamHealth, 2000);
      
      // Wait a bit for videos to load before starting recording
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start drawing loop
      const drawLoop = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
          try {
            drawToCanvas(canvas, ctx);
            animationFrameRef.current = requestAnimationFrame(drawLoop);
          } catch (error) {
            // If drawing fails, check if MediaRecorder is still recording
            if (recorder && recorder.state === 'recording') {
              // Continue drawing loop even if one frame fails
              // Don't log AbortError as it's expected when other components open
              if (error instanceof Error && error.name !== 'AbortError') {
                console.warn('Error drawing to canvas, continuing:', error);
              }
              animationFrameRef.current = requestAnimationFrame(drawLoop);
            } else if (recorder && recorder.state === 'inactive' && isRecording) {
              // MediaRecorder stopped unexpectedly but we're still in recording state
              // This might be due to FileSharing/ScreenAnnotation opening
              // Check if stream is still active - if so, try to continue
              const streamActive = recorder.stream && 
                recorder.stream.getTracks().some(track => track.readyState === 'live');
              if (streamActive) {
                console.warn('MediaRecorder stopped unexpectedly but stream is active - continuing drawing loop');
                // Continue drawing - the onstop handler will ignore the stop if stream is active
                animationFrameRef.current = requestAnimationFrame(drawLoop);
              } else {
                // Stream is inactive, exit loop
                if (animationFrameRef.current) {
                  cancelAnimationFrame(animationFrameRef.current);
                  animationFrameRef.current = null;
                }
              }
            } else {
              // MediaRecorder stopped normally, exit loop
              if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
              }
            }
          }
        } else if (recorder && recorder.state === 'inactive' && isRecording) {
          // MediaRecorder stopped but we're still recording - check stream
          const streamActive = recorder.stream && 
            recorder.stream.getTracks().some(track => track.readyState === 'live');
          if (streamActive) {
            // Stream is still active, continue drawing - onstop will handle it
            animationFrameRef.current = requestAnimationFrame(drawLoop);
          } else {
            // Stream is inactive, exit loop
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
          }
        } else {
          // MediaRecorder stopped normally, exit loop
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        }
      };
      drawLoop();

      const count = getParticipantCount();
      setParticipantCount(count);

      toast.success('Recording Started', {
        description: `Recording ${count} participant${count !== 1 ? 's' : ''}. Click the recording button in the controls to stop.`,
        duration: 4000,
        icon: '🔴',
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Cleanup on error
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      videoElementsRef.current.forEach(video => {
        video.srcObject = null;
      });
      videoElementsRef.current.clear();
      
      // Show appropriate error message
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
          toast.error('Permission Denied', {
            description: 'Recording permission was denied. Please allow camera/microphone access in your browser settings.',
            duration: 5000,
            icon: '🔒',
          });
        } else if (error.message.includes('canvas')) {
          toast.error('Canvas Error', {
            description: 'Failed to initialize recording canvas. Please refresh the page and try again.',
            duration: 5000,
            icon: '❌',
          });
        } else {
          toast.error('Recording Failed', {
            description: error.message || 'Unable to start recording. Please try again.',
            duration: 5000,
            icon: '❌',
          });
        }
      } else {
        toast.error('Recording Failed', {
          description: 'An unexpected error occurred. Please try again.',
          duration: 5000,
          icon: '❌',
        });
      }
      
      setProcessingRecRequest(false);
      setIsRecording(false);
    }
  }, [
    collectAllVideoTracks,
    collectAllAudioTracks,
    createCompositingCanvas,
    mixAudioTracks,
    drawToCanvas,
    convertToMP4Client,
    convertToMP4Server,
    getParticipantCount,
    isRecording,
    downloadRecording,
  ]);

  const stopClientSideRecording = useCallback(() => {
    // This function is always called intentionally (user clicked stop button)
    // So we always allow it and unlock the recording
    
    // Unlock recording before stopping
    recordingLockRef.current = false;
    
    // Mark as intentional stop
    isIntentionalStopRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    
    // Close the dropdown menu to show the completion modal
    onStopRecording?.();
    
    toast.success('Recording stopped! Processing...', {
      icon: '⏹️',
      duration: 2000,
    });
  }, [onStopRecording]);

  const toggleRecording = async () => {
    if (isRecording) {
      stopClientSideRecording();
    } else {
      setProcessingRecRequest(true);
      try {
        await startClientSideRecording();
      } finally {
        setProcessingRecRequest(false);
      }
    }
  };

  return (
    <>
      <button
        onClick={toggleRecording}
        disabled={processingRecRequest || !isFeatureEnabled || converting}
        className="mobile-recording-button"
        data-recording={isRecording}
        data-recording-trigger="true"
        title={
          isRecording
            ? 'Stop recording'
            : 'Start recording all participants'
        }
        style={{
          width: '100%',
          padding: '10px 14px',
          backgroundColor: !isFeatureEnabled
            ? 'rgba(128, 128, 128, 0.15)'
            : isRecording
              ? 'rgba(220, 38, 38, 0.18)'
              : 'rgba(255, 255, 255, 0.08)',
          color: !isFeatureEnabled
            ? 'rgba(255, 255, 255, 0.5)'
            : isRecording
              ? '#fca5a5'
              : 'white',
          border: '1px solid',
          borderColor: !isFeatureEnabled
            ? 'rgba(255, 255, 255, 0.12)'
            : isRecording
              ? 'rgba(220, 38, 38, 0.45)'
              : 'rgba(255, 255, 255, 0.18)',
          borderRadius: '10px',
          cursor: processingRecRequest || !isFeatureEnabled || converting ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!processingRecRequest && isFeatureEnabled && !isRecording && !converting) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = !isFeatureEnabled
            ? 'rgba(128, 128, 128, 0.15)'
            : isRecording
              ? 'rgba(220, 38, 38, 0.18)'
              : 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = !isFeatureEnabled
            ? 'rgba(255, 255, 255, 0.12)'
            : isRecording
              ? 'rgba(220, 38, 38, 0.45)'
              : 'rgba(255, 255, 255, 0.18)';
        }}
      >
        <span
          className="mobile-button-icon"
          style={{
            width: 12,
            height: 12,
            borderRadius: isRecording ? 3 : '50%',
            backgroundColor: !isFeatureEnabled ? 'rgba(255, 255, 255, 0.25)' : 'white',
            boxShadow: isRecording ? '0 0 0 6px rgba(248, 113, 113, 0.45)' : 'none',
            animation: isRecording ? 'pulse 1.4s ease-in-out infinite' : 'none',
          }}
        />
        <span className="mobile-button-label" style={{ flex: 1 }}>
          {converting
            ? 'Converting...'
            : processingRecRequest
              ? 'Preparing recorder...'
              : isRecording
                ? 'Stop Recording'
                : 'Start Recording'}
        </span>
        {showProBadge && (
          <span
            style={{
              padding: '2px 7px',
              background: 'linear-gradient(90deg, #a855f7, #ec4899)',
              borderRadius: 6,
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            PRO
          </span>
        )}
        {(processingRecRequest || converting) && (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              borderTopColor: 'white',
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
      </button>

      {/* Enhanced Recording Badge with Timer */}
      {isRecording && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000, // Higher than FileSharing (9999) and ScreenAnnotation to ensure visibility
            padding: '10px 20px',
            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))',
            color: 'white',
            borderRadius: '12px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.3,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(220, 38, 38, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#fee2e2',
                boxShadow: '0 0 0 4px rgba(254, 202, 202, 0.5), 0 0 20px rgba(254, 202, 202, 0.8)',
                animation: 'pulse 1.4s ease-in-out infinite',
                display: 'block',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              RECORDING
            </div>
            <div style={{ fontSize: 11, opacity: 0.9, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{formatTime(recordingTime)}</span>
              <span style={{ opacity: 0.6 }}>•</span>
              <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Completion Modal */}
      {mounted && showCompletionModal && downloadInfo && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001, // Higher than FileSharing (9999) and recording badge (10000)
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowCompletionModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.98), rgba(20, 20, 20, 0.98))',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '450px',
              width: '90%',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              animation: 'modalSlideIn 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success Icon */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            {/* Title */}
            <h2
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'white',
                textAlign: 'center',
              }}
            >
              Recording Complete!
            </h2>

            {/* Message */}
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                color: 'rgba(255, 255, 255, 0.8)',
                textAlign: 'center',
                lineHeight: 1.6,
              }}
            >
              Your recording has been saved and downloaded successfully.
            </p>

            {/* File Info */}
            <div
              style={{
                width: '100%',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>Format:</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{downloadInfo.format}</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowCompletionModal(false)}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1))';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.8); opacity: 0.65; }
        }
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
