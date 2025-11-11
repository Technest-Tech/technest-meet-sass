'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Video, 
  CreditCard, 
  Settings, 
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import StatCard from '@/lib/components/StatCard';
import Button from '@/lib/components/Button';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';

interface SubscriptionInfo {
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  plan: {
    name: string;
    maxParticipants: number;
    features: Array<{ feature: string; enabled: boolean }>;
  } | null;
}

interface ClientLimits {
  maxRooms: number;
  maxParticipants: number;
  currentRooms: number;
}

function ClientDashboardContent({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [limits, setLimits] = useState<ClientLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  const totalHostsCapacity = limits ? limits.maxRooms : 0;
  const perRoomGuestCapacity = limits ? Math.max(limits.maxParticipants - 1, 0) : 0;
  const totalGuestCapacity = limits ? perRoomGuestCapacity * limits.maxRooms : 0;
  const totalParticipantsCapacity = limits ? limits.maxRooms * limits.maxParticipants : 0;

  useEffect(() => {
    fetchDashboardData();
  }, [clientId]);

  const fetchDashboardData = async () => {
    try {
      const [subscriptionRes, limitsRes] = await Promise.all([
        fetch('/api/client/subscription', { credentials: 'include' }),
        fetch('/api/client/limits', { credentials: 'include' }),
      ]);

      if (subscriptionRes.ok) {
        const subData = await subscriptionRes.json();
        setSubscription(subData);
      }

      if (limitsRes.ok) {
        const limitsData = await limitsRes.json();
        setLimits(limitsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('فشل تحميل بيانات لوحة التحكم');
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

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'EXPIRED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getSubscriptionStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'نشط';
      case 'EXPIRED':
        return 'منتهي';
      default:
        return 'غير نشط';
    }
  };

  const getSubscriptionStatusIcon = (status: string) => {
    return status === 'ACTIVE' ? CheckCircle : AlertCircle;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم العميل"
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="لوحة التحكم"
          subtitle="نظرة عامة على حسابك واشتراكك"
          userEmail={userEmail}
        />

        <main className="p-4 sm:p-6 lg:p-8">
          {/* Welcome Section */}
          <div className="mb-6 md:mb-8">
            <Card className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 text-white border-0 shadow-large">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2">مرحباً بك، {userEmail}</h2>
                  <p className="text-white/90 text-sm md:text-base">إدارة غرفك ومراقبة استخدامك</p>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  rightIcon={<Plus className="w-4 h-4" />}
                  onClick={() => router.push('/client/rooms')}
                >
                  إنشاء غرفة جديدة
                </Button>
              </div>
            </Card>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-32 bg-gray-200 rounded" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Subscription Status */}
              {subscription && (
                <Card className="mb-6 border-2 border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${getSubscriptionStatusColor(subscription.status).split(' ')[0]}`}>
                        {(() => {
                          const Icon = getSubscriptionStatusIcon(subscription.status);
                          return <Icon className="w-6 h-6" />;
                        })()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">حالة الاشتراك</h2>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {subscription.plan?.name || 'لا توجد خطة'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-4 py-2 rounded-full text-sm font-semibold border ${getSubscriptionStatusColor(
                        subscription.status
                      )}`}
                    >
                      {getSubscriptionStatusText(subscription.status)}
                    </span>
                  </div>
                  
                  {subscription.status !== 'ACTIVE' && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-yellow-800 font-medium">
                            اشتراكك غير نشط
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            يرجى التواصل مع المسؤول لتفعيل اشتراكك والاستفادة من جميع الميزات
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Usage Limits */}
              {limits && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                  <Card hover>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-xl">
                          <Video className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">الغرف</h3>
                          <p className="text-sm text-gray-600">الغرف المستخدمة / الحد الأقصى</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-900">
                          {limits.currentRooms}
                        </span>
                        <span className="text-sm text-gray-600">
                          / {limits.maxRooms}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            (limits.currentRooms / limits.maxRooms) * 100 >= 80
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min((limits.currentRooms / limits.maxRooms) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      {(limits.currentRooms / limits.maxRooms) * 100 >= 80 && (
                        <p className="text-xs text-red-600">قريب من الحد الأقصى</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">إجمالي الحد المسموح: {limits.maxRooms} غرفة</p>
                    </div>
                  </Card>

                  <Card hover>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-100 rounded-xl">
                          <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">السعة القصوى للمضيفين</h3>
                          <p className="text-sm text-gray-600">مضيف واحد لكل غرفة</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-900">
                          {totalHostsCapacity}
                        </span>
                        <span className="text-sm text-gray-600">مضيف</span>
                      </div>
                      <p className="text-xs text-gray-500">الحد الحالي يستخدم {limits.currentRooms} غرفة من أصل {limits.maxRooms}</p>
                    </div>
                  </Card>

                  <Card hover>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">السعة القصوى للضيوف</h3>
                          <p className="text-sm text-gray-600">إجمالي الضيوف المسموح بهم عبر كل الغرف</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-900">
                          {totalGuestCapacity}
                        </span>
                        <span className="text-sm text-gray-600">ضيف</span>
                      </div>
                      <p className="text-xs text-gray-500">{perRoomGuestCapacity} ضيف لكل غرفة × {limits.maxRooms} غرفة = {totalParticipantsCapacity} مشارك إجمالي ناقص عدد المضيفين</p>
                    </div>
                  </Card>
                </div>
              )}

              {/* Quick Actions */}
              <Card>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">إجراءات سريعة</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => router.push('/client/rooms')}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <Video className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">إدارة الغرف</span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </button>
                  <button
                    onClick={() => router.push('/client/subscription')}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                        <CreditCard className="w-5 h-5 text-indigo-600" />
                      </div>
                      <span className="font-medium text-gray-900">معلومات الاشتراك</span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  </button>
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ClientDashboardClient({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  return (
    <SidebarProvider>
      <ClientDashboardContent clientId={clientId} userEmail={userEmail} />
    </SidebarProvider>
  );
}
