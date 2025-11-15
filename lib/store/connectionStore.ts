import { create } from 'zustand';
import { Room } from 'livekit-client';
import { ConnectionDetails } from '../types';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  error: string | null;
  room: Room | null;
  connectionDetails: ConnectionDetails | null;
  isReconnecting: boolean;
  reconnectAttempts: number;
  
  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setRoom: (room: Room | null) => void;
  setConnectionDetails: (details: ConnectionDetails | null) => void;
  setIsReconnecting: (isReconnecting: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as ConnectionStatus,
  error: null,
  room: null,
  connectionDetails: null,
  isReconnecting: false,
  reconnectAttempts: 0,
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState,
  
  setStatus: (status) => set({ status }),
  
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
  
  setRoom: (room) => set({ room }),
  
  setConnectionDetails: (connectionDetails) => set({ connectionDetails }),
  
  setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
  
  incrementReconnectAttempts: () => 
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
  
  reset: () => set(initialState),
}));








