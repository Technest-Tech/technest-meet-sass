'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { MoreHorizontal, X, Users, UserMinus } from 'lucide-react';
import { Whiteboard } from './Whiteboard';
import { WhiteboardNotification } from './WhiteboardNotification';
import { Chat } from './Chat';
import { SettingsMenu } from './SettingsMenu';
import { SimpleRecordingControl } from './SimpleRecordingControl';

interface MoreControlsProps {
  isHost: boolean;
  canRecord?: boolean;
  roomName: string;
  onEndMeeting: () => void;
}

export function MoreControls({ isHost, canRecord, roomName, onEndMeeting }: MoreControlsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // State for all controls
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isParticipantManagerOpen, setIsParticipantManagerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [whiteboardNotification, setWhiteboardNotification] = useState<{
    message: string;
    type: 'info' | 'success' | 'warning';
  } | null>(null);
  const [participantNotification, setParticipantNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // LiveKit hooks
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

  // Whiteboard functionality
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
    if (!isHost) {
      setWhiteboardNotification({
        message: 'Only hosts can open/close the whiteboard',
        type: 'warning'
      });
      return;
    }
    
    const newState = !isWhiteboardOpen;
    setIsWhiteboardOpen(newState);
    sendWhiteboardToggle(newState ? 'open' : 'close');
    
    setWhiteboardNotification({
      message: newState 
        ? 'Whiteboard opened for all participants' 
        : 'Whiteboard closed for all participants',
      type: 'success'
    });
  };

  const handleHostToggle = useCallback((isOpen: boolean) => {
    setIsWhiteboardOpen(isOpen);
    
    if (!isHost) {
      setWhiteboardNotification({
        message: isOpen 
          ? 'Host opened whiteboard for all participants' 
          : 'Host closed whiteboard for all participants',
        type: 'info'
      });
    }
  }, [isHost]);

  // Participant management functionality
  const removeParticipant = useCallback(async (participantIdentity: string) => {
    if (!isHost) {
      setParticipantNotification({
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
          setParticipantNotification({
            message: result.message,
            type: 'success'
          });
        } else {
          console.warn('⚠️ Unexpected response from remove participant API:', result);
          setParticipantNotification({
            message: 'Participant removed, but unexpected response received',
            type: 'info'
          });
        }
        setTimeout(() => setParticipantNotification(null), 3000);
      } else {
        const error = await response.json();
        setParticipantNotification({
          message: error.error || 'Failed to remove participant',
          type: 'error'
        });
        setTimeout(() => setParticipantNotification(null), 5000);
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      setParticipantNotification({
        message: 'Network error occurred while removing participant',
        type: 'error'
      });
      setTimeout(() => setParticipantNotification(null), 5000);
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

  // Chat functionality
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  // Settings functionality
  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  return (
    <div ref={dropdownRef} className="more-controls-container" style={{ position: 'relative' }}>
      {/* More Button */}
      <button
        className="more-controls-button"
        onClick={toggleDropdown}
        style={{
          padding: '12px 16px',
          backgroundColor: isDropdownOpen 
            ? 'rgba(59, 130, 246, 0.9)' 
            : 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '120px',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isDropdownOpen ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isDropdownOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.9)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDropdownOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
          }
        }}
        title="More Controls"
      >
        <MoreHorizontal size={16} />
        More
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          className="more-controls-dropdown"
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '12px',
            minWidth: '180px',
            maxWidth: 'calc(100vw - 40px)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          {/* Close button */}
          <button
            onClick={closeDropdown}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255, 255, 255, 0.7)',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            <X size={14} />
          </button>

          {/* Dropdown Items */}
          <div style={{ paddingRight: '32px', paddingTop: '4px' }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '0 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Controls
            </h3>
          </div>

          {/* Unified Control Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Recording Control */}
            {canRecord && (
              <div style={{ padding: '0 4px' }}>
                <SimpleRecordingControl isHost={isHost} />
              </div>
            )}

            {/* Whiteboard Control */}
            {isHost && (
              <button
                onClick={() => {
                  toggleWhiteboard();
                  closeDropdown();
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                title="Open/Close Whiteboard"
              >
                <span style={{ fontSize: '14px' }}>📋</span>
                Whiteboard
              </button>
            )}

            {/* Participant Manager */}
            {isHost && (
              <button
                onClick={() => {
                  setIsParticipantManagerOpen(!isParticipantManagerOpen);
                  closeDropdown();
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                title="Manage Participants"
              >
                <span style={{ fontSize: '14px' }}>👥</span>
                Participants ({allParticipants.length})
              </button>
            )}

            {/* Settings Control */}
            <button
              onClick={() => {
                toggleSettings();
                closeDropdown();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              title="Video Background Settings"
            >
              <span style={{ fontSize: '14px' }}>⚙️</span>
              Settings
            </button>

            {/* Chat Control - Removed, now handled by separate ChatButton */}

            {/* End Meeting Button (Host only) */}
            {isHost && (
              <button
                onClick={() => {
                  closeDropdown();
                  onEndMeeting();
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  marginTop: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  e.currentTarget.style.color = '#f87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  e.currentTarget.style.color = '#fca5a5';
                }}
                title="End Meeting for All Participants"
              >
                <span style={{ fontSize: '14px' }}>🚪</span>
                End Meeting
              </button>
            )}
          </div>
        </div>
      )}

      {/* Whiteboard Component */}
      <Whiteboard
        isOpen={isWhiteboardOpen}
        onClose={() => {
          setIsWhiteboardOpen(false);
          if (isHost) {
            sendWhiteboardToggle('close');
          }
        }}
        isHost={isHost}
        onHostToggle={handleHostToggle}
      />

      {/* Chat Component - Removed, now handled by separate ChatButton */}

      {/* Settings Menu Overlay */}
      {isSettingsOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#2d3748',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsSettingsOpen(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#e5e7eb',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#e5e7eb';
              }}
            >
              ×
            </button>

            {/* Settings Menu Content */}
            <SettingsMenu canRecord={canRecord} />
          </div>
        </div>
      )}

      {/* Participant List Modal */}
      {isParticipantManagerOpen && (
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
                onClick={() => setIsParticipantManagerOpen(false)}
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

      {/* Notifications */}
      {whiteboardNotification && (
        <WhiteboardNotification
          message={whiteboardNotification.message}
          type={whiteboardNotification.type}
          onClose={() => setWhiteboardNotification(null)}
        />
      )}

      {participantNotification && (
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
          backgroundColor: participantNotification.type === 'success' ? '#10b981' : 
                          participantNotification.type === 'error' ? '#ef4444' : '#3b82f6',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          {participantNotification.message}
        </div>
      )}

      {/* CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
