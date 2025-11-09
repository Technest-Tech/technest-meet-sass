'use client';

import React, { useState, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { MoreVertical, Mic, MicOff, Video, VideoOff, MessageSquare, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import { VideoRequestData } from './types';

interface ParticipantActionsProps {
  participantIdentity: string;
  participantName: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  roomName: string;
}

export function ParticipantActions({
  participantIdentity,
  participantName,
  isHost,
  audioEnabled,
  videoEnabled,
  roomName
}: ParticipantActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const muteParticipant = useCallback(async (mute: boolean) => {
    if (!isHost) return;
    setIsProcessing(true);

    try {
      const response = await fetch('/api/room/controls/mute-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room?.name || roomName,
          participantIdentity,
          mute
        })
      });

      if (response.ok) {
        toast.success(`${participantName} ${mute ? 'muted' : 'unmuted'}`);
      } else {
        toast.error(`Failed to ${mute ? 'mute' : 'unmute'}`);
      }
    } catch (error) {
      console.error('Error muting participant:', error);
      toast.error('Network error occurred');
    } finally {
      setIsProcessing(false);
      setMenuOpen(false);
    }
  }, [isHost, roomName, room, participantIdentity, participantName]);

  const requestVideoControl = useCallback(async (turnOn: boolean) => {
    if (!isHost || !room || !localParticipant) return;

    const request: VideoRequestData = {
      type: turnOn ? 'video_request_on' : 'video_request_off',
      targetParticipant: participantIdentity,
      requestType: turnOn ? 'camera_on' : 'camera_off',
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `request-${Date.now()}`
    };

    try {
      const encodedData = new TextEncoder().encode(JSON.stringify(request));
      await room.localParticipant.publishData(encodedData, { topic: 'video-request', reliable: true });
      
      toast.success(`Request sent to ${participantName}`);
      setMenuOpen(false);
    } catch (error) {
      console.error('Error sending video request:', error);
      toast.error('Failed to send request');
    }
  }, [isHost, room, localParticipant, participantIdentity, participantName]);

  const removeParticipant = useCallback(async () => {
    if (!isHost) return;
    
    if (!confirm(`Remove ${participantName} from meeting?`)) return;
    
    setIsProcessing(true);

    try {
      const response = await fetch(`/api/admin/rooms/${roomName}/remove-participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIdentity,
          roomName: room?.name || roomName
        })
      });

      if (response.ok) {
        toast.success(`${participantName} removed from meeting`);
      } else {
        toast.error('Failed to remove participant');
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Network error occurred');
    } finally {
      setIsProcessing(false);
      setMenuOpen(false);
    }
  }, [isHost, roomName, room, participantIdentity, participantName]);

  const openPrivateChat = useCallback(() => {
    toast.info(`Opening chat with ${participantName}`, { duration: 2000 });
    setMenuOpen(false);
    // TODO: Integrate with Chat component to pre-select recipient
  }, [participantName]);

  if (!isHost) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '8px',
      right: '8px',
      zIndex: 100
    }}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        disabled={isProcessing}
        style={{
          padding: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: 'none',
          borderRadius: '6px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
          opacity: isProcessing ? 0.5 : 1,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        }}
        title="More actions"
      >
        <MoreVertical size={18} color="white" />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99
            }}
            onClick={() => setMenuOpen(false)}
          />
          
          <div style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e5e7eb',
            minWidth: '200px',
            zIndex: 100,
            overflow: 'hidden'
          }}>
            <button
              onClick={() => muteParticipant(!audioEnabled)}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: '#374151',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {audioEnabled ? <MicOff size={16} /> : <Mic size={16} />}
              {audioEnabled ? 'Mute' : 'Unmute'}
            </button>

            <button
              onClick={() => requestVideoControl(!videoEnabled)}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: '#374151',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {videoEnabled ? <VideoOff size={16} /> : <Video size={16} />}
              Request {videoEnabled ? 'camera off' : 'camera on'}
            </button>

            <button
              onClick={openPrivateChat}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: '#374151',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <MessageSquare size={16} />
              Send private message
            </button>

            <div style={{
              height: '1px',
              backgroundColor: '#e5e7eb',
              margin: '4px 0'
            }} />

            <button
              onClick={removeParticipant}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: '#ef4444',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <UserMinus size={16} />
              Remove from meeting
            </button>
          </div>
        </>
      )}
    </div>
  );
}

