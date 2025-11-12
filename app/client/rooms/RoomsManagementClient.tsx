'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Copy, ExternalLink, Video, CreditCard, Settings, Trash2, Link2, Edit } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import Button from '@/lib/components/Button';
import Modal from '@/lib/components/Modal';
import FormInput from '@/lib/components/FormInput';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';

interface Room {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  hostLink: string;
  guestLink: string;
  observerLink?: string; // Optional for backward compatibility
  maxParticipants: number;
  createdAt: string;
  _count: {
    participants: number;
    files: number;
  };
}

function RoomsManagementContent({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/client/rooms', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          const data = await response.json();
          toast.error(data.error || 'الاشتراك غير نشط');
        }
        return;
      }

      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('فشل تحميل الغرف');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/client/login');
  };

  const menuItems = [
    { href: '/client/dashboard', label: 'لوحة التحكم', icon: Video },
    { href: '/client/rooms', label: 'إدارة الغرف', icon: Video },
    { href: '/client/subscription', label: 'الاشتراك', icon: CreditCard },
    { href: '/client/settings', label: 'الإعدادات', icon: Settings },
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('تم نسخ الرابط');
    } catch (error) {
      toast.error('فشل نسخ الرابط');
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الغرفة؟')) {
      return;
    }

    try {
      const response = await fetch(`/api/client/rooms/${roomId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete room');
      }

      toast.success('تم حذف الغرفة بنجاح');
      fetchRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('فشل حذف الغرفة');
    }
  };


  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم العميل"
        onLogout={handleLogout}
      />

      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="إدارة الغرف"
          subtitle="إنشاء وإدارة غرف المؤتمرات"
          userEmail={userEmail}
          actions={
            <Button
              variant="primary"
              size="md"
              rightIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              إنشاء غرفة جديدة
            </Button>
          }
        />

        <main className="p-6 lg:p-8">
          {isLoading ? (
            <Card>
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-gray-600">جاري التحميل...</p>
              </div>
            </Card>
          ) : rooms.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">لا توجد غرف</h3>
                <p className="text-gray-600 mb-6">ابدأ بإنشاء غرفة جديدة</p>
                <Button
                  variant="primary"
                  rightIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreateModal(true)}
                >
                  إنشاء غرفة جديدة
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <Card key={room.id} hover>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{room.name}</h3>
                      {room.description && (
                        <p className="text-sm text-gray-600">{room.description}</p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        room.isActive
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {room.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">رابط المضيف:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}/${room.hostLink}/h`)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="نسخ الرابط"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                          <Link
                            href={`/${room.hostLink}/h`}
                            target="_blank"
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="فتح الرابط"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-600" />
                          </Link>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1.5 rounded border border-gray-200 truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/${room.hostLink}/h` : `/${room.hostLink}/h`}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">رابط الضيف:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}/${room.guestLink}/g`)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="نسخ الرابط"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                          <Link
                            href={`/${room.guestLink}/g`}
                            target="_blank"
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="فتح الرابط"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-600" />
                          </Link>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1.5 rounded border border-gray-200 truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/${room.guestLink}/g` : `/${room.guestLink}/g`}
                      </div>
                    </div>
                    {/* Observer Link */}
                    {room.observerLink && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            👁️ رابط المراقب:
                            <span className="text-xs text-red-600 font-semibold">(سري)</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(`${window.location.origin}/${room.observerLink}/o`)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="نسخ رابط المراقب"
                            >
                              <Copy className="w-4 h-4 text-red-600" />
                            </button>
                            <Link
                              href={`/${room.observerLink}/o`}
                              target="_blank"
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="فتح رابط المراقب"
                            >
                              <ExternalLink className="w-4 h-4 text-red-600" />
                            </Link>
                          </div>
                        </div>
                        <div className="text-xs text-red-500 font-mono bg-red-50 px-2 py-1.5 rounded border border-red-200 truncate">
                          {typeof window !== 'undefined' ? `${window.location.origin}/${room.observerLink}/o` : `/${room.observerLink}/o`}
                        </div>
                        <div className="text-xs text-gray-500 italic">
                          💡 المراقب غير مرئي تماماً لجميع المشاركين
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      {room._count.participants} مشارك • {room._count.files} ملف
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingRoom(room)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchRooms();
        }}
      />

      {editingRoom && (
        <UpdateRoomModal
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onSuccess={() => {
            setEditingRoom(null);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    hostApproval: false,
    canRecord: false,
    requireWaitingRoom: false,
    allowGuestUnmute: true,
    enablePrivateChat: true,
    password: '',
    passwordRequired: false,
    passwordFor: 'HOST_ONLY' as 'HOST_ONLY' | 'HOST_AND_GUEST',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState<string>('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);

  // Fetch subscription features when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubscriptionFeatures();
    }
  }, [isOpen]);

  const checkRoomNameAvailability = useCallback(async (roomName: string) => {
    if (!roomName || roomName.trim().length === 0) {
      setNameError('');
      return;
    }

    setIsCheckingName(true);
    setNameError('');

    try {
      const response = await fetch('/api/client/rooms/check-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ roomName }),
      });

      const data = await response.json();

      if (!data.available) {
        setNameError('اسم الغرفة مستخدم بالفعل. يرجى اختيار اسم آخر');
      }
    } catch (error) {
      console.error('Error checking room name:', error);
      // Don't show error on network failure, just silently fail
    } finally {
      setIsCheckingName(false);
    }
  }, []);

  // Debounced name availability check
  useEffect(() => {
    if (!formData.name || !isOpen) {
      setNameError('');
      return;
    }

    const timeoutId = setTimeout(() => {
      checkRoomNameAvailability(formData.name);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.name, isOpen, checkRoomNameAvailability]);

  const fetchSubscriptionFeatures = async () => {
    try {
      const response = await fetch('/api/client/subscription', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.plan && data.plan.features) {
          const enabled = data.plan.features
            .filter((f: { feature: string; enabled: boolean }) => f.enabled)
            .map((f: { feature: string; enabled: boolean }) => f.feature);
          setEnabledFeatures(enabled);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription features:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if name has error
    if (nameError) {
      toast.error(nameError);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/client/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create room');
      }

      toast.success('تم إنشاء الغرفة بنجاح');
      onSuccess();
      setFormData({
        name: '',
        hostApproval: false,
        canRecord: false,
        requireWaitingRoom: false,
        allowGuestUnmute: true,
        enablePrivateChat: true,
        password: '',
        passwordRequired: false,
        passwordFor: 'HOST_ONLY',
      });
      // Reset errors
      setNameError('');
    } catch (error: any) {
      console.error('Error creating room:', error);
      toast.error(error.message || 'فشل إنشاء الغرفة');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء غرفة جديدة" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <FormInput
            label="اسم الغرفة"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={nameError}
            required
          />
          {isCheckingName && (
            <p className="text-xs text-gray-500">جاري التحقق من اسم الغرفة...</p>
          )}
        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer relative group">
            <input
              type="checkbox"
              checked={formData.hostApproval}
              onChange={(e) => setFormData({ ...formData, hostApproval: e.target.checked })}
              disabled={!enabledFeatures.includes('HOST_APPROVAL')}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-700 flex items-center gap-2">
              يتطلب موافقة المضيف
              {!enabledFeatures.includes('HOST_APPROVAL') && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                  PRO
                </span>
              )}
            </span>
            {!enabledFeatures.includes('HOST_APPROVAL') && (
              <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
                This feature requires an upgrade
              </div>
            )}
          </label>
          <label className="flex items-center gap-3 cursor-pointer relative group">
            <input
              type="checkbox"
              checked={formData.canRecord}
              onChange={(e) => setFormData({ ...formData, canRecord: e.target.checked })}
              disabled={!enabledFeatures.includes('RECORDING')}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-700 flex items-center gap-2">
              تفعيل التسجيل
              {!enabledFeatures.includes('RECORDING') && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                  PRO
                </span>
              )}
            </span>
            {!enabledFeatures.includes('RECORDING') && (
              <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
                This feature requires an upgrade
              </div>
            )}
          </label>
          <label className="flex items-center gap-3 cursor-pointer relative group">
            <input
              type="checkbox"
              checked={formData.requireWaitingRoom}
              onChange={(e) => setFormData({ ...formData, requireWaitingRoom: e.target.checked })}
              disabled={!enabledFeatures.includes('WAITING_ROOM')}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-700 flex items-center gap-2">
              يتطلب غرفة انتظار
              {!enabledFeatures.includes('WAITING_ROOM') && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                  PRO
                </span>
              )}
            </span>
            {!enabledFeatures.includes('WAITING_ROOM') && (
              <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
                This feature requires an upgrade
              </div>
            )}
          </label>
          <label className="flex items-center gap-3 cursor-pointer relative group">
            <input
              type="checkbox"
              checked={formData.allowGuestUnmute}
              onChange={(e) => setFormData({ ...formData, allowGuestUnmute: e.target.checked })}
              disabled={!enabledFeatures.includes('GUEST_UNMUTE')}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-700 flex items-center gap-2">
              السماح للضيوف بإلغاء كتم الصوت
              {!enabledFeatures.includes('GUEST_UNMUTE') && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                  PRO
                </span>
              )}
            </span>
            {!enabledFeatures.includes('GUEST_UNMUTE') && (
              <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
                This feature requires an upgrade
              </div>
            )}
          </label>
          <label className="flex items-center gap-3 cursor-pointer relative group">
            <input
              type="checkbox"
              checked={formData.enablePrivateChat}
              onChange={(e) => setFormData({ ...formData, enablePrivateChat: e.target.checked })}
              disabled={!enabledFeatures.includes('PRIVATE_CHAT')}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-700 flex items-center gap-2">
              تفعيل الدردشة الخاصة
              {!enabledFeatures.includes('PRIVATE_CHAT') && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                  PRO
                </span>
              )}
            </span>
            {!enabledFeatures.includes('PRIVATE_CHAT') && (
              <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
                This feature requires an upgrade
              </div>
            )}
          </label>
        </div>

          {/* Password Protection Section */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.passwordRequired}
                onChange={(e) => setFormData({ ...formData, passwordRequired: e.target.checked, password: e.target.checked ? formData.password : '' })}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">يتطلب كلمة مرور</span>
            </label>
            
            {formData.passwordRequired && (
              <div className="space-y-3 pr-6">
                <FormInput
                  label="كلمة المرور"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={formData.passwordRequired}
                  placeholder="أدخل كلمة المرور"
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور مطلوبة لـ</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="passwordFor"
                        value="HOST_ONLY"
                        checked={formData.passwordFor === 'HOST_ONLY'}
                        onChange={(e) => setFormData({ ...formData, passwordFor: 'HOST_ONLY' })}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">المضيف فقط</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="passwordFor"
                        value="HOST_AND_GUEST"
                        checked={formData.passwordFor === 'HOST_AND_GUEST'}
                        onChange={(e) => setFormData({ ...formData, passwordFor: 'HOST_AND_GUEST' })}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">المضيف والضيف</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            إنشاء
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UpdateRoomModal({
  room,
  onClose,
  onSuccess,
}: {
  room: Room;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: room.name,
    description: room.description || '',
    hostApproval: false,
    canRecord: false,
    requireWaitingRoom: false,
    allowGuestUnmute: true,
    enablePrivateChat: true,
    password: '',
    passwordRequired: false,
    passwordFor: 'HOST_ONLY' as 'HOST_ONLY' | 'HOST_AND_GUEST',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);

  // Fetch room details and subscription features
  useEffect(() => {
    fetchRoomDetails();
    fetchSubscriptionFeatures();
  }, []);

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`/api/client/rooms/${room.id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.room.name,
          description: data.room.description || '',
          hostApproval: data.room.hostApproval || false,
          canRecord: data.room.canRecord || false,
          requireWaitingRoom: data.room.requireWaitingRoom || false,
          allowGuestUnmute: data.room.allowGuestUnmute !== undefined ? data.room.allowGuestUnmute : true,
          enablePrivateChat: data.room.enablePrivateChat !== undefined ? data.room.enablePrivateChat : true,
          password: '',
          passwordRequired: data.room.passwordRequired || false,
          passwordFor: data.room.passwordFor || 'HOST_ONLY',
        });
      }
    } catch (error) {
      console.error('Error fetching room details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscriptionFeatures = async () => {
    try {
      const response = await fetch('/api/client/subscription', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.plan && data.plan.features) {
          const enabled = data.plan.features
            .filter((f: { feature: string; enabled: boolean }) => f.enabled)
            .map((f: { feature: string; enabled: boolean }) => f.feature);
          setEnabledFeatures(enabled);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription features:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const requestBody: any = {
        name: formData.name,
        description: formData.description,
        hostApproval: formData.hostApproval,
        canRecord: formData.canRecord,
        requireWaitingRoom: formData.requireWaitingRoom,
        allowGuestUnmute: formData.allowGuestUnmute,
        enablePrivateChat: formData.enablePrivateChat,
      };

      // Handle password fields
      requestBody.passwordRequired = formData.passwordRequired;
      if (formData.passwordRequired) {
        // If password is provided, send it; if empty, backend will keep existing password
        if (formData.password) {
          requestBody.password = formData.password;
        }
        requestBody.passwordFor = formData.passwordFor;
      } else {
        // If passwordRequired is false, set passwordFor to null
        requestBody.passwordFor = null;
      }

      const response = await fetch(`/api/client/rooms/${room.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update room');
      }

      toast.success('تم تحديث الغرفة بنجاح');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating room:', error);
      toast.error(error.message || 'فشل تحديث الغرفة');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="تعديل الغرفة" size="lg">
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <FormInput
              label="اسم الغرفة"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الوصف (اختياري)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer relative group">
                <input
                  type="checkbox"
                  checked={formData.hostApproval}
                  onChange={(e) => setFormData({ ...formData, hostApproval: e.target.checked })}
                  disabled={!enabledFeatures.includes('HOST_APPROVAL')}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  يتطلب موافقة المضيف
                  {!enabledFeatures.includes('HOST_APPROVAL') && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                      PRO
                    </span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer relative group">
                <input
                  type="checkbox"
                  checked={formData.canRecord}
                  onChange={(e) => setFormData({ ...formData, canRecord: e.target.checked })}
                  disabled={!enabledFeatures.includes('RECORDING')}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  تفعيل التسجيل
                  {!enabledFeatures.includes('RECORDING') && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                      PRO
                    </span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer relative group">
                <input
                  type="checkbox"
                  checked={formData.requireWaitingRoom}
                  onChange={(e) => setFormData({ ...formData, requireWaitingRoom: e.target.checked })}
                  disabled={!enabledFeatures.includes('WAITING_ROOM')}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  يتطلب غرفة انتظار
                  {!enabledFeatures.includes('WAITING_ROOM') && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                      PRO
                    </span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer relative group">
                <input
                  type="checkbox"
                  checked={formData.allowGuestUnmute}
                  onChange={(e) => setFormData({ ...formData, allowGuestUnmute: e.target.checked })}
                  disabled={!enabledFeatures.includes('GUEST_UNMUTE')}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  السماح للضيوف بإلغاء كتم الصوت
                  {!enabledFeatures.includes('GUEST_UNMUTE') && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                      PRO
                    </span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer relative group">
                <input
                  type="checkbox"
                  checked={formData.enablePrivateChat}
                  onChange={(e) => setFormData({ ...formData, enablePrivateChat: e.target.checked })}
                  disabled={!enabledFeatures.includes('PRIVATE_CHAT')}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  تفعيل الدردشة الخاصة
                  {!enabledFeatures.includes('PRIVATE_CHAT') && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                      PRO
                    </span>
                  )}
                </span>
              </label>
            </div>

            {/* Password Protection Section */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.passwordRequired}
                  onChange={(e) => setFormData({ ...formData, passwordRequired: e.target.checked, password: e.target.checked ? formData.password : '' })}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">يتطلب كلمة مرور</span>
              </label>
              
              {formData.passwordRequired && (
                <div className="space-y-3 pr-6">
                  <FormInput
                    label="كلمة المرور (اتركه فارغاً للاحتفاظ بالكلمة الحالية)"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="أدخل كلمة مرور جديدة أو اتركه فارغاً"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور مطلوبة لـ</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="passwordFor"
                          value="HOST_ONLY"
                          checked={formData.passwordFor === 'HOST_ONLY'}
                          onChange={(e) => setFormData({ ...formData, passwordFor: 'HOST_ONLY' })}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">المضيف فقط</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="passwordFor"
                          value="HOST_AND_GUEST"
                          checked={formData.passwordFor === 'HOST_AND_GUEST'}
                          onChange={(e) => setFormData({ ...formData, passwordFor: 'HOST_AND_GUEST' })}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">المضيف والضيف</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              حفظ التغييرات
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function RoomsManagementClient({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  return (
    <SidebarProvider>
      <RoomsManagementContent clientId={clientId} userEmail={userEmail} />
    </SidebarProvider>
  );
}
