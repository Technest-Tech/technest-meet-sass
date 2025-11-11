'use client';

import React from 'react';

interface FileSharingButtonProps {
  onClick: () => void;
  iconOnly?: boolean;
  disabled?: boolean;
  showProBadge?: boolean;
}

export function FileSharingButton({ 
  onClick, 
  iconOnly = false,
  disabled = false,
  showProBadge = false 
}: FileSharingButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  return (
    <div className="group" style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        disabled={disabled}
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        fontSize: iconOnly ? '20px' : '14px',
        fontWeight: '500',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
        title={disabled ? 'This feature requires an upgrade' : 'Files & Materials'}
      >
        <span>📁</span>
        {!iconOnly && <span>Files</span>}
      </button>

      {/* PRO Badge */}
      {showProBadge && (
        <span style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          padding: '2px 6px',
          background: 'linear-gradient(to right, #a855f7, #ec4899)',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          borderRadius: '4px',
          zIndex: 1
        }}>
          PRO
        </span>
      )}

      {/* Tooltip on hover for disabled */}
      {disabled && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 12px',
          backgroundColor: '#1f2937',
          color: 'white',
          fontSize: '12px',
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          zIndex: 50,
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.2s'
        }}
        className="group-hover:opacity-100">
          Upgrade required for this feature
        </div>
      )}
    </div>
  );
}

