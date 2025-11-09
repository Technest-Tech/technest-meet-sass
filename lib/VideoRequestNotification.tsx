'use client';

import React, { useState, useEffect } from 'react';
import { Video, VideoOff, X } from 'lucide-react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import toast from 'react-hot-toast';
import { VideoRequestData } from './types';

interface VideoRequestNotificationProps {
  // Component is self-contained and listens for requests via data channel
}

export function VideoRequestNotification() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [activeRequest, setActiveRequest] = useState<VideoRequestData | null>(null);

  // Listen for video requests
  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleDataReceived = async (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        // Check if this is a video request for this participant
        if (
          (messageData.type === 'video_request_on' || messageData.type === 'video_request_off') &&
          messageData.targetParticipant === localParticipant.identity
        ) {
          // For camera_off requests, turn off camera immediately without confirmation
          if (messageData.type === 'video_request_off') {
            await localParticipant.setCameraEnabled(false);
            toast('📹 The host turned off your camera', {
              duration: 4000,
              style: {
                background: '#ef4444',
                color: '#fff',
                fontWeight: '600',
              },
            });
            
            // Send auto-accept response
            const response: VideoRequestData = {
              type: 'video_request_response',
              targetParticipant: messageData.sender,
              requestType: 'camera_off',
              response: 'accepted',
              sender: localParticipant.identity,
              timestamp: Date.now(),
              id: `response-${Date.now()}`
            };
            const encodedData = new TextEncoder().encode(JSON.stringify(response));
            await room.localParticipant.publishData(encodedData, { topic: 'video-request' });
          } else {
            // For camera_on requests, show confirmation dialog
            setActiveRequest(messageData as VideoRequestData);
          }
        }
      } catch (error) {
        console.error('Error parsing video request:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, localParticipant]);

  const handleAccept = async () => {
    if (!activeRequest || !room || !localParticipant) return;

    try {
      if (activeRequest.requestType === 'camera_on') {
        // Enable camera
        await localParticipant.setCameraEnabled(true);
        toast.success('Camera enabled');
      } else {
        // Disable camera
        await localParticipant.setCameraEnabled(false);
        toast.success('Camera disabled');
      }

      // Send response to host
      const response: VideoRequestData = {
        type: 'video_request_response',
        targetParticipant: activeRequest.sender,
        requestType: activeRequest.requestType,
        response: 'accepted',
        sender: localParticipant.identity,
        timestamp: Date.now(),
        id: `response-${Date.now()}`
      };

      const encodedData = new TextEncoder().encode(JSON.stringify(response));
      await room.localParticipant.publishData(encodedData, { topic: 'video-request' });

      setActiveRequest(null);
    } catch (error) {
      console.error('Error handling video request:', error);
      toast.error('Failed to change camera state');
    }
  };

  const handleDecline = async () => {
    if (!activeRequest || !room || !localParticipant) return;

    // Send decline response to host
    const response: VideoRequestData = {
      type: 'video_request_response',
      targetParticipant: activeRequest.sender,
      requestType: activeRequest.requestType,
      response: 'declined',
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `response-${Date.now()}`
    };

    const encodedData = new TextEncoder().encode(JSON.stringify(response));
    await room.localParticipant.publishData(encodedData, { topic: 'video-request' });

    toast('Request declined', {
      icon: 'ℹ️',
    });
    setActiveRequest(null);
  };

  if (!activeRequest) return null;

  const isRequestOn = activeRequest.requestType === 'camera_on';

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 2500,
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      padding: '32px',
      maxWidth: '450px',
      width: '90%',
      border: '2px solid #3b82f6'
    }}>
      {/* Icon */}
      <div style={{
        width: '64px',
        height: '64px',
        margin: '0 auto 20px',
        backgroundColor: isRequestOn ? '#dbeafe' : '#fee2e2',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isRequestOn ? (
          <Video size={32} color="#3b82f6" />
        ) : (
          <VideoOff size={32} color="#ef4444" />
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '12px',
        textAlign: 'center'
      }}>
        Video Request from Host
      </h3>

      {/* Message */}
      <p style={{
        fontSize: '15px',
        color: '#6b7280',
        marginBottom: '24px',
        textAlign: 'center',
        lineHeight: '1.5'
      }}>
        The host is requesting you to turn on your camera.
      </p>

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
      }}>
        <button
          onClick={handleDecline}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '500',
            backgroundColor: '#f3f4f6',
            color: '#4b5563',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '500',
            backgroundColor: isRequestOn ? '#3b82f6' : '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          Accept
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={() => setActiveRequest(null)}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: '#9ca3af'
        }}
        title="Dismiss"
      >
        <X size={20} />
      </button>
    </div>
  );
}

