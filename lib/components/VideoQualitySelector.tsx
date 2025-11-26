'use client';

import React from 'react';

export type QualityOption = 'low' | 'medium' | 'high' | 'auto';

interface VideoQualitySelectorProps {
  value: QualityOption;
  onChange: (quality: QualityOption) => void;
  label: string;
  description?: string;
}

const qualityOptions: Array<{
  value: QualityOption;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Adapts based on connection (recommended)',
  },
  {
    value: 'low',
    label: 'Low',
    description: '~360p, best for slow connections (~300 kbps)',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: '~540p, balanced quality (~1.5 Mbps)',
  },
  {
    value: 'high',
    label: 'High',
    description: '~720p, best quality (~2.5 Mbps)',
  },
];

export function VideoQualitySelector({
  value,
  onChange,
  label,
  description,
}: VideoQualitySelectorProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: 'white',
        }}
      >
        {label}
      </label>
      {description && (
        <p
          style={{
            marginBottom: '12px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          {description}
        </p>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {qualityOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              padding: '12px 16px',
              backgroundColor:
                value === option.value
                  ? 'rgba(79, 195, 247, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
              border:
                value === option.value
                  ? '2px solid #4fc3f7'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              if (value !== option.value) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (value !== option.value) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: value === option.value ? '600' : '500',
                }}
              >
                {option.label}
              </span>
              {value === option.value && (
                <span style={{ fontSize: '16px' }}>✓</span>
              )}
            </div>
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
            >
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

