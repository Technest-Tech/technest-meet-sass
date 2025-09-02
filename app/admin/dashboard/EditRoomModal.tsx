'use client';

import { useState, useEffect } from 'react';
import { X, Users, Settings, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  name: string;
  description?: string;
  hostApproval: boolean;
  maxParticipants: number;
  isActive: boolean;
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
    description: '',
    hostApproval: false,
    maxParticipants: 50,
    isActive: true
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFormData({
      name: room.name,
      description: room.description || '',
      hostApproval: room.hostApproval,
      maxParticipants: room.maxParticipants,
      isActive: room.isActive
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
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedRoom = await response.json();
        onRoomUpdated(updatedRoom);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update room');
      }
    } catch (error) {
      console.error('Failed to update room:', error);
      alert('An error occurred while updating the room');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Room</h2>
              <p className="text-sm text-gray-600">Update room settings and configuration</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Room Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Room Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Enter room name"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Optional room description"
            />
          </div>

          {/* Max Participants */}
          <div>
            <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Participants
            </label>
            <div className="relative">
              <input
                id="maxParticipants"
                type="number"
                min="1"
                max="100"
                value={formData.maxParticipants}
                onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Users className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Room Settings
            </h3>
            
            {/* Host Approval */}
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="hostApproval" className="text-sm font-medium text-gray-700">
                  Require Host Approval
                </label>
                <p className="text-xs text-gray-500">Guests must wait for host approval to join</p>
              </div>
              <button
                type="button"
                onClick={() => handleInputChange('hostApproval', !formData.hostApproval)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  formData.hostApproval ? 'bg-primary-600' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    formData.hostApproval ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Room Active
                </label>
                <p className="text-xs text-gray-500">Enable or disable the room</p>
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
          </div>

          {/* Room Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Room Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Host Link:</span>
                <p className="font-mono text-xs bg-white px-2 py-1 rounded border mt-1">
                  {room.hostLink}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Guest Link:</span>
                <p className="font-mono text-xs bg-white px-2 py-1 rounded border mt-1">
                  {room.guestLink}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Participants:</span>
                <p className="font-semibold">{room.participants.length}</p>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <p className="text-xs">{new Date(room.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Cancel
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
