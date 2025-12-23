'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Video, CreditCard, Settings, Gift, Play, Download, Search, Filter, Loader2, Film, Trash2, AlertTriangle, Calendar, Clock, HardDrive, VideoIcon } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import Button from '@/lib/components/Button';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';
import RecordingPlayerModal from './RecordingPlayerModal';

interface Recording {
  id: string;
  roomId: string;
  roomName: string;
  filename: string;
  originalName: string;
  fileSize: number | null;
  duration: number | null;
  status: string;
  storageType: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  streamUrl: string;
  downloadUrl: string;
}

interface Room {
  id: string;
  name: string;
}

function RecordingsListContent({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);
  const [deletingRecording, setDeletingRecording] = useState<Recording | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  const menuItems = [
    { href: '/client/dashboard', label: 'لوحة التحكم', icon: Video },
    { href: '/client/rooms', label: 'إدارة الغرف', icon: Video },
    { href: '/client/recordings', label: 'التسجيلات', icon: Film },
    { href: '/client/subscription', label: 'الاشتراك', icon: CreditCard },
    { href: '/client/settings', label: 'الإعدادات', icon: Settings },
    { href: '/client/referral-center', label: 'مركز الإحالات', icon: Gift },
  ];

  const fetchRecordings = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (selectedRoomId) {
        params.append('roomId', selectedRoomId);
      }
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/client/recordings?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }

      const data = await response.json();
      setRecordings(data.recordings || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast.error('فشل تحميل التسجيلات');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, selectedRoomId, selectedStatus]);

  const fetchRooms = useCallback(async () => {
    try {
      setIsLoadingRooms(true);
      const response = await fetch('/api/client/rooms', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }

      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleLogout = async () => {
    await logout();
    router.push('/client/login');
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'غير معروف';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'غير معروف';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-SA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getRecordingDisplayName = (recording: Recording): string => {
    // Use room name as the primary name, with date and time for uniqueness
    const date = formatDateShort(recording.startedAt);
    const time = new Date(recording.startedAt).toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${recording.roomName} - ${date} ${time}`;
  };

  const getRecordingUniqueId = (recording: Recording): string => {
    // Generate a short unique identifier from recording ID
    return recording.id.slice(-8).toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      COMPLETED: { text: 'مكتمل', className: 'bg-green-100 text-green-700 border-green-200' },
      UPLOADING: { text: 'جاري الرفع', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      FAILED: { text: 'فشل', className: 'bg-red-100 text-red-700 border-red-200' },
      ACTIVE: { text: 'نشط', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      STARTING: { text: 'بدء', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    };

    const badge = badges[status] || { text: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
        {badge.text}
      </span>
    );
  };

  const handlePlay = (recording: Recording) => {
    setPlayingRecording(recording);
  };

  const handleDownload = async (recording: Recording) => {
    try {
      const response = await fetch(recording.downloadUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download recording');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = recording.originalName || recording.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('تم بدء التحميل');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('فشل تحميل التسجيل');
    }
  };

  const handleDeleteClick = (recording: Recording) => {
    setDeletingRecording(recording);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecording) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/client/recordings/${deletingRecording.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete recording' }));
        throw new Error(errorData.error || 'Failed to delete recording');
      }

      toast.success('تم حذف التسجيل بنجاح');
      setDeletingRecording(null);
      // Refresh the recordings list
      fetchRecordings();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'فشل حذف التسجيل');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div dir="rtl" className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex overflow-hidden">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم العميل"
        onLogout={handleLogout}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="التسجيلات"
          subtitle="عرض وإدارة جميع تسجيلاتك"
          userEmail={userEmail}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {/* Sync Button - Only show if no recordings found */}
          {!isLoading && recordings.length === 0 && (
            <Card className="mb-6 bg-yellow-50 border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-yellow-900">لا توجد تسجيلات في قاعدة البيانات</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    إذا كان لديك ملفات تسجيل في المجلد، يمكنك مزامنتها مع قاعدة البيانات
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      const response = await fetch('/api/client/recordings/sync', {
                        method: 'POST',
                        credentials: 'include',
                      });
                      const data = await response.json();
                      if (response.ok) {
                        toast.success(`تمت مزامنة ${data.synced} تسجيل`);
                        fetchRecordings();
                      } else {
                        toast.error(data.error || 'فشلت المزامنة');
                      }
                    } catch (error) {
                      console.error('Sync error:', error);
                      toast.error('فشلت المزامنة');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  مزامنة التسجيلات
                </Button>
              </div>
            </Card>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="بحث في التسجيلات..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedRoomId}
                onChange={(e) => {
                  setSelectedRoomId(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-w-[200px]"
                disabled={isLoadingRooms}
              >
                <option value="">جميع الغرف</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">جميع الحالات</option>
                <option value="COMPLETED">مكتمل</option>
                <option value="UPLOADING">جاري الرفع</option>
                <option value="FAILED">فشل</option>
              </select>
            </div>
          </Card>

          {/* Recordings List */}
          {isLoading ? (
            <Card>
              <div className="text-center py-12">
                <Loader2 className="inline-block w-8 h-8 animate-spin text-primary-600" />
                <p className="mt-4 text-gray-600">جاري التحميل...</p>
              </div>
            </Card>
          ) : recordings.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Film className="mx-auto w-16 h-16 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">لا توجد تسجيلات</h3>
                <p className="mt-2 text-gray-600">لم يتم العثور على أي تسجيلات بعد</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {recordings.map((recording) => (
                  <Card key={recording.id} hover className="flex flex-col border-l-4" style={{
                    borderLeftColor: `hsl(${(parseInt(recording.id.slice(-6), 16) % 360)}, 70%, 50%)`
                  }}>
                    {/* Header with Room Name and Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <VideoIcon className="w-5 h-5 text-primary-600" />
                          <h3 className="text-lg font-bold text-gray-900 truncate">{recording.roomName}</h3>
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            #{getRecordingUniqueId(recording)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{getRecordingDisplayName(recording)}</p>
                        {recording.egressId && (
                          <p className="text-xs text-gray-400 mt-1 font-mono truncate" title={recording.egressId}>
                            ID: {recording.egressId.slice(-12)}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(recording.status)}
                    </div>

                    {/* Recording Details */}
                    <div className="space-y-2 mb-4 flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{formatDate(recording.startedAt)}</span>
                      </div>
                      {recording.endedAt && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>انتهى: {formatDateShort(recording.endedAt)}</span>
                        </div>
                      )}
                      {recording.duration && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>المدة: {formatDuration(recording.duration)}</span>
                        </div>
                      )}
                      {recording.fileSize && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <HardDrive className="w-4 h-4 text-gray-400" />
                          <span>الحجم: {formatFileSize(recording.fileSize)}</span>
                        </div>
                      )}
                      {recording.filename && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-mono truncate" title={recording.filename}>
                          <span className="truncate">📄 {recording.filename}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <Button
                        onClick={() => handlePlay(recording)}
                        disabled={recording.status !== 'COMPLETED' && recording.status !== 'UPLOADING'}
                        className="flex-1 flex items-center justify-center gap-2"
                        size="sm"
                      >
                        <Play size={16} />
                        تشغيل
                      </Button>
                      <Button
                        onClick={() => handleDownload(recording)}
                        disabled={recording.status !== 'COMPLETED' && recording.status !== 'UPLOADING'}
                        variant="outline"
                        className="flex-1 flex items-center justify-center gap-2"
                        size="sm"
                      >
                        <Download size={16} />
                        تحميل
                      </Button>
                      <Button
                        onClick={() => handleDeleteClick(recording)}
                        variant="outline"
                        className="flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        size="sm"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                  >
                    السابق
                  </Button>
                  <span className="text-sm text-gray-600">
                    صفحة {page} من {totalPages} ({total} تسجيل)
                  </span>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                  >
                    التالي
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {playingRecording && (
        <RecordingPlayerModal
          recording={playingRecording}
          onClose={() => setPlayingRecording(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecording && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => !isDeleting && setDeletingRecording(null)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">تأكيد الحذف</h3>
                <p className="text-sm text-gray-600 mt-1">هل أنت متأكد من حذف هذا التسجيل؟</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-900">{deletingRecording.roomName}</p>
              <p className="text-xs text-gray-600 mt-1">{deletingRecording.originalName}</p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              سيتم حذف التسجيل نهائياً من النظام ومن التخزين. لا يمكن التراجع عن هذا الإجراء.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setDeletingRecording(null)}
                disabled={isDeleting}
                variant="outline"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="inline-block w-4 h-4 animate-spin mr-2" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} className="mr-2" />
                    حذف
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecordingsListClient({ clientId, userEmail }: { clientId: string; userEmail: string }) {
  return (
    <SidebarProvider>
      <RecordingsListContent clientId={clientId} userEmail={userEmail} />
    </SidebarProvider>
  );
}

