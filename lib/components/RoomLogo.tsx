'use client';

import React from 'react';

/**
 * RoomLogo Component
 * Displays the Academiq-meet logo in the meeting room
 * Positioned at bottom-left to avoid conflicts with other UI elements
 */
export function RoomLogo() {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 40px)',
          boxSizing: 'border-box',
        }}
        className="room-logo"
      >
        <img
          src="/academiq-meet-logo.png"
          alt="Academiq-meet Logo"
          style={{
            maxWidth: '120px',
            maxHeight: '40px',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
      <style jsx global>{`
        .room-logo:hover {
          background-color: rgba(0, 0, 0, 0.7) !important;
          transform: translateY(-2px);
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .room-logo {
            bottom: 80px !important; /* Above mobile control bar */
            left: 10px !important;
            padding: 6px 10px !important;
            max-width: calc(100vw - 20px) !important;
          }
          
          .room-logo img {
            max-width: 100px !important;
            max-height: 32px !important;
          }
        }
        
        @media (max-width: 480px) {
          .room-logo {
            bottom: 70px !important;
            left: 8px !important;
            padding: 5px 8px !important;
          }
          
          .room-logo img {
            max-width: 80px !important;
            max-height: 28px !important;
          }
        }
        
        /* Hide on very small screens if needed */
        @media (max-width: 360px) {
          .room-logo img {
            max-width: 70px !important;
            max-height: 24px !important;
          }
        }
        
        /* Ensure logo doesn't overlap with control bar on desktop */
        @media (min-width: 769px) {
          .room-logo {
            bottom: 20px !important;
          }
        }
      `}</style>
    </>
  );
}

