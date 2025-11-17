'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Activity, Building2, Users, Package, CreditCard, Gift } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';

interface Client {
  id: string;
  name: string;
  email: string;
  maxRooms: number;
  maxParticipants: number;
  enableObserverLinks: boolean;
  subscription?: {
    status: string;
    plan: {
      name: string;
    };
  };
  _count: {
    rooms: number;
    hostAccounts: number;
    guestAccounts: number;
  };
}

function ClientsManagementContent({ userEmail }: { userEmail: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/super-admin/clients', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('فشل تحميل العملاء');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: Package },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
    { href: '/super-admin/referrals', label: 'الإحالات والمكافآت', icon: Gift },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم المشرف"
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="إدارة العملاء"
          subtitle="عرض وإدارة عملاء النظام"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8">

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{client.name}</h3>
                    <p className="text-sm text-gray-600">{client.email}</p>
                  </div>
                  <button
                    onClick={() => setEditingClient(client)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="تعديل الحدود"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                {client.subscription && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">الاشتراك</p>
                    <p className="text-sm font-medium text-gray-900">
                      {client.subscription.plan.name} -{' '}
                      <span
                        className={
                          client.subscription.status === 'ACTIVE'
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }
                      >
                        {client.subscription.status === 'ACTIVE' ? 'نشط' : 'غير نشط'}
                      </span>
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">الغرف:</span>
                    <span className="font-medium text-gray-900">
                      {client._count.rooms} / {client.maxRooms}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الحد الأقصى للمشاركين:</span>
                    <span className="font-medium text-gray-900">
                      {client.maxParticipants}
                    </span>
                  </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">روابط المراقب السرية:</span>
                  <span className={`font-medium ${client.enableObserverLinks ? 'text-green-600' : 'text-gray-500'}`}>
                    {client.enableObserverLinks ? 'مفعلة' : 'معطلة'}
                  </span>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}

          {editingClient && (
            <EditLimitsModal
              client={editingClient}
              onClose={() => setEditingClient(null)}
              onSuccess={() => {
                setEditingClient(null);
                fetchClients();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function ClientsManagementClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <ClientsManagementContent userEmail={userEmail} />
    </SidebarProvider>
  );
}

function EditLimitsModal({
  client,
  onClose,
  onSuccess,
}: {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    maxRooms: client.maxRooms,
    maxParticipants: client.maxParticipants,
    enableObserverLinks: client.enableObserverLinks,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/super-admin/clients/${client.id}/limits`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update limits');
      }

      toast.success('تم تحديث الحدود بنجاح');
      onSuccess();
    } catch (error) {
      console.error('Error updating limits:', error);
      toast.error('فشل تحديث الحدود');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">تعديل الحدود - {client.name}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحد الأقصى للغرف
            </label>
            <input
              type="number"
              value={formData.maxRooms}
              onChange={(e) => setFormData({ ...formData, maxRooms: parseInt(e.target.value) })}
              min={1}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">الحد الأقصى لعدد الغرف التي يمكن للعميل إنشاؤها</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحد الأقصى للمشاركين في الغرفة
            </label>
            <input
              type="number"
              value={formData.maxParticipants}
              onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
              min={1}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">يتم تطبيق هذا الحد على كل غرفة يتم إنشاؤها</p>
          </div>

          <div className="flex items-start justify-between border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="pr-4">
              <p className="text-sm font-medium text-gray-900">روابط المراقب السرية</p>
              <p className="text-sm text-gray-600 mt-1">
                عند التفعيل سيتم إنشاء رابط مراقب سري لكل غرفة لتمكين العميل من مراقبة الاجتماعات دون الظهور للمشاركين.
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={formData.enableObserverLinks}
                onChange={(e) => setFormData({ ...formData, enableObserverLinks: e.target.checked })}
              />
              <span
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                  formData.enableObserverLinks ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    formData.enableObserverLinks ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

