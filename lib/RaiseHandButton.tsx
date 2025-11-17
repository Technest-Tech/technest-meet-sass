'use client';

import React, { useState } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { RaiseHandData } from './types';
import { playRaiseHandSound } from './reactionSounds';
import { useRaiseHandStore } from './store/raiseHandStore';

interface RaiseHandButtonProps {
  isHost?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  showProBadge?: boolean;
}

export function RaiseHandButton({ 
  isHost = false, 
  iconOnly = false,
  disabled = false,
  showProBadge = false 
}: RaiseHandButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const localIdentity = localParticipant?.identity;
  const setRaisedHand = useRaiseHandStore((state) => state.setRaisedHand);
  const isRaised = useRaiseHandStore((state) =>
    localIdentity ? state.raisedHands.get(localIdentity) ?? false : false,
  );

  // Toggle raise hand state
  const toggleRaiseHand = async () => {
    if (!room || !localParticipant || !localIdentity || disabled) return;

    try {
      const newState = !isRaised;
      setRaisedHand(localIdentity, newState);

      // Play sound immediately for local feedback
      playRaiseHandSound(newState);

      const raiseHandData: RaiseHandData = {
        type: 'raise-hand',
        sender: localParticipant.identity,
        isRaised: newState,
        timestamp: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      };

      // Send to other participants
      const encodedData = new TextEncoder().encode(JSON.stringify(raiseHandData));
      await room.localParticipant.publishData(encodedData, { topic: 'raise-hand' });
    } catch (error) {
      console.error('Error toggling raise hand:', error);
      // Revert state on error
      setRaisedHand(localIdentity, isRaised);
    }
  };

  return (
    <div className="raise-hand-button-container group" style={{ position: 'relative' }}>
      {/* Raise Hand Button */}
      <button
          className="raise-hand-button"
          onClick={toggleRaiseHand}
          disabled={disabled}
          style={{
            padding: iconOnly ? '12px' : '12px 20px',
            backgroundColor: isRaised 
              ? 'rgba(251, 191, 36, 0.95)' 
              : 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            border: isRaised 
              ? '2px solid rgba(251, 191, 36, 1)' 
              : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            fontSize: iconOnly ? '20px' : '15px',
            fontWeight: '600',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: iconOnly ? '0' : '10px',
            minWidth: iconOnly ? '48px' : '140px',
            width: iconOnly ? '48px' : 'auto',
            height: iconOnly ? '48px' : 'auto',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isRaised 
              ? '0 6px 20px rgba(251, 191, 36, 0.4), 0 0 0 3px rgba(251, 191, 36, 0.1)' 
              : '0 2px 8px rgba(0, 0, 0, 0.15)',
            transform: isRaised ? 'scale(1.02)' : 'scale(1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (!isRaised) {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.95)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
            } else {
              e.currentTarget.style.transform = 'scale(1.05)';
            }
            setIsHovered(true);
          }}
          onMouseLeave={(e) => {
            if (!isRaised) {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            } else {
              e.currentTarget.style.transform = 'scale(1.02)';
            }
            setIsHovered(false);
          }}
          title={isRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <span style={{ 
            fontSize: iconOnly ? '24px' : '20px',
            display: 'inline-flex',
            alignItems: 'center',
            animation: isRaised ? 'wave 1s ease-in-out infinite' : 'none',
            transformOrigin: '70% 70%'
          }}>
            ✋
          </span>
          {!iconOnly && (
            <span style={{ letterSpacing: '0.3px' }}>
              {isRaised ? 'Hand Raised' : 'Raise Hand'}
            </span>
          )}
          {isRaised && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
          )}
          <style jsx>{`
            @keyframes wave {
              0%, 100% { transform: rotate(0deg) scale(1); }
              25% { transform: rotate(-10deg) scale(1.1); }
              75% { transform: rotate(10deg) scale(1.1); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.2); }
            }
          `}</style>
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

      {/* Tooltip on hover */}
      {iconOnly && isHovered && !disabled && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 12px',
          backgroundColor: '#1f2937',
          color: 'white',
          fontSize: '12px',
          fontWeight: '500',
          borderRadius: '6px',
          whiteSpace: 'nowrap',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}>
          {isRaised ? 'Lower Hand' : 'Raise Hand'}
        </div>
      )}

      {/* Tooltip on hover for disabled */}
      {disabled && isHovered && (
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
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          Upgrade required for this feature
        </div>
      )}
    </div>
  );
}

