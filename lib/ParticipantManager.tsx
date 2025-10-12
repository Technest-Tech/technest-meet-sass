'use client';

import React, { useState, useCallback } from 'react';
import { useParticipants, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { UserMinus, Users, X } from 'lucide-react';

interface ParticipantManagerProps {
  isHost: boolean;
  roomName: string;
}

export function ParticipantManager({ isHost, roomName }: ParticipantManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  // Combine local and remote participants, excluding the host
  const allParticipants = React.useMemo(() => {
    const all = [...participants];
    if (localParticipant) {
      all.push(localParticipant);
    }
    // Filter out the host from the list (host can't remove themselves)
    return all.filter(p => p.identity !== localParticipant?.identity);
  }, [participants, localParticipant]);

  const removeParticipant = useCallback(async (participantIdentity: string) => {
    if (!isHost) {
      setNotification({
        message: 'Only hosts can remove participants',
        type: 'error'
      });
      return;
    }

    setIsRemoving(participantIdentity);

    try {
      console.log(`🔧 Attempting to remove participant: ${participantIdentity} from room: ${roomName}`);
      const response = await fetch(`/api/admin/rooms/${roomName}/remove-participant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantIdentity,
          roomName: room?.name || roomName
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Participant removal successful:`, result);
        
        // Verify this was a participant removal, not an end meeting
        if (result.action === 'remove_participant_only') {
          setNotification({
            message: result.message,
            type: 'success'
          });
        } else {
          console.warn('⚠️ Unexpected response from remove participant API:', result);
          setNotification({
            message: 'Participant removed, but unexpected response received',
            type: 'info'
          });
        }
        
        // Clear notification after 3 seconds
        setTimeout(() => setNotification(null), 3000);
      } else {
        const error = await response.json();
        setNotification({
          message: error.error || 'Failed to remove participant',
          type: 'error'
        });
        
        // Clear notification after 5 seconds
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      setNotification({
        message: 'Network error occurred while removing participant',
        type: 'error'
      });
      
      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsRemoving(null);
    }
  }, [isHost, roomName, room]);

  const handleRemoveClick = useCallback((participantIdentity: string) => {
    const confirmMessage = `Are you sure you want to remove "${participantIdentity}" from the meeting?

This action will:
• Disconnect the participant immediately
• They will not be able to rejoin unless they have the room link
• This action cannot be undone

Do you want to continue?`;

    if (confirm(confirmMessage)) {
      removeParticipant(participantIdentity);
    }
  }, [removeParticipant]);

  // Don't render if not a host
  if (!isHost) {
    return null;
  }

  return (
    <>
      {/* Participant Manager Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-participants-trigger="true"
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(59, 130, 246, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        title="Manage Participants"
      >
        <Users size={16} />
        Participants ({allParticipants.length})
      </button>

      {/* Participant List Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Manage Participants
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: '#6b7280'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Participants List */}
            <div style={{ marginBottom: '20px' }}>
              {allParticipants.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6b7280'
                }}>
                  <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    No other participants in the meeting
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allParticipants.map((participant) => (
                    <div
                      key={participant.sid}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '16px'
                        }}>
                          {participant.identity.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{
                            fontWeight: '500',
                            color: '#1f2937',
                            fontSize: '16px'
                          }}>
                            {participant.identity}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#6b7280'
                          }}>
                            {participant === localParticipant ? 'You (Host)' : 'Guest'}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveClick(participant.identity)}
                        disabled={isRemoving === participant.identity}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: isRemoving === participant.identity ? '#9ca3af' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isRemoving === participant.identity ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'background-color 0.2s'
                        }}
                        title="Remove participant from meeting"
                      >
                        {isRemoving === participant.identity ? (
                          <>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              border: '2px solid transparent',
                              borderTop: '2px solid white',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            Removing...
                          </>
                        ) : (
                          <>
                            <UserMinus size={14} />
                            Remove
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#6b7280'
              }}>
                Only hosts can remove participants. Removed participants can rejoin if they have the room link.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3000,
          padding: '12px 20px',
          borderRadius: '8px',
          color: 'white',
          fontWeight: '500',
          fontSize: '14px',
          backgroundColor: notification.type === 'success' ? '#10b981' : 
                          notification.type === 'error' ? '#ef4444' : '#3b82f6',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          {notification.message}
        </div>
      )}

      {/* CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
