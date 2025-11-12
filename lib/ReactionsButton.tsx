'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { ReactionType, ReactionData } from './types';
import { playReactionSound } from './reactionSounds';
import { triggerLocalReaction } from './FloatingReactions';

interface ReactionsButtonProps {
  isHost?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  showProBadge?: boolean;
}

const REACTIONS: ReactionType[] = ['👍', '❤️', '😂', '👏', '🎉', '😮', '🙌'];

export function ReactionsButton({ 
  isHost = false, 
  iconOnly = false,
  disabled = false,
  showProBadge = false 
}: ReactionsButtonProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // LiveKit hooks
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };

    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen]);

  // Send reaction
  const sendReaction = async (reactionType: ReactionType) => {
    if (!room || !localParticipant) return;

    try {
      const reactionData: ReactionData = {
        type: 'reaction',
        reactionType,
        sender: localParticipant.identity,
        timestamp: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      };

      // Play sound immediately for local feedback
      playReactionSound(reactionType);

      // Trigger local reaction display immediately
      triggerLocalReaction(reactionData);

      // Send to other participants
      const encodedData = new TextEncoder().encode(JSON.stringify(reactionData));
      await room.localParticipant.publishData(encodedData, { topic: 'reaction' });

      // Close picker after sending
      setIsPickerOpen(false);
    } catch (error) {
      console.error('Error sending reaction:', error);
    }
  };

  const togglePicker = () => {
    if (disabled) return;
    setIsPickerOpen(!isPickerOpen);
  };

  return (
    <div ref={pickerRef} className="reactions-button-container group" style={{ position: 'relative' }}>
      {/* Reactions Button */}
      <button
          className={`reactions-button ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={togglePicker}
          disabled={disabled}
          title={disabled ? 'This feature requires an upgrade' : undefined}
          style={{
            padding: iconOnly ? '12px' : '12px 16px',
            backgroundColor: isPickerOpen 
              ? 'rgba(251, 191, 36, 0.9)' 
              : 'rgba(107, 114, 128, 0.9)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: iconOnly ? '20px' : '14px',
            fontWeight: '500',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: iconOnly ? '0' : '8px',
            minWidth: iconOnly ? '48px' : '120px',
            width: iconOnly ? '48px' : 'auto',
            height: iconOnly ? '48px' : 'auto',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: isPickerOpen ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (!isPickerOpen) {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.9)';
            }
            setIsHovered(true);
          }}
          onMouseLeave={(e) => {
            if (!isPickerOpen) {
              e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
            }
            setIsHovered(false);
          }}
          title="Reactions"
        >
          <span style={{ fontSize: iconOnly ? '24px' : '16px' }}>😊</span>
          {!iconOnly && 'Reactions'}
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
          Reactions
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

      {/* Reaction Picker Popup */}
      {isPickerOpen && !disabled && (
        <div
          style={{
            position: 'fixed',
            bottom: '240px',
            right: '20px',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 99998,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '200px'
          }}
        >
          <div style={{
            marginBottom: '4px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Choose Reaction
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}>
            {REACTIONS.map((reaction) => (
              <button
                key={reaction}
                onClick={() => sendReaction(reaction)}
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '24px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '50px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={reaction}
              >
                {reaction}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

