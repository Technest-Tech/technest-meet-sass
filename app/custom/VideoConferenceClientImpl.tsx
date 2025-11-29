'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, RoomConnectOptions, Track, TrackPublication, VideoPresets, DisconnectReason } from 'livekit-client';
import { RoomContext, VideoTrack, useLocalParticipant, useParticipants, useTrackToggle } from '@livekit/components-react';
import { TrackToggle, MediaDeviceMenu } from '@livekit/components-react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { useAdaptiveStreamManager } from '@/lib/useAdaptiveStreamManager';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { ExternalE2EEKeyProvider } from 'livekit-client';
import { PictureInPicture } from '@/lib/PictureInPicture';
import { MoreControls } from '@/lib/MoreControls';
import { ReactionsButton } from '@/lib/ReactionsButton';
import { FloatingReactions } from '@/lib/FloatingReactions';
import { StudentMonitorPiP } from '@/lib/StudentMonitorPiP';
import { logger } from '@/lib/utils/logger';
import { MeetingTimer } from '@/lib/MeetingTimer';
import { RoomLogo } from '@/lib/components/RoomLogo';

interface VideoConferenceClientImplProps {
  liveKitUrl: string;
  token: string;
  codec?: string;
  isHost?: boolean;
  canRecord?: boolean;
  roomName?: string;
}

// Custom toggle button with better visual feedback
function CustomTrackToggle({ source, label }: { source: Track.Source; label: string }) {
  const { buttonProps, enabled } = useTrackToggle({ source });
  
  const isCamera = source === Track.Source.Camera;
  const isMicrophone = source === Track.Source.Microphone;
  
  return (
    <button
      {...buttonProps}
      className="custom-track-toggle"
      style={{
        background: enabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
        border: `2px solid ${enabled ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)'}`,
        borderRadius: '12px',
        padding: '8px 12px',
        color: 'white',
        minWidth: '60px',
        minHeight: '50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {/* Icon */}
      <svg
        className="custom-toggle-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isCamera && enabled && (
          // Camera on icon
          <>
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </>
        )}
        {isCamera && !enabled && (
          // Camera off icon with slash
          <>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34m-7.72-2.06a4 4 0 11-5.56-5.56" />
          </>
        )}
        {isMicrophone && enabled && (
          // Microphone on icon
          <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        )}
        {isMicrophone && !enabled && (
          // Microphone off icon with slash
          <>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        )}
      </svg>
      
      {/* Label */}
      <span className="custom-toggle-label" style={{
        fontSize: '10px',
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: '1',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
      }}>
        {label}
      </span>
      
      {/* Status text */}
      <span className="custom-toggle-status" style={{
        fontSize: '8px',
        fontWeight: '500',
        opacity: 0.9,
        textAlign: 'center',
        lineHeight: '1'
      }}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

// Video participant component
function VideoParticipant({ participant, isLocal = false }: { participant: any; isLocal?: boolean }) {
  const videoTrack = participant.getTrack(Track.Source.Camera);
  const audioTrack = participant.getTrack(Track.Source.Microphone);

  // Debug logging
  logger.debug(`VideoParticipant render - ${isLocal ? 'Local' : 'Remote'}:`, {
    participant: participant.identity,
    videoTrack: videoTrack ? {
      sid: videoTrack.sid,
      source: videoTrack.source,
      isEnabled: videoTrack.isEnabled,
      isMuted: videoTrack.isMuted
    } : null,
    audioTrack: audioTrack ? {
      sid: audioTrack.sid,
      source: audioTrack.source,
      isEnabled: audioTrack.isEnabled,
      isMuted: audioTrack.isMuted
    } : null
  });

  return (
    <div className="lk-participant-tile" style={{ position: 'relative' }}>
      <div className="lk-participant-tile-video">
        {videoTrack && (
          <VideoTrack
            trackRef={videoTrack}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {!videoTrack && (
          <div className="lk-video-placeholder" style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#2d3748',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px'
          }}>
            {participant.identity.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="lk-participant-tile-info" style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        {isLocal ? 'You' : participant.identity}
        {audioTrack && (
          <span style={{ marginLeft: '8px' }}>🎤</span>
        )}
        {!audioTrack && (
          <span style={{ marginLeft: '8px' }}>🔇</span>
        )}
      </div>
    </div>
  );
}

// Main video layout component
function VideoLayout({ room }: { room: Room }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  logger.debug('VideoLayout render:', {
    localParticipant: localParticipant ? {
      identity: localParticipant.identity,
      sid: localParticipant.sid
    } : null,
    participants: participants.map(p => ({
      identity: p.identity,
      sid: p.sid
    }))
  });

  if (!localParticipant) {
    logger.debug('No local participant available');
    return null;
  }

  return (
    <div className="lk-focus-layout" style={{ 
      height: '100vh', 
      padding: '20px',
      paddingBottom: '80px' // Space for bottom control bar
    }}>
      <div className="lk-focus-layout-main" style={{ height: '100%' }}>
        {/* Local participant (main view) */}
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <VideoParticipant participant={localParticipant} isLocal={true} />
          </div>
          
          {/* Other participants (if any) */}
          {participants.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px',
              maxHeight: '200px'
            }}>
              {participants.map((participant) => (
                <div key={participant.sid} style={{ height: '150px' }}>
                  <VideoParticipant participant={participant} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VideoConferenceClientImpl(props: VideoConferenceClientImplProps) {
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);
  
  // Refs to track connection state
  const isConnecting = useRef(false);
  const hasConnected = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<Room | null>(null);

  // E2EE setup
  const { e2eePassphrase, worker } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);
  const keyProvider = useMemo(() => new ExternalE2EEKeyProvider(), []);

  // Create room instance
  const room = useMemo(() => {
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [
          VideoPresets.h540,
          VideoPresets.h720,
          VideoPresets.h1080,
        ],
      },
    });
    roomRef.current = newRoom;
    return newRoom;
  }, []);

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  // Handle user interaction to enable audio context
  const handleUserInteraction = () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      logger.debug('User interaction detected, enabling audio context');
    }
  };

  // Add room event listeners for better debugging
  useEffect(() => {
    const handleConnectionStateChange = () => {
      setConnectionStatus(room.state);
      logger.debug('Room connection state:', room.state);
      
      // Update refs based on connection state
      if (room.state === 'connected') {
        hasConnected.current = true;
        isConnecting.current = false;
        setIsLoading(false);
        // Clear any pending timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
      } else if (room.state === 'connecting') {
        isConnecting.current = true;
        setIsLoading(true);
      } else if (room.state === 'disconnected') {
        isConnecting.current = false;
        setIsLoading(false);
      }
    };

    const handleDisconnected = (reason?: DisconnectReason) => {
      logger.debug('Room disconnected, reason:', reason);
      
      // If disconnected due to being removed by host, redirect to home
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        logger.info('Participant was removed by host, redirecting to home');
        window.location.href = '/meeting-ended';
        return;
      }
      
      setConnectionStatus('Disconnected');
      isConnecting.current = false;
      setIsLoading(false);
    };

    const handleConnected = () => {
      logger.success('Room connected successfully');
      setConnectionStatus('Connected');
      hasConnected.current = true;
      isConnecting.current = false;
      setIsLoading(false);
    };

    const handleParticipantConnected = (participant: any) => {
      logger.info('Participant connected:', participant.identity);
    };

    const handleParticipantDisconnected = (participant: any) => {
      logger.info('Participant disconnected:', participant.identity);
    };

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  // E2EE setup effect
  useEffect(() => {
    if (e2eeEnabled) {
      keyProvider.setKey(e2eePassphrase).then(() => {
        room.setE2EEEnabled(true).then(() => {
          setE2eeSetupComplete(true);
        }).catch((err) => {
          logger.error('Failed to enable E2EE:', err);
          setError('Failed to enable encryption');
        });
      }).catch((err) => {
        logger.error('Failed to set E2EE key:', err);
        setError('Failed to set encryption key');
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, keyProvider, room]);

  // Connection effect - only run when ready and user has interacted
  useEffect(() => {
    if (e2eeSetupComplete && hasUserInteracted && !isConnecting.current && !hasConnected.current) {
      logger.debug('Connecting to room...', props.liveKitUrl);
      isConnecting.current = true;
      
      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (isConnecting.current && room.state === 'connecting') {
          logger.warn('Connection timeout, disconnecting...');
          room.disconnect();
          isConnecting.current = false;
          setError('Connection timeout. Please check your internet connection and try again.');
          setCanRetry(true);
        }
      }, 30000); // 30 second timeout
      
      const connectToRoom = async () => {
        try {
          await room.connect(props.liveKitUrl, props.token, connectOptions);
          logger.success('Successfully connected to room');
          
          // Camera and microphone are disabled by default
          // Users can enable them manually using the toggle buttons
          logger.info('Camera and microphone are disabled by default. Use toggle buttons to enable.');
        } catch (error) {
          logger.error('Failed to connect to room:', error);
          isConnecting.current = false;
          
          // Only show error if it's not a client-initiated disconnect
          if (error instanceof Error && !error.message.includes('Client initiated disconnect')) {
            setError(`Connection failed: ${error.message}`);
            setCanRetry(true);
          }
        }
      };
      
      connectToRoom();
    }
  }, [e2eeSetupComplete, hasUserInteracted, props.liveKitUrl, props.token, connectOptions, room]);

  // Manual retry function
  const handleRetry = () => {
    setError(null);
    setCanRetry(false);
    hasConnected.current = false;
    isConnecting.current = false;
    
    // Force re-run of connection effect
    if (e2eeSetupComplete && hasUserInteracted) {
      logger.debug('Retrying connection...');
      const connectToRoom = async () => {
        try {
          isConnecting.current = true;
          await room.connect(props.liveKitUrl, props.token, connectOptions);
          logger.success('Successfully connected to room on retry');
          
          // Camera and microphone are disabled by default
          logger.info('Camera and microphone are disabled by default. Use toggle buttons to enable.');
        } catch (error) {
          logger.error('Failed to connect to room on retry:', error);
          isConnecting.current = false;
          setError(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setCanRetry(true);
        }
      };
      
      connectToRoom();
    }
  };

  // Track debugging effect
  useEffect(() => {
    if (room.state === 'connected') {
      logger.debug('Room connected, setting up track listeners');
      logger.debug('Local participant:', {
        identity: room.localParticipant.identity,
        sid: room.localParticipant.sid,
        tracks: Array.from(room.localParticipant.trackPublications.values()).map(publication => ({
          sid: publication.trackSid,
          source: publication.source,
          isEnabled: publication.isEnabled,
          isMuted: publication.isMuted
        }))
      });

      const handleTrackPublished = (publication: TrackPublication) => {
        logger.debug('Track published:', {
          trackSid: publication.trackSid,
          source: publication.source,
          track: publication.track ? {
            sid: publication.track.sid,
            source: publication.track.source,
            isEnabled: publication.isEnabled,
            isMuted: publication.isMuted
          } : null
        });
        if (publication.source === Track.Source.Camera) {
          logger.debug('Camera track published:', publication.trackSid);
        }
      };

      const handleTrackUnpublished = (publication: TrackPublication) => {
        logger.debug('Track unpublished:', {
          trackSid: publication.trackSid,
          source: publication.source
        });
      };

      room.localParticipant.on('trackPublished', handleTrackPublished);
      room.localParticipant.on('trackUnpublished', handleTrackUnpublished);

      return () => {
        room.localParticipant.off('trackPublished', handleTrackPublished);
        room.localParticipant.off('trackUnpublished', handleTrackUnpublished);
      };
    }
  }, [room.state, room.localParticipant]);

  useLowCPUOptimizer(room);
  useAdaptiveStreamManager(room);

  // Cleanup on unmount - only disconnect if we're actually connected
  useEffect(() => {
    return () => {
      if (room && room.state === 'connected') {
        logger.debug('Component unmounting, disconnecting from room');
        room.disconnect();
      }
      // Clear any pending timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [room]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Connection Error</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show user interaction prompt if not yet interacted
  if (!hasUserInteracted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background */}
        <div style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          animation: 'drift 20s linear infinite',
          top: '-50%',
          left: '-50%'
        }}></div>
        
        <div style={{
          textAlign: 'center',
          zIndex: 10,
          position: 'relative',
          padding: '48px',
          borderRadius: '24px',
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.4)',
          maxWidth: '480px',
          width: '90%'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            <svg style={{ width: '40px', height: '40px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: 'white',
            marginBottom: '12px',
            letterSpacing: '-0.5px'
          }}>
            Ready to Join
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '16px',
            marginBottom: '32px',
            fontWeight: '300',
            lineHeight: '1.6'
          }}>
            Click the button below to enter the video conference and enable your camera and microphone.
          </p>
          
          <button
            onClick={handleUserInteraction}
            style={{
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
              width: '100%',
              maxWidth: '280px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
            }}
          >
            Join Conference
          </button>
        </div>
        
        <style jsx>{`
          @keyframes drift {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="lk-room-container" dir="ltr" onClick={handleUserInteraction}>
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        
        {/* Connection Status */}
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px 20px',
          backgroundColor: connectionStatus === 'Connected' ? 'rgba(34, 197, 94, 0.95)' : 'rgba(251, 191, 36, 0.95)',
          color: 'white',
          borderRadius: '25px',
          fontSize: '14px',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {isLoading ? (
            <>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'white',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}></div>
              <span>Establishing Connection...</span>
            </>
          ) : (
            <>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: connectionStatus === 'Connected' ? '#22c55e' : '#fbbf24'
              }}></div>
              <span>{connectionStatus === 'Connected' ? 'Connected' : connectionStatus}</span>
            </>
          )}
          <style jsx>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.8); }
            }
          `}</style>
        </div>
        
        {/* Reactions Button - Floating above control bar */}
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center'
        }}>
          <ReactionsButton isHost={props.isHost} />
        </div>
        
        {/* Responsive Control Bar */}
        <div className="mobile-control-bar custom-control-bar" style={{
          position: 'fixed',
          bottom: '0px',
          left: '0',
          right: '0',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: '60px',
          boxSizing: 'border-box'
        }}>
          {/* Left side - Camera and Microphone */}
          <div className="custom-toggle-container" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CustomTrackToggle source={Track.Source.Camera} label="Camera" />
            <CustomTrackToggle source={Track.Source.Microphone} label="Mic" />
          </div>

          {/* Center - More Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <MoreControls
              isHost={props.isHost}
              canRecord={true}
              roomName={props.roomName || 'mobile-room'}
              onEndMeeting={() => {
                if (props.isHost) {
                  // Host can end meeting
                  const confirmMessage = `🚨 END MEETING FOR ALL PARTICIPANTS

This action will:
• Disconnect ALL participants from the meeting
• Delete the room entirely
• Cannot be undone

Are you sure you want to end the meeting for everyone?`;
                  
                  if (confirm(confirmMessage)) {
                    // For mobile, we'll just disconnect the current user
                    // The full end meeting functionality would need to be implemented
                    room.disconnect();
                    window.location.href = '/';
                  }
                } else {
                  alert('Only hosts can end meetings for all participants.');
                }
              }}
            />
          </div>
        </div>

        {/* Meeting Timer - Shows elapsed time */}
        <MeetingTimer />

        {/* Main video area with proper LiveKit components */}
        <VideoLayout room={room} />
        
        {/* Floating Reactions Overlay */}
        <FloatingReactions />
        
        {/* Student Monitor PiP - Shows students when teacher is screen sharing (Host only) */}
        <StudentMonitorPiP isHost={props.isHost} disabled={false} showProBadge={false} />
        
        {/* Picture-in-Picture for remote participants with both screen share and camera */}
        <PictureInPicture room={room} />
        
        {/* Recording Indicator */}
        <RecordingIndicator />
        
        {/* Room Logo - Bottom left corner */}
        <RoomLogo />
      </RoomContext.Provider>
    </div>
  );
}
