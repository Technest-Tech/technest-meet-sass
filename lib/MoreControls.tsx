'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext } from '@livekit/components-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { MoreHorizontal, X, Users, UserMinus, Mic, MicOff, Video, VideoOff, MessageSquare, MoreVertical } from 'lucide-react';
import { Whiteboard } from './Whiteboard';
import { NormalWhiteboard } from './NormalWhiteboard';
import { WhiteboardNotification } from './WhiteboardNotification';
import { Chat } from './Chat';
import { SettingsMenu } from './SettingsMenu';
import { SimpleRecordingControl } from './SimpleRecordingControl';
import toast from 'react-hot-toast';
import { VideoRequestData } from './types';
import { logger } from './utils/logger';

interface MoreControlsProps {
  isHost: boolean;
  canRecord?: boolean;
  roomName: string;
  onEndMeeting: () => void;
  iconOnly?: boolean;
  roomFeatures?: {
    canRecord?: boolean;
    enableCollaborativeWhiteboard?: boolean;
    enableNormalWhiteboard?: boolean;
    enableManageParticipants?: boolean;
    enableVirtualBackground?: boolean;
  };
}

export function MoreControls({ isHost, canRecord, roomName, onEndMeeting, iconOnly = false, roomFeatures }: MoreControlsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  
  // Ensure component is mounted on client-side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // State for all controls
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isNormalWhiteboardOpen, setIsNormalWhiteboardOpen] = useState(false);
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [isMuting, setIsMuting] = useState<string | null>(null);
  const [isMutingAll, setIsMutingAll] = useState(false);
  const [participantStatuses, setParticipantStatuses] = useState<Map<string, { audioEnabled: boolean; videoEnabled: boolean }>>(new Map());

  // Helper function to clean participant names
  const getCleanName = (identity: string): string => {
    return identity.replace(/_(host|guest)_\d+$/, '');
  };

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

  // Click outside to close dropdown menu
  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any dropdown menu
      if (!target.closest('[data-dropdown-menu]') && !target.closest('[data-dropdown-button]')) {
        setActiveMenu(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  // Track participant audio/video status
  useEffect(() => {
    const updateStatuses = () => {
      const newStatuses = new Map<string, { audioEnabled: boolean; videoEnabled: boolean }>();
      
      allParticipants.forEach(p => {
        let audioEnabled = false;
        let videoEnabled = false;
        
        p.audioTrackPublications.forEach((publication) => {
          if (!publication.isMuted && publication.track) {
            audioEnabled = true;
          }
        });
        
        p.videoTrackPublications.forEach((publication) => {
          if (!publication.isMuted && publication.track) {
            videoEnabled = true;
          }
        });
        
        newStatuses.set(p.identity, { audioEnabled, videoEnabled });
      });
      
      setParticipantStatuses(newStatuses);
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 1000);
    
    return () => clearInterval(interval);
  }, [allParticipants]);

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
      logger.error('Error sending whiteboard toggle command:', error);
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
      toast.error('Error removing participant');
    } finally {
      setIsRemoving(null);
    }
  }, [isHost, roomName, room]);

  const muteParticipant = useCallback(async (participantIdentity: string, mute: boolean) => {
    if (!isHost || !room || !localParticipant) return;
    setIsMuting(participantIdentity);

    try {
      // Send mute request via data channel
      const muteRequest = {
        type: mute ? 'mute_command' : 'unmute_command',
        targetParticipant: participantIdentity,
        sender: localParticipant.identity,
        timestamp: Date.now(),
        allowUnmute: true // Allow participants to unmute themselves
      };

      console.log('📤 Sending mute request:', muteRequest);

      const encodedData = new TextEncoder().encode(JSON.stringify(muteRequest));
      await room.localParticipant.publishData(encodedData, { topic: 'mute-control', reliable: true });
      
      console.log('✅ Mute request sent successfully');
      
      toast.success(`${mute ? 'Muted' : 'Unmuted'} ${getCleanName(participantIdentity)}`);
      setActiveMenu(null);
    } catch (error) {
      console.error('❌ Failed to send mute request:', error);
      toast.error('Failed to send request');
    } finally {
      setIsMuting(null);
    }
  }, [isHost, room, localParticipant]);

  const muteAllParticipants = useCallback(async () => {
    if (!isHost || !room || !localParticipant) return;
    setIsMutingAll(true);

    try {
      // Send mute all command via data channel
      const muteAllRequest = {
        type: 'mute_all_command',
        sender: localParticipant.identity,
        timestamp: Date.now(),
        allowUnmute: true // Allow participants to unmute themselves
      };

      const encodedData = new TextEncoder().encode(JSON.stringify(muteAllRequest));
      await room.localParticipant.publishData(encodedData, { topic: 'mute-control', reliable: true });
      
      toast.success('Mute request sent to all participants');
    } catch (error) {
      console.error('Failed to send mute all request:', error);
      toast.error('Failed to send request');
    } finally {
      setIsMutingAll(false);
    }
  }, [isHost, room, localParticipant]);

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
      
      const action = turnOn ? 'Request sent' : 'Camera closed';
      toast.success(`${action} for ${getCleanName(participantIdentity)}`);
      setActiveMenu(null);
    } catch (error) {
      toast.error('Failed to send command');
    }
  }, [isHost, room, localParticipant]);

  const openPrivateChat = useCallback((participantIdentity: string) => {
    toast(`Opening chat with ${getCleanName(participantIdentity)}`, { 
      duration: 2000,
      icon: '💬',
    });
    setActiveMenu(null);
  }, []);

  const handleRemoveClick = useCallback((participantIdentity: string) => {
    const cleanName = getCleanName(participantIdentity);
    if (confirm(`Remove ${cleanName} from meeting?`)) {
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
          padding: iconOnly ? '12px' : '12px 16px',
          backgroundColor: isRecordingActive
            ? 'rgba(220, 38, 38, 0.9)'
            : isDropdownOpen
              ? 'rgba(59, 130, 246, 0.9)'
              : 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: iconOnly ? '20px' : '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: iconOnly ? '0' : '8px',
          minWidth: iconOnly ? '48px' : '120px',
          width: iconOnly ? '48px' : 'auto',
          height: iconOnly ? '48px' : 'auto',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isRecordingActive
            ? '0 10px 25px rgba(220, 38, 38, 0.35)'
            : isDropdownOpen
              ? '0 4px 12px rgba(0, 0, 0, 0.15)'
              : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isDropdownOpen) {
            e.currentTarget.style.backgroundColor = isRecordingActive
              ? 'rgba(220, 38, 38, 0.95)'
              : 'rgba(75, 85, 99, 0.9)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDropdownOpen) {
            e.currentTarget.style.backgroundColor = isRecordingActive
              ? 'rgba(220, 38, 38, 0.9)'
              : 'rgba(107, 114, 128, 0.9)';
          }
        }}
        title="More Controls"
      >
        <MoreHorizontal size={iconOnly ? 20 : 16} />
        {!iconOnly && (isRecordingActive ? 'Recording' : 'More')}
      </button>

      {/* Dropdown Menu */}
      <div
        className="more-controls-dropdown"
        style={{
          position: 'absolute',
          bottom: '60px',
          right: '0',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '16px',
          width: '320px',
          maxWidth: 'calc(100vw - 40px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 99999,
          display: isDropdownOpen ? 'flex' : 'none',
          flexDirection: 'column',
          gap: '8px'
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
          <div style={{ paddingRight: '48px', paddingTop: '4px' }}>
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
            {isHost && (
              <div style={{ padding: '0 4px' }}>
                <SimpleRecordingControl
                  isHost={isHost}
                  isFeatureEnabled={Boolean(roomFeatures?.canRecord ?? canRecord)}
                  showProBadge={!(roomFeatures?.canRecord ?? canRecord)}
                  onRecordingStateChange={setIsRecordingActive}
                />
              </div>
            )}

            {/* Collaborative Whiteboard Control */}
            {isHost && (
              <button
                onClick={() => {
                  if (roomFeatures?.enableCollaborativeWhiteboard ?? false) {
                    toggleWhiteboard();
                    closeDropdown();
                  }
                }}
                disabled={!(roomFeatures?.enableCollaborativeWhiteboard ?? false)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: (roomFeatures?.enableCollaborativeWhiteboard ?? false) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  color: (roomFeatures?.enableCollaborativeWhiteboard ?? false) ? 'white' : 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: (roomFeatures?.enableCollaborativeWhiteboard ?? false) ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (roomFeatures?.enableCollaborativeWhiteboard ?? false) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (roomFeatures?.enableCollaborativeWhiteboard ?? false) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
                title={(roomFeatures?.enableCollaborativeWhiteboard ?? false) ? "Open/Close Collaborative Whiteboard" : "Upgrade required for this feature"}
              >
                <span style={{ fontSize: '14px' }}>📋</span>
                Collaborative Whiteboard
                {!(roomFeatures?.enableCollaborativeWhiteboard ?? false) && (
                  <span style={{
                    marginLeft: 'auto',
                    padding: '2px 6px',
                    background: 'linear-gradient(to right, #a855f7, #ec4899)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>PRO</span>
                )}
              </button>
            )}

            {/* Normal Whiteboard Control */}
            {isHost && (
              <button
                onClick={() => {
                  if (roomFeatures?.enableNormalWhiteboard ?? false) {
                    setIsNormalWhiteboardOpen(true);
                    closeDropdown();
                  }
                }}
                disabled={!(roomFeatures?.enableNormalWhiteboard ?? false)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: (roomFeatures?.enableNormalWhiteboard ?? false) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  color: (roomFeatures?.enableNormalWhiteboard ?? false) ? 'white' : 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: (roomFeatures?.enableNormalWhiteboard ?? false) ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (roomFeatures?.enableNormalWhiteboard ?? false) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (roomFeatures?.enableNormalWhiteboard ?? false) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
                title={(roomFeatures?.enableNormalWhiteboard ?? false) ? "Open Normal Whiteboard" : "Upgrade required for this feature"}
              >
                <span style={{ fontSize: '14px' }}>📝</span>
                Normal Whiteboard
                {!(roomFeatures?.enableNormalWhiteboard ?? false) && (
                  <span style={{
                    marginLeft: 'auto',
                    padding: '2px 6px',
                    background: 'linear-gradient(to right, #a855f7, #ec4899)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>PRO</span>
                )}
              </button>
            )}

            {/* Participant Manager */}
            {isHost && (
              <button
                onClick={() => {
                  if (roomFeatures?.enableManageParticipants ?? false) {
                    setIsParticipantManagerOpen(!isParticipantManagerOpen);
                    closeDropdown();
                  }
                }}
                disabled={!(roomFeatures?.enableManageParticipants ?? false)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: (roomFeatures?.enableManageParticipants ?? false) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  color: (roomFeatures?.enableManageParticipants ?? false) ? 'white' : 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: (roomFeatures?.enableManageParticipants ?? false) ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (roomFeatures?.enableManageParticipants ?? false) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (roomFeatures?.enableManageParticipants ?? false) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
                title={(roomFeatures?.enableManageParticipants ?? false) ? "Manage Participants" : "Upgrade required for this feature"}
              >
                <span style={{ fontSize: '14px' }}>👥</span>
                Participants ({allParticipants.length})
                {!(roomFeatures?.enableManageParticipants ?? false) && (
                  <span style={{
                    marginLeft: 'auto',
                    padding: '2px 6px',
                    background: 'linear-gradient(to right, #a855f7, #ec4899)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>PRO</span>
                )}
              </button>
            )}

            {/* Virtual Background Control */}
            <button
              onClick={() => {
                if (roomFeatures?.enableVirtualBackground ?? false) {
                  toast.info('Virtual Background - Coming Soon');
                  closeDropdown();
                }
              }}
              disabled={!(roomFeatures?.enableVirtualBackground ?? false)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: (roomFeatures?.enableVirtualBackground ?? false) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                color: (roomFeatures?.enableVirtualBackground ?? false) ? 'white' : 'rgba(255, 255, 255, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: (roomFeatures?.enableVirtualBackground ?? false) ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (roomFeatures?.enableVirtualBackground ?? false) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (roomFeatures?.enableVirtualBackground ?? false) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              title={(roomFeatures?.enableVirtualBackground ?? false) ? "Virtual Background" : "Upgrade required for this feature"}
            >
              <span style={{ fontSize: '14px' }}>🖼️</span>
              Virtual Background
              {!(roomFeatures?.enableVirtualBackground ?? false) && (
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 6px',
                  background: 'linear-gradient(to right, #a855f7, #ec4899)',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>PRO</span>
              )}
            </button>

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

      {/* Whiteboard Component - Rendered via portal */}
      {mounted && createPortal(
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
        />,
        document.body
      )}

      {/* Normal Whiteboard Component - Rendered via portal */}
      {mounted && createPortal(
        <NormalWhiteboard
          isOpen={isNormalWhiteboardOpen}
          onClose={() => setIsNormalWhiteboardOpen(false)}
        />,
        document.body
      )}

      {/* Chat Component - Removed, now handled by separate ChatButton */}

      {/* Settings Menu Overlay - Rendered via portal */}
      {mounted && isSettingsOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease-out'
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '20px',
              padding: '0',
              maxWidth: '700px',
              minWidth: '500px',
              width: '100%',
              height: '85vh',
              maxHeight: '700px',
              minHeight: '500px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: 'white'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.3)'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: 'white'
              }}>
                ⚙️ Settings
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Close Settings"
              >
                ✕
              </button>
            </div>

            {/* Settings Menu Content */}
            <div style={{ 
              flex: 1, 
              overflow: 'auto',
              padding: '20px 24px'
            }}>
              <SettingsMenu canRecord={canRecord} roomFeatures={roomFeatures} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Participant List Modal - Rendered via portal */}
      {mounted && isParticipantManagerOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '85vh',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}>
                  <Users size={22} color="white" />
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '22px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.02em'
                  }}>
                    Manage Participants
                  </h2>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''} in meeting
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsParticipantManagerOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action Buttons */}
            {isHost && allParticipants.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <button
                  onClick={muteAllParticipants}
                  disabled={isMutingAll}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: isMutingAll 
                      ? 'rgba(239, 68, 68, 0.3)' 
                      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '10px',
                    cursor: isMutingAll ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isMutingAll) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
                  }}
                >
                  <MicOff size={18} />
                  {isMutingAll ? 'Muting All...' : 'Mute All Participants'}
                </button>
              </div>
            )}

            {/* Participants List */}
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              overflowX: 'visible',
              paddingRight: '4px',
              maxHeight: '500px'
            }}>
              {allParticipants.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: 'rgba(255, 255, 255, 0.4)'
                }}>
                  <Users size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    No other participants in the meeting
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allParticipants.map((participant) => {
                    const cleanName = getCleanName(participant.identity);
                    const status = participantStatuses.get(participant.identity);
                    const isProcessing = isRemoving === participant.identity || isMuting === participant.identity;
                    const menuOpen = activeMenu === participant.identity;

                    return (
                      <div
                        key={participant.sid}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '18px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          position: 'relative',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                          <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '20px',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                            flexShrink: 0
                          }}>
                            {cleanName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: '600',
                              color: '#ffffff',
                              fontSize: '16px',
                              marginBottom: '6px',
                              letterSpacing: '-0.01em'
                            }}>
                              {cleanName}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: 'rgba(255, 255, 255, 0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '14px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {status?.audioEnabled ? (
                                  <>
                                    <Mic size={15} color="#10b981" />
                                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>Audio On</span>
                                  </>
                                ) : (
                                  <>
                                    <MicOff size={15} color="#ef4444" />
                                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>Audio Off</span>
                                  </>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {status?.videoEnabled ? (
                                  <>
                                    <Video size={15} color="#10b981" />
                                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>Video On</span>
                                  </>
                                ) : (
                                  <>
                                    <VideoOff size={15} color="#94a3b8" />
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Video Off</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Menu */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            data-dropdown-button
                            onClick={(e) => {
                              if (menuOpen) {
                                setActiveMenu(null);
                                setMenuPosition(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPosition({
                                  top: rect.top - 10,
                                  right: window.innerWidth - rect.right
                                });
                                setActiveMenu(participant.identity);
                              }
                            }}
                            disabled={isProcessing}
                            style={{
                              padding: '10px',
                              background: menuOpen ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid',
                              borderColor: menuOpen ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isProcessing && !menuOpen) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!menuOpen) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                              }
                            }}
                            title="More actions"
                          >
                            <MoreVertical size={20} color={menuOpen ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)'} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dropdown Menu - Rendered via portal with fixed positioning */}
      {mounted && activeMenu && menuPosition && (() => {
        const participant = allParticipants.find(p => p.identity === activeMenu);
        const status = participantStatuses.get(activeMenu);
        if (!participant) return null;
        
        return createPortal(
          <div 
            data-dropdown-menu
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
              transform: 'translateY(-100%)',
              background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '10px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              minWidth: '240px',
              zIndex: 9999,
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => {
                muteParticipant(activeMenu, status?.audioEnabled ?? false);
                setActiveMenu(null);
                setMenuPosition(null);
              }}
              style={{
                                  width: '100%',
                                  padding: '12px 18px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: 'rgba(255, 255, 255, 0.9)',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                  e.currentTarget.style.color = '#60a5fa';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                }}
                              >
                                {status?.audioEnabled ? <MicOff size={17} /> : <Mic size={17} />}
                                {status?.audioEnabled ? 'Mute' : 'Unmute'}
                              </button>

                              <button
                                onClick={() => {
                                  requestVideoControl(activeMenu, !status?.videoEnabled);
                                  setActiveMenu(null);
                                  setMenuPosition(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 18px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: 'rgba(255, 255, 255, 0.9)',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                  e.currentTarget.style.color = '#60a5fa';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                }}
                              >
                                {status?.videoEnabled ? <VideoOff size={17} /> : <Video size={17} />}
                                {status?.videoEnabled ? 'Close camera' : 'Request camera on'}
                              </button>

                              <button
                                onClick={() => {
                                  openPrivateChat(activeMenu);
                                  setActiveMenu(null);
                                  setMenuPosition(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 18px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: 'rgba(255, 255, 255, 0.9)',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                  e.currentTarget.style.color = '#60a5fa';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                }}
                              >
                                <MessageSquare size={17} />
                                Send private message
                              </button>

                              <div style={{
                                height: '1px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                margin: '6px 0'
                              }} />

                              <button
                                onClick={() => {
                                  handleRemoveClick(activeMenu);
                                  setActiveMenu(null);
                                  setMenuPosition(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 18px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#ef4444',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                  e.currentTarget.style.color = '#f87171';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#ef4444';
                                }}
                              >
                                <UserMinus size={17} />
                                Remove from meeting
                              </button>
          </div>,
          document.body
        );
      })()}

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
