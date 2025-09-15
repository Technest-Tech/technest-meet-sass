'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, RoomConnectOptions, Track, TrackPublication, VideoPresets } from 'livekit-client';
import { RoomContext, VideoTrack, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { TrackToggle, MediaDeviceMenu } from '@livekit/components-react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingControl } from '@/lib/RecordingControl';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { ExternalE2EEKeyProvider } from 'livekit-client';
import { PictureInPicture } from '@/lib/PictureInPicture';
import { ChatControl } from '@/lib/ChatControl';

interface VideoConferenceClientImplProps {
  liveKitUrl: string;
  token: string;
  codec?: string;
}

// Video participant component
function VideoParticipant({ participant, isLocal = false }: { participant: any; isLocal?: boolean }) {
  const videoTrack = participant.getTrack(Track.Source.Camera);
  const audioTrack = participant.getTrack(Track.Source.Microphone);

  // Debug logging
  console.log(`VideoParticipant render - ${isLocal ? 'Local' : 'Remote'}:`, {
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

  console.log('VideoLayout render:', {
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
    console.log('No local participant available');
    return null;
  }

  return (
    <div className="lk-focus-layout" style={{ height: '100vh', padding: '20px' }}>
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
      console.log('User interaction detected, enabling audio context');
    }
  };

  // Add room event listeners for better debugging
  useEffect(() => {
    const handleConnectionStateChange = () => {
      setConnectionStatus(room.state);
      console.log('Room connection state:', room.state);
      
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

    const handleDisconnected = () => {
      console.log('Room disconnected');
      setConnectionStatus('Disconnected');
      isConnecting.current = false;
      setIsLoading(false);
    };

    const handleConnected = () => {
      console.log('Room connected successfully');
      setConnectionStatus('Connected');
      hasConnected.current = true;
      isConnecting.current = false;
      setIsLoading(false);
    };

    const handleParticipantConnected = (participant: any) => {
      console.log('Participant connected:', participant.identity);
    };

    const handleParticipantDisconnected = (participant: any) => {
      console.log('Participant disconnected:', participant.identity);
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
          console.error('Failed to enable E2EE:', err);
          setError('Failed to enable encryption');
        });
      }).catch((err) => {
        console.error('Failed to set E2EE key:', err);
        setError('Failed to set encryption key');
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, keyProvider, room]);

  // Connection effect - only run when ready and user has interacted
  useEffect(() => {
    if (e2eeSetupComplete && hasUserInteracted && !isConnecting.current && !hasConnected.current) {
      console.log('Connecting to room...', props.liveKitUrl);
      isConnecting.current = true;
      
      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (isConnecting.current && room.state === 'connecting') {
          console.log('Connection timeout, disconnecting...');
          room.disconnect();
          isConnecting.current = false;
          setError('Connection timeout. Please check your internet connection and try again.');
          setCanRetry(true);
        }
      }, 30000); // 30 second timeout
      
      const connectToRoom = async () => {
        try {
          await room.connect(props.liveKitUrl, props.token, connectOptions);
          console.log('Successfully connected to room');
          
          // Enable camera and microphone after successful connection
          try {
            await room.localParticipant.enableCameraAndMicrophone();
          } catch (error) {
            console.error('Failed to enable camera/microphone:', error);
            // Don't set this as a fatal error, just log it
          }
        } catch (error) {
          console.error('Failed to connect to room:', error);
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
      console.log('Retrying connection...');
      const connectToRoom = async () => {
        try {
          isConnecting.current = true;
          await room.connect(props.liveKitUrl, props.token, connectOptions);
          console.log('Successfully connected to room on retry');
          
          try {
            await room.localParticipant.enableCameraAndMicrophone();
          } catch (error) {
            console.error('Failed to enable camera/microphone on retry:', error);
          }
        } catch (error) {
          console.error('Failed to connect to room on retry:', error);
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
      console.log('Room connected, setting up track listeners');
      console.log('Local participant:', {
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
        console.log('Track published:', {
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
          console.log('Camera track published:', publication.trackSid);
        }
      };

      const handleTrackUnpublished = (publication: TrackPublication) => {
        console.log('Track unpublished:', {
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

  // Cleanup on unmount - only disconnect if we're actually connected
  useEffect(() => {
    return () => {
      if (room && room.state === 'connected') {
        console.log('Component unmounting, disconnecting from room');
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-lg">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Join Video Conference</h1>
          <p className="text-gray-300 mb-4">Click the button below to join the meeting and enable your camera and microphone.</p>
          <button
            onClick={handleUserInteraction}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
          >
            Join Meeting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lk-room-container" onClick={handleUserInteraction}>
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        
        {/* Connection Status */}
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: connectionStatus === 'Connected' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(251, 191, 36, 0.9)',
          color: 'white',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)'
        }}>
          {isLoading ? 'Connecting...' : connectionStatus}
        </div>
        
        {/* Responsive Control Bar */}
        <div className="mobile-control-bar" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          gap: '10px',
          padding: '15px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '25px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <section className="lk-button-group">
            <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="videoinput" />
            </div>
          </section>
          
          <section className="lk-button-group">
            <TrackToggle source={Track.Source.Microphone}>Microphone</TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="audioinput" />
            </div>
          </section>
          
          <section className="lk-button-group">
          <button
            className="lk-button lk-button-settings"
            onClick={() => {
              // Toggle settings menu
              const event = new CustomEvent('toggle_settings');
              window.dispatchEvent(event);
            }}
            title="Settings"
          >
            <span className="settings-icon">⚙️</span>
            <span className="settings-text">Settings</span>
          </button>
          </section>
          
          {/* Chat Control */}
          <ChatControl />
        </div>

        {/* Main video area with proper LiveKit components */}
        <VideoLayout room={room} />
        
        {/* Picture-in-Picture for remote participants with both screen share and camera */}
        <PictureInPicture room={room} />
        
        {/* Recording Controls and Indicator */}
        <RecordingControl isHost={true} />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}
