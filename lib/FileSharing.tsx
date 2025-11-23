'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import toast from 'react-hot-toast';
import { RoomFile, FileUploadData, FileDeleteData } from '@/lib/types';
import styles from '@/styles/FileSharing.module.css';

interface FileSharingProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  isHost: boolean;
  onFileSelect?: (file: RoomFile) => void; // Callback for PDF viewer
}

export function FileSharing({ 
  isOpen, 
  onClose, 
  roomName,
  isHost,
  onFileSelect 
}: FileSharingProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);

  // Ensure component is mounted on client-side
  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      if (uploadRequestRef.current) {
        uploadRequestRef.current.abort();
      }
    };
  }, []);

  // Load files function
  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/room-files/${roomName}`);
      if (!response.ok) {
        throw new Error('Failed to load files');
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    }
  }, [roomName]);

  // Load files when component opens
  useEffect(() => {
    if (isOpen && roomName) {
      loadFiles();
    }
  }, [isOpen, roomName, loadFiles]);

  // Handle incoming file updates from other participants
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'file_upload') {
          const uploadData = messageData as FileUploadData;
          // Add file to list if not already present
          setFiles(prev => {
            const exists = prev.some(f => f.id === uploadData.file.id);
            if (!exists) {
              return [...prev, uploadData.file];
            }
            return prev;
          });
          
          // Show toast notification
          if (participant?.identity !== localParticipant?.identity) {
            toast.success(`${uploadData.sender} uploaded ${uploadData.file.originalName}`);
          }
        } else if (messageData.type === 'file_delete') {
          const deleteData = messageData as FileDeleteData;
          // Remove file from list
          setFiles(prev => prev.filter(f => f.id !== deleteData.fileId));
          
          // Show toast notification
          if (participant?.identity !== localParticipant?.identity) {
            toast(`${deleteData.sender} deleted a file`, { icon: '🗑️' });
          }
        }
      } catch (error) {
        console.error('Error parsing file sharing data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, localParticipant]);

  const uploadFileWithProgress = useCallback(
    (file: File, targetRoomName: string, uploaderIdentity: string) => {
      return new Promise<RoomFile>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadRequestRef.current = xhr;

        xhr.open('POST', '/api/room-files/upload');
        xhr.responseType = 'json';

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            setUploadProgress(percent);
          } else {
            setUploadProgress(null);
          }
        };

        const cleanup = () => {
          uploadRequestRef.current = null;
        };

        xhr.onload = () => {
          cleanup();
          const status = xhr.status;
          let response: any = xhr.response ?? null;

          if (!response && xhr.responseText) {
            try {
              response = JSON.parse(xhr.responseText);
            } catch {
              response = null;
            }
          }

          if (status >= 200 && status < 300 && response?.file) {
            resolve(response.file as RoomFile);
          } else {
            reject(new Error(response?.error || 'Upload failed'));
          }
        };

        xhr.onerror = () => {
          cleanup();
          reject(new Error('Network error while uploading file'));
        };

        xhr.onabort = () => {
          cleanup();
          reject(new Error('Upload aborted'));
        };

        const formData = new FormData();
        formData.append('file', file);
        formData.append('roomName', targetRoomName);
        formData.append('uploadedBy', uploaderIdentity);

        xhr.send(formData);
      });
    },
    []
  );

  const handleFileUpload = async (file: File) => {
    if (!localParticipant) {
      toast.error('Not connected to room');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFile = await uploadFileWithProgress(
        file,
        roomName,
        localParticipant.identity
      );

      // Add to local state
      setFiles(prev => [...prev, uploadedFile]);

      // Broadcast to other participants
      const uploadData: FileUploadData = {
        type: 'file_upload',
        file: uploadedFile,
        sender: localParticipant.identity,
        timestamp: Date.now(),
      };

      const encodedData = new TextEncoder().encode(JSON.stringify(uploadData));
      await room.localParticipant.publishData(encodedData, { topic: 'file-sharing' });

      toast.success(`Uploaded ${file.name}`);
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDownload = async (file: RoomFile) => {
    try {
      const response = await fetch(`/api/room-files/download/${file.id}`);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Downloaded ${file.originalName}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (file: RoomFile) => {
    if (!isHost) {
      toast.error('Only hosts can delete files');
      return;
    }

    if (!localParticipant) {
      toast.error('Not connected to room');
      return;
    }

    if (!confirm(`Delete ${file.originalName}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/room-files/delete/${file.id}?requestedBy=${localParticipant.identity}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      // Remove from local state
      setFiles(prev => prev.filter(f => f.id !== file.id));

      // Broadcast to other participants
      const deleteData: FileDeleteData = {
        type: 'file_delete',
        fileId: file.id,
        sender: localParticipant.identity,
        timestamp: Date.now(),
      };

      const encodedData = new TextEncoder().encode(JSON.stringify(deleteData));
      await room.localParticipant.publishData(encodedData, { topic: 'file-sharing' });

      toast.success(`Deleted ${file.originalName}`);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📊';
    if (fileType === 'text/plain') return '📃';
    return '📎';
  };

  if (!isOpen || !mounted) return null;

  const content = (
    <div className={styles.fileSharingOverlay}>
      <div className={styles.fileSharingPanel} dir="ltr">
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>📁 Files & Materials</h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Upload Area */}
        <div className={styles.uploadSection}>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className={styles.fileInput}
            id="file-upload-input"
            disabled={isUploading}
          />
          <label 
            htmlFor="file-upload-input"
            className={`${styles.uploadArea} ${isDragOver ? styles.uploadAreaDragOver : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className={styles.uploadingState}>
                <div className={styles.spinner}></div>
                <span>
                  {uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Uploading...'}
                </span>
                {uploadProgress !== null && (
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={styles.uploadIcon}>
                  {isDragOver ? '📤' : '📁'}
                </div>
                <div className={styles.uploadText}>
                  <strong>
                    {isDragOver ? 'Drop file here' : 'Click to upload'}
                  </strong>
                  <span>or drag and drop</span>
                </div>
                <div className={styles.uploadHint}>
                  PDF, Images, Word, PowerPoint, Text (Max 10MB)
                </div>
              </>
            )}
          </label>
        </div>

        {/* Files List */}
        <div className={styles.filesContainer}>
          {files.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No files uploaded yet</p>
              <span>Upload files to share with participants</span>
            </div>
          ) : (
            files.map((file) => (
              <div key={file.id} className={styles.fileItem}>
                <div className={styles.fileIcon}>
                  {getFileIcon(file.fileType)}
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{file.originalName}</div>
                  <div className={styles.fileMetadata}>
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{file.uploadedBy}</span>
                    <span>•</span>
                    <span>{new Date(file.uploadedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className={styles.fileActions}>
                  {file.fileType === 'application/pdf' && onFileSelect && (
                    <button
                      className={styles.actionButton}
                      onClick={() => onFileSelect(file)}
                      title="Open PDF"
                    >
                      👁️
                    </button>
                  )}
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDownload(file)}
                    title="Download"
                  >
                    ⬇️
                  </button>
                  {isHost && (
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => handleDelete(file)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

