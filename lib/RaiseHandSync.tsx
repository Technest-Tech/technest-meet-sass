'use client';

import { useEffect } from 'react';
import {
  useRoomContext,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { RaiseHandData } from './types';
import { playRaiseHandSound } from './reactionSounds';
import { useRaiseHandStore } from './store/raiseHandStore';
import { isObserver } from './utils/observer-filter';

export function RaiseHandSync() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const setRaisedHand = useRaiseHandStore((state) => state.setRaisedHand);
  const clearMissing = useRaiseHandStore((state) => state.clearMissing);
  const reset = useRaiseHandStore((state) => state.reset);

  // Listen for raise-hand data events
  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (
      data: Uint8Array,
      participant?: any,
      kind?: any,
      topic?: string,
    ) => {
      if (topic && topic !== 'raise-hand') {
        return;
      }

      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString) as RaiseHandData;
        if (messageData.type !== 'raise-hand') {
          return;
        }

        const sender = messageData.sender || participant?.identity;
        if (!sender) {
          return;
        }

        const isRaised = Boolean(messageData.isRaised);
        setRaisedHand(sender, isRaised);

        if (sender !== localParticipant?.identity) {
          playRaiseHandSound(isRaised);
        }
      } catch (error) {
        console.error('Error parsing raise hand data:', error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, setRaisedHand, localParticipant?.identity]);

  // Clean up participants who leave
  useEffect(() => {
    const identities = new Set<string>();
    if (localParticipant && !isObserver(localParticipant)) {
      identities.add(localParticipant.identity);
    }
    participants.forEach((p) => {
      if (!isObserver(p)) {
        identities.add(p.identity);
      }
    });
    clearMissing(identities);
  }, [participants, localParticipant, clearMissing]);

  // Reset store when component unmounts (e.g., room change)
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return null;
}

