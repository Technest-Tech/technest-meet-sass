'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Globe, Loader2, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import Modal from '@/lib/components/Modal';
import Button from '@/lib/components/Button';
import { formatDate } from '../utils';

function formatDateTime(dateString?: string | Date): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Unknown';
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  
  return date.toLocaleString('en-US', options);
}
import type { DeviceType, DeviceInfo } from '@/lib/utils/deviceDetection';

type ActivityEventType =
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_STARTED'
  | 'ROOM_ENDED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'FILE_UPLOADED'
  | 'FILE_DELETED'
  | 'SYSTEM_ALERT';

type RoomLogEntry = {
  id: string;
  event: ActivityEventType;
  description?: string | null;
  occurredAt: string;
  metadata?: Record<string, any> | null;
};

type SessionInfo = {
  id: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  isActive: boolean;
  startedBy?: string;
};

type ParticipantInfo = {
  name: string;
  type: string;
  lastSeen: string;
};

type RoomLogsResponse = {
  room: {
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    updatedAt: string;
  };
  logs: RoomLogEntry[];
  sessions: SessionInfo[];
  totalLogs: number;
  participants: ParticipantInfo[];
};

interface RoomLogsViewerProps {
  accountId: string;
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function RoomLogsViewer({ accountId, roomId, isOpen, onClose }: RoomLogsViewerProps) {
  const [data, setData] = useState<RoomLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/super-admin/accounts/${accountId}/rooms/${roomId}/logs`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Failed to load log');
        }
        return response.json() as Promise<RoomLogsResponse>;
      })
      .then((response) => {
        setData(response);
      })
      .catch((err: Error) => {
        console.error('Failed to load room logs', err);
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [accountId, roomId, isOpen, reloadKey]);

  const sessions = useMemo(() => {
    if (!data) return [];
    return data.sessions;
  }, [data]);

  const currentSession = sessions.find((session) => session.isActive);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Complete Room Log">
      <div dir="ltr">
        {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          Loading log...
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center text-red-500 py-8 space-y-3">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReloadKey((key) => key + 1);
              setData(null);
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && data && (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
          <header className="rounded-2xl border-2 border-gray-200 p-5 space-y-3 bg-gradient-to-br from-gray-50 to-white shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Room Information</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-gray-900">{data.room.name}</p>
                {data.room.description && (
                  <p className="text-sm text-gray-600 mt-1">{data.room.description}</p>
                )}
              </div>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                  data.room.isActive 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {data.room.isActive ? '✓ Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg text-sm font-medium text-blue-700">
                <Activity className="w-4 h-4" />
                {data.totalLogs} events
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-lg text-sm font-medium text-purple-700">
                <Clock3 className="w-4 h-4" />
                {formatDateTime(data.room.updatedAt)}
              </span>
              {data.participants && data.participants.length > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg text-sm font-medium text-green-700">
                  <Activity className="w-4 h-4" />
                  {data.participants.length} participant{data.participants.length !== 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReloadKey((key) => key + 1);
                  setData(null);
                }}
              >
                <RefreshCw className="w-4 h-4 ml-1" />
                Refresh
              </Button>
            </div>
          </header>

          {currentSession && (
            <section className="rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Active Session</p>
              </div>
              <p className="text-sm text-green-900 font-medium">
                Started at {formatDateTime(currentSession.startTime)}
                {currentSession.startedBy ? ` by ${currentSession.startedBy}` : ''}
              </p>
            </section>
          )}

          {data.participants && data.participants.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Participants</h3>
                <span className="text-xs text-gray-500">{data.participants.length} participant{data.participants.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.participants.map((participant, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-3 bg-white hover:shadow-md transition-shadow flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{participant.name}</p>
                      {getParticipantBadge(participant.type)}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      Last seen: {formatDateTime(participant.lastSeen)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Previous Sessions</h3>
              <span className="text-xs text-gray-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">No sessions recorded yet.</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`rounded-xl border-2 p-4 flex flex-col gap-2 transition-all hover:shadow-md ${
                      session.isActive
                        ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {session.isActive && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatDateTime(session.startTime)}
                          </span>
                          {session.endTime && (
                            <span className="text-xs text-gray-600">
                              Ended: {formatDateTime(session.endTime)}
                            </span>
                          )}
                        </div>
                      </div>
                      {getSessionBadge(session)}
                    </div>
                    {session.startedBy && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="font-medium">Started by:</span> {session.startedBy}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Activity Log</h3>
              <span className="text-xs text-gray-500">{data.logs.length} event{data.logs.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-3">
              {data.logs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-xl border-l-4 p-4 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
                  style={{ borderLeftColor: getEventColor(log.event) }}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getEventBadge(log.event)}
                          <p className="text-sm font-semibold text-gray-900">
                            {humanizeEvent(log.event)}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock3 className="w-3 h-3" />
                          {formatDateTime(log.occurredAt)}
                        </p>
                      </div>
                    </div>

                  {log.description && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{log.description}</p>
                  )}

                  <DeviceDetails metadata={log.metadata} />
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
      </div>
    </Modal>
  );
}

function DeviceDetails({ metadata }: { metadata?: Record<string, any> | null }) {
  if (!metadata) return null;

  const device = metadata.device as DeviceInfo | undefined;
  if (!device && !metadata.participantName) {
    return null;
  }

  return (
    <div className="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 p-3 text-xs space-y-2">
      {metadata.participantName && (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900">{metadata.participantName}</p>
          {metadata.participantType && getParticipantBadge(metadata.participantType)}
        </div>
      )}
      {device && (
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-200">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md shadow-sm">
            {renderDeviceIcon(device.deviceType)}
            <span className="font-medium text-gray-700 capitalize">{device.deviceType}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md shadow-sm">
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-gray-700">{device.browser}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-700">{device.os}</span>
          </span>
          <span className="px-2 py-1 bg-white rounded-md shadow-sm text-gray-600 font-mono text-xs">
            {device.ip}
          </span>
        </div>
      )}
      {metadata.ip && !device && (
        <p className="px-2 py-1 bg-white rounded-md shadow-sm font-mono text-gray-600">IP: {metadata.ip}</p>
      )}
    </div>
  );
}

function renderDeviceIcon(type: DeviceType = 'unknown') {
  switch (type) {
    case 'desktop':
      return <Monitor className="w-4 h-4 text-blue-500" />;
    case 'tablet':
      return <Tablet className="w-4 h-4 text-purple-500" />;
    case 'mobile':
      return <Smartphone className="w-4 h-4 text-green-500" />;
    default:
      return <Monitor className="w-4 h-4 text-gray-400" />;
  }
}

function getParticipantBadge(type: string) {
  const badges = {
    host: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
    guest: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    observer: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white',
  };
  
  const badgeClass = badges[type.toLowerCase() as keyof typeof badges] || 'bg-gray-200 text-gray-700';
  
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shadow-sm capitalize ${badgeClass}`}>
      {type}
    </span>
  );
}

function getEventBadge(event: ActivityEventType) {
  const colors = {
    ROOM_STARTED: 'bg-green-500',
    ROOM_ENDED: 'bg-red-500',
    PARTICIPANT_JOINED: 'bg-blue-500',
    PARTICIPANT_LEFT: 'bg-orange-500',
    FILE_UPLOADED: 'bg-purple-500',
    FILE_DELETED: 'bg-pink-500',
    ROOM_CREATED: 'bg-indigo-500',
    ROOM_UPDATED: 'bg-yellow-500',
    SYSTEM_ALERT: 'bg-gray-500',
  };
  
  return (
    <div className={`w-2 h-2 rounded-full ${colors[event] || 'bg-gray-400'}`}></div>
  );
}

function getEventColor(event: ActivityEventType): string {
  const colors: Record<ActivityEventType, string> = {
    ROOM_STARTED: '#10b981', // green
    ROOM_ENDED: '#ef4444', // red
    PARTICIPANT_JOINED: '#3b82f6', // blue
    PARTICIPANT_LEFT: '#f97316', // orange
    FILE_UPLOADED: '#a855f7', // purple
    FILE_DELETED: '#ec4899', // pink
    ROOM_CREATED: '#6366f1', // indigo
    ROOM_UPDATED: '#eab308', // yellow
    SYSTEM_ALERT: '#6b7280', // gray
  };
  
  return colors[event] || '#9ca3af';
}

function getSessionBadge(session: SessionInfo) {
  if (session.isActive) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
        Active
      </span>
    );
  }
  
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 shadow-sm">
      {session.durationSeconds ? formatDuration(session.durationSeconds) : 'Completed'}
    </span>
  );
}

function humanizeEvent(event: ActivityEventType) {
  switch (event) {
    case 'ROOM_STARTED':
      return 'Session Started';
    case 'ROOM_ENDED':
      return 'Session Ended';
    case 'PARTICIPANT_JOINED':
      return 'Participant Joined';
    case 'PARTICIPANT_LEFT':
      return 'Participant Left';
    case 'FILE_UPLOADED':
      return 'File Uploaded';
    case 'FILE_DELETED':
      return 'File Deleted';
    case 'ROOM_UPDATED':
      return 'Room Updated';
    case 'ROOM_CREATED':
      return 'Room Created';
    default:
      return 'Event';
  }
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

