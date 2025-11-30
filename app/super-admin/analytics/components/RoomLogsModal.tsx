'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Users, Activity } from 'lucide-react';
import Card from '@/lib/components/Card';
import Button from '@/lib/components/Button';
import toast from 'react-hot-toast';

interface RoomLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  roomId: string;
}

interface SessionInfo {
  id: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  isActive: boolean;
  startedBy?: string;
}

interface ParticipantInfo {
  name: string;
  type: string;
  lastSeen: Date;
}

interface RoomLogsData {
  room: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  };
  totalLogs: number;
  logs: Array<{
    id: string;
    event: string;
    occurredAt: string;
    description: string | null;
    metadata: any;
  }>;
  sessions: SessionInfo[];
  participants: ParticipantInfo[];
}

export default function RoomLogsModal({
  isOpen,
  onClose,
  accountId,
  roomId,
}: RoomLogsModalProps) {
  const [data, setData] = useState<RoomLogsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'participants' | 'logs'>('sessions');

  useEffect(() => {
    if (isOpen && accountId && roomId) {
      fetchRoomLogs();
    }
  }, [isOpen, accountId, roomId]);

  const fetchRoomLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/super-admin/accounts/${accountId}/rooms/${roomId}/logs`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch room logs');
      }

      const logsData = await response.json();
      setData(logsData);
    } catch (error) {
      console.error('Error fetching room logs:', error);
      toast.error('فشل تحميل سجل الغرفة');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return 'قيد التشغيل...';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}س ${minutes}د ${secs}ث`;
    }
    if (minutes > 0) {
      return `${minutes}د ${secs}ث`;
    }
    return `${secs}ث`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {data?.room.name || 'سجل الغرفة'}
            </h2>
            {data?.room.description && (
              <p className="text-sm text-gray-600 mt-1">{data.room.description}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity className="w-4 h-4 inline ml-2" />
            الجلسات ({data?.sessions.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'participants'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline ml-2" />
            المشاركون ({data?.participants.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 inline ml-2" />
            السجل الكامل ({data?.totalLogs || 0})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">جاري تحميل السجل...</p>
            </div>
          ) : activeTab === 'sessions' ? (
            <div className="space-y-4">
              {data?.sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>لا توجد جلسات مسجلة</p>
                </div>
              ) : (
                data?.sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border-2 ${
                      session.isActive
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {session.isActive && (
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          )}
                          <span className="font-semibold text-gray-900">
                            {session.isActive ? 'جلسة نشطة' : 'جلسة منتهية'}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>بداية: {formatDateTime(session.startTime)}</span>
                          </div>
                          {session.endTime && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>نهاية: {formatDateTime(session.endTime)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            <span>المدة: {formatDuration(session.durationSeconds)}</span>
                          </div>
                          {session.startedBy && (
                            <div className="text-xs text-gray-500">
                              بدأت بواسطة: {session.startedBy}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'participants' ? (
            <div className="space-y-3">
              {data?.participants.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>لا يوجد مشاركون مسجلون</p>
                </div>
              ) : (
                data?.participants.map((participant, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{participant.name}</span>
                        <span className="mr-2 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                          {participant.type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        آخر ظهور: {formatDateTime(participant.lastSeen.toISOString())}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {data?.logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>لا يوجد سجل</p>
                </div>
              ) : (
                data?.logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-gray-200 bg-white text-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{log.event}</span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(log.occurredAt)}
                          </span>
                        </div>
                        {log.description && (
                          <p className="text-gray-600">{log.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </Card>
    </div>
  );
}

