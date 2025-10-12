'use client';

import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { isLocalTrack, LocalTrackPublication, Track } from 'livekit-client';

// Dynamically import track processors to avoid SSR issues
let BackgroundBlur: any, VirtualBackground: any;

// Only import track processors on the client side
if (typeof window !== 'undefined') {
  import('@livekit/track-processors').then(({ BackgroundBlur: BB, VirtualBackground: VB }) => {
    BackgroundBlur = BB;
    VirtualBackground = VB;
  });
}

// Background image - using the logo from public folder
const BACKGROUND_IMAGES = [
  { name: 'Almajd', path: '/logo.png' },
];

// Background options
type BackgroundType = 'none' | 'blur' | 'image';

export function CameraSettings() {
  const { cameraTrack, localParticipant } = useLocalParticipant();
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>('none');
  const [virtualBackgroundImagePath, setVirtualBackgroundImagePath] = React.useState<string | null>(
    null,
  );
  const [processorsLoaded, setProcessorsLoaded] = React.useState(false);

  // Check if processors are loaded
  React.useEffect(() => {
    if (BackgroundBlur && VirtualBackground) {
      setProcessorsLoaded(true);
    }
  }, []);

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  const selectBackground = (type: BackgroundType, imagePath?: string) => {
    setBackgroundType(type);
    if (type === 'image' && imagePath) {
      setVirtualBackgroundImagePath(imagePath);
    } else if (type !== 'image') {
      setVirtualBackgroundImagePath(null);
    }
  };

  React.useEffect(() => {
    if (isLocalTrack(cameraTrack?.track) && BackgroundBlur && VirtualBackground) {
      if (backgroundType === 'blur') {
        cameraTrack.track?.setProcessor(BackgroundBlur());
      } else if (backgroundType === 'image' && virtualBackgroundImagePath) {
        cameraTrack.track?.setProcessor(VirtualBackground(virtualBackgroundImagePath));
      } else {
        cameraTrack.track?.stopProcessor();
      }
    }
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {camTrackRef && (
        <VideoTrack
          style={{
            maxHeight: '280px',
            objectFit: 'contain',
            objectPosition: 'right',
            transform: 'scaleX(-1)',
          }}
          trackRef={camTrackRef}
        />
      )}

      <section className="lk-button-group">
        <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput" />
        </div>
      </section>

      {!processorsLoaded && (
        <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
          Loading background effects...
        </div>
      )}
      
      {processorsLoaded && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ marginBottom: '8px' }}>Background Effects</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => selectBackground('none')}
              className="lk-button"
              aria-pressed={backgroundType === 'none'}
              style={{
                border: backgroundType === 'none' ? '2px solid #0090ff' : '1px solid #d1d1d1',
                minWidth: '80px',
              }}
            >
              None
            </button>

            <button
              onClick={() => selectBackground('blur')}
              className="lk-button"
              aria-pressed={backgroundType === 'blur'}
              style={{
                border: backgroundType === 'blur' ? '2px solid #0090ff' : '1px solid #d1d1d1',
                minWidth: '80px',
                backgroundColor: '#f0f0f0',
                position: 'relative',
                overflow: 'hidden',
                height: '60px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#e0e0e0',
                  filter: 'blur(8px)',
                  zIndex: 0,
                }}
              />
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                Blur
              </span>
            </button>

            {BACKGROUND_IMAGES.map((image) => (
              <button
                key={image.path}
                onClick={() => selectBackground('image', image.path)}
                className="lk-button"
                aria-pressed={
                  backgroundType === 'image' && virtualBackgroundImagePath === image.path
                }
                style={{
                  backgroundImage: `url(${image.path})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  width: '80px',
                  height: '60px',
                  border:
                    backgroundType === 'image' && virtualBackgroundImagePath === image.path
                      ? '2px solid #0090ff'
                      : '1px solid #d1d1d1',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.backgroundImage = 'none';
                }}
              >
                <span
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    position: 'relative',
                    zIndex: 1,
                    display: 'block',
                    textAlign: 'center',
                  }}
                >
                  {image.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
