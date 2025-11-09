'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { ReactionData, ReactionType } from './types';
import { playReactionSound } from './reactionSounds';

interface FloatingReaction {
  id: string;
  reactionType: ReactionType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
}

const ANIMATION_DURATION = 3000; // 3 seconds
const MAX_CONCURRENT_REACTIONS = 20; // Limit for performance

// Global event emitter for local reactions
const reactionEventEmitter = {
  listeners: [] as Array<(data: ReactionData) => void>,
  on: function(callback: (data: ReactionData) => void) {
    this.listeners.push(callback);
  },
  off: function(callback: (data: ReactionData) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  },
  emit: function(data: ReactionData) {
    this.listeners.forEach(callback => callback(data));
  }
};

export function FloatingReactions() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [animationTick, setAnimationTick] = useState(0);
  const animationFrameRef = useRef<number>();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Generate random position for floating animation
  const getRandomPosition = () => {
    // Start from random position in bottom 30% of screen
    const startX = Math.random() * window.innerWidth;
    const startY = window.innerHeight * 0.7 + Math.random() * (window.innerHeight * 0.3);
    
    // End at random position in top 30% of screen
    const endX = Math.random() * window.innerWidth;
    const endY = Math.random() * (window.innerHeight * 0.3);
    
    return { startX, startY, endX, endY };
  };

  // Add a new floating reaction
  const addReaction = useCallback((reactionData: ReactionData) => {
    console.log('Adding reaction:', reactionData);
    
    // Don't add if we already have too many reactions
    setReactions(prev => {
      if (prev.length >= MAX_CONCURRENT_REACTIONS) {
        console.log('Too many reactions, skipping');
        return prev;
      }
      
      const { startX, startY, endX, endY } = getRandomPosition();
      const newReaction: FloatingReaction = {
        id: reactionData.id,
        reactionType: reactionData.reactionType,
        startX,
        startY,
        endX,
        endY,
        startTime: Date.now()
      };
      
      console.log('New reaction added:', newReaction);
      return [...prev, newReaction];
    });

    // Play sound for received reactions (not for local ones, as they already played)
    if (reactionData.sender !== localParticipant?.identity) {
      playReactionSound(reactionData.reactionType);
    }
  }, [localParticipant]);

  // Listen for local reactions (from ReactionsButton)
  useEffect(() => {
    const handleLocalReaction = (reactionData: ReactionData) => {
      console.log('Local reaction received:', reactionData);
      addReaction(reactionData);
    };

    reactionEventEmitter.on(handleLocalReaction);
    
    return () => {
      reactionEventEmitter.off(handleLocalReaction);
    };
  }, [addReaction]);

  // Force re-render for smooth animation using requestAnimationFrame
  useEffect(() => {
    const tick = () => {
      setAnimationTick(prev => prev + 1);
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Remove expired reactions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setReactions(prev => 
        prev.filter(reaction => (now - reaction.startTime) < ANIMATION_DURATION)
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Listen for incoming reactions from other participants
  useEffect(() => {
    if (!room) {
      console.log('No room available for FloatingReactions');
      return;
    }

    console.log('Setting up dataReceived listener for reactions');

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        console.log('Received data in FloatingReactions:', messageData);
        
        if (messageData.type === 'reaction') {
          console.log('Reaction data received:', messageData);
          const reactionData: ReactionData = {
            type: 'reaction',
            reactionType: messageData.reactionType,
            sender: messageData.sender || participant?.identity || 'Unknown',
            timestamp: messageData.timestamp || Date.now(),
            id: messageData.id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          };
          
          addReaction(reactionData);
        }
      } catch (error) {
        console.error('Error parsing reaction data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    console.log('DataReceived listener registered');
    
    return () => {
      room.off('dataReceived', handleDataReceived);
      console.log('DataReceived listener removed');
    };
  }, [room, addReaction]);

  // Expose function to add local reactions
  useEffect(() => {
    (window as any).__addFloatingReaction = (reactionData: ReactionData) => {
      addReaction(reactionData);
    };
    
    return () => {
      delete (window as any).__addFloatingReaction;
    };
  }, [addReaction]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none', // Allow clicks to pass through
        zIndex: 10000, // Above video but below modals
        overflow: 'hidden'
      }}
    >
      {/* Use animationTick to force re-renders for smooth animation */}
      {reactions.map((reaction) => {
        // Reference animationTick to trigger re-renders
        const _ = animationTick;
        const elapsed = Date.now() - reaction.startTime;
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
        
        // Calculate current position (ease-out animation)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentX = reaction.startX + (reaction.endX - reaction.startX) * easeOut;
        const currentY = reaction.startY + (reaction.endY - reaction.startY) * easeOut;
        
        // Fade out in the last 20% of animation
        const opacity = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
        
        // Scale animation (start small, grow, then shrink)
        let scale = 0.5;
        if (progress < 0.2) {
          scale = 0.5 + (progress / 0.2) * 0.5; // Grow from 0.5 to 1.0
        } else if (progress < 0.8) {
          scale = 1.0;
        } else {
          scale = 1.0 - ((progress - 0.8) / 0.2) * 0.3; // Shrink to 0.7
        }

        return (
          <div
            key={reaction.id}
            style={{
              position: 'absolute',
              left: `${currentX}px`,
              top: `${currentY}px`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              fontSize: '64px',
              opacity,
              transition: 'none',
              userSelect: 'none',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))',
              willChange: 'transform, opacity',
              zIndex: 10001
            }}
          >
            {reaction.reactionType}
          </div>
        );
      })}
    </div>
  );
}

// Export function to trigger local reactions
export function triggerLocalReaction(reactionData: ReactionData) {
  reactionEventEmitter.emit(reactionData);
}

