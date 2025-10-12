'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Chat } from './Chat';

interface ChatButtonProps {
  isHost?: boolean;
}

export function ChatButton({ isHost = false }: ChatButtonProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
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

  // Monitor More menu state
  useEffect(() => {
    const checkMoreMenuState = () => {
      const moreDropdown = document.querySelector('.more-controls-dropdown');
      const isOpen = moreDropdown && moreDropdown.style.display !== 'none';
      setIsMoreMenuOpen(!!isOpen);
    };

    // Check initially
    checkMoreMenuState();

    // Set up observer to watch for changes
    const observer = new MutationObserver(checkMoreMenuState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setIsChatOpen(false);
      }
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
      {/* Chat Button - Hide when More menu is open */}
      {!isMoreMenuOpen && (
        <button
        className="chat-button"
        onClick={toggleChat}
        style={{
          padding: '12px 16px',
          backgroundColor: isChatOpen 
            ? 'rgba(34, 197, 94, 0.9)' 
            : 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '120px',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isChatOpen ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
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
        <span style={{ fontSize: '16px' }}>💬</span>
        Chat
        {unreadCount > 0 && !isChatOpen && (
          <span style={{
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: '600',
            marginLeft: '4px'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        </button>
      )}

      {/* Chat Component */}
      <Chat
        isOpen={isChatOpen}
        onClose={closeChat}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </div>
  );
}
