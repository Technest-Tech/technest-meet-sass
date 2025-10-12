'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import toast from 'react-hot-toast';
import styles from '@/styles/Chat.module.css';

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  isLocal: boolean;
}

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export function Chat({ isOpen, onClose, onUnreadCountChange }: ChatProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // Reset unread count when chat is opened
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
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'chat_message') {
          const chatMessage: ChatMessage = {
            id: messageData.id || Date.now().toString(),
            sender: messageData.sender || participant?.identity || 'Unknown',
            message: messageData.message,
            timestamp: messageData.timestamp || Date.now(),
            isLocal: participant?.identity === localParticipant?.identity
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
          
          // Show toast notification for all incoming messages (regardless of chat state)
          if (!chatMessage.isLocal) {
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
                  <span style={{ fontSize: '12px' }}>💬</span>
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
                  backgroundColor: '#ffffff',
                  color: '#1f2937',
                  border: '1px solid #e5e7eb',
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
  }, [room, localParticipant]);

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !room || !localParticipant) return;

    const messageData = {
      type: 'chat_message',
      id: Date.now().toString(),
      sender: localParticipant.identity,
      message: newMessage.trim(),
      timestamp: Date.now()
    };

    try {
      const encodedData = new TextEncoder().encode(JSON.stringify(messageData));
      await room.localParticipant.publishData(encodedData, { topic: 'chat' });
      
      // Add message to local state immediately for better UX
      const chatMessage: ChatMessage = {
        id: messageData.id,
        sender: messageData.sender,
        message: messageData.message,
        timestamp: messageData.timestamp,
        isLocal: true
      };
      
      setMessages(prev => [...prev, chatMessage]);
      setNewMessage('');
      
      // Show confirmation toast for sent message
      toast('Message sent', {
        duration: 2000,
        icon: '✅',
        position: 'top-right',
        style: {
          backgroundColor: '#10b981',
          color: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '12px 16px',
          fontWeight: '500',
        },
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      
      // Show error toast for failed message
      toast('Failed to send message', {
        duration: 3000,
        icon: '❌',
        position: 'top-right',
        style: {
          backgroundColor: '#ef4444',
          color: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '12px 16px',
          fontWeight: '500',
        },
      });
    }
  }, [newMessage, room, localParticipant]);

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

  if (!isOpen) return null;

  return (
    <div className={styles.chatOverlay}>
      <div className={styles.chatPanel}>
        {/* Chat Header */}
        <div className={styles.chatHeader}>
          <h3 className={styles.chatTitle}>
            💬 Chat
            {!isConnected && <span className={styles.disconnectedIndicator}> (Disconnected)</span>}
          </h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            title="Close Chat"
          >
            ✕
          </button>
        </div>

        {/* Messages Area */}
        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id} 
                className={`${styles.message} ${message.isLocal ? styles.localMessage : styles.remoteMessage}`}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.senderName}>
                    {message.isLocal ? 'You' : message.sender}
                  </span>
                  <span className={styles.timestamp}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className={styles.messageContent}>
                  {message.message}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
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
}
