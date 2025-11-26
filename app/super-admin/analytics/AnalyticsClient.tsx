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
  Gift,
  BarChart3,
} from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';
import AnalyticsSummary from './components/AnalyticsSummary';
import DeviceTypeChart from './components/DeviceTypeChart';
import BrowserChart from './components/BrowserChart';
import OSChart from './components/OSChart';
import DeviceTrendsChart from './components/DeviceTrendsChart';
import BrowserTrendsChart from './components/BrowserTrendsChart';
import OSTrendsChart from './components/OSTrendsChart';

interface DeviceAnalytics {
  summary: {
    deviceTypes: { desktop: number; mobile: number; tablet: number; unknown: number };
    browsers: Record<string, number>;
    operatingSystems: Record<string, number>;
    totalParticipants: number;
  };
  trends: {
    deviceTypes: Array<{ month: string; desktop: number; mobile: number; tablet: number; unknown: number }>;
    browsers: Array<Record<string, number>>;
    operatingSystems: Array<Record<string, number>>;
  };
}

function AnalyticsContent({ userEmail }: { userEmail: string }) {
  const [analytics, setAnalytics] = useState<DeviceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/super-admin/analytics/device', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
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
    { href: '/super-admin/analytics', label: 'التحليلات', icon: BarChart3 },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم المشرف"
        onLogout={handleLogout}
      />

      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="Device & Browser Analytics"
          subtitle="All-time historical device and browser distribution analytics"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* Summary Cards */}
              <AnalyticsSummary summary={analytics.summary} />

              {/* Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <DeviceTypeChart data={analytics.summary.deviceTypes} />
                <BrowserChart data={analytics.summary.browsers} />
                <OSChart data={analytics.summary.operatingSystems} />
              </div>

              {/* Trend Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <DeviceTrendsChart data={analytics.trends.deviceTypes} />
                <BrowserTrendsChart data={analytics.trends.browsers} />
              </div>
              <div className="mb-8">
                <OSTrendsChart data={analytics.trends.operatingSystems} />
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>No analytics data available</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AnalyticsClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <AnalyticsContent userEmail={userEmail} />
    </SidebarProvider>
  );
}

