'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LocalUserChoices } from '@livekit/components-react';
import styles from '../styles/PreJoin.module.css';

interface CustomPreJoinProps {
  defaults: LocalUserChoices;
  onSubmit: (values: LocalUserChoices) => void;
  onError: (error: any) => void;
}

export function CustomPreJoin({ defaults, onSubmit, onError }: CustomPreJoinProps) {
  const [formData, setFormData] = useState<LocalUserChoices>({
    username: defaults.username || '',
    videoEnabled: defaults.videoEnabled ?? true,
    audioEnabled: defaults.audioEnabled ?? true,
    videoDeviceId: defaults.videoDeviceId,
    audioDeviceId: defaults.audioDeviceId,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle video stream when camera is toggled
  useEffect(() => {
    if (formData.videoEnabled && !localStream) {
      const startVideo = async () => {
        setIsVideoLoading(true);
        try {
          console.log('Starting video stream...');
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user'
            }, 
            audio: false 
          });
          
          console.log('Video stream obtained:', stream);
          setLocalStream(stream);
          
          // Set the stream to the video element
          if (videoRef.current) {
            console.log('Setting video srcObject');
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error('Error playing video:', e));
          }
          
        } catch (error) {
          console.error('Could not start video:', error);
          setFormData(prev => ({ ...prev, videoEnabled: false }));
        } finally {
          setIsVideoLoading(false);
        }
      };
      startVideo();
    } else if (!formData.videoEnabled && localStream) {
      console.log('Stopping video stream...');
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [formData.videoEnabled, localStream]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) return;

    setIsLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      onError(error);
      setIsLoading(false);
    }
  };

  const toggleVideo = () => {
    setFormData(prev => ({ ...prev, videoEnabled: !prev.videoEnabled }));
  };

  const toggleAudio = () => {
    setFormData(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }));
  };

  return (
    <div className={styles.preJoinContainer}>
      {/* Background decorative elements */}
      <div className={styles.backgroundElements}>
        <div className={styles.islamicPattern1}></div>
        <div className={styles.islamicPattern2}></div>
        <div className={styles.islamicPattern3}></div>
        <div className={styles.floatingGeometric}></div>
        <div className={styles.floatingGeometric2}></div>
      </div>

      {/* Main content - centered form */}
      <div className={styles.contentWrapper}>
        <div className={styles.cardContainer}>
          <div className={styles.preJoinCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <span>👥</span>
              </div>
              <h2 className={styles.cardTitle}>Join Meeting</h2>
              <p className={styles.cardDescription}>
                Configure your settings and join the conference
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.preJoinForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="username" className={styles.inputLabel}>
                  Your Name
                </label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your name"
                  className={styles.nameInput}
                  required
                  autoFocus
                />
              </div>

              {/* Video Preview */}
              {formData.videoEnabled && (
                <div className={styles.videoPreview}>
                  <label className={styles.inputLabel}>Camera Preview</label>
                  <div className={styles.videoContainer}>
                    {isVideoLoading ? (
                      <div className={styles.videoLoading}>
                        <div className={styles.loadingSpinner}>
                          <span>⏳</span>
                        </div>
                        <span>Starting camera...</span>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={styles.previewVideo}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className={styles.deviceSettings}>
                <h3 className={styles.deviceSettingsTitle}>Device Settings</h3>
                
                <div className={styles.deviceToggle}>
                  <div className={styles.deviceLabel}>
                    <span className={styles.deviceIcon}>📹</span>
                    <span>Camera</span>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${formData.videoEnabled ? styles.active : ''}`}
                    onClick={toggleVideo}
                  >
                    <div className={styles.toggleHandle}></div>
                  </div>
                </div>

                <div className={styles.deviceToggle}>
                  <div className={styles.deviceLabel}>
                    <span className={styles.deviceIcon}>🎤</span>
                    <span>Microphone</span>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${formData.audioEnabled ? styles.active : ''}`}
                    onClick={toggleAudio}
                  >
                    <div className={styles.toggleHandle}></div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!formData.username.trim() || isLoading}
                className={`${styles.joinButton} ${isLoading ? styles.loading : ''}`}
              >
                {isLoading ? (
                  <span className={styles.loadingSpinner}>
                    <span>⏳</span>
                    Joining...
                  </span>
                ) : (
                  'Join Meeting'
                )}
              </button>
            </form>

            <div className={styles.cardFooter}>
              <p className={styles.footerText}>
                Secure • Private • High Quality
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
