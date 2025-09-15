'use client';

import { useState } from 'react';
import { X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateRoomModalProps {
  onClose: () => void;
  onRoomCreated: (room: any) => void;
}

export default function CreateRoomModal({ onClose, onRoomCreated }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    isActive: true,
    canRecord: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          description: '',
          hostApproval: false,
          maxParticipants: 50
        }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        onRoomCreated(newRoom);
      } else {
        const error = await response.json();
        alert(error.message || 'فشل في إنشاء الغرفة');
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('حدث خطأ أثناء إنشاء الغرفة');
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
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">إنشاء غرفة جديدة</h2>
              <p className="text-sm text-gray-600">إعداد غرفة مؤتمرات فيديو جديدة</p>
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
                  جاري الإنشاء...
                </div>
              ) : (
                'إنشاء الغرفة'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
