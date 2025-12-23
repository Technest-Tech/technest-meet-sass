'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BackendRecordingDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  egressId: string;
  filename: string;
  roomName: string;
}

export function BackendRecordingDownloadModal({
  isOpen,
  onClose,
  egressId,
  filename,
  roomName,
}: BackendRecordingDownloadModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // First, check if the file is ready
      const statusResponse = await fetch(
        `/api/record/backend-status?roomName=${encodeURIComponent(roomName)}&egressId=${encodeURIComponent(egressId)}`
      );

      if (!statusResponse.ok) {
        throw new Error('Recording not ready for download');
      }

      const statusData = await statusResponse.json();
      
      console.log('[Download Modal] Status check:', {
        status: statusData.status,
        originalStatus: statusData.originalStatus,
        filename: statusData.filename,
        downloadUrl: statusData.downloadUrl,
        error: statusData.error,
        partialRecording: statusData.partialRecording,
      });
      
      // Allow download if:
      // 1. Status is 2 (completed)
      // 2. Status is 5 but has a file (aborted but partial recording available)
      // 3. Has a downloadUrl (file is ready)
      // 4. Has partialRecording flag (aborted but has file)
      // 5. Has filename even if status isn't perfect (file exists on disk)
      const canDownload = 
        statusData.status === 2 || 
        (statusData.status === 5 && statusData.filename) ||
        (statusData.downloadUrl && statusData.filename) ||
        (statusData.partialRecording && statusData.filename) ||
        (statusData.filename && statusData.filename.endsWith('.mp4')); // If filename exists, allow download
      
      if (!canDownload) {
        // Check if it's actually failed or just processing
        const isActuallyFailed = (statusData.status === 3 || statusData.status === 4) && !statusData.filename && !statusData.partialRecording;
        
        if (isActuallyFailed) {
          const errorMsg = statusData.error || 'Recording failed and no file is available.';
          throw new Error(errorMsg);
        }
        
        // If status is 1 (active) or 5 without file, it might still be processing
        // Retry up to 3 times with increasing delays
        let retryCount = 0;
        const maxRetries = 3;
        let retryData = statusData;
        
        while (retryCount < maxRetries && (retryData.status === 1 || (retryData.status === 5 && !retryData.filename))) {
          // Wait with exponential backoff: 2s, 3s, 4s
          await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 1000)));
          
          // Retry status check
          const retryResponse = await fetch(
            `/api/record/backend-status?roomName=${encodeURIComponent(roomName)}&egressId=${encodeURIComponent(egressId)}`
          );
          
          if (retryResponse.ok) {
            retryData = await retryResponse.json();
            if (retryData.status === 2 || retryData.filename || retryData.downloadUrl) {
              // Now ready, continue with download
              Object.assign(statusData, retryData);
              break;
            }
          }
          
          retryCount++;
        }
        
        // Final check after retries
        const finalCanDownload = 
          retryData.status === 2 || 
          (retryData.status === 5 && retryData.filename) ||
          (retryData.downloadUrl && retryData.filename) ||
          (retryData.partialRecording && retryData.filename) ||
          (retryData.filename && retryData.filename.endsWith('.mp4'));
        
        if (!finalCanDownload) {
          const statusMessage = retryData.status === 1 
            ? 'Recording is still in progress. Please wait for it to complete.'
            : retryData.status === 3 || retryData.status === 4
            ? retryData.error || 'Recording failed and no file is available.'
            : 'Recording is still being processed. Please wait a moment and try again.';
          throw new Error(statusMessage);
        }
        
        // Update statusData with final retry data
        Object.assign(statusData, retryData);
      }

      // Download the file - include roomName for proper server routing
      const downloadUrl = `/api/record/file?egressId=${encodeURIComponent(egressId)}&roomName=${encodeURIComponent(roomName)}`;
      
      // Use a simple approach: create a link and click it
      // This lets the browser handle the download naturally
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Give the browser time to start the download
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the download started by checking if we can fetch the file
      try {
        const verifyResponse = await fetch(downloadUrl, { method: 'HEAD' });
        if (!verifyResponse.ok && verifyResponse.status !== 200) {
          // If HEAD fails, try a full fetch to get the actual error
          const errorResponse = await fetch(downloadUrl);
          if (!errorResponse.ok) {
            const errorData = await errorResponse.json().catch(() => ({ error: 'Download failed' }));
            throw new Error(errorData.error || `Download failed with status ${errorResponse.status}`);
          }
          // If full fetch succeeds, download the blob
          const blob = await errorResponse.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const blobLink = document.createElement('a');
          blobLink.href = blobUrl;
          blobLink.download = filename;
          document.body.appendChild(blobLink);
          blobLink.click();
          window.URL.revokeObjectURL(blobUrl);
          document.body.removeChild(blobLink);
        }
      } catch (verifyError) {
        // If verification fails, the direct link approach might still work
        console.warn('Download verification failed, but direct link may have worked:', verifyError);
      }

      toast.success('Download Complete', {
        description: 'Recording has been downloaded successfully.',
        duration: 3000,
        icon: '✅',
      });

      setDownloadProgress(100);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download recording';
      toast.error('Download Failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadProgress(0), 2000);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.98), rgba(20, 20, 20, 0.98))',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '400px',
          width: '90%',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          animation: 'modalSlideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
          }}
        >
          <CheckCircle2 size={36} color="white" strokeWidth={2.5} />
        </div>

        {/* Title */}
        <h2
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
          }}
        >
          Recording Ready
        </h2>

        {/* Message */}
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Your recording is ready to download.
        </p>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: isDownloading
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.6), rgba(22, 163, 74, 0.6))'
              : 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: isDownloading ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
            }
          }}
        >
          {isDownloading ? (
            <>
              <Loader2 
                size={18} 
                style={{ 
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block'
                }} 
              />
              <span>Downloading{downloadProgress > 0 ? ` ${downloadProgress}%` : '...'}</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>Download</span>
            </>
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            padding: '8px 16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          Close
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

