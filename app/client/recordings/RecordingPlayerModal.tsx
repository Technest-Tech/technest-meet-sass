'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';
import Button from '@/lib/components/Button';

interface Recording {
  id: string;
  roomName: string;
  originalName: string;
  streamUrl: string;
  downloadUrl: string;
}

interface RecordingPlayerModalProps {
  recording: Recording;
  onClose: () => void;
}

export default function RecordingPlayerModal({ recording, onClose }: RecordingPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleFullscreen = async () => {
    if (!videoRef.current) return;

    try {
      if (!isFullscreen) {
        await videoRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(recording.downloadUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download recording');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = recording.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-6xl w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{recording.roomName}</h2>
            <p className="text-sm text-gray-600">{recording.originalName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download size={18} />
              تحميل
            </Button>
            <Button
              onClick={handleFullscreen}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              {isFullscreen ? 'خروج' : 'ملء الشاشة'}
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <video
            key={recording.id} // Force re-render when recording changes
            ref={videoRef}
            src={`${recording.streamUrl}?t=${Date.now()}`} // Add cache busting parameter
            controls
            className="w-full h-auto max-h-[70vh]"
            onLoadedData={() => setIsLoading(false)}
            onError={(e) => {
              console.error('Video error:', e);
              setIsLoading(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}

