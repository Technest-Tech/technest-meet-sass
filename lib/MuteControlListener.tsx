'use client';

import { useEffect } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import toast from 'react-hot-toast';
import { logger } from './utils/logger';

interface MuteControlData {
  type: 'mute_command' | 'unmute_command' | 'mute_all_command';
  targetParticipant?: string;
  sender: string;
  timestamp: number;
  allowUnmute: boolean;
}

export function MuteControlListener() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleMuteControl = async (
      data: Uint8Array, 
      participant?: any, 
      kind?: any, 
      topic?: string
    ) => {
      if (topic !== 'mute-control') return;

      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(data)) as MuteControlData;

        logger.debug('Received mute control message:', message);

        // Don't process messages we sent
        if (message.sender === localParticipant.identity) {
          logger.debug('Ignoring own message');
          return;
        }

        // Check if this message is for me
        const isForMe = 
          message.type === 'mute_all_command' || 
          message.targetParticipant === localParticipant.identity;

        logger.debug('Is message for me?', { isForMe, myIdentity: localParticipant.identity });

        if (!isForMe) return;

        if (message.type === 'mute_command' || message.type === 'mute_all_command') {
          logger.debug('Muting microphone...');
          // Mute the microphone
          await localParticipant.setMicrophoneEnabled(false);
          logger.success('Microphone muted successfully');
          toast('🔇 The host muted your microphone', {
            duration: 4000,
            style: {
              background: '#ef4444',
              color: '#fff',
              fontWeight: '600',
            },
          });
        } else if (message.type === 'unmute_command') {
          logger.debug('Unmuting microphone...');
          // Unmute the microphone (only if allowed)
          if (message.allowUnmute) {
            await localParticipant.setMicrophoneEnabled(true);
            logger.success('Microphone unmuted successfully');
            toast('🎤 The host unmuted your microphone', {
              duration: 4000,
              style: {
                background: '#10b981',
                color: '#fff',
                fontWeight: '600',
              },
            });
          }
        }
      } catch (error) {
        logger.error('Error handling mute control:', error);
      }
    };

    room.on('dataReceived', handleMuteControl);

    return () => {
      room.off('dataReceived', handleMuteControl);
    };
  }, [room, localParticipant]);

  return null; // This component doesn't render anything
}

