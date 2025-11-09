'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant, useParticipants } from '@livekit/components-react';
import toast from 'react-hot-toast';
import { Lock, Download, Users } from 'lucide-react';
import styles from '@/styles/Chat.module.css';

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  isLocal: boolean;
  recipientType: 'all' | 'host' | 'specific';
  recipientId?: string;
  isPrivate: boolean;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure component is mounted on client-side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  // Handle room connection state
  useEffect(() => {
    if (room) {
      setIsConnected(room.state === 'connected');
      
      const handleConnectionStateChange = () => {
        setIsConnected(room.state === 'connected');
      };

      room.on('connectionStateChanged', handleConnectionStateChange);
      
      return () => {
        room.off('connectionStateChanged', handleConnectionStateChange);
      };
    }
  }, [room]);

  // Handle incoming chat messages
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

  // Save chat transcript
  const saveTranscript = useCallback(() => {
    const transcript = messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const privateLabel = msg.isPrivate ? ' [Private]' : '';
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
  }, [messages]);

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
      if (msg.isLocal) {
        return `(to ${msg.recipientId})`;
      } else {
        return '(Private)';
      }
    }
    return null;
  };

  if (!isOpen || !mounted) return null;

  const chatContent = (
    <div className={styles.chatOverlay}>
      <div className={styles.chatPanel}>
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
            onClick={onClose}
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
                    backgroundColor: message.isPrivate ? 
                      (message.isLocal ? '#fef3c7' : '#fef3c7') : 
                      undefined,
                    border: message.isPrivate ? '1px solid #fbbf24' : undefined
                  }}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.senderName}>
                      {message.isPrivate && <Lock size={12} style={{ marginRight: '4px', display: 'inline' }} />}
                    {message.isLocal ? 'You' : message.sender}
                      {recipientLabel && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#6b7280',
                          marginLeft: '4px',
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
                <div className={styles.messageContent}>
                  {message.message}
                </div>
              </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Recipient Selector */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <Users size={14} color="#6b7280" />
            <span style={{ color: '#6b7280' }}>Send to:</span>
            <select
              value={recipientType}
              onChange={(e) => {
                const value = e.target.value as 'all' | 'host' | 'specific';
                setRecipientType(value);
                if (value === 'specific' && participants.length > 0) {
                  setSelectedRecipient(participants[0].identity);
                }
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">Everyone</option>
              {!isHost && <option value="host">Host (Private)</option>}
              {isHost && participants.map(p => (
                <option key={p.identity} value="specific">{p.identity} (Private)</option>
              ))}
            </select>
            {isHost && recipientType === 'specific' && (
              <select
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                {participants.filter(p => p.identity !== localParticipant?.identity).map(p => (
                  <option key={p.identity} value={p.identity}>{p.identity}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className={styles.inputContainer}>
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            className={styles.messageInput}
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className={styles.sendButton}
            title="Send Message"
          >
            📤
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(chatContent, document.body);
}
