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

// Background images - currently empty, users can upload their own
const BACKGROUND_IMAGES: Array<{ name: string; path: string }> = [];

// Background options
type BackgroundType = 'none' | 'blur' | 'image';

interface CustomBackground {
  id: string;
  name: string;
  dataUrl: string;
}

export function CameraSettings({ roomFeatures }: { roomFeatures?: { enableVirtualBackground?: boolean } }) {
  const { cameraTrack, localParticipant } = useLocalParticipant();
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>('none');
  const [virtualBackgroundImagePath, setVirtualBackgroundImagePath] = React.useState<string | null>(
    null,
  );
  const [processorsLoaded, setProcessorsLoaded] = React.useState(false);
  const [customBackgrounds, setCustomBackgrounds] = React.useState<CustomBackground[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isVirtualBackgroundEnabled = roomFeatures?.enableVirtualBackground ?? false;

  // Check if processors are loaded
  React.useEffect(() => {
    if (BackgroundBlur && VirtualBackground) {
      setProcessorsLoaded(true);
    }
  }, []);

  // Load custom backgrounds from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('custom_backgrounds');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCustomBackgrounds(parsed);
        } catch (error) {
          console.error('Error loading custom backgrounds:', error);
        }
      }
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newBg: CustomBackground = {
          id: Date.now().toString(),
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          dataUrl: dataUrl
        };
        const updated = [...customBackgrounds, newBg];
        setCustomBackgrounds(updated);
        localStorage.setItem('custom_backgrounds', JSON.stringify(updated));
        // Auto-select the newly uploaded background
        selectBackground('image', dataUrl);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteCustomBackground = (id: string) => {
    const updated = customBackgrounds.filter(bg => bg.id !== id);
    setCustomBackgrounds(updated);
    localStorage.setItem('custom_backgrounds', JSON.stringify(updated));
    // If deleted background was selected, reset to none
    const deletedBg = customBackgrounds.find(bg => bg.id === id);
    if (deletedBg && virtualBackgroundImagePath === deletedBg.dataUrl) {
      selectBackground('none');
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
    <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Background Effects
            {!isVirtualBackgroundEnabled && (
              <span style={{
                padding: '2px 6px',
                background: 'linear-gradient(to right, #a855f7, #ec4899)',
                color: 'white',
                fontSize: '10px',
                fontWeight: 'bold',
                borderRadius: '4px'
              }}>PRO</span>
            )}
          </div>
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
              onClick={() => isVirtualBackgroundEnabled && selectBackground('blur')}
              className="lk-button"
              aria-pressed={backgroundType === 'blur'}
              disabled={!isVirtualBackgroundEnabled}
              title={!isVirtualBackgroundEnabled ? 'Upgrade required for this feature' : undefined}
              style={{
                border: backgroundType === 'blur' ? '2px solid #0090ff' : '1px solid #d1d1d1',
                minWidth: '80px',
                backgroundColor: '#f0f0f0',
                position: 'relative',
                overflow: 'hidden',
                height: '60px',
                opacity: !isVirtualBackgroundEnabled ? 0.5 : 1,
                cursor: !isVirtualBackgroundEnabled ? 'not-allowed' : 'pointer',
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
                onClick={() => isVirtualBackgroundEnabled && selectBackground('image', image.path)}
                className="lk-button"
                disabled={!isVirtualBackgroundEnabled}
                title={!isVirtualBackgroundEnabled ? 'Upgrade required for this feature' : undefined}
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
                  opacity: !isVirtualBackgroundEnabled ? 0.5 : 1,
                  cursor: !isVirtualBackgroundEnabled ? 'not-allowed' : 'pointer',
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

            {/* Custom uploaded backgrounds */}
            {customBackgrounds.map((bg) => (
              <div
                key={bg.id}
                style={{
                  position: 'relative',
                  width: '80px',
                  height: '60px',
                }}
                onMouseEnter={(e) => {
                  const deleteBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                  if (deleteBtn) deleteBtn.style.display = 'flex';
                }}
                onMouseLeave={(e) => {
                  const deleteBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                  if (deleteBtn) deleteBtn.style.display = 'none';
                }}
              >
                <button
                  onClick={() => selectBackground('image', bg.dataUrl)}
                  className="lk-button"
                  aria-pressed={
                    backgroundType === 'image' && virtualBackgroundImagePath === bg.dataUrl
                  }
                  style={{
                    backgroundImage: `url(${bg.dataUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    width: '100%',
                    height: '100%',
                    border:
                      backgroundType === 'image' && virtualBackgroundImagePath === bg.dataUrl
                        ? '2px solid #0090ff'
                        : '1px solid #d1d1d1',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      position: 'absolute',
                      bottom: '2px',
                      left: '2px',
                      right: '2px',
                      zIndex: 1,
                      display: 'block',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {bg.name}
                  </span>
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCustomBackground(bg.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    padding: 0,
                  }}
                  title="Delete background"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Upload button */}
            <button
              onClick={() => isVirtualBackgroundEnabled && fileInputRef.current?.click()}
              className="lk-button"
              disabled={!isVirtualBackgroundEnabled}
              style={{
                width: '80px',
                height: '60px',
                border: '2px dashed rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: !isVirtualBackgroundEnabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: !isVirtualBackgroundEnabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (isVirtualBackgroundEnabled) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (isVirtualBackgroundEnabled) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              title={!isVirtualBackgroundEnabled ? 'Upgrade required for this feature' : 'Upload custom background'}
            >
              <span style={{ fontSize: '24px' }}>📁</span>
              <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
