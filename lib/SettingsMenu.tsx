'use client';
import * as React from 'react';
import { Track } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
  useIsRecording,
} from '@livekit/components-react';
import styles from '../styles/SettingsMenu.module.css';
import { CameraSettings } from './CameraSettings';
import { MicrophoneSettings } from './MicrophoneSettings';

/**
 * @alpha
 */
export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  canRecord?: boolean;
  onClose?: () => void;
}

/**
 * @alpha
 */
export function SettingsMenu(props: SettingsMenuProps) {
  // Destructure custom props to avoid passing them to DOM
  const { canRecord, onClose, ...domProps } = props;
  
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;

  // Add debugging
  React.useEffect(() => {
    console.log('SettingsMenu mounted, layoutContext:', layoutContext);
    console.log('Room:', room);
  }, [layoutContext, room]);

  const settings = React.useMemo(() => {
    return {
      media: { camera: true, microphone: true, label: 'Media Devices', speaker: true },
      recording: (recordingEndpoint && canRecord) ? { label: 'Recording' } : undefined,
    };
  }, [recordingEndpoint, canRecord]);

  const tabs = React.useMemo(
    () => Object.keys(settings).filter((t) => t !== undefined) as Array<keyof typeof settings>,
    [settings],
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]);

  const isRecording = useIsRecording();
  const [initialRecStatus, setInitialRecStatus] = React.useState(isRecording);
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);

  React.useEffect(() => {
    if (initialRecStatus !== isRecording) {
      setProcessingRecRequest(false);
    }
  }, [isRecording, initialRecStatus]);

  const toggleRoomRecording = async () => {
    if (!recordingEndpoint) {
      throw TypeError('No recording endpoint specified');
    }
    if (room.isE2EEEnabled) {
      throw Error('Recording of encrypted meetings is currently not supported');
    }
    setProcessingRecRequest(true);
    setInitialRecStatus(isRecording);
    let response: Response;
    if (isRecording) {
      response = await fetch(recordingEndpoint + `/stop?roomName=${room.name}`);
    } else {
      response = await fetch(recordingEndpoint + `/start?roomName=${room.name}`);
    }
    if (response.ok) {
      // Success
    } else {
      console.error(
        'Error handling recording request, check server logs:',
        response.status,
        response.statusText,
      );
      setProcessingRecRequest(false);
    }
  };

  return (
    <div className="settings-menu" style={{ width: '100%', position: 'relative' }} {...domProps}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '12px'
      }}>
        {tabs.map(
          (tab) =>
            settings[tab] && (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: tab === activeTab 
                    ? 'rgba(79, 195, 247, 0.2)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  color: tab === activeTab ? '#4fc3f7' : 'rgba(255, 255, 255, 0.7)',
                  border: tab === activeTab 
                    ? '1px solid #4fc3f7' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (tab !== activeTab) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tab !== activeTab) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
              >
                <span>{tab === 'media' ? '📹' : '⏺️'}</span>
                {
                  // @ts-ignore
                  settings[tab].label
                }
              </button>
            ),
        )}
      </div>
      <div className="tab-content" style={{ color: 'white' }}>
        {activeTab === 'media' && (
          <>
            {settings.media && settings.media.camera && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📹 Camera
                </h3>
                <section>
                  <CameraSettings />
                </section>
              </div>
            )}
            {settings.media && settings.media.microphone && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🎤 Microphone
                </h3>
                <section>
                  <MicrophoneSettings />
                </section>
              </div>
            )}
            {settings.media && settings.media.speaker && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔊 Speaker & Headphones
                </h3>
                <section className="lk-button-group">
                  <span className="lk-button" style={{ color: 'white' }}>Audio Output</span>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="audiooutput"></MediaDeviceMenu>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
        {activeTab === 'recording' && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⏺️ Record Meeting
            </h3>
            <section>
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '16px'
              }}>
                {isRecording
                  ? '🔴 Meeting is currently being recorded'
                  : 'No active recordings for this meeting'}
              </p>
              <button 
                disabled={processingRecRequest} 
                onClick={() => toggleRoomRecording()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isRecording ? '#ef4444' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: processingRecRequest ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  opacity: processingRecRequest ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!processingRecRequest) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {processingRecRequest ? 'Processing...' : (isRecording ? 'Stop Recording' : 'Start Recording')}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
