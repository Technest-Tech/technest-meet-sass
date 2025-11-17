'use client';

import React, { useEffect } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { useRaiseHandStore } from './store/raiseHandStore';

export function RaiseHandIndicator() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const raisedHands = useRaiseHandStore((state) => state.raisedHands);

  // Inject indicators into participant tiles using DOM manipulation
  useEffect(() => {
    const updateIndicators = () => {
      // Build lookup maps for participants
      const allParticipantIdentities = new Set<string>();
      const nameToIdentity = new Map<string, string>();
      
      if (localParticipant) {
        const localName = localParticipant.name || localParticipant.identity;
        allParticipantIdentities.add(localParticipant.identity);
        nameToIdentity.set(localName, localParticipant.identity);
      }
      participants.forEach((p) => {
        const displayName = p.name || p.identity;
        allParticipantIdentities.add(p.identity);
        nameToIdentity.set(displayName, p.identity);
      });

      // Find all participant tiles - LiveKit uses various selectors
      // Also look for video elements and their parent containers
      const participantTiles = document.querySelectorAll(
        '.lk-participant-tile, [data-lk-participant], .lk-participant, [class*="participant"], [class*="Participant"], video[data-lk-participant], .lk-grid-item, .lk-focus-layout-main > div, .lk-grid-layout > div'
      );
      
      const processedTiles = new Set<Element>();
      participantTiles.forEach((node) => {
        const tile = (node as HTMLElement).closest('.lk-participant-tile') || node;
        if (!tile || processedTiles.has(tile)) {
          return;
        }
        processedTiles.add(tile);
        
        const existingIndicator = tile.querySelector('.raise-hand-indicator');
        let participantIdentity: string | null = null;
        
        // Try multiple methods to find participant identity
        // Method 1: Check for data attributes
        participantIdentity =
          tile.getAttribute('data-participant-identity') ||
          tile.getAttribute('data-lk-participant-identity') ||
          null;
        
        // Method 2: Look for participant name in tile
        if (!participantIdentity) {
          const directNameAttr = tile.getAttribute('data-lk-participant-name');
          if (directNameAttr && nameToIdentity.has(directNameAttr)) {
            participantIdentity = nameToIdentity.get(directNameAttr) || null;
          }
        }

        if (!participantIdentity) {
          const nameAttr = (tile.querySelector('[data-lk-participant-name]') as HTMLElement | null)?.getAttribute('data-lk-participant-name');
          if (nameAttr && nameToIdentity.has(nameAttr)) {
            participantIdentity = nameToIdentity.get(nameAttr) || null;
          }

          if (!participantIdentity) {
            const nameElements = tile.querySelectorAll(
              '.lk-participant-name, [data-lk-participant-name], [class*="name"], .lk-participant-tile-info, [data-lk-name], span, div'
            );
            for (const nameEl of nameElements) {
              const text = nameEl.textContent?.trim();
              if (!text) continue;
              
              if (nameToIdentity.has(text)) {
                participantIdentity = nameToIdentity.get(text) || null;
                break;
              }
              if ((text === 'You' || text.startsWith('You')) && localParticipant) {
                participantIdentity = localParticipant.identity;
                break;
              }
              for (const identity of allParticipantIdentities) {
                if (text.includes(identity)) {
                  participantIdentity = identity;
                  break;
                }
              }
              if (participantIdentity) break;
            }
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
        } else if (existingIndicator) {
          existingIndicator.remove();
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

