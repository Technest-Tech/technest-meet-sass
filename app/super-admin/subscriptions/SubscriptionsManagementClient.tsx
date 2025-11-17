'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, XCircle, AlertCircle, Activity, CreditCard, Users, Package, Building2, Gift } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Button from '@/lib/components/Button';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';

interface Subscription {
  id: string;
  status: string;
  isTrial?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDays?: number;
  client: {
    id: string;
    name: string;
    email: string;
  };
  plan: {
    id: string;
    name: string;
    features: Array<{ feature: string; enabled: boolean }>;
  };
  createdAt: string;
}

interface Plan {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

function SubscriptionsManagementContent({ userEmail }: { userEmail: string }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subsRes, plansRes, clientsRes] = await Promise.all([
        fetch('/api/super-admin/subscriptions', { credentials: 'include' }),
        fetch('/api/super-admin/plans', { credentials: 'include' }),
        fetch('/api/super-admin/clients', { credentials: 'include' }),
      ]);

      if (subsRes.ok) {
        const data = await subsRes.json();
        setSubscriptions(data.subscriptions || []);
      }

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans || []);
      }

      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('فشل تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const handleStatusChange = async (subscriptionId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      toast.success('تم تحديث حالة الاشتراك بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('فشل تحديث حالة الاشتراك');
    }
  };

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: Package },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
    { href: '/super-admin/referrals', label: 'الإحالات والمكافآت', icon: Gift },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-100';
      case 'TRIAL':
        return 'text-blue-600 bg-blue-100';
      case 'EXPIRED':
      case 'TRIAL_EXPIRED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'نشط';
      case 'TRIAL':
        return 'تجريبي';
      case 'EXPIRED':
        return 'منتهي';
      case 'TRIAL_EXPIRED':
        return 'انتهت الفترة التجريبية';
      default:
        return 'غير نشط';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'غير متوفر';
    const date = new Date(dateString);
    // Use Gregorian calendar by manually formatting
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

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
          title="إدارة الاشتراكات"
          subtitle="إدارة اشتراكات العملاء"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8">
          <div className="flex justify-end items-center mb-8">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              إنشاء اشتراك جديد
            </Button>
          </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">العميل</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">الخطة</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">الحالة</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">تاريخ الإنشاء</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{subscription.client.name}</div>
                        <div className="text-sm text-gray-500">{subscription.client.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {subscription.plan.name}
                      {subscription.isTrial && (
                        <span className="mr-2 text-xs text-blue-600 font-medium">(تجريبي)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}
                        >
                          {getStatusText(subscription.status)}
                        </span>
                        {subscription.isTrial && subscription.trialEndDate && (
                          <span className="text-xs text-gray-500">
                            ينتهي: {formatDate(subscription.trialEndDate)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(subscription.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {subscription.status === 'ACTIVE' ? (
                          <>
                            <button
                              onClick={() => handleStatusChange(subscription.id, 'INACTIVE')}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="تعطيل"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(subscription.id, 'EXPIRED')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="إنهاء"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(subscription.id, 'ACTIVE')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="تفعيل"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

          {showCreateModal && (
            <CreateSubscriptionModal
              plans={plans}
              clients={clients}
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => {
                setShowCreateModal(false);
                fetchData();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function SubscriptionsManagementClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <SubscriptionsManagementContent userEmail={userEmail} />
    </SidebarProvider>
  );
}

function CreateSubscriptionModal({
  plans,
  clients,
  onClose,
  onSuccess,
}: {
  plans: Plan[];
  clients: Client[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    clientId: '',
    planId: '',
    status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'TRIAL',
    isTrial: false,
    trialDays: 3,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const requestBody: any = {
        clientId: formData.clientId,
        planId: formData.planId,
        status: formData.status,
      };

      // Include trial fields if isTrial is true
      if (formData.isTrial) {
        requestBody.isTrial = true;
        requestBody.trialDays = formData.trialDays;
      }

      const response = await fetch('/api/super-admin/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create subscription');
      }

      toast.success('تم إنشاء الاشتراك بنجاح');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      toast.error(error.message || 'فشل إنشاء الاشتراك');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">إنشاء اشتراك جديد</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              العميل *
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">اختر عميل</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الخطة *
            </label>
            <select
              value={formData.planId}
              onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">اختر خطة</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحالة *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="INACTIVE">غير نشط</option>
              <option value="ACTIVE">نشط</option>
              <option value="TRIAL">تجريبي</option>
              <option value="EXPIRED">منتهي</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isTrial"
              checked={formData.isTrial}
              onChange={(e) => {
                const isTrial = e.target.checked;
                setFormData({ 
                  ...formData, 
                  isTrial,
                  status: isTrial ? 'TRIAL' : 'INACTIVE'
                });
              }}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="isTrial" className="text-sm font-medium text-gray-700">
              تفعيل الفترة التجريبية
            </label>
          </div>

          {formData.isTrial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                مدة التجربة (أيام) *
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={formData.trialDays}
                onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) || 3 })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

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
              {isLoading ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

