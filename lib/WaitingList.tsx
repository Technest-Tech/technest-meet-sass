'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserCheck, UserX, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoomContext } from '@livekit/components-react';

interface WaitingParticipant {
  id: string;
  participantName: string;
  participantType: string;
  status: string;
  joinedAt: string;
}

interface WaitingListProps {
  isHost: boolean;
  roomName: string;
}

export function WaitingList({ isHost, roomName }: WaitingListProps) {
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const room = useRoomContext();

  // Fetch waiting participants
  const fetchWaitingParticipants = useCallback(async () => {
    if (!isHost) return;

    try {
      const response = await fetch(
        `/api/room/waiting-room/list?roomName=${encodeURIComponent(roomName)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setWaitingParticipants(data.waitingParticipants || []);
      }
    } catch (error) {
      console.error('Error fetching waiting participants:', error);
    }
  }, [isHost, roomName]);

  // Poll for updates
  useEffect(() => {
    if (!isHost) return;

    fetchWaitingParticipants();
    const interval = setInterval(fetchWaitingParticipants, 3000);

    return () => clearInterval(interval);
  }, [isHost, fetchWaitingParticipants]);

  // Broadcast admit/reject via data channel
  const broadcastWaitingRoomAction = useCallback((action: 'admitted' | 'rejected', participantName: string) => {
    if (!room) return;

    const message = {
      type: action === 'admitted' ? 'waiting_room_admit' : 'waiting_room_reject',
      participantName,
      timestamp: Date.now()
    };

    const encodedData = new TextEncoder().encode(JSON.stringify(message));
    room.localParticipant.publishData(encodedData, { topic: 'waiting-room', reliable: true });
  }, [room]);

  const admitParticipant = useCallback(async (participantId: string, participantName: string) => {
    setProcessingId(participantId);
    
    try {
      const response = await fetch('/api/room/waiting-room/admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantId })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`✅ ${participantName} admitted to meeting`);
        
        // Broadcast to participants
        broadcastWaitingRoomAction('admitted', participantName);
        
        // Refresh list
        await fetchWaitingParticipants();
      } else {
        toast.error('Failed to admit participant');
      }
    } catch (error) {
      console.error('Error admitting participant:', error);
      toast.error('Error admitting participant');
    } finally {
      setProcessingId(null);
    }
  }, [roomName, fetchWaitingParticipants, broadcastWaitingRoomAction]);

  const rejectParticipant = useCallback(async (participantId: string, participantName: string) => {
    setProcessingId(participantId);
    
    try {
      const response = await fetch('/api/room/waiting-room/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantId })
      });

      if (response.ok) {
        toast.success(`❌ ${participantName} rejected`);
        
        // Broadcast to participants
        broadcastWaitingRoomAction('rejected', participantName);
        
        // Refresh list
        await fetchWaitingParticipants();
      } else {
        toast.error('Failed to reject participant');
      }
    } catch (error) {
      console.error('Error rejecting participant:', error);
      toast.error('Error rejecting participant');
    } finally {
      setProcessingId(null);
    }
  }, [roomName, fetchWaitingParticipants, broadcastWaitingRoomAction]);

  const admitAll = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/room/waiting-room/admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, admitAll: true })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`✅ Admitted all ${data.count} participant(s)`);
        
        // Broadcast to all participants
        waitingParticipants.forEach(p => {
          broadcastWaitingRoomAction('admitted', p.participantName);
        });
        
        // Refresh list
        await fetchWaitingParticipants();
      } else {
        toast.error('Failed to admit all participants');
      }
    } catch (error) {
      console.error('Error admitting all:', error);
      toast.error('Error admitting all participants');
    } finally {
      setIsLoading(false);
    }
  }, [roomName, waitingParticipants, fetchWaitingParticipants, broadcastWaitingRoomAction]);

  if (!isHost || waitingParticipants.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: 1500,
      width: '350px',
      maxHeight: '500px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      overflow: 'hidden',
      border: '2px solid #fbbf24'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            Waiting Room ({waitingParticipants.length})
          </h3>
        </div>
        {waitingParticipants.length > 1 && (
          <button
            onClick={admitAll}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#f59e0b',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
            title="Admit all waiting participants"
          >
            Admit All
          </button>
        )}
      </div>

      {/* Participants List */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '8px'
      }}>
        {waitingParticipants.map((participant) => (
          <div
            key={participant.id}
            style={{
              padding: '12px',
              marginBottom: '8px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fcd34d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            {/* Participant Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: '600',
                color: '#1f2937',
                fontSize: '14px',
                marginBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {participant.participantName}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>
                {new Date(participant.joinedAt).toLocaleTimeString()}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => admitParticipant(participant.id, participant.participantName)}
                disabled={processingId === participant.id}
                style={{
                  padding: '6px 10px',
                  backgroundColor: processingId === participant.id ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: processingId === participant.id ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Admit to meeting"
              >
                <CheckCircle size={14} />
                Admit
              </button>
              <button
                onClick={() => rejectParticipant(participant.id, participant.participantName)}
                disabled={processingId === participant.id}
                style={{
                  padding: '6px 10px',
                  backgroundColor: processingId === participant.id ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: processingId === participant.id ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Reject participant"
              >
                <XCircle size={14} />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

