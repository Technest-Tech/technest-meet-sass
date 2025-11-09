'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Chat } from './Chat';

interface ChatButtonProps {
  isHost?: boolean;
  iconOnly?: boolean;
}

export function ChatButton({ isHost = false, iconOnly = false }: ChatButtonProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  // LiveKit hooks
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Handle chat toggle
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  // Close chat when clicking outside (excluding the chat modal itself)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on chat button
      if (chatRef.current && chatRef.current.contains(target)) {
        return;
      }
      
      // Check if click is inside the chat modal (portal-rendered)
      const chatOverlay = document.querySelector('.chat-button-container + *') || 
                          target.closest('[class*="chatOverlay"]') ||
                          target.closest('[class*="chatPanel"]');
      
      if (chatOverlay) {
        return;
      }
      
      // Close if clicked outside both button and modal
      setIsChatOpen(false);
    };

    if (isChatOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatOpen]);

  return (
    <div ref={chatRef} className="chat-button-container" style={{ position: 'relative' }}>
      {/* Chat Button */}
      <button
        className="chat-button"
        onClick={toggleChat}
        style={{
          padding: iconOnly ? '12px' : '12px 16px',
          backgroundColor: isChatOpen 
            ? 'rgba(34, 197, 94, 0.9)' 
            : 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: iconOnly ? '20px' : '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: iconOnly ? '0' : '8px',
          minWidth: iconOnly ? '48px' : '120px',
          width: iconOnly ? '48px' : 'auto',
          height: iconOnly ? '48px' : 'auto',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isChatOpen ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (!isChatOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.9)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isChatOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
          }
        }}
        title="Chat"
      >
        <span style={{ fontSize: iconOnly ? '24px' : '16px' }}>💬</span>
        {!iconOnly && 'Chat'}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: iconOnly ? '4px' : '8px',
            right: iconOnly ? '4px' : '8px',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: '600',
            minWidth: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Component */}
      <Chat
        isOpen={isChatOpen}
        onClose={closeChat}
        onUnreadCountChange={handleUnreadCountChange}
        isHost={isHost}
      />
    </div>
  );
}
