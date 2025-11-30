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
  ChevronDown,
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
import AccountStatsCards from './components/AccountStatsCards';
import AccountRoomsList from './components/AccountRoomsList';
import Card from '@/lib/components/Card';

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

interface Account {
  id: string;
  email: string;
  client?: {
    name: string;
  };
}

interface AccountStats {
  activeSessionsNow: number;
  activeParticipantsNow: number;
  totalSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  maxParticipants: number;
  stats: {
    fileCount: number;
    storageBytes: number;
    participantSlots: number;
  };
  sessionStatus: {
    isRunning: boolean;
    currentSessionStart: string | null;
  };
}

function AnalyticsContent({ userEmail }: { userEmail: string }) {
  const [analytics, setAnalytics] = useState<DeviceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingAccountData, setIsLoadingAccountData] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchAnalytics();
    fetchAccounts();
  }, []);

  // Poll for real-time account stats when an account is selected
  useEffect(() => {
    if (!selectedAccountId) return;

    const fetchRealtimeStats = async () => {
      try {
        const response = await fetch(
          `/api/super-admin/analytics/account/${selectedAccountId}/stats`,
          {
            credentials: 'include',
          }
        );

        if (response.ok) {
          const data = await response.json();
          setAccountStats(data.stats);
          setAccountEmail(data.accountEmail);
          setClientName(data.clientName);
        }
      } catch (error) {
        console.error('Error fetching real-time stats:', error);
      }
    };

    // Fetch immediately
    fetchRealtimeStats();

    // Then poll every 3 seconds
    const interval = setInterval(fetchRealtimeStats, 3000);

    return () => clearInterval(interval);
  }, [selectedAccountId]);

  // Fetch account data when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountData();
    } else {
      setAccountStats(null);
      setRooms([]);
      setAccountEmail('');
      setClientName('');
    }
  }, [selectedAccountId]);

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

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/super-admin/accounts?pageSize=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchAccountData = async () => {
    setIsLoadingAccountData(true);
    try {
      const [statsResponse, roomsResponse] = await Promise.all([
        fetch(`/api/super-admin/analytics/account/${selectedAccountId}/stats`, {
          credentials: 'include',
        }),
        fetch(`/api/super-admin/accounts/${selectedAccountId}/rooms?pageSize=1000`, {
          credentials: 'include',
        }),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setAccountStats(statsData.stats);
        setAccountEmail(statsData.accountEmail);
        setClientName(statsData.clientName);
      }

      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json();
        setRooms(roomsData.rooms || []);
      }
    } catch (error) {
      console.error('Error fetching account data:', error);
      toast.error('فشل تحميل بيانات الحساب');
    } finally {
      setIsLoadingAccountData(false);
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
          {/* Account Selection Dropdown */}
          <Card className="mb-8">
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اختر الحساب (الأكاديمية)
              </label>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 appearance-none"
                >
                  <option value="">-- اختر حساب --</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.client?.name || account.email} ({account.email})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </Card>

          {/* Account-Specific Analytics */}
          {selectedAccountId && (
            <>
              {/* Account Statistics */}
              {accountStats && (
                <AccountStatsCards
                  stats={accountStats}
                  accountEmail={accountEmail}
                  clientName={clientName}
                />
              )}

              {/* Rooms List */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">الغرف</h2>
                <AccountRoomsList
                  rooms={rooms}
                  accountId={selectedAccountId}
                  isLoading={isLoadingAccountData}
                />
              </div>
            </>
          )}

          {/* Device Analytics (shown when no account is selected or below account data) */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : analytics ? (
            <>
              {!selectedAccountId && (
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
              )}
            </>
          ) : (
            !selectedAccountId && (
              <div className="text-center py-12 text-gray-500">
                <p>No analytics data available</p>
              </div>
            )
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

