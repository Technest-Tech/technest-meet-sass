'use client';

import React from 'react';
import { createPortal } from 'react-dom';
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
import { RaiseHandSync } from '@/lib/RaiseHandSync';
import { FileSharingButton } from '@/lib/FileSharingButton';
import { ScreenAnnotationButton } from '@/lib/ScreenAnnotationButton';
import { BackendRecordingControl } from '@/lib/BackendRecordingControl';
import { FileSharing } from '@/lib/FileSharing';
import { PdfViewer } from '@/lib/PdfViewer';
import { ScreenAnnotation } from '@/lib/ScreenAnnotation';
import { VideoRequestNotification } from '@/lib/VideoRequestNotification';
import { MuteControlListener } from '@/lib/MuteControlListener';
import { WaitingList } from '@/lib/WaitingList';
import { ParticipantManager } from '@/lib/ParticipantManager';
import { RoomFile } from '@/lib/types';
import { logger } from '@/lib/utils/logger';
import { MeetingTimer } from '@/lib/MeetingTimer';
import { RoomLogo } from '@/lib/components/RoomLogo';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  RoomContext,
  VideoConference,
  useLocalParticipant,
  useRoomContext,
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
  Track,
  ParticipantEvent,
  TrackPublication,
  LocalTrack,
  Participant,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { useAdaptiveStreamManager } from '@/lib/useAdaptiveStreamManager';
import { CustomPreJoin } from '@/lib/CustomPreJoin';
import { useVirtualBackgroundAutoApply } from '@/lib/hooks/useVirtualBackgroundAutoApply';
import { useAudioVolumeBoost } from '@/lib/hooks/useAudioVolumeBoost';
import { useAudioTrackHealth } from '@/lib/hooks/useAudioTrackHealth';
import { useAudioStability } from '@/lib/hooks/useAudioStability';
import { useVideoTrackHealth } from '@/lib/hooks/useVideoTrackHealth';
import toast from 'react-hot-toast';

// Custom SettingsMenu wrapper that can receive canRecord prop
function CustomSettingsMenu(props: any) {
  return <SettingsMenu {...props} canRecord={props.canRecord} />;
}

// Wrapper component for virtual background auto-apply hook
// This component must be inside RoomContext.Provider to access useLocalParticipant
function VirtualBackgroundAutoApplyWrapper({
  isHost,
  isVirtualBackgroundEnabled
}: {
  isHost: boolean;
  isVirtualBackgroundEnabled: boolean;
}) {
  useVirtualBackgroundAutoApply(isHost, isVirtualBackgroundEnabled);
  return null; // This component doesn't render anything
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
  roomFeatures?: any; // Room feature flags from validation
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  // For observers, start with undefined status so they see the button
  // For others, start with 'connecting' to show loading
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'error' | undefined>(
    props.participantType === 'observer' ? undefined : 'connecting'
  );
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

      // For observers, require user interaction first (AudioContext needs user gesture)
      if (props.participantType === 'observer') {
        // Don't auto-connect observers - they need to click to start
        // This prevents AudioContext errors
        return;
      }

      try {
        setConnectionStatus('connecting');
        setHasAutoConnected(true); // Mark as auto-connected

        // Set default choices - camera off, microphone off
        const defaultChoices: LocalUserChoices = {
          username: props.userName || 'Participant',
          videoEnabled: false, // Camera off by default
          audioEnabled: false, // Microphone off by default
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
          // Try to parse error message from response
          let errorMessage = `Failed to connect: ${connectionDetailsResp.statusText}`;
          try {
            const errorData = await connectionDetailsResp.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // If JSON parsing fails, use the status text
          }

          // For 403 errors (like host already active), don't retry
          if (connectionDetailsResp.status === 403) {
            setConnectionStatus('error');
            setErrorMessage(errorMessage);
            setHasAutoConnected(true); // Prevent retries for 403 errors
            setMeetingEnded(true); // Mark as ended to prevent further attempts
            return;
          }

          throw new Error(errorMessage);
        }

        const connectionDetailsData = await connectionDetailsResp.json();

        // Check if response contains an error field
        if (connectionDetailsData.error) {
          setConnectionStatus('error');
          setErrorMessage(connectionDetailsData.error);
          setHasAutoConnected(true); // Prevent retries
          setMeetingEnded(true); // Mark as ended
          return;
        }

        setConnectionDetails(connectionDetailsData);
        setConnectionStatus('connected');

      } catch (error) {
        logger.error('Failed to auto-connect:', error);
        setConnectionStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
        // Only reset on non-403 errors to allow retry for network issues
        const is403Error = error instanceof Error && error.message.includes('403');
        setHasAutoConnected(is403Error); // Don't retry on 403 errors
        if (is403Error) {
          setMeetingEnded(true); // Mark as ended to prevent further attempts
        }
      }
    };

    // Start auto-connection immediately (except for observers)
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

    try {
      const connectionDetailsResp = await fetch(url.toString());

      if (!connectionDetailsResp.ok) {
        // Try to parse error message from response
        let errorMessage = `Failed to connect: ${connectionDetailsResp.statusText}`;
        try {
          const errorData = await connectionDetailsResp.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If JSON parsing fails, use the status text
        }

        setConnectionStatus('error');
        setErrorMessage(errorMessage);
        setMeetingEnded(true); // Prevent further attempts
        return;
      }

      const connectionDetailsData = await connectionDetailsResp.json();

      // Check if response contains an error field
      if (connectionDetailsData.error) {
        setConnectionStatus('error');
        setErrorMessage(connectionDetailsData.error);
        setMeetingEnded(true); // Prevent further attempts
        return;
      }

      setConnectionDetails(connectionDetailsData);
      setConnectionStatus('connected');
    } catch (error) {
      logger.error('Failed to get connection details:', error);
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
      setMeetingEnded(true);
    }
  }, [props.roomName, props.region, props.participantType]);

  // For observers, get connection details on user interaction
  React.useEffect(() => {
    if (props.participantType === 'observer' && !hasAutoConnected && !meetingEnded && !connectionDetails) {
      // Set default choices for observer
      const defaultChoices: LocalUserChoices = {
        username: props.userName || 'Observer',
        videoEnabled: false,
        audioEnabled: false,
        videoDeviceId: undefined,
        audioDeviceId: undefined,
      };
      setPreJoinChoices(defaultChoices);
    }
  }, [props.participantType, props.userName, hasAutoConnected, meetingEnded, connectionDetails]);

  // Debug: Log state changes
  React.useEffect(() => {
    console.log('[PageClientImpl] State changed:', {
      connectionStatus,
      hasConnectionDetails: !!connectionDetails,
      participantType: props.participantType,
      hasAutoConnected,
      meetingEnded
    });
  }, [connectionStatus, connectionDetails, props.participantType, hasAutoConnected, meetingEnded]);

  const handlePreJoinError = React.useCallback((e: any) => logger.error('PreJoin error:', e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* For observers, show button if no connection details yet */}
      {props.participantType === 'observer' && !connectionDetails ? (
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
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 30px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px'
            }}>
              👁️
            </div>

            <h2 style={{
              marginBottom: '12px',
              fontSize: '28px',
              fontWeight: '600',
              letterSpacing: '-0.5px'
            }}>
              Observer Mode
            </h2>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '16px',
              marginBottom: '32px',
              fontWeight: '300',
              lineHeight: '1.6'
            }}>
              Click the button below to start observing the meeting. You will be invisible to all participants.
            </p>

            <button
              onClick={async () => {
                console.log('[Observer] Button clicked, fetching connection details...');
                try {
                  setConnectionStatus('connecting');
                  setHasAutoConnected(true);

                  const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
                  url.searchParams.append('roomName', props.roomName);
                  url.searchParams.append('participantName', props.userName || 'Observer');
                  url.searchParams.append('participantType', 'observer');
                  if (props.region) {
                    url.searchParams.append('region', props.region);
                  }

                  console.log('[Observer] Fetching from:', url.toString());
                  const connectionDetailsResp = await fetch(url.toString());

                  if (!connectionDetailsResp.ok) {
                    let errorMessage = `Failed to connect: ${connectionDetailsResp.statusText}`;
                    try {
                      const errorData = await connectionDetailsResp.json();
                      if (errorData.error) {
                        errorMessage = errorData.error;
                      }
                    } catch {
                      // If JSON parsing fails, use the status text
                    }

                    console.error('[Observer] Connection details fetch failed:', errorMessage);
                    setConnectionStatus('error');
                    setErrorMessage(errorMessage);
                    return;
                  }

                  const connectionDetailsData = await connectionDetailsResp.json();
                  console.log('[Observer] Connection details received:', {
                    hasServerUrl: !!connectionDetailsData.serverUrl,
                    hasToken: !!connectionDetailsData.participantToken,
                    roomName: connectionDetailsData.roomName
                  });

                  if (connectionDetailsData.error) {
                    console.error('[Observer] Error in connection details:', connectionDetailsData.error);
                    setConnectionStatus('error');
                    setErrorMessage(connectionDetailsData.error);
                    return;
                  }

                  // Set connection details - VideoConferenceComponent will handle the actual connection
                  console.log('[Observer] Setting connection details, will render VideoConferenceComponent');
                  setConnectionDetails(connectionDetailsData);
                  // Reset connection status so VideoConferenceComponent can show its own connecting state
                  setConnectionStatus('connected');
                } catch (error) {
                  console.error('[Observer] Failed to connect as observer:', error);
                  logger.error('Failed to connect as observer:', error);
                  setConnectionStatus('error');
                  setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
                }
              }}
              style={{
                padding: '16px 32px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }}
            >
              Start Observing
            </button>
          </div>

          <style jsx>{`
            @keyframes drift {
              0% { transform: translate(0, 0); }
              100% { transform: translate(50px, 50px); }
            }
          `}</style>
        </div>
      ) : connectionStatus === 'error' && errorMessage ? (
        <div style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.5rem',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg style={{ width: '32px', height: '32px', color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '1rem',
            }}>
              Connection Error
            </h1>
            <p style={{
              fontSize: '1rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.5',
            }}>
              {errorMessage}
            </p>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              Return to Home Page
            </button>
          </div>
        </div>
      ) : (connectionStatus === 'connecting' || connectionStatus === undefined) && !connectionDetails ? (
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
        <div dir="ltr" style={{ height: '100vh', width: '100vw' }}>
          <VideoConferenceComponent
            connectionDetails={connectionDetails!}
            userChoices={preJoinChoices!}
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
            roomFeatures={props.roomFeatures}
          />
        </div>
      )}
    </main>
  );
}

// Custom Control Buttons Component
function CustomControlButtons({ onLeave }: { onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMicEnabled, setIsMicEnabled] = React.useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = React.useState(false);
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);
  const [isTogglingScreenShare, setIsTogglingScreenShare] = React.useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = React.useState(false);

  // Screen share track monitoring refs
  const screenShareTrackRef = React.useRef<LocalTrack | null>(null);
  const screenShareLockRef = React.useRef(false);
  const screenShareHealthCheckRef = React.useRef<NodeJS.Timeout | null>(null);

  // Track participant state changes
  React.useEffect(() => {
    if (localParticipant) {
      setIsMicEnabled(localParticipant.isMicrophoneEnabled);
      setIsCameraEnabled(localParticipant.isCameraEnabled);
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
    }
  }, [localParticipant]);

  // Track pending unpublished timeouts to prevent race conditions
  const cameraUnpublishedTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isRepublishingRef = React.useRef(false);

  // Listen for remote mute/unmute commands to keep UI synced
  React.useEffect(() => {
    if (!localParticipant) return;

    const handleTrackMuted = (publication: TrackPublication) => {
      const isScreenShareVideo = publication.source === Track.Source.ScreenShare;
      const isScreenShareAudio = publication.source === Track.Source.ScreenShareAudio;

      if (publication.kind === Track.Kind.Audio && !isScreenShareAudio) {
        setIsMicEnabled(false);
      } else if (publication.kind === Track.Kind.Video && !isScreenShareVideo) {
        setIsCameraEnabled(false);
      }

      if (isScreenShareVideo || isScreenShareAudio) {
        setIsScreenSharing(false);
      }
    };

    const handleTrackUnmuted = (publication: TrackPublication) => {
      const isScreenShareVideo = publication.source === Track.Source.ScreenShare;
      const isScreenShareAudio = publication.source === Track.Source.ScreenShareAudio;

      if (publication.kind === Track.Kind.Audio && !isScreenShareAudio) {
        setIsMicEnabled(true);
      } else if (publication.kind === Track.Kind.Video && !isScreenShareVideo) {
        setIsCameraEnabled(true);
      }

      if (isScreenShareVideo || isScreenShareAudio) {
        setIsScreenSharing(true);
      }
    };

    const handleTrackPublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        try {
          // Verify state matches actual screen share status
          const actualState = localParticipant.isScreenShareEnabled;
          setIsScreenSharing(actualState);

          if (!actualState) {
            logger.debug('Screen share track published but isScreenShareEnabled is false', {
              trackSid: publication.trackSid,
            });
          }
        } catch (error) {
          logger.error('Error in handleTrackPublished for screen share:', error);
          // Fallback to setting true if we can't verify
          setIsScreenSharing(true);
        }
      } else if (publication.source === Track.Source.Camera) {
        // CRITICAL FIX: Cancel any pending unpublished timeout
        if (cameraUnpublishedTimeoutRef.current) {
          clearTimeout(cameraUnpublishedTimeoutRef.current);
          cameraUnpublishedTimeoutRef.current = null;
        }
        isRepublishingRef.current = false;
        
        // Update camera state when camera track is published
        try {
          const actualState = localParticipant.isCameraEnabled;
          setIsCameraEnabled(actualState);
          logger.debug('Camera track published, updating camera state:', {
            trackSid: publication.trackSid,
            isCameraEnabled: actualState,
          });
        } catch (error) {
          logger.error('Error in handleTrackPublished for camera:', error);
          // Fallback to setting true if we can't verify
          setIsCameraEnabled(true);
        }
      } else if (publication.source === Track.Source.Microphone) {
        // Update microphone state when microphone track is published
        try {
          const actualState = localParticipant.isMicrophoneEnabled;
          setIsMicEnabled(actualState);
          logger.debug('Microphone track published, updating microphone state:', {
            trackSid: publication.trackSid,
            isMicrophoneEnabled: actualState,
          });
        } catch (error) {
          logger.error('Error in handleTrackPublished for microphone:', error);
          // Fallback to setting true if we can't verify
          setIsMicEnabled(true);
        }
      }
    };

    const handleTrackUnpublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        // Clean up track reference
        if (screenShareTrackRef.current) {
          const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
          if (cleanup) cleanup();
          screenShareTrackRef.current = null;
        }
        
        // Don't immediately update UI - might be temporary
        setTimeout(() => {
          try {
            const actualState = localParticipant.isScreenShareEnabled;
            setIsScreenSharing(actualState);
            
            if (actualState) {
              logger.warn('Screen share track unpublished but isScreenShareEnabled is true - possible browser stop', {
                trackSid: publication.trackSid,
              });
              // Browser might have stopped sharing
              toast.error('Screen sharing was stopped. Click the button to share again.', {
                duration: 4000,
              });
            }
          } catch (error) {
            logger.error('Error in handleTrackUnpublished for screen share:', error);
            setIsScreenSharing(false);
          }
        }, 300);
      } else if (publication.source === Track.Source.Camera) {
        // CRITICAL FIX: Clear any pending timeout
        if (cameraUnpublishedTimeoutRef.current) {
          clearTimeout(cameraUnpublishedTimeoutRef.current);
          cameraUnpublishedTimeoutRef.current = null;
        }
        
        // Check if this is a republish (quality change) vs actual disable
        // If camera is still enabled in state, it's likely a republish
        const currentState = localParticipant.isCameraEnabled;
        
        if (currentState) {
          // Likely a republish - don't update UI immediately
          isRepublishingRef.current = true;
          cameraUnpublishedTimeoutRef.current = setTimeout(() => {
            // Check again after delay
            try {
              const stillEnabled = localParticipant.isCameraEnabled;
              if (stillEnabled) {
                // Was a republish, keep UI state as enabled
                setIsCameraEnabled(true);
                logger.debug('Camera track republished, keeping enabled state');
              } else {
                // Actually disabled
                setIsCameraEnabled(false);
                logger.debug('Camera track actually disabled');
              }
            } catch (error) {
              logger.error('Error checking camera state after unpublished:', error);
              // Don't update UI on error - might be temporary
            }
            isRepublishingRef.current = false;
            cameraUnpublishedTimeoutRef.current = null;
          }, 300); // Reduced to 300ms for faster response
        } else {
          // Actually disabled by user
          setIsCameraEnabled(false);
          logger.debug('Camera track unpublished and disabled');
        }
      } else if (publication.source === Track.Source.Microphone) {
        // Update microphone state when microphone track is unpublished
        try {
          const actualState = localParticipant.isMicrophoneEnabled;
          setIsMicEnabled(actualState);
          logger.debug('Microphone track unpublished, updating microphone state:', {
            trackSid: publication.trackSid,
            isMicrophoneEnabled: actualState,
          });
        } catch (error) {
          logger.error('Error in handleTrackUnpublished for microphone:', error);
          // Fallback to setting false if we can't verify
          setIsMicEnabled(false);
        }
      }
    };

    localParticipant.on(ParticipantEvent.TrackMuted, handleTrackMuted);
    localParticipant.on(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);
    localParticipant.on(ParticipantEvent.LocalTrackPublished, handleTrackPublished);
    localParticipant.on(ParticipantEvent.LocalTrackUnpublished, handleTrackUnpublished);

    return () => {
      // Clean up pending timeout
      if (cameraUnpublishedTimeoutRef.current) {
        clearTimeout(cameraUnpublishedTimeoutRef.current);
        cameraUnpublishedTimeoutRef.current = null;
      }
      isRepublishingRef.current = false;
      
      localParticipant.off(ParticipantEvent.TrackMuted, handleTrackMuted);
      localParticipant.off(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);
      localParticipant.off(ParticipantEvent.LocalTrackPublished, handleTrackPublished);
      localParticipant.off(ParticipantEvent.LocalTrackUnpublished, handleTrackUnpublished);
      
      // Clean up screen share track listeners
      if (screenShareTrackRef.current) {
        const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
        if (cleanup) cleanup();
        screenShareTrackRef.current = null;
      }
      
      // Clean up health check
      if (screenShareHealthCheckRef.current) {
        clearInterval(screenShareHealthCheckRef.current);
        screenShareHealthCheckRef.current = null;
      }
    };
  }, [localParticipant]);

  // Screen share health monitoring
  React.useEffect(() => {
    // CRITICAL FIX: Also check room state - don't run health check if room disconnected
    if (!localParticipant || !isScreenSharing || !room || room.state !== 'connected') {
      // Clear health check if screen share is not active or room disconnected
      if (screenShareHealthCheckRef.current) {
        clearInterval(screenShareHealthCheckRef.current);
        screenShareHealthCheckRef.current = null;
      }
      return;
    }

    const healthCheckInterval = setInterval(() => {
      try {
        // CRITICAL FIX: Check room state before accessing participant
        if (!room || room.state !== 'connected' || !localParticipant) {
          logger.debug('Room disconnected or participant unavailable, stopping health check');
          if (screenShareHealthCheckRef.current) {
            clearInterval(screenShareHealthCheckRef.current);
            screenShareHealthCheckRef.current = null;
          }
          return;
        }

        const screenSharePublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);
        const track = screenSharePublication?.track;
        
        if (!track) {
          // Track disappeared - browser might have stopped it
          logger.warn('Screen share track disappeared during health check');
          setIsScreenSharing(false);
          screenShareLockRef.current = false;
          if (screenShareTrackRef.current) {
            const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
            if (cleanup) cleanup();
            screenShareTrackRef.current = null;
          }
          toast.error('Screen sharing was stopped unexpectedly.', {
            duration: 4000,
          });
          return;
        }

        // Check if MediaStreamTrack is still active
        const mediaStreamTrack = track.mediaStreamTrack;
        if (mediaStreamTrack && mediaStreamTrack.readyState === 'ended') {
          logger.warn('Screen share MediaStreamTrack ended');
          setIsScreenSharing(false);
          screenShareLockRef.current = false;
          if (screenShareTrackRef.current) {
            const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
            if (cleanup) cleanup();
            screenShareTrackRef.current = null;
          }
          toast.error('Screen sharing was stopped by your browser.', {
            duration: 4000,
          });
        }
      } catch (error) {
        logger.error('Error in screen share health check:', error);
        // CRITICAL FIX: Stop health check on error to prevent repeated failures
        if (screenShareHealthCheckRef.current) {
          clearInterval(screenShareHealthCheckRef.current);
          screenShareHealthCheckRef.current = null;
        }
      }
    }, 2000); // Check every 2 seconds

    screenShareHealthCheckRef.current = healthCheckInterval;

    return () => {
      if (screenShareHealthCheckRef.current) {
        clearInterval(screenShareHealthCheckRef.current);
        screenShareHealthCheckRef.current = null;
      }
    };
  }, [localParticipant, isScreenSharing, room]);

  // Toggle microphone
  const toggleMicrophone = async () => {
    if (!localParticipant) return;

    const enabled = localParticipant.isMicrophoneEnabled;
    const newState = !enabled;

    // Optimistic update
    setIsMicEnabled(newState);

    try {
      await localParticipant.setMicrophoneEnabled(newState);

      // Verify the actual state after operation completes
      const actualState = localParticipant.isMicrophoneEnabled;
      if (actualState !== newState) {
        setIsMicEnabled(actualState);
        logger.debug('Microphone state mismatch after operation', {
          expected: newState,
          actual: actualState,
        });
      }
    } catch (error) {
      // Revert optimistic update on failure
      setIsMicEnabled(enabled);

      logger.error('Failed to toggle microphone:', error);

      // Handle specific error types with user-friendly messages
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name;
        
        // CRITICAL FIX: Handle invalid deviceId errors specifically
        if (errorMessage.includes('constraint') || 
            errorMessage.includes('deviceid') || 
            errorMessage.includes('device id') ||
            errorMessage.includes('invalid device') ||
            (errorName === 'OverconstrainedError') ||
            (errorName === 'ConstraintNotSatisfiedError')) {
          logger.warn('Invalid deviceId detected, attempting fallback to default device', {
            error: error.message,
            storedDeviceId: props.userChoices.audioDeviceId
          });
          
          // Try to enable with default device (no deviceId constraint)
          try {
            toast.error('Microphone device error. Trying default microphone...', {
              duration: 3000,
            });
            
            // First ensure it's disabled
            await localParticipant.setMicrophoneEnabled(false);
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Try enabling without deviceId constraint
            // LiveKit should fall back to default device if deviceId fails
            await localParticipant.setMicrophoneEnabled(true);
            
            // Verify it worked
            if (localParticipant.isMicrophoneEnabled) {
              setIsMicEnabled(true);
              toast.success('Microphone enabled with default device', {
                duration: 3000,
              });
              return; // Success, exit early
            }
          } catch (retryError) {
            logger.error('Failed to enable microphone with default device:', retryError);
            // Fall through to show error message below
          }
        }
        
        if (errorName === 'NotAllowedError' || errorMessage.includes('permission denied') || errorMessage.includes('permission')) {
          toast.error('Microphone permission denied. Please allow microphone access in your browser settings to use audio.', {
            duration: 5000,
          });
        } else if (errorName === 'NotFoundError' || errorMessage.includes('notfounderror') || errorMessage.includes('not found')) {
          toast.error('No microphone detected. Please connect a microphone and try again.', {
            duration: 5000,
          });
        } else if (errorName === 'NotReadableError' || errorMessage.includes('notreadableerror') || errorMessage.includes('not readable')) {
          toast.error('Microphone is currently in use by another application. Please close other apps and try again.', {
            duration: 5000,
          });
        } else if (errorMessage.includes('getusermedia') || errorMessage.includes('mediadevices')) {
          toast.error('Microphone access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.', {
            duration: 5000,
          });
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          toast.error('Network error while accessing microphone. Please check your connection and try again.', {
            duration: 5000,
          });
        } else {
          toast.error('Unable to access microphone. Please check your microphone settings and try again.', {
            duration: 5000,
          });
        }
      } else {
        toast.error('An unexpected error occurred while accessing the microphone. Please try again.', {
          duration: 5000,
        });
      }
    }
  };

  // Toggle camera
  const toggleCamera = async () => {
    if (!localParticipant) return;

    const enabled = localParticipant.isCameraEnabled;
    const newState = !enabled;

    // Optimistic update
    setIsCameraEnabled(newState);

    try {
      await localParticipant.setCameraEnabled(newState);

      // Verify the actual state after operation completes
      const actualState = localParticipant.isCameraEnabled;
      if (actualState !== newState) {
        setIsCameraEnabled(actualState);
        logger.debug('Camera state mismatch after operation', {
          expected: newState,
          actual: actualState,
        });
      }
    } catch (error) {
      // Revert optimistic update on failure
      setIsCameraEnabled(enabled);

      logger.error('Failed to toggle camera:', error);

      // Handle specific error types with user-friendly messages
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name;
        
        // CRITICAL FIX: Handle invalid deviceId errors specifically
        if (errorMessage.includes('constraint') || 
            errorMessage.includes('deviceid') || 
            errorMessage.includes('device id') ||
            errorMessage.includes('invalid device') ||
            (errorName === 'OverconstrainedError') ||
            (errorName === 'ConstraintNotSatisfiedError')) {
          logger.warn('Invalid deviceId detected, attempting fallback to default device', {
            error: error.message,
            storedDeviceId: props.userChoices.videoDeviceId
          });
          
          // Try to enable with default device (no deviceId constraint)
          try {
            toast.error('Camera device error. Trying default camera...', {
              duration: 3000,
            });
            
            // First ensure it's disabled
            await localParticipant.setCameraEnabled(false);
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Try enabling without deviceId constraint
            // LiveKit should fall back to default device if deviceId fails
            await localParticipant.setCameraEnabled(true);
            
            // Verify it worked
            if (localParticipant.isCameraEnabled) {
              setIsCameraEnabled(true);
              toast.success('Camera enabled with default device', {
                duration: 3000,
              });
              return; // Success, exit early
            }
          } catch (retryError) {
            logger.error('Failed to enable camera with default device:', retryError);
            // Fall through to show error message below
          }
        }
        
        if (errorName === 'NotAllowedError' || errorMessage.includes('permission denied') || errorMessage.includes('permission')) {
          toast.error('Camera permission denied. Please allow camera access in your browser settings to use video.', {
            duration: 5000,
          });
        } else if (errorName === 'NotFoundError' || errorMessage.includes('notfounderror') || errorMessage.includes('not found')) {
          toast.error('No camera detected. Please connect a camera and try again.', {
            duration: 5000,
          });
        } else if (errorName === 'NotReadableError' || errorMessage.includes('notreadableerror') || errorMessage.includes('not readable')) {
          toast.error('Camera is currently in use by another application. Please close other apps and try again.', {
            duration: 5000,
          });
        } else if (errorMessage.includes('getusermedia') || errorMessage.includes('mediadevices')) {
          toast.error('Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.', {
            duration: 5000,
          });
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          toast.error('Network error while accessing camera. Please check your connection and try again.', {
            duration: 5000,
          });
        } else {
          toast.error('Unable to access camera. Please check your camera settings and try again.', {
            duration: 5000,
          });
        }
      } else {
        toast.error('An unexpected error occurred while accessing the camera. Please try again.', {
          duration: 5000,
        });
      }
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (!localParticipant || isTogglingScreenShare || screenShareLockRef.current) return;

    const enabled = localParticipant.isScreenShareEnabled;
    const newState = !enabled;

    // Acquire lock
    screenShareLockRef.current = true;
    setIsTogglingScreenShare(true);

    try {
      // Optimistic update - will be reverted if operation fails
      setIsScreenSharing(newState);

      if (newState) {
        // Enable screen share with audio option
        // Use createScreenTracks to explicitly request audio
        const tracks = await localParticipant.createScreenTracks({
          audio: true,  // Enable system audio sharing - this shows the "Share tab audio" option
          video: true,
        });

        // Store track reference for monitoring
        const videoTrack = tracks.find(t => t.kind === Track.Kind.Video);
        if (videoTrack) {
          screenShareTrackRef.current = videoTrack as LocalTrack;
          
          // CRITICAL: Monitor for browser-initiated stops
          const mediaStreamTrack = videoTrack.mediaStreamTrack;
          if (mediaStreamTrack) {
            const handleTrackEnded = () => {
              logger.warn('Screen share track ended unexpectedly (browser stop detected)');
              // Browser stopped sharing - clean up state
              screenShareTrackRef.current = null;
              setIsScreenSharing(false);
              setIsTogglingScreenShare(false);
              screenShareLockRef.current = false;
              
              // Notify user
              toast.error('Screen sharing was stopped by your browser. Click the button to share again.', {
                duration: 5000,
              });
            };

            mediaStreamTrack.addEventListener('ended', handleTrackEnded);
            
            // Store cleanup function
            (videoTrack as any).__cleanupEnded = () => {
              mediaStreamTrack.removeEventListener('ended', handleTrackEnded);
            };
          }
        }

        // Publish the tracks with error handling
        for (const track of tracks) {
          try {
            await localParticipant.publishTrack(track);
          } catch (publishError) {
            logger.error('Failed to publish screen share track:', publishError);
            // Clean up already published tracks
            tracks.forEach(t => {
              if (t !== track && t.mediaStreamTrack) {
                t.mediaStreamTrack.stop();
              }
            });
            // Clean up track reference
            if (screenShareTrackRef.current) {
              const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
              if (cleanup) cleanup();
              screenShareTrackRef.current = null;
            }
            throw publishError;
          }
        }
      } else {
        // Disable screen share
        // Clean up track reference
        if (screenShareTrackRef.current) {
          const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
          if (cleanup) cleanup();
          screenShareTrackRef.current = null;
        }
        
        await localParticipant.setScreenShareEnabled(false);
      }

      // Verify the actual state after operation completes
      const actualState = localParticipant.isScreenShareEnabled;
      if (actualState !== newState) {
        setIsScreenSharing(actualState);
        logger.debug('Screen share state mismatch after operation', {
          expected: newState,
          actual: actualState,
        });
      }
    } catch (error) {
      // Revert optimistic update on failure
      setIsScreenSharing(enabled);
      
      // Clean up any partial tracks
      if (screenShareTrackRef.current) {
        const cleanup = (screenShareTrackRef.current as any).__cleanupEnded;
        if (cleanup) cleanup();
        screenShareTrackRef.current = null;
      }

      logger.error('Failed to toggle screen share:', error);

      // Handle specific error types with user-friendly messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied') || error.message.includes('permission')) {
          toast.error('Screen sharing permission was denied. Please allow screen sharing when prompted.');
        } else if (error.name === 'NotReadableError' || error.message.includes('NotReadableError') || error.message.includes('not readable')) {
          toast.error('Screen sharing is not available. Another application may be using it.');
        } else if (error.name === 'NotFoundError' || error.message.includes('NotFoundError') || error.message.includes('not found')) {
          toast.error('No screen sharing source found. Please check your display settings.');
        } else if (error.message.includes('getDisplayMedia') || error.message.includes('Screen Capture API')) {
          toast.error('Screen sharing is not supported in this browser. Please use a modern browser.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          toast.error('Network error while starting screen share. Please check your connection and try again.');
        } else if (error.message.includes('ended') || error.message.includes('stopped')) {
          toast.error('Screen sharing was stopped unexpectedly. Please try again.');
        } else {
          toast.error('Failed to start screen sharing. Please try again.');
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsTogglingScreenShare(false);
      screenShareLockRef.current = false;
    }
  };

  // Base button style matching custom buttons
  const getButtonStyle = (isActive: boolean, isDisabled: boolean = false, isDanger: boolean = false): React.CSSProperties => {
    let backgroundColor = 'rgba(0, 0, 0, 0.7)';
    let borderColor = 'rgba(255, 255, 255, 0.2)';

    if (isDanger) {
      backgroundColor = 'rgba(220, 38, 38, 0.9)';
      borderColor = 'rgba(220, 38, 38, 1)';
    } else if (isActive) {
      backgroundColor = 'rgba(59, 130, 246, 0.9)';
      borderColor = 'rgba(59, 130, 246, 1)';
    }

    return {
      backgroundColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '12px',
      padding: '12px',
      color: 'white',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '48px',
      width: '48px',
      height: '48px',
      transition: 'all 0.2s ease',
      position: 'relative',
      boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
    };
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, isActive: boolean, isDanger: boolean = false) => {
    if (isDanger) {
      e.currentTarget.style.backgroundColor = 'rgba(185, 28, 28, 0.95)';
    } else if (isActive) {
      e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.95)';
    } else {
      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    }
    e.currentTarget.style.transform = 'translateY(-2px)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>, isActive: boolean, isDanger: boolean = false) => {
    if (isDanger) {
      e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
    } else if (isActive) {
      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
    } else {
      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    }
    e.currentTarget.style.transform = 'translateY(0)';
  };

  const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!showLeaveDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowLeaveDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLeaveDialog]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!showLeaveDialog) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showLeaveDialog]);

  const leaveDialog = React.useMemo(() => {
    if (!showLeaveDialog || typeof document === 'undefined') {
      return null;
    }

    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'fadeIn 0.2s ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-meeting-title"
        aria-describedby="leave-meeting-description"
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '420px',
            width: '90%',
            boxShadow:
              '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <span style={{ fontSize: '32px' }}>🚪</span>
          </div>

          <h3
            id="leave-meeting-title"
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            Leave Meeting?
          </h3>

          <p
            id="leave-meeting-description"
            style={{
              fontSize: '14px',
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: '28px',
              lineHeight: '1.5',
            }}
          >
            Are you sure you want to leave this meeting? You can rejoin anytime.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => setShowLeaveDialog(false)}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
            >
              Cancel
            </button>

            <button
              onClick={() => {
                setShowLeaveDialog(false);
                onLeave();
              }}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#b91c1c';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
              }}
            >
              Leave
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }, [showLeaveDialog, onLeave]);

  return (
    <>
      {/* Microphone Button - Color coded */}
      <div style={{ position: 'relative' }} className="group">
        <button
          onClick={toggleMicrophone}
          className="custom-track-toggle custom-control-button"
          data-custom-button="true"
          style={{
            background: isMicEnabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            border: `2px solid ${isMicEnabled ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)'}`,
            borderRadius: '12px',
            padding: '6px 10px',
            color: 'white',
            minWidth: '56px',
            minHeight: '48px',
            height: '48px',
            display: 'flex !important',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            setHoveredButton('mic');
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            setHoveredButton(null);
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
          title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
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
            {isMicEnabled ? (
              // Microphone on icon
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            ) : (
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
            Mic
          </span>

          {/* Status text */}
          <span className="custom-toggle-status" style={{
            fontSize: '8px',
            fontWeight: '500',
            opacity: 0.9,
            textAlign: 'center',
            lineHeight: '1'
          }}>
            {isMicEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
        {/* Tooltip */}
        {hoveredButton === 'mic' && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            backgroundColor: isMicEnabled ? '#22c55e' : '#ef4444',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}>
            {isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          </div>
        )}
      </div>

      {/* Camera Button - Color coded */}
      <div style={{ position: 'relative' }} className="group">
        <button
          onClick={toggleCamera}
          className="custom-track-toggle custom-control-button"
          data-custom-button="true"
          style={{
            background: isCameraEnabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            border: `2px solid ${isCameraEnabled ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)'}`,
            borderRadius: '12px',
            padding: '6px 10px',
            color: 'white',
            minWidth: '56px',
            minHeight: '48px',
            height: '48px',
            display: 'flex !important',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            setHoveredButton('camera');
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            setHoveredButton(null);
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
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
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
            {isCameraEnabled ? (
              // Camera on icon
              <>
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </>
            ) : (
              // Camera off icon with slash
              <>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34m-7.72-2.06a4 4 0 11-5.56-5.56" />
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
            Camera
          </span>

          {/* Status text */}
          <span className="custom-toggle-status" style={{
            fontSize: '8px',
            fontWeight: '500',
            opacity: 0.9,
            textAlign: 'center',
            lineHeight: '1'
          }}>
            {isCameraEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
        {/* Tooltip */}
        {hoveredButton === 'camera' && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            backgroundColor: isCameraEnabled ? '#22c55e' : '#ef4444',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}>
            {isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          </div>
        )}
      </div>

      {/* Screen Share Button */}
      <div style={{ position: 'relative' }} className="group">
        <button
          onClick={toggleScreenShare}
          disabled={isTogglingScreenShare}
          style={getButtonStyle(isScreenSharing, isTogglingScreenShare, false)}
          onMouseEnter={(e) => {
            if (!isTogglingScreenShare) {
              handleMouseEnter(e, isScreenSharing);
              setHoveredButton('screen');
            }
          }}
          onMouseLeave={(e) => {
            if (!isTogglingScreenShare) {
              handleMouseLeave(e, isScreenSharing);
              setHoveredButton(null);
            }
          }}
          title={isTogglingScreenShare ? 'Processing...' : (isScreenSharing ? 'Stop sharing' : 'Share screen')}
        >
          <span style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isScreenSharing ? '⏹️' : '🖥️'}
          </span>
          {/* Active indicator */}
          {isScreenSharing && (
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
          )}
        </button>
        {/* Tooltip */}
        {hoveredButton === 'screen' && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            backgroundColor: '#1f2937',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}>
            {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          </div>
        )}
      </div>

      {/* Leave Button */}
      <div style={{ position: 'relative' }} className="group">
        <button
          onClick={() => setShowLeaveDialog(true)}
          style={getButtonStyle(false, false, false)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
            e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            setHoveredButton('leave');
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'translateY(0)';
            setHoveredButton(null);
          }}
          title="Leave meeting"
        >
          <span style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            🚪
          </span>
        </button>
        {/* Tooltip */}
        {hoveredButton === 'leave' && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            backgroundColor: '#dc2626',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}>
            Leave Meeting
          </div>
        )}
      </div>

      {leaveDialog}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            transform: translateY(20px);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
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
  roomFeatures?: any; // Room feature flags
}) {
  console.log('[VideoConferenceComponent] Rendering with:', {
    participantType: props.participantType,
    hasConnectionDetails: !!props.connectionDetails,
    connectionDetails: props.connectionDetails
  });
  const isObserverView = props.participantType === 'observer';

  const router = useRouter();
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  // Control bar visibility state with localStorage persistence
  const [controlsVisible, setControlsVisible] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('livekit-controls-visible');
    return saved !== null ? saved === 'true' : true;
  });

  // Screen share detection state
  const [hasScreenShare, setHasScreenShare] = React.useState(false);

  // Participant count state for dynamic grid layout
  const [participantCount, setParticipantCount] = React.useState(0);

  // Calculate optimal grid columns based on participant count (vertical-first stacking)
  const calculateGridColumns = React.useCallback((count: number): number => {
    if (count <= 0) return 1;
    if (count <= 3) return 1; // 1-3 participants: 1 column (vertical stack)
    if (count === 4) return 2; // 4 participants: 2 columns, 2 rows
    if (count <= 6) return 2; // 5-6 participants: 2 columns
    if (count <= 9) return 3; // 7-9 participants: 3 columns
    return 3; // 10+ participants: 3 columns (optimal fit)
  }, []);

  // Save control bar visibility preference to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('livekit-controls-visible', String(controlsVisible));
    }
  }, [controlsVisible]);

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
        // Enhanced audio constraints for better volume and quality (like Zoom)
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000, // Higher sample rate for better quality
        channelCount: 1, // Mono for better compatibility
        // Additional constraints for better volume and quality
        googEchoCancellation: true,
        googNoiseSuppression: true,
        googAutoGainControl: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
      },
      screenShareCaptureOptions: {
        audio: true,  // Enable system audio sharing
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  // Screen share detection - monitor all participants for screen sharing
  React.useEffect(() => {
    if (!room || room.state !== 'connected') {
      setHasScreenShare(false);
      return;
    }

    const checkScreenShare = () => {
      // Check local participant
      const localScreenTrack = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const localHasScreenShare = localScreenTrack?.isEnabled && !!localScreenTrack?.track;

      // Check remote participants using room.remoteParticipants
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      const remoteHasScreenShare = remoteParticipants.some((participant) => {
        const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare);
        return screenTrack?.isEnabled && !!screenTrack?.track;
      });

      const hasAnyScreenShare = localHasScreenShare || remoteHasScreenShare;
      setHasScreenShare(hasAnyScreenShare);
    };

    checkScreenShare();

    // Listen for track changes on local participant
    const handleLocalTrackPublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        checkScreenShare();
      }
    };

    const handleLocalTrackUnpublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        checkScreenShare();
      }
    };

    // Listen for track changes on remote participants
    const handleRemoteTrackPublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        checkScreenShare();
      }
    };

    const handleRemoteTrackUnpublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        checkScreenShare();
      }
    };

    // Listen for participant events
    const handleParticipantConnected = () => {
      checkScreenShare();
    };

    const handleParticipantDisconnected = () => {
      checkScreenShare();
    };

    room.localParticipant.on('trackPublished', handleLocalTrackPublished);
    room.localParticipant.on('trackUnpublished', handleLocalTrackUnpublished);
    room.on(RoomEvent.TrackPublished, handleRemoteTrackPublished);
    room.on(RoomEvent.TrackUnpublished, handleRemoteTrackUnpublished);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    // Set up listeners for existing remote participants
    const remoteParticipants = Array.from(room.remoteParticipants.values());
    remoteParticipants.forEach((participant) => {
      participant.on('trackPublished', handleRemoteTrackPublished);
      participant.on('trackUnpublished', handleRemoteTrackUnpublished);
    });

    return () => {
      try {
        if (!room) return;

        if (room.localParticipant) {
          room.localParticipant.off('trackPublished', handleLocalTrackPublished);
          room.localParticipant.off('trackUnpublished', handleLocalTrackUnpublished);
        }

        if (typeof room.off === 'function') {
          room.off(RoomEvent.TrackPublished, handleRemoteTrackPublished);
          room.off(RoomEvent.TrackUnpublished, handleRemoteTrackUnpublished);
          room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
          room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        }

        if (room.remoteParticipants) {
          const remoteParticipants = Array.from(room.remoteParticipants.values());
          remoteParticipants.forEach((participant) => {
            if (participant && typeof participant.off === 'function') {
              participant.off('trackPublished', handleRemoteTrackPublished);
              participant.off('trackUnpublished', handleRemoteTrackUnpublished);
            }
          });
        }
      } catch (error) {
        // Ignore cleanup errors
        logger.debug('Error during screen share detection cleanup (ignored):', error instanceof Error ? error.message : String(error));
      }
    };
  }, [room]);

  // Participant count tracking - exclude observers and screen share participants
  React.useEffect(() => {
    if (!room || room.state !== 'connected') {
      setParticipantCount(0);
      return;
    }

    const updateParticipantCount = () => {
      // Count remote participants (excluding observers)
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      const remoteCount = remoteParticipants.filter(
        (p) => !p.identity.includes('_observer_')
      ).length;

      // Include local participant (always 1)
      const total = 1 + remoteCount;
      setParticipantCount(total);
    };

    updateParticipantCount();

    // Listen for participant connect/disconnect events
    const handleParticipantConnected = () => {
      updateParticipantCount();
    };

    const handleParticipantDisconnected = () => {
      updateParticipantCount();
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      if (typeof room.off === 'function') {
        room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      }
    };
  }, [room]);

  // CRITICAL FIX: Ensure tracks are immediately subscribed when published
  // This prevents the issue where teacher/student can't see each other when joining
  React.useEffect(() => {
    if (!room || room.state !== 'connected') return;

    const handleRemoteTrackPublished = (publication: TrackPublication, participant: Participant) => {
      // Only handle remote participants
      if (participant === room.localParticipant) return;

      // CRITICAL: Immediately subscribe to video tracks when published
      if (publication.kind === Track.Kind.Video && publication.source === Track.Source.Camera) {
        if (publication.track && !publication.isSubscribed && !publication.isMuted) {
          try {
            logger.debug('Immediately subscribing to newly published video track', {
              participant: participant.identity,
              trackSid: publication.trackSid,
            });
            publication.setSubscribed(true);
          } catch (error) {
            logger.warn('Failed to subscribe to newly published video track:', error);
          }
        }
      }

      // CRITICAL: Immediately subscribe to audio tracks when published
      if (publication.kind === Track.Kind.Audio && publication.source === Track.Source.Microphone) {
        if (publication.track && !publication.isSubscribed && !publication.isMuted) {
          try {
            logger.debug('Immediately subscribing to newly published audio track', {
              participant: participant.identity,
              trackSid: publication.trackSid,
            });
            publication.setSubscribed(true);
          } catch (error) {
            logger.warn('Failed to subscribe to newly published audio track:', error);
          }
        }
      }
    };

    // Listen for track published events on room level
    room.on(RoomEvent.TrackPublished, handleRemoteTrackPublished);

    // Store participant track published handlers for cleanup
    const participantHandlers = new Map<Participant, (publication: TrackPublication) => void>();

    // Helper to create participant-specific handler
    const createParticipantHandler = (participant: Participant) => {
      return (publication: TrackPublication) => {
        handleRemoteTrackPublished(publication, participant);
      };
    };

    // Also set up listeners for existing participants
    room.remoteParticipants.forEach((participant) => {
      const handler = createParticipantHandler(participant);
      participantHandlers.set(participant, handler);
      participant.on('trackPublished', handler);
    });

    // Handle new participants joining
    const handleParticipantConnected = (participant: Participant) => {
      // Set up listener for this participant
      const handler = createParticipantHandler(participant);
      participantHandlers.set(participant, handler);
      participant.on('trackPublished', handler);

      // CRITICAL: Check for existing tracks that might not be subscribed
      setTimeout(() => {
        participant.videoTrackPublications.forEach((publication) => {
          if (publication.track && !publication.isSubscribed && !publication.isMuted) {
            try {
              publication.setSubscribed(true);
            } catch (error) {
              logger.debug('Could not subscribe to existing video track:', error);
            }
          }
        });

        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && !publication.isSubscribed && !publication.isMuted) {
            try {
              publication.setSubscribed(true);
            } catch (error) {
              logger.debug('Could not subscribe to existing audio track:', error);
            }
          }
        });
      }, 100); // Small delay to ensure participant is fully initialized
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    // CRITICAL FIX: Handle participant disconnect to clean up handlers
    const handleParticipantDisconnected = (participant: Participant) => {
      const handler = participantHandlers.get(participant);
      if (handler) {
        try {
          participant.off('trackPublished', handler);
        } catch (error) {
          logger.debug('Error removing participant handler (ignored):', error);
        }
        participantHandlers.delete(participant);
      }
    };
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      // CRITICAL FIX: Add null checks before cleanup
      try {
        if (room && typeof room.off === 'function') {
          room.off(RoomEvent.TrackPublished, handleRemoteTrackPublished);
          room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
          room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        }
      } catch (error) {
        logger.debug('Error removing room event listeners (ignored):', error);
      }
      
      // CRITICAL FIX: Cleanup participant handlers with error handling
      participantHandlers.forEach((handler, participant) => {
        try {
          if (participant && typeof participant.off === 'function') {
            participant.off('trackPublished', handler);
          }
        } catch (error) {
          logger.debug('Error removing participant handler (ignored):', error);
        }
      });
      participantHandlers.clear();
    };
  }, [room]);

  React.useEffect(() => {
    logger.debug('E2EE setup effect running:', { e2eeEnabled, hasRoom: !!room });
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              logger.error('Device unsupported error:', e);
            } else {
              throw e;
            }
          });
        })
        .then(() => {
          logger.debug('E2EE setup complete');
          setE2eeSetupComplete(true);
        })
        .catch((error) => {
          logger.error('E2EE setup failed:', error);
          // Still allow connection even if E2EE setup fails
          setE2eeSetupComplete(true);
        });
    } else {
      logger.debug('E2EE disabled, marking setup as complete');
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  // Debug logging for host controls
  React.useEffect(() => {
    logger.debug('Host Controls Debug:', {
      participantType: props.participantType,
      roomName: props.roomName,
      connectionDetails: props.connectionDetails,
      isHost: props.participantType === 'host'
    });

    // Additional debugging for host controls rendering
    if (props.participantType === 'host') {
      logger.debug('Host controls should be visible');
    } else {
      logger.debug('Host controls hidden - participant type:', props.participantType);
    }
  }, [props.participantType, props.roomName, props.connectionDetails]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
      publishDefaults: {
        videoEnabled: props.userChoices.videoEnabled,
        audioEnabled: props.userChoices.audioEnabled,
      },
    };
  }, [props.userChoices.videoEnabled, props.userChoices.audioEnabled]);

  // Ensure observer never sees their own tile even if LiveKit updates DOM structure
  React.useEffect(() => {
    if (!isObserverView || typeof window === 'undefined') {
      return;
    }

    const hideObserverTiles = () => {
      const selectors = [
        '[data-lk-participant-identity*="_observer_"]',
        '[data-lk-participant-name="Observer"]',
        '[data-lk-participant-name*="observer"]',
      ];

      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
          const element = node instanceof HTMLElement ? node : (node as Element).parentElement;
          if (!element) return;

          const tile = element.closest('.lk-participant-tile');
          const target = (tile as HTMLElement) || element;
          target.style.display = 'none';
        });
      });
    };

    hideObserverTiles();

    const observer = new MutationObserver(() => {
      hideObserverTiles();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isObserverView]);

  // Track connection states
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  // For observers, require user interaction (AudioContext needs user gesture)
  // But once connection details are set (after user clicks), allow auto-connect
  const [userInteractionRequired, setUserInteractionRequired] = React.useState(
    props.participantType === 'observer' && !props.connectionDetails
  );
  const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Function to handle user interaction and start connection
  const handleUserInteraction = React.useCallback(async () => {
    if (isConnecting || isConnected) {
      logger.debug('Already connecting or connected, skipping');
      return;
    }

    logger.debug('handleUserInteraction called', {
      participantType: props.participantType,
      hasConnectionDetails: !!props.connectionDetails
    });

    setUserInteractionRequired(false);
    setIsConnecting(true);

    try {
      // Observers don't need to request media permissions (they don't publish)
      // But they still need user interaction for AudioContext
      const isObserver = props.participantType === 'observer';

      logger.debug('Starting connection process', { isObserver });

      // NOTE: Removed getUserMedia pre-check that stops tracks
      // LiveKit will request permissions when needed during connection
      // This prevents camera/mic from being released and then failing to re-enable

      // Clean up any existing connection first
      if (room && room.state !== 'disconnected') {
        logger.debug('Cleaning up existing connection before reconnecting...');
        await room.disconnect();
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // CRITICAL FIX: Event listeners are now set up in useEffect, not here
      // This prevents duplicate listeners and ensures proper cleanup

      logger.debug('Connecting to room...', {
        serverUrl: props.connectionDetails.serverUrl,
        hasToken: !!props.connectionDetails.participantToken
      });

      // Attempt connection
      await room.connect(
        props.connectionDetails.serverUrl,
        props.connectionDetails.participantToken,
        connectOptions,
      );

      logger.debug('Room connected successfully!');
      setIsConnected(true);
      setIsConnecting(false);
      setReconnectAttempts(0);

      // NOTE: Tracks are enabled via publishDefaults during connection
      // No need to enable them after connection - this prevents race conditions
      // and ensures tracks are ready immediately when room connects

    } catch (error) {
      logger.error('Connection failed:', error);
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

  // CRITICAL FIX: Define error handlers BEFORE useEffect that uses them
  const handleError = React.useCallback((error: Error) => {
    logger.error('LiveKit error:', error);

    // Handle microphone/camera errors gracefully without disconnecting room
    // This must be checked BEFORE AudioContext and other connection errors
    const errorMessageLower = error.message.toLowerCase();
    
    const isMicrophoneError =
      error.message.includes('Microphone') ||
      error.message.includes('microphone') ||
      (error.message.includes('audio') && (error.message.includes('NotAllowedError') || error.message.includes('Permission denied'))) ||
      (error.message.includes('getUserMedia') && error.message.includes('audio')) ||
      (errorMessageLower.includes('deviceid') && errorMessageLower.includes('audio')) ||
      (errorMessageLower.includes('constraint') && errorMessageLower.includes('audio'));

    const isCameraError =
      error.message.includes('Camera') ||
      error.message.includes('camera') ||
      (error.message.includes('video') && (error.message.includes('NotAllowedError') || error.message.includes('Permission denied'))) ||
      (error.message.includes('getUserMedia') && error.message.includes('video')) ||
      (errorMessageLower.includes('deviceid') && errorMessageLower.includes('video')) ||
      (errorMessageLower.includes('constraint') && errorMessageLower.includes('video'));

    if (isMicrophoneError || isCameraError) {
      logger.warn('Microphone/Camera error detected - handling gracefully without disconnecting room', {
        error: error.message,
        name: error.name,
        isMicrophone: isMicrophoneError,
        isCamera: isCameraError,
      });

      // Show clear error message to user while keeping them in the room
      if (isMicrophoneError) {
        if (error.message.includes('NotAllowedError') || error.message.includes('Permission denied')) {
          toast.error('Microphone permission denied. Please allow microphone access in your browser settings to use audio.', {
            duration: 5000,
          });
        } else if (error.message.includes('NotFoundError') || error.message.includes('not found')) {
          toast.error('No microphone detected. Please connect a microphone and try again.', {
            duration: 5000,
          });
        } else if (error.message.includes('NotReadableError') || error.message.includes('not readable')) {
          toast.error('Microphone is currently in use by another application. Please close other apps and try again.', {
            duration: 5000,
          });
        } else {
          toast.error('Unable to access microphone. Please check your microphone settings and try again.', {
            duration: 5000,
          });
        }
      } else if (isCameraError) {
        if (error.message.includes('NotAllowedError') || error.message.includes('Permission denied')) {
          toast.error('Camera permission denied. Please allow camera access in your browser settings to use video.', {
            duration: 5000,
          });
        } else if (error.message.includes('NotFoundError') || error.message.includes('not found')) {
          toast.error('No camera detected. Please connect a camera and try again.', {
            duration: 5000,
          });
        } else if (error.message.includes('NotReadableError') || error.message.includes('not readable')) {
          toast.error('Camera is currently in use by another application. Please close other apps and try again.', {
            duration: 5000,
          });
        } else {
          toast.error('Unable to access camera. Please check your camera settings and try again.', {
            duration: 5000,
          });
        }
      }

      // Don't disconnect room for microphone/camera errors - they're non-critical
      return;
    }

    // Handle specific RTCPeerConnection errors - LESS AGGRESSIVE
    if (error.message.includes('setRemoteDescription') || error.message.includes('addIceCandidate')) {
      logger.warn('RTCPeerConnection error - connection may be in invalid state');
      
      // CRITICAL FIX: Don't immediately disconnect - try to recover first
      // Only disconnect if we've had multiple failures
      const errorKey = 'rtcpeerconnection-error';
      const errorCount = (window as any).__rtcErrorCount || 0;
      (window as any).__rtcErrorCount = errorCount + 1;
      
      // Only disconnect after 3 consecutive errors (more lenient)
      if (errorCount >= 2 && room && room.state !== 'disconnected') {
        logger.warn('Multiple RTCPeerConnection errors detected, attempting reconnection');
        // Reset error count
        (window as any).__rtcErrorCount = 0;
        
        // Try graceful reconnection instead of immediate disconnect
        try {
          // Wait a bit before reconnecting to allow network to stabilize
          setTimeout(async () => {
            if (room && room.state === 'connected') {
              logger.debug('Attempting graceful reconnection due to RTCPeerConnection errors');
              await room.disconnect();
              setIsConnected(false);
              setReconnectAttempts(0);
              // Auto-reconnect will be handled by the auto-connect logic
            }
          }, 3000);
        } catch (reconnectError) {
          logger.error('Error during graceful reconnection:', reconnectError);
        }
      } else {
        // First or second error - just log and continue
        logger.debug(`RTCPeerConnection error (count: ${errorCount + 1}), continuing without disconnect`);
        toast.error('Connection issue detected. If problems persist, please refresh.', {
          duration: 4000,
        });
      }
      
      // Reset error count after 30 seconds (allows recovery)
      setTimeout(() => {
        (window as any).__rtcErrorCount = 0;
      }, 30000);
      
      return;
    }

    // Handle AudioContext errors (browser permission issues)
    if (error.message.includes('AudioContext') || error.message.includes('not allowed to start')) {
      logger.warn('AudioContext permission error - user needs to interact with page first');
      toast.error('Audio permission required. Please click anywhere on the page and try again.', {
        duration: 5000,
      });
      // Reset to user interaction state to allow them to try again
      setIsConnected(false);
      setIsConnecting(false);
      setUserInteractionRequired(true);
      return;
    }

    // Handle WebRTC connection errors
    if (error.message.includes('could not establish pc connection') || error.message.includes('Client initiated disconnect')) {
      logger.warn('WebRTC connection error - this may be due to component lifecycle issues');
      // Reset to user interaction state to allow them to try again
      setIsConnected(false);
      setIsConnecting(false);
      setUserInteractionRequired(true);
      return;
    }

    // Handle camera track placeholder errors
    if (error.message.includes('Element not part of the array') || error.message.includes('camera_placeholder')) {
      logger.warn('Camera track placeholder error - this is usually a timing issue');
      // Don't show error message for this - it's usually resolved automatically
      // Don't disconnect for this error, it's usually resolved automatically
      return;
    }

    // Don't show alert for common connection issues to avoid spam
    if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      logger.warn('Duplicate participant detected, this is normal during reconnections');
      return;
    }

    // Handle screen sharing errors gracefully without disconnecting room
    const isScreenShareError =
      error.message.includes('ScreenShare') ||
      error.message.includes('screen share') ||
      error.message.includes('screen sharing') ||
      error.message.includes('getDisplayMedia') ||
      error.message.includes('Screen Capture API') ||
      error.message.includes('NotAllowedError') && (error.message.includes('screen') || error.message.includes('display')) ||
      error.message.includes('NotReadableError') && (error.message.includes('screen') || error.message.includes('display')) ||
      error.message.includes('NotFoundError') && (error.message.includes('screen') || error.message.includes('display'));

    if (isScreenShareError) {
      logger.warn('Screen sharing error detected - handling gracefully without disconnecting room', {
        error: error.message,
        name: error.name,
      });

      // Don't disconnect room for screen share errors - they're non-critical
      // The toggleScreenShare function already handles these errors with user-friendly messages
      return;
    }

    // Handle generic permission cancellation gracefully (legacy check for compatibility)
    if (error.message.includes('Permission denied by user') || (error.message.includes('NotAllowedError') && !error.message.includes('screen') && !error.message.includes('display'))) {
      logger.debug('Permission was denied by user - this is expected behavior');
      // Show a friendly message for permission denial
      toast.error('Permission was denied. Please allow access when prompted to use this feature.', {
        duration: 4000,
      });
      return;
    }

    // Only show toast for unexpected errors (not network/timeout which are handled elsewhere)
    if (!error.message.includes('Network') && !error.message.includes('timeout') && !error.message.includes('duplicate')) {
      toast.error('An unexpected error occurred. You can continue using the meeting. If the issue persists, please refresh the page.', {
        duration: 6000,
      });
      logger.error('Unexpected error in handleError:', error);
    }
  }, [room]);

  const handleEncryptionError = React.useCallback((error: Error) => {
    logger.error('LiveKit encryption error:', error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  const handleOnLeave = React.useCallback((reason?: DisconnectReason) => {
    logger.debug('Room disconnected, reason:', reason);

    // CRITICAL FIX: Add null check - room might be null if component unmounted
    if (!room) {
      logger.debug('Room is null in handleOnLeave, skipping');
      return;
    }

    // If disconnected due to being removed by host, don't auto-reconnect
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
      logger.info('Participant was removed by host, not reconnecting');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/meeting-ended');
      return;
    }

    // If meeting was ended, don't reconnect
    if (props.meetingEnded) {
      logger.info('Meeting was ended, not reconnecting');
      router.push('/meeting-ended');
      return;
    }

    // Check if this is a user-initiated disconnect (clicking leave button)
    // CLIENT_INITIATED means user clicked the disconnect/leave button
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      logger.info('User intentionally left meeting (CLIENT_INITIATED)');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/meeting-ended');
      return;
    }

    // Reset connection state when leaving
    setIsConnected(false);
    setIsConnecting(false);
    setUserInteractionRequired(false); // Keep auto-connect enabled
    setReconnectAttempts(0);

    // CRITICAL FIX: Don't remove event listeners here - they're cleaned up in useEffect
    // Removing them here causes race conditions and prevents proper cleanup

    // Only redirect if this was an intentional leave (not a page reload)
    // Add null check before accessing room.state
    if (room && room.state === 'disconnected' && !document.hidden) {
      logger.info('Intentional leave detected, redirecting to home...');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/meeting-ended');
    }
  }, [router, room, props.meetingEnded, props.setMeetingEnded]);

  // CRITICAL FIX: Monitor local track publications for failures
  // Since LiveKit doesn't have TrackPublicationFailed event, we monitor track state
  React.useEffect(() => {
    if (!room || room.state !== 'connected' || !room.localParticipant) return;

    const checkTrackPublications = () => {
      const localParticipant = room.localParticipant;
      if (!localParticipant) return;

      // Check microphone track
      const isMicEnabled = localParticipant.isMicrophoneEnabled;
      const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (isMicEnabled && (!micPublication || !micPublication.track)) {
        logger.warn('Microphone is enabled but track is missing - attempting recovery');
        toast.error('Microphone connection lost. Attempting to reconnect...', {
          duration: 4000,
          icon: '🎤',
        });
        
        // Attempt recovery
        setTimeout(async () => {
          if (room && room.state === 'connected' && room.localParticipant) {
            try {
              await room.localParticipant.setMicrophoneEnabled(false);
              await new Promise(resolve => setTimeout(resolve, 500));
              await room.localParticipant.setMicrophoneEnabled(true);
              toast.success('Microphone reconnected', { duration: 2000 });
            } catch (recoveryError) {
              logger.error('Failed to recover microphone:', recoveryError);
              toast.error('Failed to reconnect microphone. Please toggle it manually.', {
                duration: 5000,
              });
            }
          }
        }, 2000);
      }

      // Check camera track
      const isCameraEnabled = localParticipant.isCameraEnabled;
      const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
      if (isCameraEnabled && (!cameraPublication || !cameraPublication.track)) {
        logger.warn('Camera is enabled but track is missing - attempting recovery');
        toast.error('Camera connection lost. Attempting to reconnect...', {
          duration: 4000,
          icon: '📹',
        });
        
        // Attempt recovery
        setTimeout(async () => {
          if (room && room.state === 'connected' && room.localParticipant) {
            try {
              await room.localParticipant.setCameraEnabled(false);
              await new Promise(resolve => setTimeout(resolve, 500));
              await room.localParticipant.setCameraEnabled(true);
              toast.success('Camera reconnected', { duration: 2000 });
            } catch (recoveryError) {
              logger.error('Failed to recover camera:', recoveryError);
              toast.error('Failed to reconnect camera. Please toggle it manually.', {
                duration: 5000,
              });
            }
          }
        }, 2000);
      }
    };

    // Check immediately and then periodically (every 5 seconds)
    checkTrackPublications();
    const checkInterval = setInterval(checkTrackPublications, 5000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [room]);

  // Cleanup event listeners when component unmounts
  // CRITICAL FIX: This must come AFTER handleOnLeave, handleEncryptionError, and handleError are defined
  React.useEffect(() => {
    if (!room) return;
    
    // Set up event listeners
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);
    
    return () => {
      // CRITICAL FIX: Add null check before removing listeners
      if (room && typeof room.off === 'function') {
        try {
          room.off(RoomEvent.Disconnected, handleOnLeave);
          room.off(RoomEvent.EncryptionError, handleEncryptionError);
          room.off(RoomEvent.MediaDevicesError, handleError);
        } catch (error) {
          // Ignore errors during cleanup - room might already be disconnected
          logger.debug('Error removing event listeners during cleanup (ignored):', error);
        }
      }
    };
  }, [room, handleOnLeave, handleEncryptionError, handleError]);

  const lowPowerMode = useLowCPUOptimizer(room);
  useAdaptiveStreamManager(room);
  // Audio improvements: volume boost, health monitoring, and stability
  useAudioVolumeBoost(room, 1.5); // 50% volume boost for remote audio (like Zoom)
  useAudioTrackHealth(room); // Monitor and fix intermittent audio issues
  useAudioStability(room); // Enhanced stability - prevents lag and disconnections
  // CRITICAL FIX: Add video track health monitoring
  useVideoTrackHealth(room); // Monitor and fix intermittent video issues

  // CRITICAL FIX: Use ref to prevent race conditions in auto-connect
  const autoConnectAttemptedRef = React.useRef(false);

  // Check if room is already connected when connection details are available
  React.useEffect(() => {
    // Don't auto-connect if meeting ended or user left
    if (props.meetingEnded) {
      logger.debug('Meeting ended or user left, not auto-connecting');
      autoConnectAttemptedRef.current = false;
      return;
    }

    // For observers, if connection details are set, it means user already clicked
    // So we should allow auto-connect (user interaction requirement is satisfied)
    if (props.participantType === 'observer' && props.connectionDetails) {
      logger.debug('Observer: Connection details available, allowing auto-connect');
      setUserInteractionRequired(false);
    }

    // Log current state for debugging
    logger.debug('Auto-connect check:', {
      hasConnectionDetails: !!props.connectionDetails,
      isConnected,
      isConnecting,
      e2eeSetupComplete,
      participantType: props.participantType,
      roomState: room?.state,
      alreadyAttempted: autoConnectAttemptedRef.current
    });

    if (props.connectionDetails && !isConnected && !isConnecting && e2eeSetupComplete) {
      // Check if room is already connected to prevent duplicates
      if (room && room.state === 'connected') {
        logger.debug('Room already connected, skipping auto-connect');
        setIsConnected(true);
        autoConnectAttemptedRef.current = false; // Reset since we're connected
        return;
      }

      // CRITICAL FIX: Prevent multiple connection attempts
      if (autoConnectAttemptedRef.current) {
        logger.debug('Auto-connect already attempted, skipping');
        return;
      }

      logger.debug('Auto-connecting to meeting...', {
        participantType: props.participantType,
        serverUrl: props.connectionDetails.serverUrl
      });
      
      autoConnectAttemptedRef.current = true;
      handleUserInteraction().finally(() => {
        // Reset flag after connection attempt completes (success or failure)
        setTimeout(() => {
          autoConnectAttemptedRef.current = false;
        }, 2000);
      });
    } else if (props.connectionDetails && !e2eeSetupComplete) {
      logger.debug('Waiting for E2EE setup to complete before connecting...');
    } else {
      // Reset flag if conditions aren't met
      autoConnectAttemptedRef.current = false;
    }
  }, [props.connectionDetails, props.participantType, isConnected, isConnecting, e2eeSetupComplete, handleUserInteraction, room, props.meetingEnded]);

  // All hooks must be called before any conditional returns
  React.useEffect(() => {
    if (lowPowerMode) {
      logger.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Handle PDF viewer synchronization from host
  React.useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any, kind?: any, topic?: string) => {
      // CRITICAL FIX: Filter by topic to avoid conflicts with other data channels
      if (topic && topic !== 'pdf-viewer') {
        return;
      }
      
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
        logger.error('Error parsing PDF viewer sync data:', error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, props.participantType, props.setSelectedPdfFile, props.setIsPdfViewerOpen]);

  // Handle page visibility changes and cleanup
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (room && typeof room.disconnect === 'function' && room.state !== 'disconnected') {
          logger.debug('Page unloading, disconnecting from room...');
          room.disconnect().catch((error) => {
            logger.debug('Error during room disconnect on beforeunload (ignored):', error.message);
          });
        }
      } catch (error) {
        logger.debug('Error in handleBeforeUnload (ignored):', error instanceof Error ? error.message : String(error));
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug('Page hidden, checking screen share status...');
        
        // Check if screen share is active
        if (room && room.localParticipant) {
          const screenSharePublication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
          if (screenSharePublication?.track) {
            const mediaStreamTrack = screenSharePublication.track.mediaStreamTrack;
            if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
              logger.debug('Screen share active, keeping connection alive');
              // Screen share is active - don't disconnect
              return;
            }
          }
        }
        
        logger.debug('Page hidden, but keeping room connection active...');
      } else {
        logger.debug('Page visible again, verifying screen share...');
        
        // When page becomes visible, verify screen share is still active
        if (room && room.localParticipant) {
          setTimeout(() => {
            // CRITICAL FIX: Add null checks - room might have disconnected during timeout
            if (!room || !room.localParticipant) {
              logger.debug('Room or localParticipant no longer available after visibility change');
              return;
            }
            
            const screenSharePublication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
            if (!screenSharePublication?.track) {
              logger.warn('Screen share lost when page became visible');
              // Screen share was lost - update UI
              setHasScreenShare(false);
            } else {
              // Verify track is still live
              const mediaStreamTrack = screenSharePublication.track.mediaStreamTrack;
              if (mediaStreamTrack && mediaStreamTrack.readyState === 'ended') {
                logger.warn('Screen share track ended when page became visible');
                setHasScreenShare(false);
              }
            }
          }, 500);
        }
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
      try {
        if (room && typeof room.disconnect === 'function' && room.state !== 'disconnected') {
          logger.debug('Component unmounting, disconnecting from room...');
          room.disconnect().catch((error) => {
            // Ignore disconnect errors during cleanup - room may already be disconnected
            logger.debug('Error during room disconnect in cleanup (ignored):', error.message);
          });
        }
      } catch (error) {
        // Ignore any errors during cleanup
        logger.debug('Error during cleanup (ignored):', error instanceof Error ? error.message : String(error));
      }
    };
  }, [room]);

  // Add/remove screen-sharing-active class to body and container
  // This must be called before any early returns to maintain hook order
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const body = document.body;
      const container = document.querySelector('.lk-room-container');

      if (hasScreenShare) {
        body.classList.add('screen-sharing-active');
        if (container) {
          (container as HTMLElement).classList.add('screen-sharing-active');
        }
      } else {
        body.classList.remove('screen-sharing-active');
        if (container) {
          (container as HTMLElement).classList.remove('screen-sharing-active');
        }
      }

      return () => {
        body.classList.remove('screen-sharing-active');
        if (container) {
          (container as HTMLElement).classList.remove('screen-sharing-active');
        }
      };
    }
  }, [hasScreenShare]);

  // Apply dynamic grid columns via CSS custom properties
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const containers = document.querySelectorAll('.lk-grid-layout, .lk-focus-layout');
      const columns = hasScreenShare ? 1 : calculateGridColumns(participantCount);

      containers.forEach((container) => {
        (container as HTMLElement).style.setProperty('--grid-columns', String(columns));
        // Also ensure all children are visible
        const tiles = container.querySelectorAll('.lk-participant-tile');
        tiles.forEach((tile) => {
          (tile as HTMLElement).style.display = 'block';
          (tile as HTMLElement).style.visibility = 'visible';
          (tile as HTMLElement).style.opacity = '1';
        });
      });

      return () => {
        containers.forEach((container) => {
          (container as HTMLElement).style.removeProperty('--grid-columns');
        });
      };
    }
  }, [participantCount, hasScreenShare, calculateGridColumns]);

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
        roomFeatures={props.roomFeatures}
        onEndMeeting={isHost ? async () => {
          if (meetingEnded) return; // Prevent multiple end meeting calls

          logger.debug('End Meeting button clicked!');
          logger.debug('Current props:', { participantType: isHost ? 'host' : 'guest', roomName });

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
              logger.info('Ending meeting for room:', actualRoomName);

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
                logger.success('Meeting ended successfully:', result);

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
                logger.error('Failed to end meeting:', error);

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
              logger.error('Error ending meeting:', error);

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
    <div
      className={`lk-room-container ${hasScreenShare ? 'screen-sharing-active' : ''}`}
      dir="ltr"
      data-observer-view={isObserverView ? 'true' : 'false'}
    >
      <RoomContext.Provider value={room}>
        {/* Virtual Background Auto-Apply - runs independently of settings menu */}
        {props.participantType === 'host' && (
          <VirtualBackgroundAutoApplyWrapper
            isHost={props.participantType === 'host'}
            isVirtualBackgroundEnabled={props.roomFeatures?.enableVirtualBackground ?? false}
          />
        )}
        {/* Show participant type indicator - Positioned below timer to avoid overlap */}
        {props.participantType && props.participantType !== 'observer' && (
          <div
            className="participant-type-indicator"
            style={{
              position: 'fixed',
              top: '70px',
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
            }}
          >
            {props.participantType === 'host' ? '👑 Host' : '👤 Guest'}
          </div>
        )}
        {props.participantType === 'observer' && (
          <div
            className="observer-indicator"
            style={{
              position: 'fixed',
              top: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '10px 18px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              color: 'white',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '0.02em',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>👁</span>
            <span>Observer Mode</span>
          </div>
        )}
        <style jsx global>{`
          /* Responsive adjustments for participant type indicator */
          @media (max-width: 768px) {
            .participant-type-indicator {
              top: 60px !important;
              right: 10px !important;
              font-size: 12px !important;
              padding: 6px 12px !important;
            }
          }
          
          @media (max-width: 480px) {
            .participant-type-indicator {
              top: 55px !important;
              right: 8px !important;
              font-size: 11px !important;
              padding: 5px 10px !important;
            }
          }
          @media (max-width: 768px) {
            .observer-indicator {
              top: 60px !important;
              padding: 8px 14px !important;
              font-size: 12px !important;
            }
          }
          @media (max-width: 480px) {
            .observer-indicator {
              top: 55px !important;
              padding: 6px 12px !important;
              font-size: 11px !important;
            }
          }
        `}</style>
        <style jsx global>{`
          [data-observer-view="true"] .lk-participant-tile[data-lk-participant-identity*="_observer_"],
          [data-observer-view="true"] .lk-participant-tile[data-lk-participant-name="Observer"] {
            display: none !important;
          }
        `}</style>

        {/* Meeting Timer - Shows elapsed time in center top */}
        <MeetingTimer />

        {/* Show room name indicator - Positioned below timer to avoid overlap */}
        <div
          className="room-name-indicator"
          style={{
            position: 'fixed',
            top: '70px',
            left: '20px',
            zIndex: 1000,
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: 'calc(50% - 40px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          🏠 {props.connectionDetails?.roomName || 'Meeting'}
        </div>
        <style jsx global>{`
          /* Responsive adjustments for room name indicator */
          @media (max-width: 768px) {
            .room-name-indicator {
              top: 60px !important;
              left: 10px !important;
              max-width: calc(50% - 20px) !important;
              font-size: 12px !important;
              padding: 6px 12px !important;
            }
          }
          
          @media (max-width: 480px) {
            .room-name-indicator {
              top: 55px !important;
              left: 8px !important;
              max-width: calc(50% - 16px) !important;
              font-size: 11px !important;
              padding: 5px 10px !important;
            }
          }
        `}</style>

        <KeyboardShortcuts />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? (props: any) => <CustomSettingsMenu {...props} canRecord={props.canRecord} /> : undefined}
        />

        {/* Floating Reactions Overlay */}
        <FloatingReactions />

        <RaiseHandSync />
        {/* Raise Hand Indicator - Shows raised hand status on participant tiles */}
        <RaiseHandIndicator />

        {/* Student Monitor PiP - Shows students when teacher is screen sharing (Host only) */}
        {props.participantType === 'host' && (
          <StudentMonitorPiP
            key="student-monitor-pip"
            isHost={true}
            disabled={!(props.roomFeatures?.enableStudentMonitorPiP ?? false)}
            showProBadge={!(props.roomFeatures?.enableStudentMonitorPiP ?? false)}
            roomName={props.roomName}
          />
        )}

        {/* Custom Action Buttons Row - All controls in one horizontal row */}
        <div
          className={`custom-control-bar custom-action-buttons-row ${!controlsVisible ? 'controls-hidden' : ''}`}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: controlsVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(calc(100% + 20px))',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxSizing: 'border-box',
            maxWidth: 'calc(100vw - 40px)',
            flexWrap: 'wrap',
            opacity: controlsVisible ? 1 : 0,
            pointerEvents: controlsVisible ? 'auto' : 'none',
            transition: 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)',
          }}
        >
          {/* Core Control Buttons - Mic, Camera, Screen Share, Leave */}
          <CustomControlButtons
            onLeave={() => {
              if (room) {
                room.disconnect();
                router.push('/');
              }
            }}
          />

          {/* Divider - Hidden on mobile */}
          <div className="control-divider" style={{
            width: '1px',
            height: '40px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            margin: '0 4px',
          }} />

          {/* More Button - Icon only - Moved to prominent position */}
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

          {/* Chat Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <ChatButton
              isHost={props.participantType === 'host'}
              iconOnly={true}
              disabled={!(props.roomFeatures?.enablePrivateChat ?? false)}
              showProBadge={!(props.roomFeatures?.enablePrivateChat ?? false)}
            />
          </div>

          {/* Raise Hand Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <RaiseHandButton
              isHost={props.participantType === 'host'}
              iconOnly={true}
              disabled={!(props.roomFeatures?.enableRaiseHand ?? false)}
              showProBadge={!(props.roomFeatures?.enableRaiseHand ?? false)}
            />
          </div>

          {/* Reactions Button - Icon only - Host Only */}
          {props.participantType === 'host' && (
            <div style={{ position: 'relative' }}>
              <ReactionsButton
                isHost={props.participantType === 'host'}
                iconOnly={true}
                disabled={!(props.roomFeatures?.enableReactions ?? false)}
                showProBadge={!(props.roomFeatures?.enableReactions ?? false)}
              />
            </div>
          )}

          {/* File Sharing Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <FileSharingButton
              onClick={() => props.setIsFileSharingOpen(true)}
              iconOnly={true}
              disabled={!(props.roomFeatures?.enableFileSharing ?? false)}
              showProBadge={!(props.roomFeatures?.enableFileSharing ?? false)}
            />
          </div>

          {/* Backend Recording Button - Icon only - Host Only */}
          {props.participantType === 'host' && (
            <div style={{ position: 'relative' }}>
              <BackendRecordingControl
                isHost={props.participantType === 'host'}
                roomName={props.roomName}
                isFeatureEnabled={props.canRecord ?? false}
                showProBadge={!(props.canRecord ?? false)}
                iconOnly={true}
              />
            </div>
          )}

          {/* Screen Annotation Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <ScreenAnnotationButton
              onClick={() => props.setIsScreenAnnotationEnabled(!props.isScreenAnnotationEnabled)}
              isActive={props.isScreenAnnotationEnabled}
              iconOnly={true}
              disabled={!(props.roomFeatures?.enableScreenAnnotation ?? false)}
              showProBadge={!(props.roomFeatures?.enableScreenAnnotation ?? false)}
            />
          </div>

          {/* Hide/Show Controls Toggle Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setControlsVisible(!controlsVisible)}
              className="custom-control-button"
              data-custom-button="true"
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '6px 10px',
                color: 'white',
                minWidth: '56px',
                minHeight: '48px',
                height: '48px',
                display: 'flex !important',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                touchAction: 'manipulation',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
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
              title={controlsVisible ? 'Hide Controls' : 'Show Controls'}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {controlsVisible ? (
                  // Chevron down icon (hide)
                  <polyline points="6 9 12 15 18 9" />
                ) : (
                  // Chevron up icon (show)
                  <polyline points="18 15 12 9 6 15" />
                )}
              </svg>
              <span className="custom-toggle-label" style={{
                fontSize: '10px',
                fontWeight: '600',
                textAlign: 'center',
                lineHeight: '1',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
              }}>
                {controlsVisible ? 'Hide' : 'Show'}
              </span>
            </button>
          </div>
        </div>

        {/* Floating Restore Button - Appears when controls are hidden */}
        {!controlsVisible && (
          <button
            onClick={() => setControlsVisible(true)}
            className="floating-restore-controls-button"
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 1001,
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              animation: 'fadeInScale 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Show Controls"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        )}

        {/* CSS Animations for Control Bar Hide/Show */}
        <style jsx global>{`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          /* Mobile responsive styles for floating restore button */
          @media (max-width: 768px) {
            .floating-restore-controls-button {
              bottom: 10px !important;
              right: 10px !important;
              width: 52px !important;
              height: 52px !important;
            }
          }
          
          @media (max-width: 480px) {
            .floating-restore-controls-button {
              bottom: 8px !important;
              right: 8px !important;
              width: 48px !important;
              height: 48px !important;
            }
            
            .floating-restore-controls-button svg {
              width: 20px !important;
              height: 20px !important;
            }
          }
        `}</style>

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
          isHost={props.participantType === 'host'}
          onHostToggle={(enabled) => {
            // This is called when a guest receives a host control message
            props.setIsScreenAnnotationEnabled(enabled);
          }}
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

        {/* Room Logo - Bottom left corner */}
        <RoomLogo />
      </RoomContext.Provider>
    </div>
  );
}
