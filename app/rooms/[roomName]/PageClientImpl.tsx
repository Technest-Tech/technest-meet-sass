'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { MoreControls } from '@/lib/MoreControls';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { ChatButton } from '@/lib/ChatButton';
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

// Custom SettingsMenu wrapper that can receive canRecord prop
function CustomSettingsMenu(props: any) {
  return <SettingsMenu {...props} canRecord={props.canRecord} />;
}

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
  canRecord?: boolean; // Add canRecord prop
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
        
        // Set default choices - camera off, microphone on
        const defaultChoices: LocalUserChoices = {
          username: props.userName || 'Participant',
          videoEnabled: false, // Camera off by default
          audioEnabled: true,  // Microphone on by default
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
          canRecord={props.canRecord}
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
  canRecord?: boolean; // Add canRecord prop
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

  // Track connection states
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [userInteractionRequired, setUserInteractionRequired] = React.useState(false); // Auto-connect by default
  const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Function to handle user interaction and start connection
  const handleUserInteraction = React.useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    setUserInteractionRequired(false);
    setIsConnecting(true);
    
    try {
      // Request media permissions first
      console.log('Requesting media permissions...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: props.userChoices.videoEnabled,
          audio: props.userChoices.audioEnabled
        });
        
        // Stop the stream immediately as we just needed permission
        stream.getTracks().forEach(track => track.stop());
        console.log('Media permissions granted');
      } catch (permissionError) {
        console.error('Media permission denied:', permissionError);
        // Continue anyway - LiveKit will handle the case where permissions are denied
      }
      
      // Clean up any existing connection first
      if (room && room.state !== 'disconnected') {
        console.log('Cleaning up existing connection before reconnecting...');
        await room.disconnect();
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Set up event listeners
      room.on(RoomEvent.Disconnected, handleOnLeave);
      room.on(RoomEvent.EncryptionError, handleEncryptionError);
      room.on(RoomEvent.MediaDevicesError, handleError);

      // Attempt connection
      await room.connect(
        props.connectionDetails.serverUrl,
        props.connectionDetails.participantToken,
        connectOptions,
      );
      
      setIsConnected(true);
      setIsConnecting(false);
      setReconnectAttempts(0);
      
      // Add a small delay before enabling camera and microphone to prevent placeholder issues
      setTimeout(() => {
        // Enable camera and microphone based on user choices (camera off, microphone on by default)
        if (props.userChoices.videoEnabled) {
          room.localParticipant.setCameraEnabled(true).catch((error) => {
            console.warn('Failed to enable camera:', error);
            // Don't treat camera enable failure as a critical error
          });
        } else {
          // Ensure camera is disabled if not wanted
          room.localParticipant.setCameraEnabled(false).catch((error) => {
            console.warn('Failed to disable camera:', error);
          });
        }
        
        if (props.userChoices.audioEnabled) {
          room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
            console.warn('Failed to enable microphone:', error);
            // Don't treat microphone enable failure as a critical error
          });
        } else {
          // Ensure microphone is disabled if not wanted
          room.localParticipant.setMicrophoneEnabled(false).catch((error) => {
            console.warn('Failed to disable microphone:', error);
          });
        }
      }, 1000); // 1 second delay
      
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      setReconnectAttempts(prev => prev + 1);
      
      // If we've exceeded reconnection attempts, show an error
      if (reconnectAttempts + 1 >= MAX_RECONNECT_ATTEMPTS) {
        alert('Failed to connect after multiple attempts. Please refresh the page and try again.');
        router.push('/');
      } else {
        // Reset to allow user to try again
        setUserInteractionRequired(true);
      }
    }
  }, [isConnecting, isConnected, room, props.connectionDetails.serverUrl, props.connectionDetails.participantToken, props.userChoices.videoEnabled, props.userChoices.audioEnabled, connectOptions, router, reconnectAttempts]);

  // Cleanup event listeners when component unmounts
  React.useEffect(() => {
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [room]);

  const lowPowerMode = useLowCPUOptimizer(room);
  
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
    
    // Handle AudioContext errors (browser permission issues)
    if (error.message.includes('AudioContext') || error.message.includes('not allowed to start')) {
      console.warn('AudioContext permission error - user needs to interact with page first');
      // Reset to user interaction state to allow them to try again
      setIsConnected(false);
      setIsConnecting(false);
      setUserInteractionRequired(true);
      return;
    }
    
    // Handle WebRTC connection errors
    if (error.message.includes('could not establish pc connection') || error.message.includes('Client initiated disconnect')) {
      console.warn('WebRTC connection error - this may be due to component lifecycle issues');
      // Reset to user interaction state to allow them to try again
      setIsConnected(false);
      setIsConnecting(false);
      setUserInteractionRequired(true);
      return;
    }
    
    // Handle camera track placeholder errors
    if (error.message.includes('Element not part of the array') || error.message.includes('camera_placeholder')) {
      console.warn('Camera track placeholder error - this is usually a timing issue');
      // Don't disconnect for this error, it's usually resolved automatically
      return;
    }
    
    // Don't show alert for common connection issues to avoid spam
    if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      console.warn('Duplicate participant detected, this is normal during reconnections');
      return;
    }
    
    // Handle screen sharing permission cancellation gracefully
    if (error.message.includes('Permission denied by user') || error.message.includes('NotAllowedError')) {
      console.log('Screen sharing permission was denied by user - this is expected behavior');
      // Don't show alert for permission cancellation, just log it
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

  const handleOnLeave = React.useCallback(() => {
    console.log('Room disconnected, cleaning up...');
    
    // Reset connection state when leaving
    setIsConnected(false);
    setIsConnecting(false);
    setUserInteractionRequired(false); // Keep auto-connect enabled
    setReconnectAttempts(0);
    
    // Clean up event listeners
    room.off(RoomEvent.Disconnected, handleOnLeave);
    room.off(RoomEvent.EncryptionError, handleEncryptionError);
    room.off(RoomEvent.MediaDevicesError, handleError);
    
    // Only redirect if this was an intentional leave (not a page reload)
    if (room.state === 'disconnected' && !document.hidden) {
      console.log('Intentional leave detected, redirecting to home...');
      router.push('/');
    }
  }, [router, room, handleEncryptionError, handleError]);

  // Check if room is already connected when connection details are available
  React.useEffect(() => {
    if (props.connectionDetails && !isConnected && !isConnecting && e2eeSetupComplete) {
      // Check if room is already connected to prevent duplicates
      if (room && room.state === 'connected') {
        console.log('Room already connected, skipping auto-connect');
        setIsConnected(true);
        return;
      }
      
      console.log('Auto-connecting to meeting...');
      handleUserInteraction();
    }
  }, [props.connectionDetails, isConnected, isConnecting, e2eeSetupComplete, handleUserInteraction, room]);

  // All hooks must be called before any conditional returns
  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Handle page visibility changes and cleanup
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (room && room.state !== 'disconnected') {
        console.log('Page unloading, disconnecting from room...');
        room.disconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, but keeping room connection active for screen sharing...');
        // Don't disconnect when switching tabs - this allows screen sharing to continue
        // The room will only disconnect when the page is actually unloaded (beforeunload)
      } else {
        console.log('Page visible again');
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Cleanup room connection when component unmounts
      if (room && room.state !== 'disconnected') {
        console.log('Component unmounting, disconnecting from room...');
        room.disconnect();
      }
    };
  }, [room]);

  // Show appropriate state based on connection status

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to video conference...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we establish your connection</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Failed</h2>
            <p className="text-gray-600 mb-6">We couldn&apos;t connect to the video conference. This might be due to network issues or browser permissions.</p>
          </div>
          
          <button
            onClick={handleUserInteraction}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

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
          SettingsComponent={SHOW_SETTINGS_MENU ? (props: any) => <CustomSettingsMenu {...props} canRecord={props.canRecord} /> : undefined}
        />
        
        {/* Custom Chat Button - Positioned above More button */}
        <div style={{
          position: 'fixed',
          bottom: '180px', // Position it much higher above the More button
          right: '20px', // Same horizontal position as More button
          zIndex: 1000, // Lower z-index to appear under camera background selection
          display: 'flex',
          alignItems: 'center'
        }}>
          <ChatButton isHost={props.participantType === 'host'} />
        </div>
        
        <DebugMode />
        <RecordingIndicator />
        

        
        {/* Guest-specific controls */}
        {props.participantType === 'guest' && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000
          }}>
            <MoreControls
              isHost={false}
              canRecord={false}
              roomName={props.roomName}
              onEndMeeting={() => {
                // Guests can't end meetings
                alert('Only hosts can end meetings for all participants.');
              }}
            />
          </div>
        )}
        
        {/* Picture-in-Picture removed - LiveKit VideoConference component handles participant rendering */}
        
        {/* Host-specific controls */}
        {props.participantType === 'host' && (
          <div style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            zIndex: 1000
          }}>
            <MoreControls
              isHost={true}
              canRecord={props.canRecord}
              roomName={props.roomName}
              onEndMeeting={async () => {
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
                    }
                  } catch (error) {
                    console.error('Error ending meeting:', error);
                    
                    let errorMessage = 'Error ending meeting';
                    if (error instanceof Error) {
                      errorMessage += `: ${error.message}`;
                    }
                    
                    alert(`❌ ${errorMessage}\n\nThis might be due to a network issue or server problem. Please try again.`);
                  }
                }
              }}
            />
          </div>
        )}
      </RoomContext.Provider>
    </div>
  );
}
