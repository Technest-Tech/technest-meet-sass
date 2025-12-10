import { LocalAudioTrack, LocalVideoTrack, videoCodecs } from 'livekit-client';
import { VideoCodec } from 'livekit-client';

export interface SessionProps {
  roomName: string;
  identity: string;
  audioTrack?: LocalAudioTrack;
  videoTrack?: LocalVideoTrack;
  region?: string;
  turnServer?: RTCIceServer;
  forceRelay?: boolean;
}

export interface TokenResult {
  identity: string;
  accessToken: string;
}

export function isVideoCodec(codec: string): codec is VideoCodec {
  return videoCodecs.includes(codec as VideoCodec);
}

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// Reaction types
export type ReactionType = '👍' | '❤️' | '😂' | '👏' | '🎉' | '😮' | '🙌';

export interface ReactionData {
  type: 'reaction';
  reactionType: ReactionType;
  sender: string;
  timestamp: number;
  id: string;
}

// Raise Hand types
export type RaiseHandState = boolean; // true = raised, false = lowered

export interface RaiseHandData {
  type: 'raise-hand';
  sender: string;
  isRaised: boolean;
  timestamp: number;
  id: string;
}

// File Sharing types
export interface RoomFile {
  id: string;
  roomId: string;
  filename: string;
  originalName: string;
  fileType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
}

export interface FileUploadData {
  type: 'file_upload';
  file: RoomFile;
  sender: string;
  timestamp: number;
}

export interface FileDeleteData {
  type: 'file_delete';
  fileId: string;
  sender: string;
  timestamp: number;
}

// Drawing types (shared with Whiteboard)
export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser' | 'highlighter' | 'pointer';
  sender?: string; // Track which participant created the stroke
}

// PDF Annotation types
export interface PdfAnnotationData {
  type: 'pdf_annotation_stroke' | 'pdf_annotation_clear' | 'pdf_annotation_delete_host' | 'pdf_annotation_delete_guest' | 'pdf_annotation_delete_all' | 'pdf_viewer_open' | 'pdf_viewer_close' | 'pdf_page_change' | 'pdf_scroll_sync' | 'pdf_prevent_guest_drawing';
  fileId: string;
  pageNumber: number;
  stroke?: DrawingStroke;
  sender: string;
  timestamp: number;
  id: string;
  isHost?: boolean;
  file?: RoomFile; // For opening PDF
  scrollTop?: number; // For scroll synchronization
  scrollLeft?: number; // For horizontal scroll
  preventGuestDrawing?: boolean; // For guest drawing restriction state
}

// Screen Annotation types
export interface ScreenAnnotationData {
  type: 'screen_annotation_stroke' | 'screen_annotation_clear' | 'screen_pointer_position' | 'screen_annotation_enable' | 'screen_annotation_disable' | 'screen_annotation_delete_stroke';
  stroke?: DrawingStroke;
  position?: { x: number; y: number };
  sender: string;
  timestamp: number;
  id: string;
  strokeId?: string; // For deleting specific strokes
  enabled?: boolean; // For host control messages
}

// Waiting Room types
export interface WaitingRoomData {
  type: 'waiting_room_admit' | 'waiting_room_reject';
  participantName: string;
  timestamp: number;
}

// Chat Message types (Enhanced)
export interface ChatMessageData {
  type: 'chat_message';
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  recipientType: 'all' | 'host' | 'specific'; // Who can see this message
  recipientId?: string; // For specific recipient
  isPrivate: boolean;
}

// Chat File Message types
export interface ChatFileMessage {
  type: 'chat_file';
  id: string;
  sender: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  timestamp: number;
  recipientType: 'all' | 'host' | 'specific';
  recipientId?: string;
  isPrivate: boolean;
}

// Mute Control types
export interface MuteControlData {
  type: 'mute_command' | 'unmute_command' | 'mute_all_command';
  targetParticipant?: string; // Specific participant or undefined for all
  sender: string;
  timestamp: number;
  allowUnmute: boolean; // Whether the participant can unmute themselves
}

// Video Request types
export interface VideoRequestData {
  type: 'video_request_on' | 'video_request_off' | 'video_request_response';
  targetParticipant: string;
  requestType: 'camera_on' | 'camera_off';
  response?: 'accepted' | 'declined';
  sender: string;
  timestamp: number;
  id: string;
}

// Participant Status types
export interface ParticipantStatusData {
  type: 'participant_status_update';
  participantIdentity: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  timestamp: number;
}


