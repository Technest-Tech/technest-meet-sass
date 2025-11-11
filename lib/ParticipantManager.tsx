'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParticipants, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { UserMinus, Users, X, Mic, MicOff, Video, VideoOff, MessageSquare, MoreVertical, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { RaiseHandData, VideoRequestData } from './types';
import { isObserver } from './utils/observer-filter';

interface ParticipantManagerProps {
  isHost: boolean;
  roomName: string;
}

interface ParticipantStatus {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function ParticipantManager({ isHost, roomName }: ParticipantManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [isMuting, setIsMuting] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<Map<string, ParticipantStatus>>(new Map());

  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [raisedHands, setRaisedHands] = useState<Map<string, boolean>>(new Map());

  // Helper function to clean participant names (remove _host_1, _guest_1 suffixes)
  const getCleanName = (identity: string): string => {
    return identity.replace(/_(host|guest)_\d+$/, '');
  };

  // Track raised hand state from data channel
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'raise-hand') {
          const raiseHandData: RaiseHandData = {
            type: 'raise-hand',
            sender: messageData.sender || participant?.identity || 'Unknown',
            isRaised: messageData.isRaised ?? true,
            timestamp: messageData.timestamp || Date.now(),
            id: messageData.id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          };
          
          setRaisedHands(prev => {
            const newMap = new Map(prev);
            if (raiseHandData.isRaised) {
              newMap.set(raiseHandData.sender, true);
            } else {
              newMap.delete(raiseHandData.sender);
            }
            return newMap;
          });
        } else if (messageData.type === 'video_request_response' && isHost) {
          // Show response from student
          const response = messageData.response === 'accepted' ? 'accepted' : 'declined';
          const action = messageData.requestType === 'camera_on' ? 'turn on camera' : 'turn off camera';
          const cleanSenderName = getCleanName(messageData.sender);
          toast(
            `${cleanSenderName} ${response} your request to ${action}`,
            {
              icon: response === 'accepted' ? '✅' : '❌',
              duration: 3000
            }
          );
        }
      } catch (error) {
        // Silently handle parsing errors
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, isHost]);

  // Track participant audio/video status
  useEffect(() => {
    const updateStatuses = () => {
      const newStatuses = new Map<string, ParticipantStatus>();
      
      participants.forEach(p => {
        // Use audioTrackPublications and videoTrackPublications Maps
        let audioEnabled = false;
        let videoEnabled = false;
        
        // Check audio tracks
        p.audioTrackPublications.forEach((publication) => {
          if (!publication.isMuted && publication.track) {
            audioEnabled = true;
          }
        });
        
        // Check video tracks
        p.videoTrackPublications.forEach((publication) => {
          if (!publication.isMuted && publication.track) {
            videoEnabled = true;
          }
        });
        
        newStatuses.set(p.identity, {
          audioEnabled,
          videoEnabled
        });
      });
      
      setParticipantStatuses(newStatuses);
    };

    updateStatuses();
    
    // Update periodically
    const interval = setInterval(updateStatuses, 1000);
    
    return () => clearInterval(interval);
  }, [participants]);

  // Clean up raised hands when participants disconnect
  useEffect(() => {
    const allParticipantIdentities = new Set<string>();
    
    if (localParticipant) {
      allParticipantIdentities.add(localParticipant.identity);
    }
    
    participants.forEach(p => {
      allParticipantIdentities.add(p.identity);
    });

    setRaisedHands(prev => {
      const newMap = new Map();
      prev.forEach((isRaised, identity) => {
        if (allParticipantIdentities.has(identity)) {
          newMap.set(identity, isRaised);
        }
      });
      return newMap;
    });
  }, [participants, localParticipant]);

  // Combine local and remote participants, excluding the host and observers
  const allParticipants = React.useMemo(() => {
    const all = [...participants];
    if (localParticipant) {
      all.push(localParticipant);
    }
    return all.filter(p => {
      // Exclude the local participant (host/current user)
      if (p.identity === localParticipant?.identity) {
        return false;
      }
      
      // Filter out observers - they should be completely invisible
      return !isObserver(p);
    });
  }, [participants, localParticipant]);

  // Count raised hands
  const raisedHandsCount = React.useMemo(() => {
    return Array.from(raisedHands.values()).filter(Boolean).length;
  }, [raisedHands]);

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
      const response = await fetch(`/api/admin/rooms/${roomName}/remove-participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIdentity,
          roomName: room?.name || roomName
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Participant removed');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove participant');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsRemoving(null);
      setActiveMenu(null);
    }
  }, [isHost, roomName, room]);

  const muteParticipant = useCallback(async (participantIdentity: string, mute: boolean) => {
    if (!isHost) return;

    setIsMuting(participantIdentity);

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
        toast.success(`${getCleanName(participantIdentity)} ${mute ? 'muted' : 'unmuted'}`);
      } else {
        toast.error(`Failed to ${mute ? 'mute' : 'unmute'} participant`);
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsMuting(null);
      setActiveMenu(null);
    }
  }, [isHost, roomName, room]);

  const muteAll = useCallback(async () => {
    if (!isHost || !localParticipant) return;

    try {
      const response = await fetch('/api/room/controls/mute-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room?.name || roomName,
          hostIdentity: localParticipant.identity
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
      } else {
        toast.error('Failed to mute all participants');
      }
    } catch (error) {
      toast.error('Network error occurred');
    }
  }, [isHost, roomName, room, localParticipant]);

  const requestVideoControl = useCallback(async (participantIdentity: string, turnOn: boolean) => {
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
      
      toast.success(`Request sent to ${getCleanName(participantIdentity)}`);
      setActiveMenu(null);
    } catch (error) {
      toast.error('Failed to send request');
    }
  }, [isHost, room, localParticipant]);

  const openPrivateChat = useCallback((participantIdentity: string) => {
    // This would trigger opening the chat with the participant pre-selected
    toast.info(`Opening chat with ${getCleanName(participantIdentity)}`, {
      duration: 2000
    });
    setActiveMenu(null);
    // TODO: Integrate with Chat component to pre-select recipient
  }, []);

  if (!isHost) return null;

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
        {raisedHandsCount > 0 && (
          <span style={{
            backgroundColor: 'rgba(251, 191, 36, 0.9)',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: '600',
            marginLeft: '4px'
          }}>
            ✋ {raisedHandsCount}
          </span>
        )}
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
            maxWidth: '600px',
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={muteAll}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Mute all participants"
                >
                  <MicOff size={14} />
                  Mute All
                </button>
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
                  {allParticipants.map((participant) => {
                    const hasRaisedHand = raisedHands.get(participant.identity) || false;
                    const status = participantStatuses.get(participant.identity);
                    const isProcessing = isRemoving === participant.identity || isMuting === participant.identity;
                    const menuOpen = activeMenu === participant.identity;
                    const cleanName = getCleanName(participant.identity);

                    return (
                      <div
                        key={participant.sid}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '18px',
                          backgroundColor: hasRaisedHand ? '#fef3c7' : 'white',
                          borderRadius: '12px',
                          border: hasRaisedHand ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                          position: 'relative',
                          transition: 'all 0.2s',
                          boxShadow: hasRaisedHand ? '0 4px 6px -1px rgba(251, 191, 36, 0.2)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: hasRaisedHand 
                              ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '18px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            flexShrink: 0
                          }}>
                            {cleanName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: '600',
                              color: '#111827',
                              fontSize: '15px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '4px'
                            }}>
                              {cleanName}
                              {hasRaisedHand && <span title="Hand raised">✋</span>}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {status?.audioEnabled ? (
                                  <>
                                    <Mic size={14} color="#10b981" />
                                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>Audio On</span>
                                  </>
                                ) : (
                                  <>
                                    <MicOff size={14} color="#ef4444" />
                                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '500' }}>Audio Off</span>
                                  </>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {status?.videoEnabled ? (
                                  <>
                                    <Video size={14} color="#10b981" />
                                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>Video On</span>
                                  </>
                                ) : (
                                  <>
                                    <VideoOff size={14} color="#9ca3af" />
                                    <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '500' }}>Video Off</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Menu */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            onClick={() => setActiveMenu(menuOpen ? null : participant.identity)}
                            disabled={isProcessing}
                            style={{
                              padding: '10px',
                              backgroundColor: menuOpen ? '#f3f4f6' : 'transparent',
                              border: '1px solid',
                              borderColor: menuOpen ? '#d1d5db' : 'transparent',
                              borderRadius: '8px',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isProcessing && !menuOpen) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!menuOpen) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }
                            }}
                            title="More actions"
                          >
                            <MoreVertical size={20} color={menuOpen ? '#374151' : '#6b7280'} />
                          </button>

                          {/* Dropdown Menu */}
                          {menuOpen && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '8px',
                              backgroundColor: 'white',
                              borderRadius: '10px',
                              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                              border: '1px solid #e5e7eb',
                              minWidth: '220px',
                              zIndex: 10,
                              overflow: 'hidden'
                            }}>
                              <button
                                onClick={() => muteParticipant(participant.identity, !status?.audioEnabled)}
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
                                {status?.audioEnabled ? <MicOff size={16} /> : <Mic size={16} />}
                                {status?.audioEnabled ? 'Mute' : 'Unmute'}
                              </button>

                              <button
                                onClick={() => requestVideoControl(participant.identity, !status?.videoEnabled)}
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
                                {status?.videoEnabled ? <VideoOff size={16} /> : <Video size={16} />}
                                Request {status?.videoEnabled ? 'camera off' : 'camera on'}
                              </button>

                              <button
                                onClick={() => openPrivateChat(participant.identity)}
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
                                onClick={() => {
                                  if (confirm(`Remove ${cleanName} from meeting?`)) {
                                    removeParticipant(participant.identity);
                                  }
                                }}
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
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
