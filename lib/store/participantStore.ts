import { create } from 'zustand';
import { Participant } from 'livekit-client';

export interface ParticipantInfo {
  sid: string;
  identity: string;
  name?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  metadata?: string;
}

interface ParticipantState {
  participants: Map<string, ParticipantInfo>;
  localParticipant: ParticipantInfo | null;
  raisedHands: Map<string, boolean>;
  speakingParticipants: Set<string>;
  
  // Actions
  addParticipant: (participant: ParticipantInfo) => void;
  removeParticipant: (sid: string) => void;
  updateParticipant: (sid: string, updates: Partial<ParticipantInfo>) => void;
  setLocalParticipant: (participant: ParticipantInfo | null) => void;
  updateRaisedHand: (identity: string, isRaised: boolean) => void;
  clearRaisedHands: () => void;
  setSpeaking: (sid: string, isSpeaking: boolean) => void;
  reset: () => void;
}

const initialState = {
  participants: new Map<string, ParticipantInfo>(),
  localParticipant: null,
  raisedHands: new Map<string, boolean>(),
  speakingParticipants: new Set<string>(),
};

export const useParticipantStore = create<ParticipantState>((set) => ({
  ...initialState,
  
  addParticipant: (participant) =>
    set((state) => {
      const newParticipants = new Map(state.participants);
      newParticipants.set(participant.sid, participant);
      return { participants: newParticipants };
    }),
  
  removeParticipant: (sid) =>
    set((state) => {
      const newParticipants = new Map(state.participants);
      newParticipants.delete(sid);
      const newSpeaking = new Set(state.speakingParticipants);
      newSpeaking.delete(sid);
      return { participants: newParticipants, speakingParticipants: newSpeaking };
    }),
  
  updateParticipant: (sid, updates) =>
    set((state) => {
      const newParticipants = new Map(state.participants);
      const existing = newParticipants.get(sid);
      if (existing) {
        newParticipants.set(sid, { ...existing, ...updates });
      }
      return { participants: newParticipants };
    }),
  
  setLocalParticipant: (participant) => set({ localParticipant: participant }),
  
  updateRaisedHand: (identity, isRaised) =>
    set((state) => {
      const newRaisedHands = new Map(state.raisedHands);
      if (isRaised) {
        newRaisedHands.set(identity, true);
      } else {
        newRaisedHands.delete(identity);
      }
      return { raisedHands: newRaisedHands };
    }),
  
  clearRaisedHands: () => set({ raisedHands: new Map() }),
  
  setSpeaking: (sid, isSpeaking) =>
    set((state) => {
      const newSpeaking = new Set(state.speakingParticipants);
      if (isSpeaking) {
        newSpeaking.add(sid);
      } else {
        newSpeaking.delete(sid);
      }
      
      // Also update participant info
      const newParticipants = new Map(state.participants);
      const participant = newParticipants.get(sid);
      if (participant) {
        newParticipants.set(sid, { ...participant, isSpeaking });
      }
      
      return { speakingParticipants: newSpeaking, participants: newParticipants };
    }),
  
  reset: () => set(initialState),
}));


















