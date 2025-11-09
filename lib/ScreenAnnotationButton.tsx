'use client';

import React from 'react';

interface ScreenAnnotationButtonProps {
  onClick: () => void;
  isActive: boolean;
  iconOnly?: boolean;
}

export function ScreenAnnotationButton({ 
  onClick, 
  isActive,
  iconOnly = false 
}: ScreenAnnotationButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 16px',
        backgroundColor: isActive 
          ? 'rgba(102, 126, 234, 0.9)' 
          : 'rgba(0, 0, 0, 0.7)',
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
        e.currentTarget.style.backgroundColor = isActive
          ? 'rgba(102, 126, 234, 1)'
          : 'rgba(0, 0, 0, 0.85)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isActive
          ? 'rgba(102, 126, 234, 0.9)'
          : 'rgba(0, 0, 0, 0.7)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      title="Screen Annotation"
    >
      <span>🖊️</span>
      {!iconOnly && <span>Annotate</span>}
    </button>
  );
}

