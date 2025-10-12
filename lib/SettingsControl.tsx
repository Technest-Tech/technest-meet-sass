'use client';

import React, { useState } from 'react';
import { SettingsMenu } from './SettingsMenu';

interface SettingsControlProps {
  isHost: boolean;
  canRecord?: boolean;
}

export function SettingsControl({ isHost, canRecord }: SettingsControlProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleClose = () => {
    setIsSettingsOpen(false);
  };

  return (
    <>
      {/* Vid Background Control Button */}
      <button
        onClick={toggleSettings}
        data-settings-trigger="true"
        title={isSettingsOpen ? 'Close Video Background Settings' : 'Open Video Background Settings'}
        style={{
          padding: '12px 16px',
          backgroundColor: isSettingsOpen 
            ? 'rgba(59, 130, 246, 0.9)' 
            : 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          opacity: 1,
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '140px',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isSettingsOpen 
            ? 'rgba(37, 99, 235, 0.9)' 
            : 'rgba(75, 85, 99, 0.9)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isSettingsOpen 
            ? 'rgba(59, 130, 246, 0.9)' 
            : 'rgba(107, 114, 128, 0.9)';
        }}
      >
        <div style={{
          width: '8px',
          height: '8px',
          backgroundColor: 'white',
          borderRadius: '50%'
        }} />
        {isSettingsOpen ? 'Close Vid Background' : 'Vid Background'}
      </button>

      {/* Settings Menu Overlay */}
      {isSettingsOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={handleClose}
        >
          <div
            style={{
              backgroundColor: '#2d3748',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#e5e7eb',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#e5e7eb';
              }}
            >
              ×
            </button>

            {/* Settings Menu Content */}
            <SettingsMenu canRecord={canRecord} onClose={handleClose} />
          </div>
        </div>
      )}
    </>
  );
}
