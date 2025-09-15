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
        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl relative ${
          isChatOpen
            ? 'bg-green-600 text-white shadow-green-500/50'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
        }`}
        title={isChatOpen ? 'Close Chat' : 'Open Chat'}
      >
        <span className="flex items-center gap-2">
          💬 {isChatOpen ? 'Close' : 'Chat'}
          {unreadCount > 0 && !isChatOpen && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center font-bold">
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
