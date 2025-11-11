import { create } from 'zustand';
import { RoomFile } from '../types';

interface UIState {
  // Modal/Panel states
  isFileSharingOpen: boolean;
  isPdfViewerOpen: boolean;
  isChatOpen: boolean;
  isWhiteboardOpen: boolean;
  isSettingsOpen: boolean;
  isParticipantManagerOpen: boolean;
  isScreenAnnotationEnabled: boolean;
  
  // Selected items
  selectedPdfFile: RoomFile | null;
  
  // Notification state
  unreadChatCount: number;
  unreadNotificationCount: number;
  
  // Layout preferences
  layoutMode: 'grid' | 'spotlight' | 'sidebar';
  isSidebarCollapsed: boolean;
  
  // Actions - File Sharing
  openFileSharing: () => void;
  closeFileSharing: () => void;
  
  // Actions - PDF Viewer
  openPdfViewer: (file: RoomFile) => void;
  closePdfViewer: () => void;
  
  // Actions - Chat
  openChat: () => void;
  closeChat: () => void;
  incrementUnreadChat: () => void;
  resetUnreadChat: () => void;
  
  // Actions - Whiteboard
  openWhiteboard: () => void;
  closeWhiteboard: () => void;
  
  // Actions - Settings
  openSettings: () => void;
  closeSettings: () => void;
  
  // Actions - Participant Manager
  openParticipantManager: () => void;
  closeParticipantManager: () => void;
  
  // Actions - Screen Annotation
  enableScreenAnnotation: () => void;
  disableScreenAnnotation: () => void;
  toggleScreenAnnotation: () => void;
  
  // Actions - Layout
  setLayoutMode: (mode: 'grid' | 'spotlight' | 'sidebar') => void;
  toggleSidebar: () => void;
  
  // Actions - Notifications
  incrementNotificationCount: () => void;
  resetNotificationCount: () => void;
  
  reset: () => void;
}

const initialState = {
  isFileSharingOpen: false,
  isPdfViewerOpen: false,
  isChatOpen: false,
  isWhiteboardOpen: false,
  isSettingsOpen: false,
  isParticipantManagerOpen: false,
  isScreenAnnotationEnabled: false,
  selectedPdfFile: null,
  unreadChatCount: 0,
  unreadNotificationCount: 0,
  layoutMode: 'grid' as const,
  isSidebarCollapsed: false,
};

export const useUIStore = create<UIState>((set) => ({
  ...initialState,
  
  // File Sharing
  openFileSharing: () => set({ isFileSharingOpen: true }),
  closeFileSharing: () => set({ isFileSharingOpen: false }),
  
  // PDF Viewer
  openPdfViewer: (file) => set({ isPdfViewerOpen: true, selectedPdfFile: file }),
  closePdfViewer: () => set({ isPdfViewerOpen: false, selectedPdfFile: null }),
  
  // Chat
  openChat: () => set({ isChatOpen: true, unreadChatCount: 0 }),
  closeChat: () => set({ isChatOpen: false }),
  incrementUnreadChat: () => set((state) => ({ unreadChatCount: state.unreadChatCount + 1 })),
  resetUnreadChat: () => set({ unreadChatCount: 0 }),
  
  // Whiteboard
  openWhiteboard: () => set({ isWhiteboardOpen: true }),
  closeWhiteboard: () => set({ isWhiteboardOpen: false }),
  
  // Settings
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  
  // Participant Manager
  openParticipantManager: () => set({ isParticipantManagerOpen: true }),
  closeParticipantManager: () => set({ isParticipantManagerOpen: false }),
  
  // Screen Annotation
  enableScreenAnnotation: () => set({ isScreenAnnotationEnabled: true }),
  disableScreenAnnotation: () => set({ isScreenAnnotationEnabled: false }),
  toggleScreenAnnotation: () => set((state) => ({ isScreenAnnotationEnabled: !state.isScreenAnnotationEnabled })),
  
  // Layout
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  
  // Notifications
  incrementNotificationCount: () => 
    set((state) => ({ unreadNotificationCount: state.unreadNotificationCount + 1 })),
  resetNotificationCount: () => set({ unreadNotificationCount: 0 }),
  
  reset: () => set(initialState),
}));





