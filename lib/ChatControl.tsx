'use client';

import React, { useState } from 'react';
import { Chat } from './Chat';

interface ChatControlProps {
  isHost?: boolean;
}

export function ChatControl({ isHost = false }: ChatControlProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  return (
    <>
      {/* Chat Control Button */}
      <button
        onClick={toggleChat}
        className={`mobile-chat-button ${isChatOpen ? 'active' : ''}`}
        data-chat-trigger="true"
        title={isChatOpen ? 'Close Chat' : 'Open Chat'}
      >
        <span className="mobile-button-content">
          <span className="mobile-button-icon">💬</span>
          <span className="mobile-button-label">Chat</span>
          {unreadCount > 0 && !isChatOpen && (
            <span className="mobile-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </button>

      {/* Chat Component */}
      <Chat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </>
  );
}
