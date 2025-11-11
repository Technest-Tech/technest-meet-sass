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
import { logger } from '@/lib/utils/logger';
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
  roomFeatures?: any; // Room feature flags from validation
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

  const handlePreJoinError = React.useCallback((e: any) => logger.error('PreJoin error:', e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {connectionStatus === 'error' && errorMessage ? (
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
      ) : connectionStatus === 'connecting' ? (
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
          roomFeatures={props.roomFeatures}
        />
      )}
    </main>
  );
}

// Custom Control Buttons Component
function CustomControlButtons({ onLeave }: { onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [isMicEnabled, setIsMicEnabled] = React.useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = React.useState(false);
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = React.useState(false);

  // Track participant state changes
  React.useEffect(() => {
    if (localParticipant) {
      setIsMicEnabled(localParticipant.isMicrophoneEnabled);
      setIsCameraEnabled(localParticipant.isCameraEnabled);
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
    }
  }, [localParticipant]);

  // Toggle microphone
  const toggleMicrophone = async () => {
    if (localParticipant) {
      const enabled = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!enabled);
      setIsMicEnabled(!enabled);
    }
  };

  // Toggle camera
  const toggleCamera = async () => {
    if (localParticipant) {
      const enabled = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(!enabled);
      setIsCameraEnabled(!enabled);
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (localParticipant) {
      const enabled = localParticipant.isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(!enabled);
      setIsScreenSharing(!enabled);
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

      {/* Camera Button - Color coded */}
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

      {/* Screen Share Button */}
      <div style={{ position: 'relative' }} className="group">
        <button
          onClick={toggleScreenShare}
          style={getButtonStyle(isScreenSharing, false, false)}
          onMouseEnter={(e) => {
            handleMouseEnter(e, isScreenSharing);
            setHoveredButton('screen');
          }}
          onMouseLeave={(e) => {
            handleMouseLeave(e, isScreenSharing);
            setHoveredButton(null);
          }}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
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
              logger.error('Device unsupported error:', e);
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
      // Request media permissions first (only if at least one is enabled)
      if (props.userChoices.videoEnabled || props.userChoices.audioEnabled) {
        logger.debug('Requesting media permissions...');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: props.userChoices.videoEnabled,
            audio: props.userChoices.audioEnabled
          });
          
          // Stop the stream immediately as we just needed permission
          stream.getTracks().forEach(track => track.stop());
          logger.debug('Media permissions granted');
        } catch (permissionError) {
          logger.error('Media permission denied:', permissionError);
          // Continue anyway - LiveKit will handle the case where permissions are denied
        }
      } else {
        logger.debug('Skipping media permissions request - both audio and video are disabled');
      }
      
      // Clean up any existing connection first
      if (room && room.state !== 'disconnected') {
        logger.debug('Cleaning up existing connection before reconnecting...');
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
            logger.warn('Failed to enable camera:', error);
            // Don't treat camera enable failure as a critical error
          });
        } else {
          // Ensure camera is disabled if not wanted
          room.localParticipant.setCameraEnabled(false).catch((error) => {
            logger.warn('Failed to disable camera:', error);
          });
        }
        
        if (props.userChoices.audioEnabled) {
          room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
            logger.warn('Failed to enable microphone:', error);
            // Don't treat microphone enable failure as a critical error
          });
        } else {
          // Ensure microphone is disabled if not wanted
          room.localParticipant.setMicrophoneEnabled(false).catch((error) => {
            logger.warn('Failed to disable microphone:', error);
          });
        }
      }, 1000); // 1 second delay
      
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
    logger.error('LiveKit error:', error);
    
    // Handle specific RTCPeerConnection errors
    if (error.message.includes('setRemoteDescription') || error.message.includes('addIceCandidate')) {
      logger.warn('RTCPeerConnection error - connection may be in invalid state');
      // Try to reconnect if the connection is in a bad state
      if (room && room.state !== 'disconnected') {
        logger.debug('Attempting to reconnect due to RTCPeerConnection error');
        room.disconnect();
        // Reset connection state
        setIsConnected(false);
        setReconnectAttempts(0);
      }
      return;
    }
    
    // Handle AudioContext errors (browser permission issues)
    if (error.message.includes('AudioContext') || error.message.includes('not allowed to start')) {
      logger.warn('AudioContext permission error - user needs to interact with page first');
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
      // Don't disconnect for this error, it's usually resolved automatically
      return;
    }
    
    // Don't show alert for common connection issues to avoid spam
    if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      logger.warn('Duplicate participant detected, this is normal during reconnections');
      return;
    }
    
    // Handle screen sharing permission cancellation gracefully
    if (error.message.includes('Permission denied by user') || error.message.includes('NotAllowedError')) {
      logger.debug('Screen sharing permission was denied by user - this is expected behavior');
      // Don't show alert for permission cancellation, just log it
      return;
    }
    
    // Only show alert for unexpected errors
    if (!error.message.includes('Network') && !error.message.includes('timeout')) {
      alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
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
    
    // If disconnected due to being removed by host, don't auto-reconnect
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
      logger.info('Participant was removed by host, not reconnecting');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/');
      return;
    }
    
    // If meeting was ended, don't reconnect
    if (props.meetingEnded) {
      logger.info('Meeting was ended, not reconnecting');
      router.push('/');
      return;
    }
    
    // Check if this is a user-initiated disconnect (clicking leave button)
    // CLIENT_INITIATED means user clicked the disconnect/leave button
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      logger.info('User intentionally left meeting (CLIENT_INITIATED)');
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
      logger.info('Intentional leave detected, redirecting to home...');
      props.setMeetingEnded(true); // Mark as ended to prevent reconnection
      router.push('/');
    }
  }, [router, room, handleEncryptionError, handleError, props.meetingEnded, props.setMeetingEnded]);

  // Check if room is already connected when connection details are available
  React.useEffect(() => {
    // Don't auto-connect if meeting ended or user left
    if (props.meetingEnded) {
      logger.debug('Meeting ended or user left, not auto-connecting');
      return;
    }
    
    if (props.connectionDetails && !isConnected && !isConnecting && e2eeSetupComplete) {
      // Check if room is already connected to prevent duplicates
      if (room && room.state === 'connected') {
        logger.debug('Room already connected, skipping auto-connect');
        setIsConnected(true);
        return;
      }
      
      logger.debug('Auto-connecting to meeting...');
      handleUserInteraction();
    }
  }, [props.connectionDetails, isConnected, isConnecting, e2eeSetupComplete, handleUserInteraction, room, props.meetingEnded]);

  // All hooks must be called before any conditional returns
  React.useEffect(() => {
    if (lowPowerMode) {
      logger.warn('Low power mode enabled');
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
        logger.error('Error parsing PDF viewer sync data:', error);
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
        logger.debug('Page unloading, disconnecting from room...');
        room.disconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug('Page hidden, but keeping room connection active for screen sharing...');
        // Don't disconnect when switching tabs - this allows screen sharing to continue
        // The room will only disconnect when the page is actually unloaded (beforeunload)
      } else {
        logger.debug('Page visible again');
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
        logger.debug('Component unmounting, disconnecting from room...');
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
        {props.participantType === 'host' && (
          <StudentMonitorPiP 
            key="student-monitor-pip" 
            isHost={true}
            disabled={!(props.roomFeatures?.enableStudentMonitorPiP ?? false)}
            showProBadge={!(props.roomFeatures?.enableStudentMonitorPiP ?? false)}
          />
        )}
        
        {/* Custom Action Buttons Row - All controls in one horizontal row */}
        <div className="custom-control-bar custom-action-buttons-row" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
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
          flexWrap: 'wrap'
        }}>
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
          
          {/* Reactions Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <ReactionsButton 
              isHost={props.participantType === 'host'} 
              iconOnly={true}
              disabled={!(props.roomFeatures?.enableReactions ?? false)}
              showProBadge={!(props.roomFeatures?.enableReactions ?? false)}
            />
          </div>
          
          {/* File Sharing Button - Icon only */}
          <div style={{ position: 'relative' }}>
            <FileSharingButton 
              onClick={() => props.setIsFileSharingOpen(true)} 
              iconOnly={true}
              disabled={!(props.roomFeatures?.enableFileSharing ?? false)}
              showProBadge={!(props.roomFeatures?.enableFileSharing ?? false)}
            />
          </div>
          
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
