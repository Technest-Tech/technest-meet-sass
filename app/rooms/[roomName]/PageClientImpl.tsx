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
import { ReactionsButton } from '@/lib/ReactionsButton';
import { FloatingReactions } from '@/lib/FloatingReactions';
import { StudentMonitorPiP } from '@/lib/StudentMonitorPiP';
import { RaiseHandButton } from '@/lib/RaiseHandButton';
import { RaiseHandIndicator } from '@/lib/RaiseHandIndicator';
import { FileSharingButton } from '@/lib/FileSharingButton';
import { ScreenAnnotationButton } from '@/lib/ScreenAnnotationButton';
import { FileSharing } from '@/lib/FileSharing';
import { PdfViewer } from '@/lib/PdfViewer';
import { ScreenAnnotation } from '@/lib/ScreenAnnotation';
import { VideoRequestNotification } from '@/lib/VideoRequestNotification';
import { MuteControlListener } from '@/lib/MuteControlListener';
import { WaitingList } from '@/lib/WaitingList';
import { ParticipantManager } from '@/lib/ParticipantManager';
import { RoomFile } from '@/lib/types';
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
  DisconnectReason,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { CustomPreJoin } from '@/lib/CustomPreJoin';
import toast from 'react-hot-toast';

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
  requireWaitingRoom?: boolean; // Whether waiting room is enabled
  allowGuestUnmute?: boolean; // Whether guests can unmute themselves
  enablePrivateChat?: boolean; // Whether private chat is enabled
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [hasAutoConnected, setHasAutoConnected] = React.useState(false);
  const [meetingEnded, setMeetingEnded] = React.useState(false);
  
  // File sharing and annotation state
  const [isFileSharingOpen, setIsFileSharingOpen] = React.useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = React.useState(false);
  const [isScreenAnnotationEnabled, setIsScreenAnnotationEnabled] = React.useState(false);
  const [selectedPdfFile, setSelectedPdfFile] = React.useState<RoomFile | null>(null);

  // Auto-connect without pre-join
  React.useEffect(() => {
    const autoConnect = async () => {
      // Prevent multiple auto-connections
      if (hasAutoConnected || meetingEnded) return;
      
      try {
        setConnectionStatus('connecting');
        setHasAutoConnected(true); // Mark as auto-connected
        
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
        setHasAutoConnected(false); // Reset on error to allow retry
      }
    };

    // Start auto-connection immediately
    autoConnect();
  }, [props.roomName, props.region, props.participantType, props.userName, hasAutoConnected, meetingEnded]);

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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated background elements */}
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
            padding: '40px',
            borderRadius: '20px',
            background: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Professional spinner with pulsing effect */}
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              margin: '0 auto 30px'
            }}>
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                borderTop: '3px solid #ffffff',
                animation: 'spin 1s linear infinite'
              }}></div>
              <div style={{
                position: 'absolute',
                width: '60px',
                height: '60px',
                top: '10px',
                left: '10px',
                border: '3px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                borderRight: '3px solid #ffffff',
                animation: 'spin 0.8s linear infinite reverse'
              }}></div>
              <div style={{
                position: 'absolute',
                width: '40px',
                height: '40px',
                top: '20px',
                left: '20px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite'
              }}></div>
            </div>
            
            <h2 style={{ 
              marginBottom: '12px',
              fontSize: '28px',
              fontWeight: '600',
              letterSpacing: '-0.5px'
            }}>
              Joining Meeting
            </h2>
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '16px',
              marginBottom: '24px',
              fontWeight: '300'
            }}>
              Establishing secure connection...
            </p>
            
            {/* Progress dots */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '20px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.6)',
                animation: 'bounce 1.4s ease-in-out infinite',
                animationDelay: '0s'
              }}></div>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.6)',
                animation: 'bounce 1.4s ease-in-out infinite',
                animationDelay: '0.2s'
              }}></div>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.6)',
                animation: 'bounce 1.4s ease-in-out infinite',
                animationDelay: '0.4s'
              }}></div>
            </div>
            
            {/* Meeting info */}
            <div style={{
              marginTop: '32px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Room:</strong> {props.roomName}
              </div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Participant:</strong> {props.userName}
              </div>
              <div>
                <strong>Role:</strong> {props.participantType === 'host' ? 'Host' : 'Guest'}
              </div>
            </div>
          </div>
          
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.3; }
              50% { transform: scale(1.2); opacity: 0.6; }
            }
            @keyframes bounce {
              0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
              40% { transform: translateY(-10px); opacity: 1; }
            }
            @keyframes drift {
              0% { transform: translate(0, 0); }
              100% { transform: translate(50px, 50px); }
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
          meetingEnded={meetingEnded}
          setMeetingEnded={setMeetingEnded}
          isFileSharingOpen={isFileSharingOpen}
          setIsFileSharingOpen={setIsFileSharingOpen}
          isPdfViewerOpen={isPdfViewerOpen}
          setIsPdfViewerOpen={setIsPdfViewerOpen}
          isScreenAnnotationEnabled={isScreenAnnotationEnabled}
          setIsScreenAnnotationEnabled={setIsScreenAnnotationEnabled}
          selectedPdfFile={selectedPdfFile}
          setSelectedPdfFile={setSelectedPdfFile}
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
  meetingEnded: boolean; // Add meetingEnded state
  setMeetingEnded: (ended: boolean) => void; // Add setMeetingEnded function
  isFileSharingOpen: boolean;
  setIsFileSharingOpen: (open: boolean) => void;
  isPdfViewerOpen: boolean;
  setIsPdfViewerOpen: (open: boolean) => void;
  isScreenAnnotationEnabled: boolean;
  setIsScreenAnnotationEnabled: (enabled: boolean) => void;
  selectedPdfFile: RoomFile | null;
  setSelectedPdfFile: (file: RoomFile | null) => void;
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

  const handleOnLeave = React.useCallback((reason?: DisconnectReason) => {
    console.log('Room disconnected, reason:', reason);
    
    // If disconnected due to being removed by host, don't auto-reconnect
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
      console.log('Participant was removed by host, not reconnecting');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/');
      return;
    }
    
    // If meeting was ended, don't reconnect
    if (props.meetingEnded) {
      console.log('Meeting was ended, not reconnecting');
      router.push('/');
      return;
    }
    
    // Check if this is a user-initiated disconnect (clicking leave button)
    // CLIENT_INITIATED means user clicked the disconnect/leave button
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      console.log('User intentionally left meeting (CLIENT_INITIATED)');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/');
      return;
    }
    
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
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/');
    }
  }, [router, room, handleEncryptionError, handleError, props.meetingEnded, props.setMeetingEnded]);

  // Check if room is already connected when connection details are available
  React.useEffect(() => {
    // Don't auto-connect if meeting ended or user left
    if (props.meetingEnded) {
      console.log('Meeting ended or user left, not auto-connecting');
      return;
    }
    
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
  }, [props.connectionDetails, isConnected, isConnecting, e2eeSetupComplete, handleUserInteraction, room, props.meetingEnded]);

  // All hooks must be called before any conditional returns
  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Handle PDF viewer synchronization from host
  React.useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        // Only guests should respond to host's PDF viewer controls
        if (props.participantType !== 'host' && messageData.isHost) {
          if (messageData.type === 'pdf_viewer_open' && messageData.file) {
            // Host opened PDF - open it for guest too
            props.setSelectedPdfFile(messageData.file);
            props.setIsPdfViewerOpen(true);
            toast(`Host opened ${messageData.file.originalName}`, {
              icon: '📄',
              duration: 3000,
            });
          } else if (messageData.type === 'pdf_viewer_close') {
            // Host closed PDF - close it for guest too
            props.setIsPdfViewerOpen(false);
            props.setSelectedPdfFile(null);
            toast('Host closed PDF viewer', {
              icon: '✕',
              duration: 2000,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing PDF viewer sync data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, props.participantType, props.setSelectedPdfFile, props.setIsPdfViewerOpen]);

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
          padding: '40px',
          borderRadius: '20px',
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Professional spinner */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 30px'
          }}>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '3px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              borderTop: '3px solid #ffffff',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '60px',
              height: '60px',
              top: '10px',
              left: '10px',
              border: '3px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              borderRight: '3px solid #ffffff',
              animation: 'spin 0.8s linear infinite reverse'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '40px',
              height: '40px',
              top: '20px',
              left: '20px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              animation: 'pulse 2s ease-in-out infinite'
            }}></div>
          </div>
          
          <h2 style={{
            marginBottom: '12px',
            fontSize: '28px',
            fontWeight: '600',
            color: 'white',
            letterSpacing: '-0.5px'
          }}>
            Initializing Conference
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '16px',
            marginBottom: '24px',
            fontWeight: '300'
          }}>
            Setting up your video connection...
          </p>
          
          {/* Progress dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '20px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.6)',
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: '0s'
            }}></div>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.6)',
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: '0.2s'
            }}></div>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.6)',
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: '0.4s'
            }}></div>
          </div>
        </div>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.2); opacity: 0.6; }
          }
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
            40% { transform: translateY(-10px); opacity: 1; }
          }
          @keyframes drift {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
          }
        `}</style>
      </div>
    );
  }

  // Wrapper component for MoreControls to access room from context
  const MoreControlsWrapper = ({ isHost, canRecord, roomName, iconOnly, meetingEnded, setMeetingEnded, connectionDetails, router }: any) => {
    const roomFromContext = React.useContext(RoomContext);
    const roomToUse = roomFromContext || room;

    return (
      <MoreControls
        isHost={isHost}
        canRecord={canRecord}
        roomName={roomName}
        iconOnly={iconOnly}
        onEndMeeting={isHost ? async () => {
          if (meetingEnded) return; // Prevent multiple end meeting calls
          
          console.log('🚪 End Meeting button clicked!');
          console.log('Current props:', { participantType: isHost ? 'host' : 'guest', roomName });
          
          // Host can end the meeting for all participants
          const confirmMessage = `🚨 END MEETING FOR ALL PARTICIPANTS

This action will:
• Disconnect ALL participants from the meeting
• Delete the room entirely
• Cannot be undone

Are you sure you want to end the meeting for everyone?`;
          
          if (confirm(confirmMessage)) {
            setMeetingEnded(true); // Mark meeting as ended to prevent reconnection
            
            try {
              // Call the server-side API to end the meeting for everyone
              // Use the actual LiveKit room name from connection details
              const actualRoomName = connectionDetails?.roomName || roomName;
              console.log('Ending meeting for room:', actualRoomName);
              
              const response = await fetch(`/api/admin/rooms/${roomName}/end-meeting`, {
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
                
                // Disconnect host and redirect immediately
                if (roomToUse) {
                  roomToUse.disconnect();
                }
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
                setMeetingEnded(false); // Reset on error to allow retry
              }
            } catch (error) {
              console.error('Error ending meeting:', error);
              
              let errorMessage = 'Error ending meeting';
              if (error instanceof Error) {
                errorMessage += `: ${error.message}`;
              }
              
              alert(`❌ ${errorMessage}\n\nThis might be due to a network issue or server problem. Please try again.`);
              setMeetingEnded(false); // Reset on error to allow retry
            }
          }
        } : () => {
          alert('Only hosts can end meetings for all participants.');
        }}
      />
    );
  };

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
        
        {/* Floating Reactions Overlay */}
        <FloatingReactions />
        
        {/* Raise Hand Indicator - Shows raised hand status on participant tiles */}
        <RaiseHandIndicator />
        
        {/* Student Monitor PiP - Shows students when teacher is screen sharing (Host only) */}
        {props.participantType === 'host' && <StudentMonitorPiP key="student-monitor-pip" isHost={true} />}
        
        {/* Top Action Buttons Row - Icon-only buttons in horizontal row */}
        <div style={{
          position: 'fixed',
          bottom: '80px', // Space above bottom control bar (60px height + 20px gap)
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Raise Hand Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <RaiseHandButton isHost={props.participantType === 'host'} iconOnly={true} />
          </div>
          
          {/* Reactions Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <ReactionsButton isHost={props.participantType === 'host'} iconOnly={true} />
          </div>
          
          {/* Chat Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <ChatButton isHost={props.participantType === 'host'} iconOnly={true} />
          </div>
          
          {/* File Sharing Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <FileSharingButton 
              onClick={() => props.setIsFileSharingOpen(true)} 
              iconOnly={true} 
            />
          </div>
          
          {/* Screen Annotation Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <ScreenAnnotationButton 
              onClick={() => props.setIsScreenAnnotationEnabled(!props.isScreenAnnotationEnabled)}
              isActive={props.isScreenAnnotationEnabled}
              iconOnly={true} 
            />
          </div>
          
          {/* More Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <MoreControlsWrapper
              isHost={props.participantType === 'host'}
              canRecord={props.participantType === 'host' ? props.canRecord : false}
              roomName={props.roomName}
              iconOnly={true}
              meetingEnded={props.meetingEnded}
              setMeetingEnded={props.setMeetingEnded}
              connectionDetails={props.connectionDetails}
              router={router}
            />
          </div>
        </div>
        
        <DebugMode />
        <RecordingIndicator />
        
        {/* File Sharing & Materials */}
        <FileSharing
          isOpen={props.isFileSharingOpen}
          onClose={() => props.setIsFileSharingOpen(false)}
          roomName={props.connectionDetails?.roomName || props.roomName}
          isHost={props.participantType === 'host'}
          onFileSelect={(file) => {
            if (file.fileType === 'application/pdf') {
              props.setSelectedPdfFile(file);
              props.setIsPdfViewerOpen(true);
              
              // If host, broadcast PDF open to everyone
              if (props.participantType === 'host' && room) {
                const openData = {
                  type: 'pdf_viewer_open',
                  fileId: file.id,
                  pageNumber: 1,
                  sender: room.localParticipant.identity,
                  timestamp: Date.now(),
                  id: `open-${Date.now()}`,
                  isHost: true,
                  file: file,
                };
                const encodedData = new TextEncoder().encode(JSON.stringify(openData));
                room.localParticipant.publishData(encodedData, { topic: 'pdf-viewer' });
              }
            }
          }}
        />
        
        {/* PDF Viewer with Annotations */}
        <PdfViewer
          isOpen={props.isPdfViewerOpen}
          onClose={() => {
            // If host is closing, broadcast to everyone
            if (props.participantType === 'host' && props.selectedPdfFile && room) {
              const closeData = {
                type: 'pdf_viewer_close',
                fileId: props.selectedPdfFile.id,
                pageNumber: 1,
                sender: room.localParticipant.identity,
                timestamp: Date.now(),
                id: `close-${Date.now()}`,
                isHost: true,
              };
              const encodedData = new TextEncoder().encode(JSON.stringify(closeData));
              room.localParticipant.publishData(encodedData, { topic: 'pdf-viewer' });
            }
            props.setIsPdfViewerOpen(false);
            props.setSelectedPdfFile(null);
          }}
          file={props.selectedPdfFile}
          roomName={props.connectionDetails?.roomName || props.roomName}
          isHost={props.participantType === 'host'}
        />
        
        {/* Screen Annotation Overlay */}
        <ScreenAnnotation
          isEnabled={props.isScreenAnnotationEnabled}
          onClose={() => props.setIsScreenAnnotationEnabled(false)}
        />
        
        {/* Video Request Notification - Shows when host requests video action */}
        <VideoRequestNotification />
        
        {/* Mute Control Listener - Handles mute/unmute requests from host */}
        <MuteControlListener />
        
        {/* Waiting List - Shows pending participants for host */}
        {props.participantType === 'host' && (
          <WaitingList 
            isHost={true} 
            roomName={props.connectionDetails?.roomName || props.roomName}
          />
        )}
      </RoomContext.Provider>
    </div>
  );
}
