'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRoomContext, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { RaiseHandData } from './types';
import { playRaiseHandSound } from './reactionSounds';

export function RaiseHandIndicator() {
  const [raisedHands, setRaisedHands] = useState<Map<string, boolean>>(new Map());
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  // Update raised hand state
  const updateRaisedHand = useCallback((participantIdentity: string, isRaised: boolean) => {
    setRaisedHands(prev => {
      const newMap = new Map(prev);
      if (isRaised) {
        newMap.set(participantIdentity, true);
      } else {
        newMap.delete(participantIdentity);
      }
      return newMap;
    });
  }, []);

  // Listen for incoming raise hand events from other participants
  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'raise-hand') {
          const raiseHandData: RaiseHandData = {
            type: 'raise-hand',
            sender: messageData.sender || participant?.identity || 'Unknown',
            isRaised: messageData.isRaised ?? true,
            timestamp: messageData.timestamp || Date.now(),
            id: messageData.id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          };
          
          // Play sound for received raise hand events (not for local ones, as they already played)
          if (raiseHandData.sender !== localParticipant?.identity) {
            playRaiseHandSound(raiseHandData.isRaised);
          }
          
          updateRaisedHand(raiseHandData.sender, raiseHandData.isRaised);
        }
      } catch (error) {
        console.error('Error parsing raise hand data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, updateRaisedHand]);

  // Clean up raised hands when participants disconnect
  useEffect(() => {
    const allParticipantIdentities = new Set<string>();
    
    if (localParticipant) {
      allParticipantIdentities.add(localParticipant.identity);
    }
    
    participants.forEach(p => {
      allParticipantIdentities.add(p.identity);
    });

    // Remove raised hands for participants who are no longer in the room
    setRaisedHands(prev => {
      const newMap = new Map();
      prev.forEach((isRaised, identity) => {
        if (allParticipantIdentities.has(identity)) {
          newMap.set(identity, isRaised);
        }
      });
      return newMap;
    });
  }, [participants, localParticipant]);

  // Inject indicators into participant tiles using DOM manipulation
  useEffect(() => {
    const updateIndicators = () => {
      // Get all participant identities (local + remote)
      const allParticipantIdentities = new Set<string>();
      const identityToName = new Map<string, string>();
      
      if (localParticipant) {
        allParticipantIdentities.add(localParticipant.identity);
        identityToName.set(localParticipant.identity, 'You');
      }
      participants.forEach(p => {
        allParticipantIdentities.add(p.identity);
        identityToName.set(p.identity, p.identity);
      });

      // Find all participant tiles - LiveKit uses various selectors
      // Also look for video elements and their parent containers
      const participantTiles = document.querySelectorAll(
        '.lk-participant-tile, [data-lk-participant], .lk-participant, [class*="participant"], [class*="Participant"], video[data-lk-participant], .lk-grid-item, .lk-focus-layout-main > div, .lk-grid-layout > div'
      );
      
      participantTiles.forEach((tile) => {
        const existingIndicator = tile.querySelector('.raise-hand-indicator');
        let participantIdentity: string | null = null;
        
        // Try multiple methods to find participant identity
        // Method 1: Check for data attributes
        participantIdentity = tile.getAttribute('data-participant-identity') || 
                             tile.getAttribute('data-lk-participant-identity') ||
                             null;
        
        // Method 2: Look for participant name in tile
        if (!participantIdentity) {
          const nameElements = tile.querySelectorAll(
            '.lk-participant-name, [data-lk-participant-name], [class*="name"], .lk-participant-tile-info, [data-lk-name], span, div'
          );
          for (const nameEl of nameElements) {
            const text = nameEl.textContent?.trim();
            if (!text) continue;
            
            // Check if text matches any participant identity
            if (allParticipantIdentities.has(text)) {
              participantIdentity = text;
              break;
            }
            // Also check for "You" which might be the local participant
            if ((text === 'You' || text.startsWith('You')) && localParticipant) {
              participantIdentity = localParticipant.identity;
              break;
            }
            // Check if text contains any identity
            for (const identity of allParticipantIdentities) {
              if (text.includes(identity)) {
                participantIdentity = identity;
                break;
              }
            }
            if (participantIdentity) break;
          }
        }

        // Method 3: Try to match by checking all text content in tile
        if (!participantIdentity) {
          const tileText = tile.textContent || '';
          // First check for "You" (local participant)
          if ((tileText.includes('You') || tileText.match(/\bYou\b/)) && localParticipant) {
            participantIdentity = localParticipant.identity;
          } else {
            // Then check for other participant identities
            for (const identity of allParticipantIdentities) {
              if (tileText.includes(identity)) {
                participantIdentity = identity;
                break;
              }
            }
          }
        }

        // Method 4: Try to match by video track or data attributes on video elements
        if (!participantIdentity) {
          const videoElement = tile.querySelector('video');
          if (videoElement) {
            // Check data attributes on video
            participantIdentity = videoElement.getAttribute('data-participant-identity') ||
                                 videoElement.getAttribute('data-lk-participant-identity') ||
                                 null;
            
            // If still not found, try to match by checking parent elements
            if (!participantIdentity) {
              let parent = tile.parentElement;
              let depth = 0;
              while (parent && depth < 3) {
                const parentText = parent.textContent || '';
                if (parentText.includes('You') && localParticipant) {
                  participantIdentity = localParticipant.identity;
                  break;
                }
                for (const identity of allParticipantIdentities) {
                  if (parentText.includes(identity)) {
                    participantIdentity = identity;
                    break;
                  }
                }
                if (participantIdentity) break;
                parent = parent.parentElement;
                depth++;
              }
            }
          }
        }

        // If we found the identity, store it for future reference
        if (participantIdentity) {
          tile.setAttribute('data-participant-identity', participantIdentity);
        }

        // If we still don't have identity, skip this tile
        if (!participantIdentity) {
          return;
        }

        const isRaised = raisedHands.get(participantIdentity) || false;

        if (isRaised) {
          // Add or update indicator
          if (!existingIndicator) {
            const indicator = document.createElement('div');
            indicator.className = 'raise-hand-indicator';
            indicator.setAttribute('data-participant-identity', participantIdentity);
            indicator.style.cssText = `
              position: absolute;
              top: 10px;
              right: 10px;
              z-index: 1000;
              background: linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(245, 158, 11, 0.95));
              color: white;
              padding: 8px 12px;
              border-radius: 24px;
              font-size: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(251, 191, 36, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.3);
              backdrop-filter: blur(10px);
              pointer-events: none;
              animation: raiseHandPulse 2s ease-in-out infinite;
              font-weight: bold;
            `;
            indicator.textContent = '✋';
            indicator.title = `${participantIdentity} has raised their hand`;
            
            // Add animation style if not already added
            if (!document.getElementById('raise-hand-indicator-styles')) {
              const style = document.createElement('style');
              style.id = 'raise-hand-indicator-styles';
              style.textContent = `
                @keyframes raiseHandPulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.1); opacity: 0.9; }
                }
              `;
              document.head.appendChild(style);
            }
            
            tile.appendChild(indicator);
          }
        } else {
          // Remove indicator
          if (existingIndicator) {
            existingIndicator.remove();
          }
        }
      });
    };

    // Update indicators when raised hands change or participants change
    updateIndicators();

    // Also update periodically to catch new participant tiles
    const interval = setInterval(updateIndicators, 500);

    return () => {
      clearInterval(interval);
    };
  }, [raisedHands, participants, localParticipant]);

  // Also listen for participant name changes and update tiles
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Trigger indicator update when DOM changes
      const event = new Event('participantTilesUpdated');
      window.dispatchEvent(event);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null; // This component doesn't render anything directly
}

