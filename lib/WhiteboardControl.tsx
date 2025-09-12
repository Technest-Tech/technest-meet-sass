'use client';

import React, { useState, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Whiteboard } from './Whiteboard';
import { WhiteboardNotification } from './WhiteboardNotification';

interface WhiteboardControlProps {
  isHost: boolean;
}

export function WhiteboardControl({ isHost }: WhiteboardControlProps) {
  const room = useRoomContext();
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'success' | 'warning';
  } | null>(null);
  
  // For guests, start with whiteboard closed and wait for host commands
  const [isWaitingForHost, setIsWaitingForHost] = useState(!isHost);

  // Send whiteboard toggle command to all participants
  const sendWhiteboardToggle = useCallback((action: 'open' | 'close') => {
    if (!room) return;
    
    try {
      const message = {
        type: 'whiteboard_toggle',
        isHost: isHost,
        action: action
      };
      
      const encodedData = new TextEncoder().encode(JSON.stringify(message));
      room.localParticipant.publishData(encodedData);
    } catch (error) {
      console.error('Error sending whiteboard toggle command:', error);
    }
  }, [room, isHost]);

  const toggleWhiteboard = () => {
    // Only hosts can manually toggle the whiteboard
    if (!isHost) {
      setNotification({
        message: 'Only hosts can open/close the whiteboard',
        type: 'warning'
      });
      return;
    }
    
    const newState = !isWhiteboardOpen;
    setIsWhiteboardOpen(newState);
    
    // Send command to all participants
    sendWhiteboardToggle(newState ? 'open' : 'close');
    
    // Show notification for host
    setNotification({
      message: newState 
        ? 'Whiteboard opened for all participants' 
        : 'Whiteboard closed for all participants',
      type: 'success'
    });
  };

  // Handle host control of whiteboard state
  const handleHostToggle = useCallback((isOpen: boolean) => {
    setIsWhiteboardOpen(isOpen);
    setIsWaitingForHost(false); // No longer waiting for host
    
    // Show notification for guests when host controls whiteboard
    if (!isHost) {
      setNotification({
        message: isOpen 
          ? 'Host opened whiteboard for all participants' 
          : 'Host closed whiteboard for all participants',
        type: 'info'
      });
    }
  }, [isHost]);

  return (
    <>
      {/* Whiteboard Control Button - Only show for hosts */}
      {isHost && (
        <button
          onClick={toggleWhiteboard}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl ${
            isWhiteboardOpen
              ? 'bg-blue-600 text-white shadow-blue-500/50'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
          }`}
          title={isWhiteboardOpen ? 'Close Whiteboard for All' : 'Open Whiteboard for All'}
        >
          {isWhiteboardOpen ? '📋 Close for All' : '📋 Open for All'}
        </button>
      )}

      {/* Whiteboard Component - Always render for both hosts and guests */}
      <Whiteboard
        isOpen={isWhiteboardOpen}
        onClose={() => {
          setIsWhiteboardOpen(false);
          // If host is closing, send command to all participants
          if (isHost) {
            sendWhiteboardToggle('close');
          }
        }}
        isHost={isHost}
        onHostToggle={handleHostToggle}
      />

      {/* Notification */}
      {notification && (
        <WhiteboardNotification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </>
  );
}
