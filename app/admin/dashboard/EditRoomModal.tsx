'use client';

import { useState, useEffect } from 'react';
import { X, Users, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface EditRoomModalProps {
  room: Room;
  onClose: () => void;
  onRoomUpdated: (room: Room) => void;
}

export default function EditRoomModal({ room, onClose, onRoomUpdated }: EditRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    isActive: true,
    canRecord: false
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFormData({
      name: room.name,
      isActive: room.isActive,
      canRecord: room.canRecord
    });
  }, [room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/rooms/${room.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          description: room.description || '',
          hostApproval: room.hostApproval,
          maxParticipants: room.maxParticipants,
          canRecord: formData.canRecord
        }),
      });

      if (response.ok) {
        const updatedRoom = await response.json();
        onRoomUpdated(updatedRoom);
      } else {
        const error = await response.json();
        alert(error.message || 'فشل في تحديث الغرفة');
      }
    } catch (error) {
      console.error('Failed to update room:', error);
      alert('حدث خطأ أثناء تحديث الغرفة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center ml-3">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">تعديل الغرفة</h2>
              <p className="text-sm text-gray-600">تحديث إعدادات الغرفة والتكوين</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Room Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2 text-right">
              اسم الغرفة *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-right"
              placeholder="أدخل اسم الغرفة"
              required
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div className="text-right">
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                الغرفة نشطة
              </label>
              <p className="text-xs text-gray-500">تفعيل أو تعطيل الغرفة</p>
            </div>
            <button
              type="button"
              onClick={() => handleInputChange('isActive', !formData.isActive)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                formData.isActive ? 'bg-green-600' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Recording Status */}
          <div className="flex items-center justify-between">
            <div className="text-right">
              <label htmlFor="canRecord" className="text-sm font-medium text-gray-700">
                تسجيل الاجتماعات
              </label>
              <p className="text-xs text-gray-500">السماح بتسجيل الاجتماعات في هذه الغرفة</p>
            </div>
            <button
              type="button"
              onClick={() => handleInputChange('canRecord', !formData.canRecord)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                formData.canRecord ? 'bg-blue-600' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  formData.canRecord ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Room Info - Simplified */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 text-right">معلومات الغرفة</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-right">
                <span className="text-gray-500">المشاركون:</span>
                <p className="font-semibold">{room.participants.length}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-500">تاريخ الإنشاء:</span>
                <p className="text-xs">{new Date(room.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-reverse space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.name.trim()}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors',
                (isLoading || !formData.name.trim()) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  جاري الحفظ...
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ التغييرات
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
