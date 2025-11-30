'use client';

import { useState } from 'react';
import { Clock, Users, FileText, ExternalLink } from 'lucide-react';
import Card from '@/lib/components/Card';
import Button from '@/lib/components/Button';
import RoomLogsModal from './RoomLogsModal';

interface Room {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  maxParticipants: number;
  stats: {
    fileCount: number;
    storageBytes: number;
    participantSlots: number;
  };
  sessionStatus: {
    isRunning: boolean;
    currentSessionStart: string | null;
  };
}

interface AccountRoomsListProps {
  rooms: Room[];
  accountId: string;
  isLoading?: boolean;
}

export default function AccountRoomsList({ rooms, accountId, isLoading }: AccountRoomsListProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  const handleViewLogs = (roomId: string) => {
    setSelectedRoomId(roomId);
    setIsLogsModalOpen(true);
  };

  const handleCloseLogs = () => {
    setIsLogsModalOpen(false);
    setSelectedRoomId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد غرف</h3>
          <p className="text-gray-600">لم يتم إنشاء أي غرف لهذا الحساب بعد</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <Card key={room.id} className="hover:shadow-lg transition-shadow">
            <div className="p-6">
              {/* Room Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{room.name}</h3>
                  {room.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{room.description}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    room.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {room.isActive ? 'نشطة' : 'غير نشطة'}
                </span>
              </div>

              {/* Session Status */}
              {room.sessionStatus.isRunning && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-green-800">جلسة نشطة</span>
                  </div>
                  {room.sessionStatus.currentSessionStart && (
                    <p className="text-xs text-green-600 mt-1">
                      بدأت: {formatDate(room.sessionStatus.currentSessionStart)}
                    </p>
                  )}
                </div>
              )}

              {/* Room Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>الحد الأقصى للمشاركين</span>
                  </div>
                  <span className="font-medium text-gray-900">{room.maxParticipants}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span>الملفات</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {room.stats.fileCount} ({formatBytes(room.stats.storageBytes)})
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>تاريخ الإنشاء</span>
                  </div>
                  <span className="font-medium text-gray-900">{formatDate(room.createdAt)}</span>
                </div>
              </div>

              {/* View Logs Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleViewLogs(room.id)}
              >
                <ExternalLink className="w-4 h-4 ml-2" />
                عرض السجل الكامل
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Room Logs Modal */}
      {selectedRoomId && (
        <RoomLogsModal
          isOpen={isLogsModalOpen}
          onClose={handleCloseLogs}
          accountId={accountId}
          roomId={selectedRoomId}
        />
      )}
    </>
  );
}

