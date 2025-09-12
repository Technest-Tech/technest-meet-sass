'use client';

import React, { useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import toast from 'react-hot-toast';

interface SimpleRecordingControlProps {
  isHost: boolean;
}

export function SimpleRecordingControl({ isHost }: SimpleRecordingControlProps) {
  const room = useRoomContext();
  const [isRecording, setIsRecording] = useState(false);
  const [processingRecRequest, setProcessingRecRequest] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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
    <button
      onClick={toggleRecording}
      disabled={processingRecRequest}
      style={{
        padding: '12px 16px',
        backgroundColor: isRecording 
          ? 'rgba(220, 38, 38, 0.9)' 
          : 'rgba(34, 197, 94, 0.9)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        cursor: processingRecRequest ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        backdropFilter: 'blur(10px)',
        opacity: processingRecRequest ? 0.6 : 1,
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '140px',
        justifyContent: 'center'
      }}
      title={
        isRecording 
          ? 'Stop screen recording'
          : 'Start screen recording'
      }
    >
      {processingRecRequest ? (
        <>
          <div style={{
            width: '12px',
            height: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Processing...
        </>
              ) : isRecording ? (
          <>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: 'white',
              borderRadius: '2px'
            }} />
            Stop Screen Recording
          </>
        ) : (
          <>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: 'white',
              borderRadius: '50%'
            }} />
            Record Screen
          </>
        )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
