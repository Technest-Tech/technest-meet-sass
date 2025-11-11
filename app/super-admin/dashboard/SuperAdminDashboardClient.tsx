'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Package, 
  CreditCard, 
  Building2, 
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import StatCard from '@/lib/components/StatCard';
import Card from '@/lib/components/Card';
import Button from '@/lib/components/Button';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalAccounts: number;
  totalClients: number;
  totalPlans: number;
  activeSubscriptions: number;
}

function SuperAdminDashboardContent({ userEmail }: { userEmail: string }) {
  const [stats, setStats] = useState<DashboardStats>({
    totalAccounts: 0,
    totalClients: 0,
    totalPlans: 0,
    activeSubscriptions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/super-admin/stats', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('فشل تحميل الإحصائيات');
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
          title="لوحة التحكم"
          subtitle="نظرة عامة على النظام والإحصائيات"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <Card className="bg-gradient-primary text-white border-0 shadow-large">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">مرحباً بك، {userEmail}</h2>
                  <p className="text-white/90">إليك نظرة سريعة على أداء النظام اليوم</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    rightIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push('/super-admin/accounts')}
                  >
                    إنشاء حساب جديد
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Stats Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-24 bg-gray-200 rounded" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="إجمالي الحسابات"
                value={stats.totalAccounts}
                icon={Users}
                color="blue"
                trend={{ value: 12, isPositive: true }}
                description="حسابات نشطة"
              />
              <StatCard
                title="العملاء"
                value={stats.totalClients}
                icon={Building2}
                color="green"
                trend={{ value: 8, isPositive: true }}
                description="عملاء مسجلون"
              />
              <StatCard
                title="الخطط"
                value={stats.totalPlans}
                icon={Package}
                color="purple"
                description="خطط متاحة"
              />
              <StatCard
                title="الاشتراكات النشطة"
                value={stats.activeSubscriptions}
                icon={TrendingUp}
                color="indigo"
                trend={{ value: 5, isPositive: true }}
                description="اشتراكات مفعلة"
              />
            </div>
          )}

          {/* Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4">إجراءات سريعة</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/super-admin/accounts')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                      <Users className="w-5 h-5 text-primary-600" />
                    </div>
                    <span className="font-medium text-gray-900">إدارة الحسابات</span>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                </button>
                <button
                  onClick={() => router.push('/super-admin/plans')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <Package className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="font-medium text-gray-900">إدارة الخطط</span>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                </button>
                <button
                  onClick={() => router.push('/super-admin/subscriptions')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="font-medium text-gray-900">إدارة الاشتراكات</span>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </button>
              </div>
            </Card>

            {/* System Status */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4">حالة النظام</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium text-gray-900">قاعدة البيانات</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">متصل</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium text-gray-900">الخادم</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">يعمل</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <span className="font-medium text-gray-900">LiveKit</span>
                  </div>
                  <span className="text-sm text-blue-600 font-medium">نشط</span>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <SuperAdminDashboardContent userEmail={userEmail} />
    </SidebarProvider>
  );
}
