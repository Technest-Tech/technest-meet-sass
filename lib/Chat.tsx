'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant, useParticipants } from '@livekit/components-react';
import toast from 'react-hot-toast';
import { Lock, Download, Users } from 'lucide-react';
import styles from '@/styles/Chat.module.css';
import { filterObservers } from './utils/observer-filter';

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

  // Get clean participant names for display
  const getCleanName = (identity: string): string => {
    return identity.replace(/_(host|guest)_\d+$/, '');
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
                  position: 'relative'
                }}
              >
                {message.isPrivate && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: message.isLocal ? 'auto' : '12px',
                    right: message.isLocal ? '12px' : 'auto',
                    backgroundColor: '#fbbf24',
                    color: '#1f2937',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    zIndex: 1,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }}>
                    <Lock size={10} />
                    Private
                  </div>
                )}
                <div className={styles.messageHeader}>
                  <span className={styles.senderName}>
                    {message.isLocal ? 'You' : getCleanName(message.sender)}
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
                  {message.message}
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
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setRecipientType('all')}
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
                  onClick={() => setRecipientType('host')}
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
            </div>
            
            {/* Participant Selector for Host */}
            {isHost && availableParticipants.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '4px'
                }}>
                  Select participant for private message:
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  {availableParticipants.map(p => {
                    const isSelected = recipientType === 'specific' && selectedRecipient === p.identity;
                    return (
                      <button
                        key={p.identity}
                        onClick={() => {
                          setRecipientType('specific');
                          setSelectedRecipient(p.identity);
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isSelected 
                            ? '2px solid #fbbf24' 
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor: isSelected
                            ? 'rgba(251, 191, 36, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: isSelected ? '600' : '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          textAlign: 'left',
                          justifyContent: 'flex-start'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                      >
                        <Lock size={12} />
                        <span>{getCleanName(p.identity)}</span>
                        {isSelected && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className={styles.inputContainer}>
          <div style={{ 
            display: 'flex', 
            gap: '10px',
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
                        : `Private to ${selectedRecipient ? getCleanName(selectedRecipient) : 'participant'}...`)
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
