'use client';

import React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

export function MeetingTimer() {
  const room = useRoomContext();
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const startTimeRef = React.useRef<number | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      console.log('[MeetingTimer] Room connected, starting timer');
      startTimeRef.current = Date.now();
      setIsRunning(true);
      
      // Start the interval to update the timer every second
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    };

    const handleDisconnected = () => {
      console.log('[MeetingTimer] Room disconnected, stopping timer');
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Check if already connected
    if (room.state === 'connected') {
      handleConnected();
    }

    // Listen for connection events
    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [room]);

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRunning && elapsedTime === 0) {
    return null; // Don't show timer until meeting starts
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        padding: '8px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: '600',
        fontFamily: 'monospace',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <span style={{ fontSize: '16px' }}>⏱️</span>
      <span>{formatTime(elapsedTime)}</span>
    </div>
  );
}

