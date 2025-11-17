import { create } from 'zustand';

interface MediaState {
  // Current state
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenShareEnabled: boolean;
  
  // Selected devices
  selectedVideoDevice: string | null;
  selectedAudioDevice: string | null;
  selectedAudioOutputDevice: string | null;
  
  // Available devices
  availableVideoDevices: MediaDeviceInfo[];
  availableAudioDevices: MediaDeviceInfo[];
  availableAudioOutputDevices: MediaDeviceInfo[];
  
  // Device permissions
  hasVideoPermission: boolean;
  hasAudioPermission: boolean;
  permissionError: string | null;
  
  // Media quality
  videoQuality: 'low' | 'medium' | 'high' | 'auto';
  
  // Actions - Toggle
  toggleVideo: () => void;
  toggleAudio: () => void;
  toggleScreenShare: () => void;
  setVideoEnabled: (enabled: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  
  // Actions - Device Selection
  setVideoDevice: (deviceId: string) => void;
  setAudioDevice: (deviceId: string) => void;
  setAudioOutputDevice: (deviceId: string) => void;
  
  // Actions - Available Devices
  setAvailableVideoDevices: (devices: MediaDeviceInfo[]) => void;
  setAvailableAudioDevices: (devices: MediaDeviceInfo[]) => void;
  setAvailableAudioOutputDevices: (devices: MediaDeviceInfo[]) => void;
  updateAvailableDevices: (devices: MediaDeviceInfo[]) => void;
  
  // Actions - Permissions
  setHasVideoPermission: (has: boolean) => void;
  setHasAudioPermission: (has: boolean) => void;
  setPermissionError: (error: string | null) => void;
  
  // Actions - Quality
  setVideoQuality: (quality: 'low' | 'medium' | 'high' | 'auto') => void;
  
  reset: () => void;
}

const initialState = {
  videoEnabled: false,
  audioEnabled: true,
  screenShareEnabled: false,
  selectedVideoDevice: null,
  selectedAudioDevice: null,
  selectedAudioOutputDevice: null,
  availableVideoDevices: [],
  availableAudioDevices: [],
  availableAudioOutputDevices: [],
  hasVideoPermission: false,
  hasAudioPermission: false,
  permissionError: null,
  videoQuality: 'auto' as const,
};

export const useMediaStore = create<MediaState>((set) => ({
  ...initialState,
  
  // Toggle actions
  toggleVideo: () => set((state) => ({ videoEnabled: !state.videoEnabled })),
  toggleAudio: () => set((state) => ({ audioEnabled: !state.audioEnabled })),
  toggleScreenShare: () => set((state) => ({ screenShareEnabled: !state.screenShareEnabled })),
  setVideoEnabled: (enabled) => set({ videoEnabled: enabled }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  setScreenShareEnabled: (enabled) => set({ screenShareEnabled: enabled }),
  
  // Device selection
  setVideoDevice: (deviceId) => set({ selectedVideoDevice: deviceId }),
  setAudioDevice: (deviceId) => set({ selectedAudioDevice: deviceId }),
  setAudioOutputDevice: (deviceId) => set({ selectedAudioOutputDevice: deviceId }),
  
  // Available devices
  setAvailableVideoDevices: (devices) => set({ availableVideoDevices: devices }),
  setAvailableAudioDevices: (devices) => set({ availableAudioDevices: devices }),
  setAvailableAudioOutputDevices: (devices) => set({ availableAudioOutputDevices: devices }),
  
  updateAvailableDevices: (devices) => {
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    const audioOutputDevices = devices.filter(d => d.kind === 'audiooutput');
    
    set({
      availableVideoDevices: videoDevices,
      availableAudioDevices: audioDevices,
      availableAudioOutputDevices: audioOutputDevices,
    });
  },
  
  // Permissions
  setHasVideoPermission: (has) => set({ hasVideoPermission: has }),
  setHasAudioPermission: (has) => set({ hasAudioPermission: has }),
  setPermissionError: (error) => set({ permissionError: error }),
  
  // Quality
  setVideoQuality: (quality) => set({ videoQuality: quality }),
  
  reset: () => set(initialState),
}));










