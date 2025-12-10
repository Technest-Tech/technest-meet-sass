'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext } from '@livekit/components-react';
import toast from 'react-hot-toast';

interface SimpleRecordingControlProps {
  isHost: boolean;
  isFeatureEnabled: boolean;
  showProBadge?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function SimpleRecordingControl({
  isHost,
  isFeatureEnabled,
  showProBadge = false,
  onRecordingStateChange,
}: SimpleRecordingControlProps) {
  const room = useRoomContext();
  const [isRecording, setIsRecording] = useState(false);
  const [processingRecRequest, setProcessingRecRequest] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  // Don't show recording controls if not a host
  if (!isHost) {
    return null;
  }

  const startClientSideRecording = async () => {
    try {
      // Get screen capture stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true // Include system audio
      });

      // Also get microphone audio for better quality
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        });
      } catch (audioError) {
        console.warn('Could not get microphone audio:', audioError);
      }

      // Combine screen and audio streams
      const combinedStream = new MediaStream();

      // Add screen video tracks
      screenStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      // Add audio tracks (prefer microphone, fallback to system audio)
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      } else {
        screenStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      streamRef.current = combinedStream;
      recordedChunksRef.current = [];

      // Try to use MP4 format, fallback to WebM if not supported
      let mimeType = 'video/mp4;codecs=h264,aac';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
        audioBitsPerSecond: 128000   // 128 kbps for audio
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        downloadRecording(blob, fileExtension);
      };

      // Handle screen sharing end
      screenStream.getVideoTracks()[0].onended = () => {
        if (isRecording) {
          stopClientSideRecording();
          toast.info('Screen sharing ended. Recording stopped.', {
            icon: 'ℹ️',
            duration: 3000,
          });
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      toast.success('Screen recording started!', {
        icon: '🔴',
        duration: 3000,
      });

    } catch (error) {
      console.error('Failed to start screen recording:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast.error('Screen recording permission denied. Please allow screen sharing when prompted.');
      } else {
        toast.error('Failed to start screen recording. Please check your browser permissions.');
      }
    }
  };

  const stopClientSideRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    toast.success('Recording stopped!', {
      icon: '⏹️',
      duration: 3000,
    });
  };

  const downloadRecording = (blob: Blob, fileExtension: string = 'mp4') => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screen-recording-${room.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`Screen recording downloaded successfully as ${fileExtension.toUpperCase()}!`, {
      icon: '✅',
      duration: 3000,
    });
  };

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
        disabled={processingRecRequest || !isFeatureEnabled}
        className="mobile-recording-button"
        data-recording={isRecording}
        data-recording-trigger="true"
        title={
          isRecording
            ? 'Stop screen recording'
            : 'Start screen recording'
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
          cursor: processingRecRequest || !isFeatureEnabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!processingRecRequest && isFeatureEnabled && !isRecording) {
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
          {processingRecRequest
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
        {processingRecRequest && (
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

      {mounted && isRecording && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1200,
            padding: '6px 14px',
            background: 'rgba(220, 38, 38, 0.85)',
            color: 'white',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.4,
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 10px 30px rgba(220, 38, 38, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#fee2e2',
              boxShadow: '0 0 0 6px rgba(254, 202, 202, 0.35)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
          Recording…
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
      `}</style>
    </>
  );
}
