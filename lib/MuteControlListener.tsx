'use client';

import { useEffect } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import toast from 'react-hot-toast';

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

        console.log('📩 Received mute control message:', message);

        // Don't process messages we sent
        if (message.sender === localParticipant.identity) {
          console.log('⏭️ Ignoring own message');
          return;
        }

        // Check if this message is for me
        const isForMe = 
          message.type === 'mute_all_command' || 
          message.targetParticipant === localParticipant.identity;

        console.log('🎯 Is message for me?', isForMe, 'My identity:', localParticipant.identity);

        if (!isForMe) return;

        if (message.type === 'mute_command' || message.type === 'mute_all_command') {
          console.log('🔇 Muting microphone...');
          // Mute the microphone
          await localParticipant.setMicrophoneEnabled(false);
          console.log('✅ Microphone muted successfully');
          toast('🔇 The host muted your microphone', {
            duration: 4000,
            style: {
              background: '#ef4444',
              color: '#fff',
              fontWeight: '600',
            },
          });
        } else if (message.type === 'unmute_command') {
          console.log('🎤 Unmuting microphone...');
          // Unmute the microphone (only if allowed)
          if (message.allowUnmute) {
            await localParticipant.setMicrophoneEnabled(true);
            console.log('✅ Microphone unmuted successfully');
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
        console.error('Error handling mute control:', error);
      }
    };

    room.on('dataReceived', handleMuteControl);

    return () => {
      room.off('dataReceived', handleMuteControl);
    };
  }, [room, localParticipant]);

  return null; // This component doesn't render anything
}

