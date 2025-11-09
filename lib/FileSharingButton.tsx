'use client';

import React from 'react';

interface FileSharingButtonProps {
  onClick: () => void;
  iconOnly?: boolean;
}

export function FileSharingButton({ onClick, iconOnly = false }: FileSharingButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        cursor: 'pointer',
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
      title="Files & Materials"
    >
      <span>📁</span>
      {!iconOnly && <span>Files</span>}
    </button>
  );
}

