'use client';

import React, { useEffect, useState } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { ParticipantActions } from './ParticipantActions';
import { isObserver } from './utils/observer-filter';

interface ParticipantActionsOverlayProps {
  isHost: boolean;
  roomName: string;
}

export function ParticipantActionsOverlay({ isHost, roomName }: ParticipantActionsOverlayProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [participantElements, setParticipantElements] = useState<Map<string, DOMRect>>(new Map());

  useEffect(() => {
    if (!isHost) return;

    const updateParticipantPositions = () => {
      const newPositions = new Map<string, DOMRect>();
      
      // Find the actual video tile containers, not just name labels
      // We need to find the parent containers that have the actual video
      const selectors = [
        'div.lk-participant-tile',
        'div.lk-grid-layout > div',
        'div[data-lk-participant]',
        'div.lk-focus-layout > div'
      ];
      
      let tiles: NodeListOf<Element> | null = null;
      let usedSelector = '';
      
      for (const selector of selectors) {
        tiles = document.querySelectorAll(selector);
        if (tiles.length > 0) {
          usedSelector = selector;
          break;
        }
      }
      
      // Debug logging (first time only)
      if (tiles && tiles.length > 0 && newPositions.size === 0) {
        console.log('🎯 Found participant tiles:', tiles.length, 'using selector:', usedSelector);
      }
      
      if (!tiles || tiles.length === 0) return;
      
      tiles.forEach((tile, index) => {
        // Try to get participant name from various attributes or child elements
        let participantName = 
          tile.getAttribute('data-lk-participant-name') ||
          tile.getAttribute('data-lk-participant-identity') ||
          tile.getAttribute('data-lk-source-name');
        
        // If no attribute, look in child elements for the name
        if (!participantName) {
          const nameElement = tile.querySelector('[data-lk-participant-name], [data-lk-source-name], .lk-participant-name');
          if (nameElement) {
            participantName = nameElement.getAttribute('data-lk-participant-name') || 
                            nameElement.textContent?.trim() || '';
          }
        }
        
        // Match with actual participants from LiveKit
        if (!participantName && participants[index]) {
          participantName = participants[index].identity;
        }
        
        // Skip if no name found
        if (!participantName) return;
        
        // Check if this is the local participant's tile
        // Handle cases where DOM has "Ahmed Omar" but LiveKit has "Ahmed Omar_host_1"
        const localIdentityBase = localParticipant?.identity?.split('_')[0] || '';
        const isOwnTile = 
          participantName === localParticipant?.identity ||
          localParticipant?.identity?.startsWith(participantName + '_') ||
          participantName === localIdentityBase;
        
        console.log('🔍 Tile', index, '- Name:', participantName, 'Local:', localParticipant?.identity, 'Is own tile:', isOwnTile);
        
        if (!isOwnTile) {
          const rect = tile.getBoundingClientRect();
          // Only add if the tile is visible and has reasonable size (not just a label)
          if (rect.width > 100 && rect.height > 100) {
            console.log('✅ Adding overlay for:', participantName, 'at position:', {
              x: rect.x, y: rect.y, width: rect.width, height: rect.height
            });
            newPositions.set(participantName, rect);
          } else {
            console.log('❌ Skipping tile - too small:', rect.width, 'x', rect.height);
          }
        }
      });
      
      // DEBUG: Log LiveKit participants
      console.log('👥 LiveKit participants:', participants.map(p => p.identity));
      console.log('👤 Local participant:', localParticipant?.identity);
      
      if (newPositions.size > 0 && participantElements.size === 0) {
        console.log('✅ Mapped participant positions:', Array.from(newPositions.keys()));
      }
      
      setParticipantElements(newPositions);
    };

    // Update positions periodically
    updateParticipantPositions();
    const interval = setInterval(updateParticipantPositions, 500);

    // Update on window resize
    window.addEventListener('resize', updateParticipantPositions);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateParticipantPositions);
    };
  }, [isHost, localParticipant, participants]);

  if (!isHost) return null;

  return (
    <>
      {participants
        .filter(p => p.identity !== localParticipant?.identity && !isObserver(p))
        .map((participant) => {
          const rect = participantElements.get(participant.identity);
          if (!rect) return null;

          let audioEnabled = false;
          let videoEnabled = false;
          
          participant.audioTrackPublications.forEach((pub) => {
            if (!pub.isMuted && pub.track) audioEnabled = true;
          });
          
          participant.videoTrackPublications.forEach((pub) => {
            if (!pub.isMuted && pub.track) videoEnabled = true;
          });

          return (
            <div
              key={participant.sid}
              style={{
                position: 'fixed',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                pointerEvents: 'none',
                zIndex: 50
              }}
            >
              <div style={{ pointerEvents: 'auto' }}>
                <ParticipantActions
                  participantIdentity={participant.identity}
                  participantName={participant.identity}
                  isHost={isHost}
                  audioEnabled={audioEnabled}
                  videoEnabled={videoEnabled}
                  roomName={roomName}
                />
              </div>
            </div>
          );
        })}
    </>
  );
}

