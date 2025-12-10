'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant, useParticipants } from '@livekit/components-react';
import toast from 'react-hot-toast';
import { Lock, Download, Users, Upload, File, Image as ImageIcon } from 'lucide-react';
import styles from '@/styles/Chat.module.css';
import { filterObservers } from './utils/observer-filter';
import { ChatFileMessage } from './types';

interface ChatMessage {
  id: string;
  sender: string;
  message?: string;
  timestamp: number;
  isLocal: boolean;
  recipientType: 'all' | 'host' | 'specific';
  recipientId?: string;
  isPrivate: boolean;
  fileData?: {
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  };
}

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  isHost?: boolean;
}

export function Chat({ isOpen, onClose, onUnreadCountChange, isHost = false }: ChatProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [recipientType, setRecipientType] = useState<'all' | 'host' | 'specific'>('all');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);

  // Ensure component is mounted on client-side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Add/remove class to body when chat is open/closed to hide control bar on mobile
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    if (isOpen) {
      document.body.classList.add('chat-open');
    } else {
      document.body.classList.remove('chat-open');
    }
    
    return () => {
      document.body.classList.remove('chat-open');
    };
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when chat opens and reset unread count
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    }
  }, [isOpen, onUnreadCountChange]);

  // Handle room connection state and cleanup on disconnect
  useEffect(() => {
    if (room) {
      setIsConnected(room.state === 'connected');
      
      const handleConnectionStateChange = () => {
        setIsConnected(room.state === 'connected');
      };

      const handleDisconnected = async () => {
        // Cleanup chat files when room disconnects
        try {
          if (room.name) {
            await fetch(`/api/chat-files/${encodeURIComponent(room.name)}`, {
              method: 'DELETE',
            }).catch(err => {
              console.error('Error cleaning up chat files:', err);
            });
          }
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      };

      room.on('connectionStateChanged', handleConnectionStateChange);
      room.on('disconnected', handleDisconnected);
      
      return () => {
        room.off('connectionStateChanged', handleConnectionStateChange);
        room.off('disconnected', handleDisconnected);
        
        // Cleanup on unmount
        if (room.name) {
          fetch(`/api/chat-files/${encodeURIComponent(room.name)}`, {
            method: 'DELETE',
          }).catch(err => {
            console.error('Error cleaning up chat files on unmount:', err);
          });
        }
      };
    }
  }, [room]);

  // Handle incoming chat messages and file messages
  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'chat_message') {
          const isFromMe = participant?.identity === localParticipant?.identity;
          const recipientType = messageData.recipientType || 'all';
          const isPrivate = messageData.isPrivate || false;
          
          // Determine if this message should be shown to current user
          let shouldShow = false;
          
          if (recipientType === 'all') {
            shouldShow = true; // Public message - everyone sees it
          } else if (recipientType === 'host') {
            // Message to host - show if I'm host or I'm the sender
            shouldShow = isHost || isFromMe;
          } else if (recipientType === 'specific') {
            // Private message to specific person - show if I'm sender or recipient
            shouldShow = isFromMe || messageData.recipientId === localParticipant.identity;
          }
          
          if (!shouldShow) return; // Don't show this message to current user
          
          const chatMessage: ChatMessage = {
            id: messageData.id || Date.now().toString(),
            sender: messageData.sender || participant?.identity || 'Unknown',
            message: messageData.message,
            timestamp: messageData.timestamp || Date.now(),
            isLocal: isFromMe,
            recipientType,
            recipientId: messageData.recipientId,
            isPrivate
          };
          
          setMessages(prev => [...prev, chatMessage]);
          
          // Increment unread count for non-local messages when chat is closed
          if (!chatMessage.isLocal && !isOpen) {
            setUnreadCount(prev => {
              const newCount = prev + 1;
              onUnreadCountChange?.(newCount);
              return newCount;
            });
          }
          
          // Show toast notification for incoming messages
          if (!chatMessage.isLocal) {
            const notificationPrefix = isPrivate ? '🔒 Private' : '💬';
            toast(
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                minWidth: '250px',
                maxWidth: '350px'
              }}>
                <div style={{ 
                  fontWeight: '600', 
                  fontSize: '14px', 
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '12px' }}>{notificationPrefix}</span>
                  <span>{chatMessage.sender}</span>
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#374151',
                  lineHeight: '1.4',
                  wordBreak: 'break-word'
                }}>
                  {chatMessage.message}
                </div>
              </div>, 
              {
                duration: 4000,
                position: 'top-right',
                style: {
                  backgroundColor: isPrivate ? '#fef3c7' : '#ffffff',
                  color: '#1f2937',
                  border: isPrivate ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  padding: '12px 16px',
                  maxWidth: '400px',
                },
              }
            );
          }
        } else if (messageData.type === 'chat_file') {
          const fileMessage = messageData as ChatFileMessage;
          const isFromMe = participant?.identity === localParticipant?.identity;
          const recipientType = fileMessage.recipientType || 'all';
          const isPrivate = fileMessage.isPrivate || false;
          
          // Determine if this file message should be shown to current user
          let shouldShow = false;
          
          if (recipientType === 'all') {
            shouldShow = true;
          } else if (recipientType === 'host') {
            shouldShow = isHost || isFromMe;
          } else if (recipientType === 'specific') {
            shouldShow = isFromMe || fileMessage.recipientId === localParticipant.identity;
          }
          
          if (!shouldShow) return;
          
          const chatMessage: ChatMessage = {
            id: fileMessage.id,
            sender: fileMessage.sender || participant?.identity || 'Unknown',
            timestamp: fileMessage.timestamp,
            isLocal: isFromMe,
            recipientType,
            recipientId: fileMessage.recipientId,
            isPrivate,
            fileData: {
              fileId: fileMessage.fileId,
              fileName: fileMessage.fileName,
              fileType: fileMessage.fileType,
              fileSize: fileMessage.fileSize,
            }
          };
          
          setMessages(prev => [...prev, chatMessage]);
          
          // Increment unread count for non-local file messages when chat is closed
          if (!chatMessage.isLocal && !isOpen) {
            setUnreadCount(prev => {
              const newCount = prev + 1;
              onUnreadCountChange?.(newCount);
              return newCount;
            });
          }
          
          // Show toast notification for incoming file messages
          if (!chatMessage.isLocal) {
            const notificationPrefix = isPrivate ? '🔒 Private File' : '📎 File';
            toast(
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                minWidth: '250px',
                maxWidth: '350px'
              }}>
                <div style={{ 
                  fontWeight: '600', 
                  fontSize: '14px', 
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '12px' }}>{notificationPrefix}</span>
                  <span>{chatMessage.sender}</span>
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#374151',
                  lineHeight: '1.4',
                  wordBreak: 'break-word'
                }}>
                  {fileMessage.fileName}
                </div>
              </div>, 
              {
                duration: 4000,
                position: 'top-right',
                style: {
                  backgroundColor: isPrivate ? '#fef3c7' : '#ffffff',
                  color: '#1f2937',
                  border: isPrivate ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  padding: '12px 16px',
                  maxWidth: '400px',
                },
              }
            );
          }
        }
      } catch (error) {
        console.error('Error parsing chat message:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, localParticipant, isOpen, onUnreadCountChange, isHost]);

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !room || !localParticipant) return;

    const isPrivate = recipientType !== 'all';
    const messageData = {
      type: 'chat_message',
      id: Date.now().toString(),
      sender: localParticipant.identity,
      message: newMessage.trim(),
      timestamp: Date.now(),
      recipientType,
      recipientId: recipientType === 'specific' ? selectedRecipient : undefined,
      isPrivate
    };

    try {
      const encodedData = new TextEncoder().encode(JSON.stringify(messageData));
      await room.localParticipant.publishData(encodedData, { topic: 'chat', reliable: true });
      
      // Add message to local state immediately
      const chatMessage: ChatMessage = {
        id: messageData.id,
        sender: messageData.sender,
        message: messageData.message,
        timestamp: messageData.timestamp,
        isLocal: true,
        recipientType,
        recipientId: messageData.recipientId,
        isPrivate
      };
      
      setMessages(prev => [...prev, chatMessage]);
      setNewMessage('');
      
      toast.success(isPrivate ? 'Private message sent' : 'Message sent', {
        duration: 2000,
        icon: isPrivate ? '🔒' : '✅',
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      toast.error('Failed to send message', {
        duration: 3000,
        icon: '❌',
      });
    }
  }, [newMessage, room, localParticipant, recipientType, selectedRecipient]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!room || !localParticipant || !room.name) {
      toast.error('Not connected to room');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomName', room.name);
      formData.append('uploadedBy', localParticipant.identity);

      const xhr = new XMLHttpRequest();
      uploadRequestRef.current = xhr;

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.open('POST', '/api/chat-files/upload');
        xhr.responseType = 'json';

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          uploadRequestRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = xhr.response;
            if (response?.file) {
              resolve(response.file);
            } else {
              reject(new Error(response?.error || 'Upload failed'));
            }
          } else {
            reject(new Error(xhr.response?.error || 'Upload failed'));
          }
        };

        xhr.onerror = () => {
          uploadRequestRef.current = null;
          reject(new Error('Network error while uploading file'));
        };

        xhr.onabort = () => {
          uploadRequestRef.current = null;
          reject(new Error('Upload aborted'));
        };

        xhr.send(formData);
      });

      const uploadedFile = await uploadPromise;
      
      console.log('File uploaded successfully:', { 
        fileId: uploadedFile.id, 
        fileName: uploadedFile.originalName,
        roomName: room.name 
      });

      // Create file message
      const isPrivate = recipientType !== 'all';
      const fileMessage: ChatFileMessage = {
        type: 'chat_file',
        id: Date.now().toString(),
        sender: localParticipant.identity,
        fileId: uploadedFile.id,
        fileName: uploadedFile.originalName,
        fileType: uploadedFile.fileType,
        fileSize: uploadedFile.size,
        timestamp: Date.now(),
        recipientType,
        recipientId: recipientType === 'specific' ? selectedRecipient : undefined,
        isPrivate,
      };

      // Broadcast file message via LiveKit
      const encodedData = new TextEncoder().encode(JSON.stringify(fileMessage));
      await room.localParticipant.publishData(encodedData, { topic: 'chat', reliable: true });

      // Add to local state
      const chatMessage: ChatMessage = {
        id: fileMessage.id,
        sender: fileMessage.sender,
        timestamp: fileMessage.timestamp,
        isLocal: true,
        recipientType,
        recipientId: fileMessage.recipientId,
        isPrivate,
        fileData: {
          fileId: fileMessage.fileId,
          fileName: fileMessage.fileName,
          fileType: fileMessage.fileType,
          fileSize: fileMessage.fileSize,
        }
      };

      setMessages(prev => [...prev, chatMessage]);
      setUploadProgress(100);

      toast.success(`File uploaded: ${file.name}`, {
        duration: 2000,
        icon: '✅',
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload file', {
        duration: 3000,
        icon: '❌',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [room, localParticipant, recipientType, selectedRecipient]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // Handle file download
  const handleFileDownload = useCallback(async (fileId: string, fileName: string, roomName?: string) => {
    if (!roomName && !room?.name) {
      toast.error('Room name not available');
      return;
    }
    
    const targetRoomName = roomName || room.name;
    
    try {
      const url = `/api/chat-files/download/${fileId}?roomName=${encodeURIComponent(targetRoomName)}`;
      console.log('Downloading file:', { fileId, fileName, roomName: targetRoomName, url });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Download failed:', { status: response.status, error: errorData });
        throw new Error(errorData.error || `Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      toast.success(`Downloaded ${fileName}`, {
        duration: 2000,
        icon: '⬇️',
      });
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download file';
      toast.error(errorMessage, {
        duration: 3000,
        icon: '❌',
      });
    }
  }, [room]);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Check if file is an image
  const isImageFile = useCallback((fileType: string): boolean => {
    return fileType.startsWith('image/');
  }, []);

  // Save chat transcript
  const saveTranscript = useCallback(() => {
    const transcript = messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const privateLabel = msg.isPrivate ? ' [Private]' : '';
      if (msg.fileData) {
        return `[${time}] ${msg.sender}${privateLabel}: [File] ${msg.fileData.fileName} (${formatFileSize(msg.fileData.fileSize)})`;
      }
      return `[${time}] ${msg.sender}${privateLabel}: ${msg.message}`;
    }).join('\n');

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Chat transcript downloaded');
  }, [messages, formatFileSize]);

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get recipient label
  const getRecipientLabel = (msg: ChatMessage) => {
    if (msg.recipientType === 'all') return null;
    if (msg.recipientType === 'host') return msg.isLocal ? '(to Host)' : '(Private)';
    if (msg.recipientType === 'specific') {
      if (msg.isLocal && msg.recipientId) {
        return `(to ${getParticipantName(msg.recipientId)})`;
      } else {
        return '(Private)';
      }
    }
    return null;
  };

  // Get participant's real name from metadata or clean identity
  const getParticipantName = (identity: string): string => {
    const participant = participants.find(p => p.identity === identity);
    if (participant?.metadata) {
      try {
        const metadata = JSON.parse(participant.metadata);
        if (metadata.name) return metadata.name;
      } catch (e) {
        // If parsing fails, continue to extract from identity
      }
    }
    // If no metadata name, extract from identity
    // Pattern: name_role_roomname (e.g., "john_guest_room123" or "john_host_room123")
    const parts = identity.split('_');
    if (parts.length >= 3) {
      // The name is always the first part, before the role
      const namePart = parts[0];
      // Make sure it's not empty and not just a number
      if (namePart && namePart.trim() && isNaN(Number(namePart))) {
        // Capitalize first letter of each word
        return namePart
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    }
    // Fallback: remove role and room name suffixes
    // Remove patterns like: _host_roomname, _guest_roomname, _observer_*
    return identity
      .replace(/^(.+?)_(host|guest|observer)_.*$/, '$1')
      .replace(/^(\d+)_(host|guest|observer)_/, '')
      .trim() || identity;
  };

  // Get clean name (backward compatibility)
  const getCleanName = (identity: string): string => {
    return getParticipantName(identity);
  };

  // Get filtered participants (excluding observers and local participant)
  const availableParticipants = filterObservers(participants).filter(
    p => p.identity !== localParticipant?.identity
  );

  // Initialize selected recipient when recipient type changes to 'specific'
  useEffect(() => {
    if (isHost && recipientType === 'specific' && !selectedRecipient) {
      const filtered = filterObservers(participants).filter(
        p => p.identity !== localParticipant?.identity
      );
      if (filtered.length > 0) {
        setSelectedRecipient(filtered[0].identity);
      }
    }
  }, [isHost, recipientType, selectedRecipient, participants, localParticipant]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showParticipantDropdown && !target.closest('[data-dropdown-container]')) {
        setShowParticipantDropdown(false);
      }
    };

    if (showParticipantDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showParticipantDropdown]);

  if (!isOpen || !mounted) return null;

  const chatContent = (
    <div className={styles.chatOverlay}>
      <div className={styles.chatPanel} dir="ltr">
        {/* Chat Header */}
        <div className={styles.chatHeader}>
          <h3 className={styles.chatTitle}>
            💬 Chat
            {!isConnected && <span className={styles.disconnectedIndicator}> (Disconnected)</span>}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={saveTranscript}
              disabled={messages.length === 0}
              className={styles.iconButton}
              title="Download Chat Transcript"
              style={{ opacity: messages.length === 0 ? 0.5 : 1 }}
            >
              <Download size={18} />
            </button>
          <button 
            className={styles.closeButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            title="Close Chat"
          >
            ✕
          </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const recipientLabel = getRecipientLabel(message);
              return (
              <div 
                key={message.id} 
                className={`${styles.message} ${message.isLocal ? styles.localMessage : styles.remoteMessage}`}
                style={{
                  position: 'relative',
                  marginTop: message.isPrivate ? '20px' : '0'
                }}
              >
                {message.isPrivate && (
                  <div style={{
                    position: 'absolute',
                    top: '-16px',
                    left: message.isLocal ? 'auto' : '0',
                    right: message.isLocal ? '0' : 'auto',
                    backgroundColor: '#fbbf24',
                    color: '#1f2937',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    zIndex: 1,
                    boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)',
                    whiteSpace: 'nowrap'
                  }}>
                    <Lock size={10} />
                    Private
                  </div>
                )}
                <div className={styles.messageHeader}>
                  <span className={styles.senderName}>
                    {message.isLocal ? 'You' : getParticipantName(message.sender)}
                    {recipientLabel && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: 'rgba(255, 255, 255, 0.6)',
                        marginLeft: '6px',
                        fontWeight: 'normal'
                      }}>
                        {recipientLabel}
                      </span>
                    )}
                  </span>
                  <span className={styles.timestamp}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div 
                  className={styles.messageContent}
                  style={{
                    background: message.isPrivate 
                      ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                      : undefined,
                    color: message.isPrivate ? '#1f2937' : undefined,
                    border: message.isPrivate ? '1px solid #fbbf24' : undefined
                  }}
                >
                  {message.fileData ? (
                    <div className={styles.fileMessageContainer}>
                      {isImageFile(message.fileData.fileType) ? (
                        <div className={styles.imagePreviewContainer}>
                          {room?.name ? (
                            <img
                              src={`/api/chat-files/view/${message.fileData.fileId}?roomName=${encodeURIComponent(room.name)}`}
                              alt={message.fileData.fileName}
                              className={styles.imagePreview}
                              onError={(e) => {
                                // Hide image on error, show file info instead
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon size={32} />
                          )}
                        </div>
                      ) : (
                        <div className={styles.fileIconContainer}>
                          <File size={24} />
                        </div>
                      )}
                      <div className={styles.fileInfo}>
                        <div className={styles.fileName}>{message.fileData.fileName}</div>
                        <div className={styles.fileSize}>{formatFileSize(message.fileData.fileSize)}</div>
                      </div>
                      {room?.name && (
                        <button
                          onClick={() => handleFileDownload(message.fileData!.fileId, message.fileData!.fileName, room.name)}
                          className={styles.downloadButton}
                          title="Download file"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    message.message
                  )}
                </div>
              </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Recipient Selector */}
        <div 
          className="recipient-selector-container"
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0
          }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '4px'
            }}>
              <Users size={16} color="rgba(255, 255, 255, 0.8)" />
              <span style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '13px',
                fontWeight: '500'
              }}>
                Send message to:
              </span>
            </div>
            
            {/* Recipient Type Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <button
                onClick={() => {
                  setRecipientType('all');
                  setShowParticipantDropdown(false);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: recipientType === 'all' 
                    ? '2px solid #4fc3f7' 
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: recipientType === 'all'
                    ? 'rgba(79, 195, 247, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: recipientType === 'all' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  if (recipientType !== 'all') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (recipientType !== 'all') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
              >
                <span>🌐</span>
                Everyone
              </button>
              
              {!isHost && (
                <button
                  onClick={() => {
                    setRecipientType('host');
                    setShowParticipantDropdown(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: recipientType === 'host' 
                      ? '2px solid #fbbf24' 
                      : '1px solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: recipientType === 'host'
                      ? 'rgba(251, 191, 36, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: recipientType === 'host' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (recipientType !== 'host') {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (recipientType !== 'host') {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }
                  }}
                >
                  <Lock size={14} />
                  Host (Private)
                </button>
              )}

              {/* Participant Dropdown for Host */}
              {isHost && availableParticipants.length > 0 && (
                <div style={{ position: 'relative', display: 'inline-block' }} data-dropdown-container>
                  <button
                    onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: recipientType === 'specific' 
                        ? '2px solid #fbbf24' 
                        : '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: recipientType === 'specific'
                        ? 'rgba(251, 191, 36, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: recipientType === 'specific' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      minWidth: '150px',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => {
                      if (recipientType !== 'specific') {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (recipientType !== 'specific') {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }
                    }}
                  >
                    <Lock size={14} />
                    <span>
                      {selectedRecipient 
                        ? getParticipantName(selectedRecipient) 
                        : 'Select Participant'}
                    </span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                  </button>

                  {showParticipantDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      backgroundColor: 'rgba(26, 26, 46, 0.98)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      padding: '8px',
                      minWidth: '200px',
                      maxWidth: '300px',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {availableParticipants.map(p => {
                        const isSelected = recipientType === 'specific' && selectedRecipient === p.identity;
                        const participantName = getParticipantName(p.identity);
                        
                        return (
                          <button
                            key={p.identity}
                            onClick={() => {
                              setRecipientType('specific');
                              setSelectedRecipient(p.identity);
                              setShowParticipantDropdown(false);
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isSelected
                                ? 'rgba(251, 191, 36, 0.3)'
                                : 'rgba(255, 255, 255, 0.05)',
                              color: 'white',
                              fontSize: '13px',
                              fontWeight: isSelected ? '600' : '400',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              textAlign: 'left',
                              justifyContent: 'flex-start',
                              width: '100%'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                              }
                            }}
                          >
                            {isSelected && <span style={{ fontSize: '12px' }}>✓</span>}
                            <span style={{ flex: 1 }}>{participantName}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className={styles.inputContainer}>
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              alignItems: 'center',
              width: '100%',
              flex: '1 1 100%'
            }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                className={styles.fileInput}
                id="chat-file-input"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/zip"
                disabled={!isConnected || isUploading}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="chat-file-input"
                className={styles.fileUploadButton}
                title="Upload file or image"
                style={{
                  opacity: (!isConnected || isUploading) ? 0.5 : 1,
                  cursor: (!isConnected || isUploading) ? 'not-allowed' : 'pointer',
                }}
              >
                {isUploading ? (
                  <div className={styles.uploadProgress}>
                    <div className={styles.uploadSpinner}></div>
                    {uploadProgress !== null && (
                      <span className={styles.uploadProgressText}>{uploadProgress}%</span>
                    )}
                  </div>
                ) : (
                  <Upload size={18} />
                )}
              </label>
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  isConnected 
                    ? (recipientType === 'all' 
                        ? "Type a message..." 
                        : recipientType === 'host'
                        ? "Private to host..."
                        : `Private to ${selectedRecipient ? getParticipantName(selectedRecipient) : 'participant'}...`)
                    : "Connecting..."
                }
                disabled={!isConnected}
                className={styles.messageInput}
                maxLength={500}
                style={{ flex: 1, minWidth: 0 }}
              />
              {recipientType !== 'all' && (
                <div className="mobile-private-indicator" style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#fbbf24',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  <Lock size={12} />
                  <span className="mobile-private-text">Private</span>
                </div>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className={styles.sendButton}
              title={recipientType === 'all' ? "Send Message" : "Send Private Message"}
              style={{
                minWidth: '50px',
                width: '50px',
                height: '45px',
                borderRadius: '50%',
                padding: 0
              }}
            >
              📤
            </button>
          </div>
          {newMessage.length > 0 && (
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.5)',
              textAlign: 'right',
              marginTop: '4px'
            }}>
              {newMessage.length}/500
            </div>
          )}
        </div>
        <style jsx global>{`
          /* Mobile-specific styles for chat input */
          @media (max-width: 768px) {
            .mobile-private-indicator {
              padding: 6px 8px !important;
            }
            
            .mobile-private-text {
              display: none;
            }
            
            .inputContainer {
              flex-direction: column !important;
            }
            
            .inputContainer > div:first-child {
              flex-direction: column !important;
              gap: 8px !important;
            }
            
            .inputContainer > div:first-child > div:first-child {
              width: 100% !important;
            }
            
            .sendButton {
              width: 100% !important;
              border-radius: 24px !important;
              height: 48px !important;
            }
          }
          
          @media (max-width: 480px) {
            .mobile-private-indicator {
              padding: 5px 6px !important;
            }
            
            .inputContainer > div:first-child {
              gap: 6px !important;
            }
          }
        `}</style>
      </div>
    </div>
  );

  return createPortal(chatContent, document.body);
}
