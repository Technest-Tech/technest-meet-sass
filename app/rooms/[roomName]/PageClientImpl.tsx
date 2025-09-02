'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { PictureInPicture } from '@/lib/PictureInPicture';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  RoomContext,
  VideoConference,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { CustomPreJoin } from '@/lib/CustomPreJoin';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  userName: string;
  participantType?: 'host' | 'guest'; // Add participant type
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  // Auto-connect without pre-join
  React.useEffect(() => {
    const autoConnect = async () => {
      try {
        setConnectionStatus('connecting');
        
        // Set default choices
        const defaultChoices: LocalUserChoices = {
          username: props.userName || 'Participant',
          videoEnabled: true,
          audioEnabled: true,
          videoDeviceId: undefined,
          audioDeviceId: undefined,
        };
        
        setPreJoinChoices(defaultChoices);
        
        // Automatically get connection details
        const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
        url.searchParams.append('roomName', props.roomName);
        url.searchParams.append('participantName', defaultChoices.username);
        url.searchParams.append('participantType', props.participantType || 'guest');
        if (props.region) {
          url.searchParams.append('region', props.region);
        }
        
        const connectionDetailsResp = await fetch(url.toString());
        
        if (!connectionDetailsResp.ok) {
          throw new Error(`Failed to connect: ${connectionDetailsResp.statusText}`);
        }
        
        const connectionDetailsData = await connectionDetailsResp.json();
        setConnectionDetails(connectionDetailsData);
        setConnectionStatus('connected');
        
      } catch (error) {
        console.error('Failed to auto-connect:', error);
        setConnectionStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
      }
    };

    // Start auto-connection immediately
    autoConnect();
  }, [props.roomName, props.region, props.participantType, props.userName]);

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    url.searchParams.append('participantType', props.participantType || 'guest');
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, [props.roomName, props.region, props.participantType]);

  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {connectionStatus === 'connecting' ? (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: 'white'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #3b82f6',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <h2 style={{ marginBottom: '10px' }}>Connecting to Meeting...</h2>
            <p style={{ color: '#9ca3af' }}>
              Room: {props.roomName}<br/>
              Participant: {props.userName}<br/>
              Type: {props.participantType || 'guest'}
            </p>
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : connectionStatus === 'error' ? (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: 'white'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '10px' }}>Connection Failed</h2>
            <p style={{ color: '#9ca3af' }}>{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
          participantType={props.participantType}
          roomName={props.roomName}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
  participantType?: 'host' | 'guest'; // Add participant type
  roomName: string; // Add roomName for host controls
}) {
  const router = useRouter();
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  // Debug logging for host controls
  React.useEffect(() => {
    console.log('🔍 Host Controls Debug:', {
      participantType: props.participantType,
      roomName: props.roomName,
      connectionDetails: props.connectionDetails,
      isHost: props.participantType === 'host'
    });
    
    // Additional debugging for host controls rendering
    if (props.participantType === 'host') {
      console.log('✅ Host controls should be visible');
    } else {
      console.log('❌ Host controls hidden - participant type:', props.participantType);
    }
  }, [props.participantType, props.roomName, props.connectionDetails]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  // Track if we're already connected to avoid reconnections
  const [isConnected, setIsConnected] = React.useState(false);
  const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  React.useEffect(() => {
    // Only connect once when e2ee setup is complete and we haven't exceeded reconnection attempts
    if (e2eeSetupComplete && !isConnected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      room.on(RoomEvent.Disconnected, handleOnLeave);
      room.on(RoomEvent.EncryptionError, handleEncryptionError);
      room.on(RoomEvent.MediaDevicesError, handleError);

      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .then(() => {
          setIsConnected(true);
          setReconnectAttempts(0); // Reset reconnection attempts on successful connection
          // Enable camera and microphone after successful connection
          if (props.userChoices.videoEnabled) {
            room.localParticipant.setCameraEnabled(true).catch((error) => {
              handleError(error);
            });
          }
          if (props.userChoices.audioEnabled) {
            room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
              handleError(error);
            });
          }
        })
        .catch((error) => {
          console.error('Connection failed:', error);
          setReconnectAttempts(prev => prev + 1);
          
          // If we've exceeded reconnection attempts, show an error
          if (reconnectAttempts + 1 >= MAX_RECONNECT_ATTEMPTS) {
            alert('Failed to connect after multiple attempts. Please refresh the page and try again.');
            router.push('/');
          }
        });
    }

    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, isConnected, reconnectAttempts, room, props.connectionDetails.serverUrl, props.connectionDetails.participantToken, props.userChoices.videoEnabled, props.userChoices.audioEnabled, connectOptions, router]);

  const lowPowerMode = useLowCPUOptimizer(room);

  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  
  const handleError = React.useCallback((error: Error) => {
    console.error('LiveKit error:', error);
    
    // Handle specific RTCPeerConnection errors
    if (error.message.includes('setRemoteDescription') || error.message.includes('addIceCandidate')) {
      console.warn('RTCPeerConnection error - connection may be in invalid state');
      // Try to reconnect if the connection is in a bad state
      if (room && room.state !== 'disconnected') {
        console.log('Attempting to reconnect due to RTCPeerConnection error');
        room.disconnect();
        // Reset connection state
        setIsConnected(false);
        setReconnectAttempts(0);
      }
      return;
    }
    
    // Don't show alert for common connection issues to avoid spam
    if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      console.warn('Duplicate participant detected, this is normal during reconnections');
      return;
    }
    
    // Only show alert for unexpected errors
    if (!error.message.includes('Network') && !error.message.includes('timeout')) {
      alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
    }
  }, [room]);
  
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error('LiveKit encryption error:', error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Cleanup room connection when component unmounts
  React.useEffect(() => {
    return () => {
      if (room && room.state !== 'disconnected') {
        room.disconnect();
      }
    };
  }, [room]);

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        {/* Show participant type indicator */}
        {props.participantType && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            padding: '8px 16px',
            backgroundColor: props.participantType === 'host' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {props.participantType === 'host' ? '👑 Host' : '👤 Guest'}
          </div>
        )}
        
        {/* Show room name indicator */}
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          🏠 {props.connectionDetails?.roomName || 'Meeting'}
        </div>
        
        <KeyboardShortcuts />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        <DebugMode />
        <RecordingIndicator />
        
        {/* Picture-in-Picture for participants with both screen share and camera */}
        <PictureInPicture room={room} />
        
        {/* Host-specific controls */}
        {props.participantType === 'host' && (
          <div style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* End Meeting for All */}
            <button
              onClick={async () => {
                console.log('🚪 End Meeting button clicked!');
                console.log('Current props:', { participantType: props.participantType, roomName: props.roomName });
                
                // Host can end the meeting for all participants
                const confirmMessage = `🚨 END MEETING FOR ALL PARTICIPANTS

This action will:
• Disconnect ALL participants from the meeting
• Delete the room entirely
• Cannot be undone

Are you sure you want to end the meeting for everyone?`;
                
                if (confirm(confirmMessage)) {
                  try {
                    // Disable button and show loading state
                    const button = event?.target as HTMLButtonElement;
                    const originalText = button.textContent;
                    button.disabled = true;
                    button.textContent = '🔄 Ending...';
                    button.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
                    
                    // Call the server-side API to end the meeting for everyone
                    // Use the actual LiveKit room name from connection details
                    const actualRoomName = props.connectionDetails?.roomName || props.roomName;
                    console.log('Ending meeting for room:', actualRoomName);
                    
                    const response = await fetch(`/api/admin/rooms/${props.roomName}/end-meeting`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        roomName: actualRoomName
                      })
                    });

                    if (response.ok) {
                      const result = await response.json();
                      console.log('Meeting ended successfully:', result);
                      
                      // Show success message
                      const successMessage = `✅ MEETING ENDED SUCCESSFULLY!

${result.message}

The meeting has been terminated for all participants and the room has been deleted. You will now be redirected to the home page.`;
                      
                      alert(successMessage);
                      
                      // Disconnect host and redirect
                      room.disconnect();
                      router.push('/');
                    } else {
                      const error = await response.json();
                      console.error('Failed to end meeting:', error);
                      
                      let errorMessage = 'Failed to end meeting';
                      if (error.error) {
                        errorMessage += `: ${error.error}`;
                      }
                      if (error.details) {
                        errorMessage += `\n\nDetails: ${error.details}`;
                      }
                      
                      alert(`❌ ${errorMessage}\n\nPlease try again or contact support if the problem persists.`);
                      
                      // Reset button state
                      button.disabled = false;
                      button.textContent = originalText;
                      button.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
                    }
                  } catch (error) {
                    console.error('Error ending meeting:', error);
                    
                    let errorMessage = 'Error ending meeting';
                    if (error instanceof Error) {
                      errorMessage += `: ${error.message}`;
                    }
                    
                    alert(`❌ ${errorMessage}\n\nThis might be due to a network issue or server problem. Please try again.`);
                    
                    // Reset button state
                    const button = event?.target as HTMLButtonElement;
                    if (button) {
                      button.disabled = false;
                      button.textContent = '🚪 End Meeting';
                      button.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
                    }
                  }
                }
              }}
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}
              title="End meeting for ALL participants (not just you)"
            >
              🚪 End Meeting
            </button>
            
            {/* Host Controls Info */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              borderRadius: '8px',
              fontSize: '12px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              👑 Host Controls Active<br/>
              <span style={{ fontSize: '10px', opacity: '0.8' }}>
                Use LiveKit's built-in controls for participant management
              </span>
            </div>
            
            {/* Quick Actions */}
            <button
              onClick={() => {
                // Show host instructions
                alert(`Host Controls Available:

🚪 End Meeting - Ends meeting for ALL participants (not just you)
👥 Participant Management - Use LiveKit's built-in controls
🎤 Audio Control - Mute/unmute participants from participant list
📹 Video Control - Enable/disable video from participant list

🚨 IMPORTANT: When you end the meeting, ALL participants will be disconnected and the room will be deleted. This action cannot be undone.

For detailed participant control, use the participant list on the right side of the video conference interface.`);
              }}
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}
              title="Show host control instructions"
            >
              📋 Host Instructions
            </button>
          </div>
        )}
      </RoomContext.Provider>
    </div>
  );
}
