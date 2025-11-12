'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, UserCheck, UserX, CheckCircle, XCircle, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoomContext } from '@livekit/components-react';
import { playGuestJoinNotificationSound } from './reactionSounds';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const room = useRoomContext();
  const previousCountRef = useRef<number>(0);
  const hasPlayedInitialSound = useRef(false);

  // Fetch waiting participants
  const fetchWaitingParticipants = useCallback(async () => {
    if (!isHost) return;

    try {
      const response = await fetch(
        `/api/room/waiting-room/list?roomName=${encodeURIComponent(roomName)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const newParticipants = data.waitingParticipants || [];
        const newCount = newParticipants.length;
        
        // Play notification sound and animate if new guest joined
        if (hasPlayedInitialSound.current && newCount > previousCountRef.current && newCount > 0) {
          // Play sound immediately
          console.log('🔔 Playing notification sound for new guest');
          try {
            playGuestJoinNotificationSound();
          } catch (error) {
            console.error('Error playing notification sound:', error);
          }
          
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 600);
          
          // Show toast notification - compare with previous state
          setWaitingParticipants(prev => {
            const newGuests = newParticipants.filter((p: WaitingParticipant) => 
              !prev.some(existing => existing.id === p.id)
            );
            if (newGuests.length > 0) {
              toast.success(`🔔 ${newGuests[0].participantName} is requesting to join`, {
                duration: 5000,
                style: {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontWeight: '600',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
                },
              });
            }
            return newParticipants;
          });
        } else {
          setWaitingParticipants(newParticipants);
        }
        
        previousCountRef.current = newCount;
        if (!hasPlayedInitialSound.current && newCount > 0) {
          hasPlayedInitialSound.current = true;
        }
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
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.4), 0 10px 40px rgba(0, 0, 0, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(102, 126, 234, 0.8), 0 10px 40px rgba(0, 0, 0, 0.3);
          }
        }
        
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0deg); }
          10%, 30% { transform: rotate(-15deg); }
          20%, 40% { transform: rotate(15deg); }
          50% { transform: rotate(0deg); }
        }
        
        .waiting-list-container {
          animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .waiting-list-animating {
          animation: pulse-glow 0.6s ease-in-out;
        }
        
        .bell-icon-animating {
          animation: bell-ring 0.6s ease-in-out;
        }
        
        .participant-item {
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .participant-item:hover {
          transform: translateX(-4px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .action-button {
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        
        .action-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .action-button:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .admit-all-button {
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .admit-all-button::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .admit-all-button:hover::before {
          width: 300px;
          height: 300px;
        }
        
        /* Responsive styles for small screens */
        @media (max-width: 768px) {
          .waiting-list-container {
            width: calc(100vw - 20px) !important;
            max-width: 380px;
            right: 10px !important;
            left: 10px !important;
            margin: 0 auto;
            top: 130px !important;
          }
        }
        
        @media (max-width: 480px) {
          .waiting-list-container {
            width: calc(100vw - 16px) !important;
            right: 8px !important;
            left: 8px !important;
            top: 120px !important;
            max-height: calc(100vh - 140px) !important;
          }
        }
      `}</style>
      <div 
        className={`waiting-list-container ${isAnimating ? 'waiting-list-animating' : ''}`}
        style={{
          position: 'fixed',
          top: '140px',
          right: '20px',
          zIndex: 9999999,
          width: '380px',
          maxHeight: '550px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Header */}
        <div 
          className="waiting-list-header"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: '180px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <Bell 
                size={20} 
                className={isAnimating ? 'bell-icon-animating' : ''}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
              />
            </div>
            <div>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: '700',
                letterSpacing: '-0.3px',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                Waiting Room
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                opacity: 0.95,
                fontWeight: '500',
                marginTop: '2px'
              }}>
                {waitingParticipants.length} {waitingParticipants.length === 1 ? 'person' : 'people'} waiting
              </p>
            </div>
          </div>
          {waitingParticipants.length > 1 && (
            <button
              className="admit-all-button"
              onClick={admitAll}
              disabled={isLoading}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#3b82f6',
                border: 'none',
                borderRadius: '10px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                position: 'relative',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
              title="Admit all waiting participants"
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                Admit All
              </span>
            </button>
          )}
        </div>

        {/* Participants List */}
        <div 
          className="waiting-list-content"
          style={{
            maxHeight: '450px',
            overflowY: 'auto',
            padding: '12px',
            background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
          }}
        >
          {waitingParticipants.map((participant, index) => (
            <div
              key={participant.id}
              className="participant-item"
              style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                animationDelay: `${index * 0.1}s`,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: '120px' }}>
                {/* Avatar Circle */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '700',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  textTransform: 'uppercase',
                }}>
                  {participant.participantName.charAt(0)}
                </div>

                {/* Participant Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    color: '#1e293b',
                    fontSize: '14px',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                    letterSpacing: '-0.2px',
                  }}>
                    {participant.participantName}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="action-button"
                  onClick={() => admitParticipant(participant.id, participant.participantName)}
                  disabled={processingId === participant.id}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: processingId === participant.id ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: processingId === participant.id ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: processingId === participant.id ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Admit to meeting"
                  onMouseEnter={(e) => {
                    if (processingId !== participant.id) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = processingId === participant.id ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.25)';
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Admit</span>
                </button>
                <button
                  className="action-button"
                  onClick={() => rejectParticipant(participant.id, participant.participantName)}
                  disabled={processingId === participant.id}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: processingId === participant.id ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: processingId === participant.id ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: processingId === participant.id ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Reject participant"
                  onMouseEnter={(e) => {
                    if (processingId !== participant.id) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = processingId === participant.id ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.25)';
                  }}
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

