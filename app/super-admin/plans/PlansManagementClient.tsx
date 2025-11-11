'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Activity, Package, CreditCard, Building2, Users } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Button from '@/lib/components/Button';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';
import { FeatureType } from '@prisma/client';

interface Plan {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  features: Array<{ feature: FeatureType; enabled: boolean }>;
  _count: {
    subscriptions: number;
  };
}

const ALL_FEATURES: FeatureType[] = [
  'RECORDING',
  'WAITING_ROOM',
  'PRIVATE_CHAT',
  'GUEST_UNMUTE',
  'HOST_APPROVAL',
  'SCREEN_ANNOTATION',
  'FILE_SHARING',
  'PDF_VIEWER',
  'REACTIONS',
  'RAISE_HAND',
  'E2EE',
  'CUSTOM_BRANDING',
  'PICTURE_IN_PICTURE',
  'STUDENT_MONITOR_PIP',
  'COLLABORATIVE_WHITEBOARD',
  'NORMAL_WHITEBOARD',
  'MANAGE_PARTICIPANTS',
  'VIRTUAL_BACKGROUND',
];

const FEATURE_LABELS: Record<FeatureType, string> = {
  RECORDING: 'Recording',
  WAITING_ROOM: 'Waiting Room',
  PRIVATE_CHAT: 'Private Chat',
  GUEST_UNMUTE: 'Guest Unmute',
  HOST_APPROVAL: 'Host Approval',
  SCREEN_ANNOTATION: 'Screen Annotation',
  FILE_SHARING: 'File Sharing',
  PDF_VIEWER: 'PDF Viewer',
  REACTIONS: 'Reactions',
  RAISE_HAND: 'Raise Hand',
  E2EE: 'End-to-End Encryption',
  CUSTOM_BRANDING: 'Custom Branding',
  PICTURE_IN_PICTURE: 'Picture in Picture',
  STUDENT_MONITOR_PIP: 'Student Monitor PiP',
  COLLABORATIVE_WHITEBOARD: 'Collaborative Whiteboard',
  NORMAL_WHITEBOARD: 'Normal Whiteboard',
  MANAGE_PARTICIPANTS: 'Manage Participants',
  VIRTUAL_BACKGROUND: 'Virtual Background',
};

function PlansManagementContent({ userEmail }: { userEmail: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/super-admin/plans', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('فشل تحميل الخطط');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الخطة؟')) {
      return;
    }

    try {
      const response = await fetch(`/api/super-admin/plans/${planId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete plan');
      }

      toast.success('تم حذف الخطة بنجاح');
      fetchPlans();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error(error.message || 'فشل حذف الخطة');
    }
  };

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: Package },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
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
          title="إدارة الخطط"
          subtitle="إنشاء وإدارة خطط الاشتراك"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8">
          <div className="flex justify-between items-center mb-8">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              إنشاء خطة جديدة
            </Button>
          </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      plan.isActive
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {plan.isActive ? 'نشط' : 'غير نشط'}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    الميزات ({plan.features.filter((f) => f.enabled).length} / {ALL_FEATURES.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {plan.features
                      .filter((f) => f.enabled)
                      .slice(0, 5)
                      .map((feature) => (
                        <span
                          key={feature.feature}
                          className="px-2 py-1 bg-indigo-100 text-indigo-600 text-xs rounded"
                        >
                          {FEATURE_LABELS[feature.feature]}
                        </span>
                      ))}
                    {plan.features.filter((f) => f.enabled).length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{plan.features.filter((f) => f.enabled).length - 5}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    {plan._count.subscriptions} اشتراك
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingPlan(plan)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="تعديل"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

          {showCreateModal && (
            <PlanModal
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => {
                setShowCreateModal(false);
                fetchPlans();
              }}
            />
          )}

          {editingPlan && (
            <PlanModal
              plan={editingPlan}
              onClose={() => setEditingPlan(null)}
              onSuccess={() => {
                setEditingPlan(null);
                fetchPlans();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function PlansManagementClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <PlansManagementContent userEmail={userEmail} />
    </SidebarProvider>
  );
}

function PlanModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan?: Plan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    features: plan?.features.filter((f) => f.enabled).map((f) => f.feature) || [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = plan
        ? `/api/super-admin/plans/${plan.id}`
        : '/api/super-admin/plans';
      const method = plan ? 'PUT' : 'POST';

      // Prepare request body - features are handled separately
      const requestBody: any = {
        name: formData.name,
        description: formData.description,
      };

      // Only include features when creating a new plan
      if (!plan) {
        requestBody.features = formData.features;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save plan');
      }

      if (!plan) {
        // After creating, update features
        const createdPlan = await response.json();
        await fetch(`/api/super-admin/plans/${createdPlan.plan.id}/features`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            features: ALL_FEATURES.map((feature) => ({
              feature,
              enabled: formData.features.includes(feature),
            })),
          }),
        });
      } else {
        // Update features for existing plan
        await fetch(`/api/super-admin/plans/${plan.id}/features`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            features: ALL_FEATURES.map((feature) => ({
              feature,
              enabled: formData.features.includes(feature),
            })),
          }),
        });
      }

      toast.success(plan ? 'تم تحديث الخطة بنجاح' : 'تم إنشاء الخطة بنجاح');
      onSuccess();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'فشل حفظ الخطة');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFeature = (feature: FeatureType) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {plan ? 'تعديل الخطة' : 'إنشاء خطة جديدة'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم الخطة *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الوصف
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              الميزات
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-4 border border-gray-200 rounded-lg">
              {ALL_FEATURES.map((feature) => (
                <label
                  key={feature}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={formData.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{FEATURE_LABELS[feature]}</span>
                </label>
              ))}
            </div>
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

