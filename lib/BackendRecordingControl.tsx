'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext, useRemoteParticipants, useLocalParticipant } from '@livekit/components-react';
import { Circle, Square, Loader2, Video, VideoOff, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
// Download modal removed - recordings are now saved to account
import { createPortal } from 'react-dom';

interface BackendRecordingControlProps {
  isHost: boolean;
  roomName: string;
  isFeatureEnabled: boolean;
  showProBadge?: boolean;
  iconOnly?: boolean;
}

type RecordingStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'completed' | 'failed';

interface RecordingInfo {
  egressId: string;
  status: RecordingStatus;
  filename?: string;
  error?: string;
  startedAt?: number;
}

export function BackendRecordingControl({
  isHost,
  roomName,
  isFeatureEnabled,
  showProBadge = false,
  iconOnly = false,
}: BackendRecordingControlProps) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();

  const [recordingInfo, setRecordingInfo] = useState<RecordingInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // Download modal removed - recordings are now saved to account
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const recordingStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollRetryCountRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipTime, setTooltipTime] = useState(0);

  useEffect(() => {
    setMounted(true);
    
    // Check for existing active recording when component mounts
    const checkExistingRecording = async () => {
      if (!roomName) {
        // Retry if roomName not available yet
        setTimeout(checkExistingRecording, 1000);
        return;
      }
      
      try {
        console.log('[Recording Control] Checking for existing recording for room:', roomName);
        const response = await fetch(`/api/record/backend-status?roomName=${encodeURIComponent(roomName)}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[Recording Control] Existing recording status:', data);
          
          // PRIORITY: Check for ACTIVE recordings first (status 1 or 0)
          // DO NOT show download modal on mount - only show it after user explicitly stops recording
          if (data.status === 0 || data.status === 1) {
            // Only restore if we have a valid egressId
            if (!data.egressId) {
              console.warn('[Recording Control] Found active recording but no egressId, skipping restore');
              return;
            }
            
            const status: RecordingStatus = data.status === 0 ? 'starting' : 'active';
            const startedAt = data.startedAt 
              ? (typeof data.startedAt === 'string' ? new Date(data.startedAt).getTime() : data.startedAt)
              : (data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
            
            setRecordingInfo({
              egressId: data.egressId,
              status: status,
              filename: data.filename,
              startedAt: startedAt,
            });
            
            // If active, set the start time for the timer
            if (status === 'active') {
              recordingStartTimeRef.current = startedAt;
              // Calculate current recording time
              const elapsed = Math.floor((Date.now() - startedAt) / 1000);
              setRecordingTime(elapsed);
            }
            
            // No download modal to close
            
            console.log('[Recording Control] Restored ACTIVE recording state:', status, data.egressId, 'Started at:', new Date(startedAt).toISOString());
          } else if (data.status === 2 || data.status === 3 || data.status === 4) {
            // Completed/failed/aborted recordings - clear state to avoid showing as active
            console.log('[Recording Control] Found completed/failed recording, clearing state. Status:', data.status);
            setRecordingInfo(null);
          } else {
            // Don't show download modal on mount - only show it when user explicitly stops recording
            // Completed recordings from previous sessions should not auto-show the modal
            console.log('[Recording Control] Found recording with status:', data.status, '- clearing state');
            setRecordingInfo(null);
          }
        } else {
          console.log('[Recording Control] Status check failed:', response.status);
        }
      } catch (error) {
        console.error('[Recording Control] Error checking existing recording:', error);
        // Silently fail - don't show error on mount
      }
    };
    
    // Check after a short delay to ensure roomName is available
    const timeoutId = setTimeout(checkExistingRecording, 500);
    
    // Also check periodically (every 10 seconds) if we don't have recording info
    // This handles cases where the initial check failed or recording started elsewhere
    const periodicCheckInterval = setInterval(() => {
      if (!recordingInfo && roomName) {
        checkExistingRecording();
      }
    }, 10000);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(periodicCheckInterval);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, [roomName, recordingInfo]);

  // Hide loading overlay when recording becomes active
  useEffect(() => {
    if (recordingInfo?.status === 'active' && showLoadingOverlay) {
      setShowLoadingOverlay(false);
      setLoadingMessage('');
    }
  }, [recordingInfo?.status, showLoadingOverlay]);

  // Recording timer
  useEffect(() => {
    if (recordingInfo?.status === 'active' && recordingStartTimeRef.current) {
      timerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
          setRecordingTime(elapsed);
        }
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (recordingInfo?.status !== 'active') {
        setRecordingTime(0);
        recordingStartTimeRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [recordingInfo?.status]);

  // Status polling when recording is active, starting, or stopping
  useEffect(() => {
    if (recordingInfo?.status === 'active' || recordingInfo?.status === 'starting' || recordingInfo?.status === 'stopping') {
      const pollStatus = async () => {
        if (!recordingInfo?.egressId || !roomName) return;

        try {
          const response = await fetch(`/api/record/backend-status?roomName=${encodeURIComponent(roomName)}&egressId=${encodeURIComponent(recordingInfo.egressId)}`);
          
          if (!response.ok) {
            // If 404, the recording might not exist yet or was already completed
            if (response.status === 404) {
              // Check if we're in stopping state - might be completed already
              if (recordingInfo.status === 'stopping') {
                // Try to get the latest recording for the room
                const roomResponse = await fetch(`/api/record/backend-status?roomName=${encodeURIComponent(roomName)}`);
                if (roomResponse.ok) {
                  const roomData = await roomResponse.json();
                  if (roomData.status === 2 && roomData.filename) {
                    // Recording is completed - just update status (no download modal)
                    setRecordingInfo(prev => prev ? { ...prev, status: 'completed', filename: roomData.filename } : null);
                    return;
                  }
                }
              }
            }
            const errorData = await response.json().catch(() => ({ error: 'Failed to check status' }));
            throw new Error(errorData.error || 'Failed to check recording status');
          }

          const data = await response.json();
          
          // CRITICAL: If we're in 'stopping' state, don't allow status to revert back to 'active'
          // The backend might still show 'active' for a moment after stop is called
          if (recordingInfo.status === 'stopping') {
            // Only allow transitions to 'completed' or 'failed', never back to 'active' or 'starting'
            if (data.status === 2 || (data.status === 5 && data.filename)) {
              // Recording completed
              setRecordingInfo(prev => prev ? { 
                ...prev, 
                status: 'completed', 
                filename: data.filename || prev.filename 
              } : null);
              setShowLoadingOverlay(false);
              setLoadingMessage('');
              return;
            }
            // If backend still shows active/starting, ignore it - we're already stopping
            if (data.status === 1 || data.status === 0) {
              // Backend hasn't processed stop yet, but we're already stopping - don't revert
              return;
            }
            // If failed, allow transition to failed
            if (data.status === 3 || data.status === 4) {
              setRecordingInfo(prev => prev ? { 
                ...prev, 
                status: 'failed',
                error: data.error 
              } : null);
              return;
            }
            // Otherwise, keep as 'stopping' and continue polling
            return;
          }
          
          // Update status - track previous status for side effects
          let prevStatus: RecordingStatus | null = null;
          setRecordingInfo(prev => {
            if (!prev) return prev;
            prevStatus = prev.status;
            
            // Map status - be more lenient with status 5 (might be processing)
            const newStatus: RecordingStatus = 
              data.status === 0 ? 'starting' :
              data.status === 1 ? 'active' :
              data.status === 2 ? 'completed' :
              data.status === 3 || data.status === 4 ? 'failed' :
              data.status === 5 ? (data.filename ? 'completed' : 'stopping') : // Status 5 with file = completed, without = still processing
              'idle';

            return {
              ...prev,
              status: newStatus,
              error: data.error,
              filename: data.filename || prev.filename,
            };
          });
          
          // Handle side effects AFTER state update (outside setState callback)
          // Use setTimeout to ensure state update completes first
          setTimeout(() => {
            if (prevStatus === null) return;
            
            // Map status - be more lenient with status 5 (might be processing)
            const newStatus: RecordingStatus = 
              data.status === 0 ? 'starting' :
              data.status === 1 ? 'active' :
              data.status === 2 ? 'completed' :
              data.status === 3 || data.status === 4 ? 'failed' :
              data.status === 5 ? (data.filename ? 'completed' : 'stopping') : // Status 5 with file = completed, without = still processing
              'idle';

            // If completed, hide loading overlay (notification already shown in stopRecording)
            if (newStatus === 'completed' && prevStatus !== 'completed') {
              setShowLoadingOverlay(false);
              setLoadingMessage('');
              // Don't show download modal - recording is saved to account
            }
            
            // Hide loading overlay when recording becomes active (started successfully)
            if (newStatus === 'active' && prevStatus === 'starting') {
              setShowLoadingOverlay(false);
              setLoadingMessage('');
            }

            // If failed, show error (but only if it's actually failed, not just processing)
            // Suppress errors when status is 'stopping' - might still be processing
            if (newStatus === 'failed' && prevStatus !== 'failed' && prevStatus !== 'stopping') {
              // Only show error if it's a real failure (status 3 or 4), not status 5 which might be processing
              // Also check retry count - don't show error too quickly
              if ((data.status === 3 || data.status === 4) && statusPollRetryCountRef.current > 10) {
                const errorMsg = data.error || 'Recording failed';
                toast.error('Recording Failed', {
                  description: errorMsg,
                  duration: 5000,
                });
              }
            }
            
            // If status 5 without file, keep polling (it might still be processing)
            if (newStatus === 'stopping' && data.status === 5 && !data.filename) {
              // Continue polling - file might appear soon
              statusPollRetryCountRef.current++;
              // After 30 retries (60s), check if file exists on disk
              if (statusPollRetryCountRef.current > 30) {
                // File might exist even if status says failed - check via API
                // This will be handled by the next poll which checks filesystem
              }
            } else {
              // Reset retry count when status changes
              statusPollRetryCountRef.current = 0;
            }
          }, 0);
        } catch (error) {
          console.error('Status polling error:', error);
          // Don't show error toast on every poll failure, only log
          // But if we're stopping and getting errors, the recording might be completed
          if (recordingInfo.status === 'stopping') {
            // After a few failed polls, assume it might be completed and check one more time
            // This will be handled by the next poll
          }
        }
      };

      // Poll immediately, then with different intervals based on status
      pollStatus();
      // Poll every 2s when stopping (faster for processing), 3s otherwise
      const pollInterval = recordingInfo.status === 'stopping' ? 2000 : 3000;
      statusPollIntervalRef.current = setInterval(pollStatus, pollInterval);
    } else {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
    }

    return () => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, [recordingInfo?.status, recordingInfo?.egressId, roomName]);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Check if participants have active tracks (published and not muted)
  const hasActiveParticipants = useCallback(() => {
    let hasActive = false;
    let trackCount = 0;

    // Check local participant
    if (localParticipant) {
      const videoTracks = Array.from(localParticipant.videoTrackPublications.values()).filter(
        pub => pub.isEnabled && pub.track && !pub.isMuted
      );
      const audioTracks = Array.from(localParticipant.audioTrackPublications.values()).filter(
        pub => pub.isEnabled && pub.track && !pub.isMuted
      );
      
      if (videoTracks.length > 0 || audioTracks.length > 0) {
        hasActive = true;
        trackCount += videoTracks.length + audioTracks.length;
      }
    }

    // Check remote participants
    for (const participant of remoteParticipants) {
      const videoTracks = Array.from(participant.videoTrackPublications.values()).filter(
        pub => pub.isEnabled && pub.track && !pub.isMuted && pub.isSubscribed
      );
      const audioTracks = Array.from(participant.audioTrackPublications.values()).filter(
        pub => pub.isEnabled && pub.track && !pub.isMuted && pub.isSubscribed
      );
      
      if (videoTracks.length > 0 || audioTracks.length > 0) {
        hasActive = true;
        trackCount += videoTracks.length + audioTracks.length;
      }
    }

    // Return true only if we have active tracks (not just participants)
    return hasActive && trackCount > 0;
  }, [localParticipant, remoteParticipants]);

  const startRecording = useCallback(async () => {
    if (!roomName || isProcessing) return;

        // Check if participants have active tracks
        if (!hasActiveParticipants()) {
          const toastId = toast.error(
            <div 
              style={{ 
                textAlign: 'right',
                direction: 'rtl',
                lineHeight: '1.6',
                minWidth: '300px',
                maxWidth: '450px',
                cursor: 'pointer'
              }}
              onClick={() => toast.dismiss(toastId)}
            >
              <div style={{ 
                fontWeight: '600', 
                fontSize: '15px', 
                marginBottom: '10px',
                color: '#dc2626'
              }}>
                لا يمكن بدء التسجيل
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#374151',
                marginBottom: '12px'
              }}>
                لا توجد إشارات نشطة (كاميرا أو ميكروفون) في الغرفة حالياً.
              </div>
              <div style={{ 
                padding: '10px', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '6px',
                fontSize: '13px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#1e40af' }}>
                  ما يجب فعله:
                </strong>
                <ul style={{ 
                  margin: '0', 
                  paddingRight: '20px', 
                  listStyle: 'disc',
                  color: '#4b5563'
                }}>
                  <li style={{ marginBottom: '4px' }}>تأكد من وجود مشاركين في الغرفة</li>
                  <li style={{ marginBottom: '4px' }}>قم بتشغيل الكاميرا أو الميكروفون</li>
                  <li style={{ marginBottom: '4px' }}>تأكد من أن الوسائط غير مكتومة</li>
                  <li>انتظر بضع ثوانٍ ثم حاول مرة أخرى</li>
                </ul>
              </div>
            </div>,
            {
              duration: 10000,
              icon: '📹',
              style: {
                maxWidth: '500px',
                padding: '16px',
                cursor: 'pointer',
              },
            }
          );
          
          // Add click outside to dismiss functionality
          setTimeout(() => {
            const handleClickOutside = (e: MouseEvent) => {
              // Find the toast element by checking all toast containers
              const toastContainers = document.querySelectorAll('[data-sonner-toast], [role="status"], [data-hot-toast]');
              let toastElement: Element | null = null;
              
              for (const container of toastContainers) {
                if (container.textContent?.includes('لا يمكن بدء التسجيل')) {
                  toastElement = container;
                  break;
                }
              }
              
              // If clicked outside the toast, dismiss it
              if (toastElement && !toastElement.contains(e.target as Node)) {
                toast.dismiss(toastId);
                document.removeEventListener('click', handleClickOutside);
              }
            };
            // Use a small delay to ensure toast is rendered
            setTimeout(() => {
              document.addEventListener('click', handleClickOutside);
              // Clean up after toast duration or when dismissed
              setTimeout(() => {
                document.removeEventListener('click', handleClickOutside);
              }, 10000);
            }, 200);
          }, 100);
          
          return;
        }

    setIsProcessing(true);
    // Show loading overlay immediately when user clicks record
    setShowLoadingOverlay(true);
    setLoadingMessage('Starting recording...');
    
    try {
      const response = await fetch(`/api/record/start?roomName=${encodeURIComponent(roomName)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to start recording' }));
        
        // Hide loading overlay on error
        setShowLoadingOverlay(false);
        setLoadingMessage('');
        
        // Check for specific error messages
        const errorMsg = errorData.error || errorData.details || 'Failed to start recording';
        const hasNoSignalError = errorData.hasNoSignalError || false;
        const suggestion = errorData.suggestion || '';
        
        if (errorMsg.includes('already being recorded') || errorMsg.includes('already exists')) {
          toast.error('Recording Already Active', {
            description: 'A recording is already in progress for this room.',
            duration: 5000,
          });
        } else if (hasNoSignalError || errorMsg.includes('no signal') || errorMsg.includes('No signal') || errorMsg.includes('No active tracks')) {
          // Enhanced alert for no active tracks
          const details = errorData.details || 'Unable to receive participant signals.';
          
          const toastId = toast.error(
            <div 
              style={{ 
                textAlign: 'right',
                direction: 'rtl',
                lineHeight: '1.6',
                minWidth: '300px',
                maxWidth: '500px',
                cursor: 'pointer'
              }}
              onClick={() => toast.dismiss(toastId)}
            >
              <div style={{ 
                fontWeight: '600', 
                fontSize: '15px', 
                marginBottom: '10px',
                color: '#dc2626'
              }}>
                لا يمكن بدء التسجيل - لا توجد إشارات نشطة
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#374151',
                marginBottom: '12px'
              }}>
                {details}
              </div>
              {suggestion && (
                <div style={{ 
                  fontSize: '13px', 
                  color: '#4b5563',
                  marginBottom: '12px',
                  fontStyle: 'italic'
                }}>
                  {suggestion}
                </div>
              )}
              <div style={{ 
                padding: '10px', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '6px',
                fontSize: '13px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#1e40af' }}>
                  خطوات الحل:
                </strong>
                <ul style={{ 
                  margin: '0', 
                  paddingRight: '20px', 
                  listStyle: 'disc',
                  color: '#4b5563'
                }}>
                  <li style={{ marginBottom: '4px' }}>تأكد من وجود مشارك واحد على الأقل في الغرفة</li>
                  <li style={{ marginBottom: '4px' }}>قم بتشغيل الكاميرا أو الميكروفون</li>
                  <li style={{ marginBottom: '4px' }}>تأكد من أن الكاميرا/الميكروفون غير مكتوم</li>
                  <li style={{ marginBottom: '4px' }}>انتظر بضع ثوانٍ بعد تشغيل الوسائط</li>
                  <li>حاول بدء التسجيل مرة أخرى</li>
                </ul>
              </div>
            </div>,
            {
              duration: 12000,
              icon: '📹',
              style: {
                maxWidth: '550px',
                padding: '16px',
                cursor: 'pointer',
              },
            }
          );
          
          // Add click outside to dismiss functionality
          setTimeout(() => {
            const handleClickOutside = (e: MouseEvent) => {
              // Find the toast element by checking all toast containers
              const toastContainers = document.querySelectorAll('[data-sonner-toast], [role="status"], [data-hot-toast]');
              let toastElement: Element | null = null;
              
              for (const container of toastContainers) {
                if (container.textContent?.includes('لا يمكن بدء التسجيل')) {
                  toastElement = container;
                  break;
                }
              }
              
              // If clicked outside the toast, dismiss it
              if (toastElement && !toastElement.contains(e.target as Node)) {
                toast.dismiss(toastId);
                document.removeEventListener('click', handleClickOutside);
              }
            };
            // Use a small delay to ensure toast is rendered
            setTimeout(() => {
              document.addEventListener('click', handleClickOutside);
              // Clean up after toast duration or when dismissed
              setTimeout(() => {
                document.removeEventListener('click', handleClickOutside);
              }, 12000);
            }, 200);
          }, 100);
        } else if (errorMsg.includes('egress') || errorMsg.includes('Egress')) {
          toast.error('Recording Service Unavailable', {
            description: 'The recording service is not available. Please check server configuration.',
            duration: 6000,
            icon: '⚠️',
          });
        } else {
          toast.error('Failed to Start Recording', {
            description: errorMsg,
            duration: 6000,
          });
        }
        return;
      }

      const data = await response.json();
      
      setRecordingInfo({
        egressId: data.egressId,
        status: 'starting',
        filename: data.filename,
      });
      
      recordingStartTimeRef.current = Date.now();
      // Loading overlay is already shown - it will hide when status becomes 'active' (handled in status polling)

      toast.success('Recording Started', {
        description: 'Backend recording has started. All participants will be recorded.',
        duration: 3000,
        icon: '🔴',
      });
    } catch (error) {
      console.error('Start recording error:', error);
      setShowLoadingOverlay(false);
      setLoadingMessage('');
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        toast.error('Network Error', {
          description: 'Unable to connect to recording service. Please check your connection.',
          duration: 6000,
        });
      } else {
        toast.error('Recording Error', {
          description: errorMessage,
          duration: 6000,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [roomName, isProcessing, hasActiveParticipants]);

  const stopRecording = useCallback(async () => {
    if (!roomName || isProcessing) {
      console.warn('[Recording Control] Cannot stop: missing roomName or already processing');
      return;
    }
    
    // If no egressId, try to get it from status check first
    if (!recordingInfo?.egressId) {
      console.log('[Recording Control] No egressId, checking status first...');
      try {
        const statusResponse = await fetch(`/api/record/backend-status?roomName=${encodeURIComponent(roomName)}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.egressId) {
            setRecordingInfo(prev => prev ? { ...prev, egressId: statusData.egressId } : { egressId: statusData.egressId, status: 'active' });
          } else {
            // No active recording found, clear state
            setRecordingInfo(null);
            toast.error('No Active Recording', {
              description: 'No active recording found to stop.',
              duration: 3000,
            });
            return;
          }
        }
      } catch (error) {
        console.error('[Recording Control] Error checking status before stop:', error);
      }
    }
    
    if (!recordingInfo?.egressId) {
      console.warn('[Recording Control] Cannot stop: no egressId available');
      // Clear the recording state if we can't stop it
      setRecordingInfo(null);
      toast.error('Recording Error', {
        description: 'Unable to stop recording: no recording ID found.',
        duration: 3000,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/record/stop?roomName=${encodeURIComponent(roomName)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to stop recording' }));
        toast.error('Failed to Stop Recording', {
          description: errorData.error || 'Unable to stop recording',
          duration: 5000,
        });
        setIsProcessing(false);
        return;
      }

      const data = await response.json();
      
      const egressIdToCheck = data.egressId || recordingInfo?.egressId;
      const recordingId = data.recordingId;
      
      // IMMEDIATELY update recording info with stopping status - this will hide the red border
      // Set to 'stopping' first to immediately update UI, then status polling will handle completion
      setRecordingInfo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'stopping', // This immediately makes isRecording = false, hiding red border
          egressId: egressIdToCheck || prev.egressId,
          filename: data.filename || prev.filename,
        };
      });
      
      // Clear the timer immediately since we're stopping
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      recordingStartTimeRef.current = null;
      setRecordingTime(0);

      // Show loading overlay while processing
      setShowLoadingOverlay(true);
      setLoadingMessage('Saving recording to your account...');

      // Wait a moment for the recording to be saved to database, then show success notification
      setTimeout(() => {
        setShowLoadingOverlay(false);
        setLoadingMessage('');
        
        // Show modern notification with link to recordings page
        toast.success('Recording Saved', {
          description: 'Your recording has been saved to your account.',
          duration: 5000,
          icon: '✅',
          action: {
            label: 'View Recordings',
            onClick: () => {
              window.location.href = '/client/recordings';
            }
          }
        });
        
        // Mark as completed (even though it might still be uploading to R2)
        setRecordingInfo(prev => prev ? { ...prev, status: 'completed' } : null);
      }, 2000);
    } catch (error) {
      console.error('Stop recording error:', error);
      setShowLoadingOverlay(false);
      setLoadingMessage('');
      toast.error('Recording Error', {
        description: error instanceof Error ? error.message : 'Failed to stop recording',
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [roomName, recordingInfo?.egressId, isProcessing]);

  const toggleRecording = useCallback(() => {
    if (recordingInfo?.status === 'active' || recordingInfo?.status === 'starting') {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recordingInfo?.status, startRecording, stopRecording]);

  // Don't show if not host
  if (!isHost) {
    return null;
  }

  const isRecording = recordingInfo?.status === 'active' || recordingInfo?.status === 'starting';
  const isStopping = recordingInfo?.status === 'stopping';
  // Allow stopping when recording is active, but disable when stopping or if feature is disabled
  const isDisabled = !isFeatureEnabled || isProcessing || (isStopping && !isRecording);

  return (
    <>
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          // Calculate current time when hovering
          if (isRecording && recordingStartTimeRef.current) {
            const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
            setTooltipTime(elapsed);
            // Update tooltip time every second while hovering
            if (tooltipIntervalRef.current) {
              clearInterval(tooltipIntervalRef.current);
            }
            tooltipIntervalRef.current = setInterval(() => {
              if (recordingStartTimeRef.current) {
                const currentElapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
                setTooltipTime(currentElapsed);
              }
            }, 1000);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          // Clear the interval when mouse leaves
          if (tooltipIntervalRef.current) {
            clearInterval(tooltipIntervalRef.current);
            tooltipIntervalRef.current = null;
          }
        }}
      >
        <button
          onClick={toggleRecording}
          disabled={isDisabled}
          style={{
            padding: iconOnly ? '12px' : '12px 16px',
            backgroundColor: isRecording
              ? 'rgba(220, 38, 38, 0.9)'
              : 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: isRecording 
              ? '1px solid rgba(239, 68, 68, 0.5)' 
              : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.5 : 1,
            fontSize: iconOnly ? '20px' : '14px',
            fontWeight: '500',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: iconOnly ? '48px' : 'auto',
            width: iconOnly ? '48px' : 'auto',
            height: iconOnly ? '48px' : 'auto',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            position: 'relative',
            boxShadow: isRecording 
              ? '0 0 12px rgba(239, 68, 68, 0.4)' 
              : isHovered && !isDisabled
              ? '0 4px 12px rgba(0, 0, 0, 0.3)'
              : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isDisabled && !isRecording) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDisabled && !isRecording) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
          }}
        >
          {isProcessing ? (
            <Loader2 
              size={iconOnly ? 20 : 16} 
              style={{ 
                animation: 'spin 1s linear infinite',
                display: 'inline-block'
              }} 
            />
          ) : isRecording ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video 
                size={iconOnly ? 20 : 16} 
                fill="currentColor"
                style={{
                  filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.5))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
                }}
              />
            </div>
          ) : (
            <Radio 
              size={iconOnly ? 20 : 16} 
              style={{
                filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.3))',
              }}
            />
          )}
          {!iconOnly && (
            <span>
              {isRecording ? `Stop (${formatTime(recordingTime)})` : 'Backend Record'}
            </span>
          )}
          {isRecording && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                border: '2px solid rgba(0, 0, 0, 0.9)',
                animation: 'pulse 2s infinite',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              }}
            />
          )}
        </button>

        {/* Tooltip on hover */}
        {isHovered && !isDisabled && (
          <div
            style={{
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
              direction: 'ltr',
            }}
          >
            {isRecording ? (() => {
              // Calculate time dynamically - prefer tooltipTime, then recordingTime, then calculate from start time
              let displayTime = tooltipTime > 0 ? tooltipTime : recordingTime;
              if (displayTime === 0 && recordingStartTimeRef.current) {
                displayTime = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
              }
              return `إيقاف التسجيل (${formatTime(displayTime)})`;
            })() : 'بدء التسجيل'}
          </div>
        )}

        {/* Tooltip for disabled state */}
        {isHovered && isDisabled && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '8px 12px',
              backgroundColor: '#1f2937',
              color: 'white',
              fontSize: '12px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              zIndex: 9999,
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            {isStopping ? 'جاري إيقاف التسجيل...' : 'التسجيل غير متاح'}
          </div>
        )}
      </div>

      {/* PRO Badge */}
      {showProBadge && (
        <span
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            backgroundColor: '#f59e0b',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '10px',
            zIndex: 10,
          }}
        >
          PRO
        </span>
      )}

      {/* Modern Loading Popup */}
      {mounted && showLoadingOverlay && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.98), rgba(20, 20, 20, 0.98))',
              borderRadius: '16px',
              padding: '32px 40px',
              minWidth: '280px',
              maxWidth: '320px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              animation: 'popupSlideIn 0.3s ease-out',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <Loader2 
                size={32} 
                style={{ 
                  animation: 'spin 1s linear infinite',
                  color: '#3b82f6',
                }} 
              />
            </div>
            {loadingMessage && (
              <p
                style={{
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '500',
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                {loadingMessage}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Download modal removed - recordings are now saved to account */}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.95);
          }
        }
        @keyframes popupSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}

