'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Users, Copy, ExternalLink, Trash2, Edit, Search } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import CreateRoomModal from './CreateRoomModal';
import EditRoomModal from './EditRoomModal';

interface Room {
  id: string;
  name: string;
  description?: string;
  hostApproval: boolean;
  maxParticipants: number;
  isActive: boolean;
  canRecord: boolean;
  createdAt: string;
  hostLink: string;
  guestLink: string;
  participants: Array<{
    id: string;
    name: string;
    type: 'HOST' | 'GUEST';
  }>;
}

export default function AdminDashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchRooms();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
    }
  };

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    router.push('/admin/login');
  };

  const copyToClipboard = async (text: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    const showFeedback = (message: string, isSuccess: boolean) => {
      const button = event?.currentTarget as HTMLElement;
      if (button) {
        const originalTitle = button.getAttribute('title');
        button.setAttribute('title', message);
        button.style.color = isSuccess ? '#10b981' : '#ef4444';
        
        setTimeout(() => {
          button.setAttribute('title', originalTitle || 'نسخ الرابط');
          button.style.color = '';
        }, 2000);
      }
    };

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showFeedback('تم النسخ!', true);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          showFeedback('تم النسخ!', true);
        } else {
          throw new Error('Copy command failed');
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      showFeedback('فشل في النسخ', false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الغرفة؟')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setRooms(rooms.filter(room => room.id !== roomId));
      }
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600 ml-3" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-reverse space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <Plus className="w-4 h-4 ml-2" />
                <span className="hidden sm:inline">إنشاء غرفة</span>
                <span className="sm:hidden">جديد</span>
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <LogOut className="w-4 h-4 ml-2" />
                <span className="hidden sm:inline">تسجيل خروج</span>
                <span className="sm:hidden">خروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto scroll-smooth bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-full">
          {/* Search and Stats */}
          <div className="mb-6">
            <div className="flex flex-col space-y-4">
              <div className="text-center sm:text-right">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">الغرف</h2>
                <p className="text-gray-600">إدارة غرف مؤتمرات الفيديو</p>
              </div>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 sm:flex sm:justify-end sm:space-x-reverse sm:space-x-4">
                <div className="bg-white px-4 py-3 rounded-lg border border-gray-200 text-center">
                  <span className="text-sm text-gray-600">إجمالي الغرف</span>
                  <div className="font-semibold text-gray-900 text-lg">{rooms.length}</div>
                </div>
                <div className="bg-white px-4 py-3 rounded-lg border border-gray-200 text-center">
                  <span className="text-sm text-gray-600">نشطة</span>
                  <div className="font-semibold text-green-600 text-lg">{rooms.filter(r => r.isActive).length}</div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md mx-auto sm:mr-0">
                <input
                  type="text"
                  placeholder="البحث في الغرف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-right"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md',
                  !room.isActive && 'opacity-75'
                )}
              >
                {/* Room Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{room.name}</h3>
                    <div className="flex items-center space-x-reverse space-x-2">
                      <button
                        onClick={() => setEditingRoom(room)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteRoom(room.id)}
                        className="p-1 text-red-400 hover:text-red-600 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {room.description && (
                    <p className="text-sm text-gray-600 mb-3 text-right">{room.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      room.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    )}>
                      {room.isActive ? 'نشطة' : 'غير نشطة'}
                    </span>
                    <span className="text-gray-500">
                      {room.participants.length} مشارك
                    </span>
                  </div>

                  {/* Recording Status */}
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      room.canRecord 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    )}>
                      {room.canRecord ? 'تسجيل مسموح' : 'تسجيل غير مسموح'}
                    </span>
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      room.hostApproval 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-blue-100 text-blue-800'
                    )}>
                      {room.hostApproval ? 'يتطلب موافقة' : 'دخول مباشر'}
                    </span>
                  </div>
                </div>

                {/* Room Links - Simplified */}
                <div className="p-4 sm:p-6 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 text-right">رابط المضيف</label>
                    <div className="flex items-center space-x-reverse space-x-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/${room.hostLink}/h`}
                        readOnly
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 text-right cursor-pointer"
                      />
                      <button
                        onClick={(e) => copyToClipboard(`${window.location.origin}/${room.hostLink}/h`, e)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="نسخ الرابط"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`/${room.hostLink}/h`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-primary-600 hover:text-primary-700 transition-colors"
                        title="فتح الرابط"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 text-right">رابط الضيف</label>
                    <div className="flex items-center space-x-reverse space-x-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/${room.guestLink}/g`}
                        readOnly
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 text-right cursor-pointer"
                      />
                      <button
                        onClick={(e) => copyToClipboard(`${window.location.origin}/${room.guestLink}/g`, e)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="نسخ الرابط"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`/${room.guestLink}/g`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-primary-600 hover:text-primary-700 transition-colors"
                        title="فتح الرابط"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Room Footer */}
                <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>تم الإنشاء {formatDate(new Date(room.createdAt), 'ar-SA')}</span>
                    <span>الحد الأقصى: {room.maxParticipants} مشارك</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRooms.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">لم يتم العثور على غرف</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? 'جرب تعديل مصطلحات البحث.' : 'ابدأ بإنشاء أول غرفة لك.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء غرفة
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onRoomCreated={(newRoom) => {
            setRooms([...rooms, newRoom]);
            setShowCreateModal(false);
          }}
        />
      )}

      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onRoomUpdated={(updatedRoom) => {
            setRooms(rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r));
            setEditingRoom(null);
          }}
        />
      )}
    </div>
  );
}
