'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Users, Settings, Copy, ExternalLink, Trash2, Edit } from 'lucide-react';
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">NewMeet Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto scroll-smooth bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full">
          {/* Search and Stats */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Rooms</h2>
                <p className="text-gray-600">Manage your video conference rooms</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-600">Total Rooms: </span>
                  <span className="font-semibold text-gray-900">{rooms.length}</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-600">Active: </span>
                  <span className="font-semibold text-green-600">{rooms.filter(r => r.isActive).length}</span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mt-6">
              <div className="relative max-w-md">
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md',
                  !room.isActive && 'opacity-75'
                )}
              >
                {/* Room Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                                          <h3 className="text-lg font-semibold text-gray-900 truncate">{room.name}</h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingRoom(room)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRoom(room.id)}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  </div>
                  
                  {room.description && (
                    <p className="text-sm text-gray-600 mb-3">{room.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      room.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    )}>
                      {room.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-gray-500">
                      {room.participants.length} participants
                    </span>
                  </div>
                </div>

                {/* Room Links */}
                <div className="p-6 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Host Link</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/room/${room.hostLink}?type=host`}
                        readOnly
                        className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600"
                      />
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/room/${room.hostLink}?type=host`)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`/room/${room.hostLink}?type=host`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-primary-600 hover:text-primary-700 transition-colors"
                        title="Open link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">👑 Host access with admin controls</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Guest Link</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/room/${room.guestLink}?type=guest`}
                        readOnly
                        className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600"
                      />
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/room/${room.guestLink}?type=guest`)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`/room/${room.guestLink}?type=guest`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-primary-600 hover:text-primary-700 transition-colors"
                        title="Open link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">👤 Guest access with basic permissions</p>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">
                      💡 Both links join the same meeting room: <strong>{room.name}</strong>
                    </p>
                  </div>
                </div>

                {/* Room Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created {formatDate(new Date(room.createdAt))}</span>
                    <span className={cn(
                      'px-2 py-1 rounded text-xs',
                      room.hostApproval 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-blue-100 text-blue-800'
                    )}>
                      {room.hostApproval ? 'Approval Required' : 'Direct Access'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRooms.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first room.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Room
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
