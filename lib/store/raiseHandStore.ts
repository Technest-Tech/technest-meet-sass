import { create } from 'zustand';

interface RaiseHandState {
  raisedHands: Map<string, boolean>;
  setRaisedHand: (identity: string, isRaised: boolean) => void;
  clearMissing: (identities: Set<string>) => void;
  reset: () => void;
}

export const useRaiseHandStore = create<RaiseHandState>((set) => ({
  raisedHands: new Map(),
  setRaisedHand: (identity, isRaised) =>
    set((state) => {
      const next = new Map(state.raisedHands);
      if (isRaised) {
        next.set(identity, true);
      } else {
        next.delete(identity);
      }
      return { raisedHands: next };
    }),
  clearMissing: (identities) =>
    set((state) => {
      const next = new Map<string, boolean>();
      state.raisedHands.forEach((value, key) => {
        if (identities.has(key)) {
          next.set(key, value);
        }
      });
      return { raisedHands: next };
    }),
  reset: () => set({ raisedHands: new Map() }),
}));

