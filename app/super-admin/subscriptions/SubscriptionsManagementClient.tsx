/*
  Enhanced super-admin subscriptions management client.
*/
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle,
  Clock3,
  CreditCard,
  Download,
  Edit,
  Filter,
  Gift,
  Loader2,
  PieChart,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Button from '@/lib/components/Button';
import Card from '@/lib/components/Card';
import FormInput from '@/lib/components/FormInput';
import StatCard from '@/lib/components/StatCard';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import {
  useSubscriptionsData,
  SubscriptionRecord,
  SubscriptionSource as SubscriptionSourceType,
} from '@/lib/hooks/useSubscriptionsData';
import SubscriptionDetailDrawer from './SubscriptionDetailDrawer';

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  features?: Array<{ id: string; feature: string; enabled: boolean }>;
}

interface Client {
  id: string;
  name: string;
  email: string;
  maxRooms: number;
  maxParticipants: number;
  whatsappNumber?: string | null;
  subscription?: {
    id: string;
    status: string;
  } | null;
  _count?: {
    rooms?: number;
  };
}

type SubscriptionStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'TRIAL'
  | 'TRIAL_EXPIRED';

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  EXPIRED: 'منتهي',
  TRIAL: 'تجريبي',
  TRIAL_EXPIRED: 'انتهت الفترة التجريبية',
};

const statusClasses: Record<SubscriptionStatus, string> = {
  ACTIVE: 'text-green-700 bg-green-100',
  INACTIVE: 'text-amber-700 bg-amber-100',
  EXPIRED: 'text-red-700 bg-red-100',
  TRIAL: 'text-blue-700 bg-blue-100',
  TRIAL_EXPIRED: 'text-red-700 bg-red-100',
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'غير متوفر';
  const date = new Date(dateString);
  const months = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatCurrency = (amount?: number | null) => {
  if (typeof amount !== 'number') return 'غير محدد';
  return `${amount.toLocaleString('ar-EG')} ج.م`;
};

const normalizePhoneNumber = (value: string) => value.replace(/[^0-9+]/g, '').replace(/^\+/, '');

const defaultWhatsappTemplate =
  'مرحباً {{clientName}}، نذكرك بأن قيمة اشتراكك {{amount}} مستحقة بتاريخ {{endDate}}. يرجى إتمام السداد في أقرب وقت. شكراً لتعاونك.';

type StatMode = 'status' | 'financial';

const capacityColor = (value: number) => {
  if (value >= 0.9) return 'text-red-600 bg-red-50';
  if (value >= 0.7) return 'text-amber-600 bg-amber-50';
  return 'text-emerald-600 bg-emerald-50';
};

function SubscriptionsManagementContent({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sources, setSources] = useState<SubscriptionSourceType[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRecord | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionRecord | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubscriptionStatus>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [showPlanInsights, setShowPlanInsights] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [statMode, setStatMode] = useState<StatMode>('status');
  const [whatsappTemplate, setWhatsappTemplate] = useState(defaultWhatsappTemplate);
  const [whatsappSavingClientId, setWhatsappSavingClientId] = useState<string | null>(null);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [sourceForm, setSourceForm] = useState({ label: '', description: '' });
  const [isCreatingSource, setIsCreatingSource] = useState(false);
  const [createdMonthFilter, setCreatedMonthFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const {
    subscriptions,
    overview,
    planDistribution,
    isLoading: subscriptionsLoading,
    error,
    refetch,
  } = useSubscriptionsData();

  useEffect(() => {
    const loadMeta = async () => {
      try {
        setMetadataLoading(true);
        const [plansRes, clientsRes, sourcesRes] = await Promise.all([
          fetch('/api/super-admin/plans', { credentials: 'include' }),
          fetch('/api/super-admin/clients', { credentials: 'include' }),
          fetch('/api/super-admin/subscription-sources', { credentials: 'include' }),
        ]);

        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(data.plans ?? []);
        }

        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.clients ?? []);
        }

        if (sourcesRes.ok) {
          const data = await sourcesRes.json();
          setSources(data.sources ?? []);
        }
      } catch (loadError) {
        console.error(loadError);
        toast.error('تعذر تحميل بيانات الخطط أو العملاء');
      } finally {
        setMetadataLoading(false);
      }
    };

    loadMeta();
  }, []);

  const uniquePlanOptions = useMemo(() => {
    return plans.map((plan) => ({ id: plan.id, name: plan.name }));
  }, [plans]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const matchesSearch =
        !searchTerm ||
        subscription.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subscription.client.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ? true : subscription.status === statusFilter;

      const matchesPlan =
        planFilter === 'ALL' ? true : subscription.plan?.id === planFilter;

      const matchesSource =
        sourceFilter === 'ALL'
          ? true
          : sourceFilter === 'UNASSIGNED'
            ? !subscription.source?.id
            : subscription.source?.id === sourceFilter;

      const createdAtDate = new Date(subscription.createdAt);
      const startDateValue = subscription.startDate ? new Date(subscription.startDate) : null;
      const [filterYear, filterMonth] = createdMonthFilter
        ? createdMonthFilter.split('-').map((part) => Number(part))
        : [];

      const matchesMonth =
        !createdMonthFilter ||
        (!Number.isNaN(createdAtDate.getTime()) &&
          createdAtDate.getFullYear() === filterYear &&
          createdAtDate.getMonth() + 1 === filterMonth);

      const matchesDateRange =
        (!dateFromFilter || (startDateValue && startDateValue >= new Date(dateFromFilter))) &&
        (!dateToFilter || (startDateValue && startDateValue <= new Date(dateToFilter)));

      return matchesSearch && matchesStatus && matchesPlan && matchesSource && matchesMonth && matchesDateRange;
    });
  }, [subscriptions, searchTerm, statusFilter, planFilter, sourceFilter, createdMonthFilter, dateFromFilter, dateToFilter]);

  const financialSnapshot = useMemo(() => {
    const nowDate = new Date();
    const currentMonth = nowDate.getMonth();
    const currentYear = nowDate.getFullYear();

    return subscriptions.reduce(
      (acc, subscription) => {
        const amount = subscription.amountEGP ?? 0;
        const startDateValue = subscription.startDate ? new Date(subscription.startDate) : null;
        const endDateValue = subscription.endDate ? new Date(subscription.endDate) : null;

        if (
          endDateValue &&
          endDateValue.getMonth() === currentMonth &&
          endDateValue.getFullYear() === currentYear
        ) {
          acc.currentMonthDue += amount;
        }

        if (subscription.status === 'ACTIVE') {
          acc.totalCollected += amount;

          if (
            startDateValue &&
            startDateValue.getMonth() === currentMonth &&
            startDateValue.getFullYear() === currentYear
          ) {
            acc.currentCollected += amount;
          }

          if (subscription.metrics?.hasTrialEnded) {
            acc.reactivatedCollected += amount;
          }
        }

        return acc;
      },
      {
        currentMonthDue: 0,
        totalCollected: 0,
        currentCollected: 0,
        reactivatedCollected: 0,
      }
    );
  }, [subscriptions]);

  const isLoading = subscriptionsLoading || metadataLoading;

  const buildWhatsappMessage = (subscription: SubscriptionRecord) => {
    const replacements: Record<string, string> = {
      '{{clientName}}': subscription.client.name,
      '{{amount}}': formatCurrency(subscription.amountEGP),
      '{{endDate}}': formatDate(subscription.endDate),
    };

    return Object.entries(replacements).reduce(
      (message, [token, value]) => message.replace(new RegExp(token, 'g'), value),
      whatsappTemplate
    );
  };

  const handleClientWhatsappUpdate = async (clientId: string, number: string) => {
    const sanitizedNumber = number.replace(/[^\d+]/g, '');

    if (!sanitizedNumber) {
      toast.error('يرجى إدخال رقم واتساب صالح');
      return;
    }

    setWhatsappSavingClientId(clientId);
    try {
      const response = await fetch(`/api/super-admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ whatsappNumber: sanitizedNumber }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل تحديث رقم واتساب');
      }

      const { client } = await response.json();
      toast.success('تم تحديث رقم الواتساب');
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, whatsappNumber: client.whatsappNumber } : c))
      );
      setSelectedSubscription((prev) =>
        prev && prev.client.id === clientId
          ? { ...prev, client: { ...prev.client, whatsappNumber: client.whatsappNumber } }
          : prev
      );
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'تعذر تحديث رقم الواتساب');
    } finally {
      setWhatsappSavingClientId(null);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (planFilter !== 'ALL') params.set('planId', planFilter);
      if (sourceFilter === 'UNASSIGNED') {
        params.set('sourceId', 'UNASSIGNED');
      } else if (sourceFilter !== 'ALL') {
        params.set('sourceId', sourceFilter);
      }
      if (createdMonthFilter) params.set('createdMonth', createdMonthFilter);
      if (dateFromFilter) params.set('dateFrom', dateFromFilter);
      if (dateToFilter) params.set('dateTo', dateToFilter);

      const response = await fetch(`/api/super-admin/subscriptions/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'تعذر تصدير الملف');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subscriptions-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('تم تنزيل ملف الاشتراكات');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'تعذر تصدير الاشتراكات');
    }
  };

  const handleCreateSource = async () => {
    if (!sourceForm.label.trim()) {
      toast.error('يرجى إدخال اسم للمصدر');
      return;
    }

    setIsCreatingSource(true);
    try {
      const response = await fetch('/api/super-admin/subscription-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          label: sourceForm.label.trim(),
          description: sourceForm.description?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'تعذر إنشاء المصدر');
      }

      const { source } = await response.json();
      setSources((prev) => [source, ...prev]);
      setSourceForm({ label: '', description: '' });
      toast.success('تم إضافة المصدر');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'تعذر إنشاء المصدر');
    } finally {
      setIsCreatingSource(false);
    }
  };

  const handleToggleSourceActive = async (sourceId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/super-admin/subscription-sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'تعذر تحديث المصدر');
      }

      const { source } = await response.json();
      setSources((prev) => prev.map((s) => (s.id === source.id ? source : s)));
      toast.success('تم تحديث حالة المصدر');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'تعذر تحديث المصدر');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const handleStatusChange = async (subscriptionId: string, newStatus: SubscriptionStatus) => {
    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      toast.success('تم تحديث حالة الاشتراك');
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('تعذر تحديث الحالة');
    }
  };

  const handleDelete = async (subscriptionId: string, clientName: string) => {
    if (!confirm(`هل أنت متأكد من حذف اشتراك ${clientName}؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/super-admin/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل حذف الاشتراك');
      }

      toast.success('تم حذف الاشتراك بنجاح');
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'تعذر حذف الاشتراك');
    }
  };

  const handleQuickResend = (subscription: SubscriptionRecord) => {
    const whatsapp = subscription.client.whatsappNumber;
    if (!whatsapp) {
      toast.error('لا يوجد رقم واتساب مسجل لهذا العميل');
      return;
    }

    const normalized = normalizePhoneNumber(whatsapp);
    if (!normalized) {
      toast.error('رقم واتساب غير صالح');
      return;
    }

    const message = buildWhatsappMessage(subscription);
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;

    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      toast.success('تم فتح واتساب لإرسال الفاتورة');
    }
  };

  const handleOpenCreate = (subscription?: SubscriptionRecord | null) => {
    setEditingSubscription(subscription ?? null);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingSubscription(null);
  };

  const handleModalSuccess = () => {
    handleCloseModal();
    refetch();
  };

  const handleRowSelect = (subscription: SubscriptionRecord) => {
    setSelectedSubscription(subscription);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPlanFilter('ALL');
    setSourceFilter('ALL');
    setCreatedMonthFilter('');
    setDateFromFilter('');
    setDateToFilter('');
  };

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: BarChart3 },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
    { href: '/super-admin/referrals', label: 'الإحالات والمكافآت', icon: Gift },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم المشرف"
        onLogout={handleLogout}
      />

      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="إدارة الاشتراكات"
          subtitle="راقب نشاط العملاء، الخطط، والفترات التجريبية"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8 space-y-8">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              تعذر تحميل بيانات الاشتراكات، حاول مجدداً.
            </div>
          )}

          {/* KPI cards */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setStatMode('status')}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  statMode === 'status'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                مؤشرات الاشتراكات
              </button>
              <button
                onClick={() => setStatMode('financial')}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  statMode === 'financial'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                المؤشرات المالية
              </button>
            </div>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statMode === 'status' ? (
                <>
                  <StatCard
                    title="إجمالي الاشتراكات"
                    value={overview.total}
                    icon={Users}
                    color="indigo"
                    description="كل العملاء الذين لديهم خطة مرتبطة"
                  />
                  <StatCard
                    title="نشطة الآن"
                    value={overview.active}
                    icon={Activity}
                    color="green"
                    description={`${overview.expiringTrials} تجارب توشك على الانتهاء`}
                  />
                  <StatCard
                    title="فترات تجريبية"
                    value={overview.trials}
                    icon={Clock3}
                    color="orange"
                    description="يتم مراقبة التحويلات المتوقعة"
                  />
                  <StatCard
                    title="معرضة للخطر"
                    value={overview.atRisk}
                    icon={AlertTriangle}
                    color="red"
                    description="اشتراكات تحتاج متابعة"
                  />
                </>
              ) : (
                <>
                  <StatCard
                    title="مستحقات هذا الشهر"
                    value={formatCurrency(financialSnapshot.currentMonthDue)}
                    icon={CreditCard}
                    color="indigo"
                    description="إجمالي الفواتير التي تستحق هذا الشهر"
                  />
                  <StatCard
                    title="إجمالي التحصيل"
                    value={formatCurrency(financialSnapshot.totalCollected)}
                    icon={BarChart3}
                    color="green"
                    description="إجمالي ما تم تحصيله عبر النظام"
                  />
                  <StatCard
                    title="تحصيل الشهر الحالي"
                    value={formatCurrency(financialSnapshot.currentCollected)}
                    icon={Activity}
                    color="orange"
                    description="مدفوعات سجلت خلال الشهر الحالي"
                  />
                  <StatCard
                    title="تحصيل المعاد تفعيلها"
                    value={formatCurrency(financialSnapshot.reactivatedCollected)}
                    icon={RefreshCw}
                    color="red"
                    description="اشتراكات عادت للعمل وتم تحصيلها"
                  />
                </>
              )}
            </section>
          </div>

          {/* Plan distribution */}
          <section className="rounded-2xl bg-white/80 p-4 shadow-soft ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">تحليل الخطط</h3>
              <button
                onClick={() => setShowPlanInsights((prev) => !prev)}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {showPlanInsights ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
            {showPlanInsights && (
              <div className="mt-4">
                <PlanDistributionCard data={planDistribution} />
              </div>
            )}
            {!showPlanInsights && (
              <p className="mt-3 text-sm text-gray-500">اضغط لإظهار توزيع الخطط.</p>
            )}
          </section>

          {/* Sources management */}
          <section className="rounded-2xl bg-white/80 p-4 shadow-soft ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">مصادر الاشتراك</h3>
                <p className="text-sm text-gray-500">قم بتتبع مصادر الاشتراكات وربطها بالمشتركين</p>
              </div>
              <button
                onClick={() => setShowSourcesPanel((prev) => !prev)}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {showSourcesPanel ? 'إخفاء' : 'إدارة المصادر'}
              </button>
            </div>

            {showSourcesPanel && (
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-dashed border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-800">إضافة مصدر جديد</p>
                  <FormInput
                    label="اسم المصدر"
                    value={sourceForm.label}
                    onChange={(e) => setSourceForm({ ...sourceForm, label: e.target.value })}
                  />
                  <textarea
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    placeholder="وصف اختياري"
                    value={sourceForm.description}
                    onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateSource}
                    isLoading={isCreatingSource}
                  >
                    إضافة المصدر
                  </Button>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-medium text-gray-800">
                    قائمة المصادر ({sources.length})
                  </p>
                  <div className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-1">
                    {sources.length === 0 ? (
                      <p className="text-sm text-gray-500">لا توجد مصادر بعد.</p>
                    ) : (
                      sources.map((source) => (
                        <div
                          key={source.id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{source.label}</p>
                            {source.description && (
                              <p className="text-xs text-gray-500">{source.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleSourceActive(source.id, !source.isActive)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              source.isActive
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {source.isActive ? 'نشط' : 'موقوف'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Toolbar */}
          <section className="rounded-2xl bg-white/80 p-4 shadow-soft ring-1 ring-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <RefreshCw className="h-4 w-4" />
                <span>آخر تحديث منذ لحظات</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleExport}
                >
                  تصدير Excel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => handleOpenCreate()}
                >
                  إنشاء اشتراك
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-600">أدوات التصفية</p>
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {showFilters ? 'إخفاء' : 'إظهار'}
              </button>
            </div>

            {showFilters && (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <FormInput
                    label="بحث عن عميل"
                    placeholder="اكتب اسم العميل أو البريد"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">الحالة</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SubscriptionStatus)}
                    >
                      <option value="ALL">كل الحالات</option>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key} className="bg-white text-gray-900">
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">الخطة</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                    >
                      <option value="ALL">كل الخطط</option>
                      {uniquePlanOptions.map((plan) => (
                        <option key={plan.id} value={plan.id} className="bg-white text-gray-900">
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">المصدر</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                    >
                      <option value="ALL">كل المصادر</option>
                      <option value="UNASSIGNED">بدون مصدر</option>
                      {sources.map((source) => (
                        <option key={source.id} value={source.id} className="bg-white text-gray-900">
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">الشهر (تاريخ الإنشاء)</label>
                    <input
                      type="month"
                      value={createdMonthFilter}
                      onChange={(e) => setCreatedMonthFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">بداية الفترة (تاريخ البداية)</label>
                    <input
                      type="date"
                      value={dateFromFilter}
                      onChange={(e) => setDateFromFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">نهاية الفترة</label>
                    <input
                      type="date"
                      value={dateToFilter}
                      onChange={(e) => setDateToFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    تم العثور على <span className="font-semibold text-gray-900">{filteredSubscriptions.length}</span>{' '}
                    نتيجة بعد التصفية
                  </p>
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <Filter className="h-4 w-4" />
                    إعادة تعيين المرشحات
                  </button>
                </div>
              </>
            )}

            <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">رسالة فاتورة الواتساب</p>
                  <p className="text-xs text-gray-500">عدّل النص الافتراضي قبل الإرسال</p>
                </div>
                <button
                  onClick={() => setShowTemplateEditor((prev) => !prev)}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  {showTemplateEditor ? 'إخفاء' : 'تعديل الرسالة'}
                </button>
              </div>

              {showTemplateEditor && (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    rows={3}
                    value={whatsappTemplate}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                    dir="rtl"
                  />
                  <p className="text-xs text-gray-500">
                    المتغيرات المتاحة: {'{{clientName}}'}, {'{{amount}}'}, {'{{endDate}}'}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Table */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      العميل
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      الخطة & الاستخدام
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      الحالة
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      تاريخ الإنشاء
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-gray-500">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                          جاري تحميل الاشتراكات...
                        </div>
                      </td>
                    </tr>
                  ) : filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-gray-500">
                        لا توجد اشتراكات مطابقة لمرشحاتك.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscriptions.map((subscription) => {
                      const isOverdue =
                        subscription.endDate &&
                        new Date(subscription.endDate) < new Date() &&
                        subscription.status === 'ACTIVE';
                      return (
                        <tr
                          key={subscription.id}
                          className={`${isOverdue ? 'bg-red-50/80' : ''} cursor-pointer hover:bg-gray-50/70`}
                          onClick={() => handleRowSelect(subscription)}
                        >
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-900">{subscription.client.name}</p>
                            <p className="text-sm text-gray-500">{subscription.client.email}</p>
                            <p className="text-xs text-gray-400">
                              {subscription.client.roomStats?.totalRooms ?? 0} غرفة / حد {subscription.client.maxRooms}
                            </p>
                            <p className="text-xs text-gray-500">
                              واتساب: {subscription.client.whatsappNumber || 'غير مضاف'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-gray-700">
                          <p className="font-medium text-gray-900">{subscription.plan?.name ?? 'بدون خطة'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${
                                capacityColor(subscription.client.roomStats?.capacityUtilization ?? 0)
                              }`}
                            >
                              استخدام الغرف{' '}
                              {Math.round((subscription.client.roomStats?.capacityUtilization ?? 0) * 100)}%
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                              فعال الآن: {subscription.client.roomStats?.activeNow ?? 0}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-gray-500">
                            <p>تاريخ البداية: {formatDate(subscription.startDate)}</p>
                            <p>تاريخ الانتهاء: {formatDate(subscription.endDate)}</p>
                            <p>قيمة الاشتراك: {formatCurrency(subscription.amountEGP)}</p>
                            <p>
                              المصدر:{' '}
                              {subscription.source?.label ? (
                                <span className="font-semibold text-gray-800">
                                  {subscription.source.label}
                                </span>
                              ) : (
                                'غير محدد'
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                                statusClasses[subscription.status as SubscriptionStatus] ??
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {statusLabels[subscription.status as SubscriptionStatus] ?? subscription.status}
                            </span>
                            {subscription.metrics?.trialDaysRemaining !== null && (
                              <span className="text-xs text-gray-500">
                                تبقى {subscription.metrics?.trialDaysRemaining} يوم للتجربة
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-xs font-semibold text-red-600">
                                انتهى الاشتراك ويحتاج إجراء يدوي
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-gray-600">
                          {formatDate(subscription.createdAt)}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(
                                  subscription.id,
                                  subscription.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                                );
                              }}
                              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-indigo-200 hover:text-indigo-600"
                            >
                              {subscription.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickResend(subscription);
                              }}
                              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-indigo-200 hover:text-indigo-600"
                            >
                              إرسال فاتورة
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCreate(subscription);
                              }}
                              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-indigo-200 hover:text-indigo-600"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(subscription.id, subscription.client.name);
                              }}
                              className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              حذف
                            </button>
                          </div>
                        </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showCreateModal && (
            <CreateSubscriptionModal
              plans={plans}
              clients={clients}
              sources={sources}
              onClose={handleCloseModal}
              onSuccess={handleModalSuccess}
              existingSubscription={editingSubscription}
              onUpdateClientWhatsapp={handleClientWhatsappUpdate}
              whatsappSavingClientId={whatsappSavingClientId}
            />
          )}

          <SubscriptionDetailDrawer
            subscription={selectedSubscription}
            onClose={() => setSelectedSubscription(null)}
            onEdit={handleOpenCreate}
            onWhatsappSave={handleClientWhatsappUpdate}
            savingWhatsappClientId={whatsappSavingClientId}
          />
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

interface CreateSubscriptionModalProps {
  plans: Plan[];
  clients: Client[];
  sources: SubscriptionSourceType[];
  existingSubscription?: SubscriptionRecord | null;
  onClose: () => void;
  onSuccess: () => void;
  onUpdateClientWhatsapp: (clientId: string, whatsappNumber: string) => Promise<void> | void;
  whatsappSavingClientId?: string | null;
}

const subscriptionPresets = [
  {
    id: 'trial-7',
    label: 'تجربة محسنة (7 أيام)',
    description: 'مناسبة لاختبار المنصة قبل التحويل.',
    status: 'TRIAL' as SubscriptionStatus,
    trialDays: 7,
  },
  {
    id: 'standard',
    label: 'اشتراك أساسي',
    description: 'خطة مدفوعة تبدأ مباشرة.',
    status: 'ACTIVE' as SubscriptionStatus,
    trialDays: 0,
  },
  {
    id: 'annual',
    label: 'اشتراك سنوي',
    description: 'إعداد جاهز للحزم السنوية.',
    status: 'ACTIVE' as SubscriptionStatus,
    trialDays: 0,
  },
];

const toInputDateValue = (value?: string | Date | null) => {
  if (!value) return '';
  const dateObj = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toISOString().split('T')[0];
};

function CreateSubscriptionModal({
  plans,
  clients,
  sources,
  existingSubscription,
  onClose,
  onSuccess,
  onUpdateClientWhatsapp,
  whatsappSavingClientId,
}: CreateSubscriptionModalProps) {
  const [step, setStep] = useState(existingSubscription ? 2 : 1);
  const [isLoading, setIsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [presetId, setPresetId] = useState(subscriptionPresets[0]?.id);

  const initialForm = {
    clientId: existingSubscription?.client.id ?? '',
    planId: existingSubscription?.plan?.id ?? '',
    status: (existingSubscription?.status ?? 'INACTIVE') as SubscriptionStatus,
    isTrial: existingSubscription?.status === 'TRIAL' || existingSubscription?.isTrial || false,
    trialDays: existingSubscription?.trialDays ?? 3,
    startDate: existingSubscription?.startDate
      ? toInputDateValue(existingSubscription.startDate)
      : toInputDateValue(new Date()),
    endDate: existingSubscription?.endDate ? toInputDateValue(existingSubscription.endDate) : '',
    amountEGP: existingSubscription?.amountEGP ?? 0,
    sourceId: existingSubscription?.source?.id ?? '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [clientWhatsapp, setClientWhatsapp] = useState(existingSubscription?.client.whatsappNumber ?? '');

  useEffect(() => {
    if (!formData.clientId) return;
    const selected = clients.find((client) => client.id === formData.clientId);
    setClientWhatsapp(selected?.whatsappNumber ?? '');
  }, [formData.clientId, clients]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter((client) =>
      client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clients, clientSearch]);

  const selectedPlan = plans.find((plan) => plan.id === formData.planId);
  const selectedClient = clients.find((client) => client.id === formData.clientId);

  const applyPreset = (presetIdValue: string) => {
    setPresetId(presetIdValue);
    const preset = subscriptionPresets.find((presetOption) => presetOption.id === presetIdValue);
    if (!preset) return;

    setFormData((prev) => ({
      ...prev,
      status: preset.status,
      isTrial: preset.status === 'TRIAL',
      trialDays: preset.trialDays || prev.trialDays,
    }));
  };

  const handleWhatsappSave = () => {
    if (!formData.clientId) {
      toast.error('اختر عميلًا أولاً');
      return;
    }
    onUpdateClientWhatsapp(formData.clientId, clientWhatsapp);
  };

  const handleSubmit = async () => {
    if (!formData.clientId || !formData.planId) {
      toast.error('يرجى اختيار عميل وخطة');
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        clientId: formData.clientId,
        planId: formData.planId,
        status: formData.status,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        amountEGP: typeof formData.amountEGP === 'number' ? formData.amountEGP : Number(formData.amountEGP) || 0,
        sourceId: formData.sourceId || null,
      };

      if (formData.isTrial) {
        payload.isTrial = true;
        payload.trialDays = formData.trialDays;
      }

      // Use PUT for updates, POST for new subscriptions
      const url = existingSubscription
        ? `/api/super-admin/subscriptions/${existingSubscription.id}`
        : '/api/super-admin/subscriptions';
      const method = existingSubscription ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل حفظ الاشتراك');
      }

      toast.success(existingSubscription ? 'تم تحديث الاشتراك' : 'تم إنشاء الاشتراك');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => setStep((prev) => Math.min(prev + 1, 2));
  const handlePrev = () => setStep((prev) => Math.max(prev - 1, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <header className="border-b border-gray-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                {existingSubscription ? 'تعديل الاشتراك' : 'اشتراك جديد'}
              </p>
              <h2 className="text-2xl font-bold text-gray-900">إعداد الاشتراك</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              إغلاق
            </Button>
          </div>
          <div className="mt-4 flex gap-2 text-sm text-gray-500">
            <span className={`rounded-full px-3 py-1 ${step === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}>
              ١. اختيار العميل/الخطة
            </span>
            <span className={`rounded-full px-3 py-1 ${step === 2 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}>
              ٢. الضبط والمراجعة
            </span>
          </div>
        </header>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
          {step === 1 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">اختر عميل</h3>
                  <span className="text-xs text-gray-500">{filteredClients.length} عميل</span>
                </div>
                <FormInput
                  placeholder="بحث عن عميل"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {filteredClients.map((client) => (
                    <label
                      key={client.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                        formData.clientId === client.id
                          ? 'border-indigo-500 bg-white text-gray-900'
                          : 'border-gray-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{client.name}</p>
                        <p className="text-gray-600">{client.email}</p>
                      </div>
                      <input
                        type="radio"
                        name="client"
                        checked={formData.clientId === client.id}
                        onChange={() => setFormData({ ...formData, clientId: client.id })}
                      />
                    </label>
                  ))}
                </div>
                {formData.clientId && (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-3">
                    <label className="text-sm font-medium text-gray-700">رقم واتساب العميل</label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="مثال: 201234567890"
                        value={clientWhatsapp}
                        onChange={(e) => setClientWhatsapp(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isLoading={whatsappSavingClientId === formData.clientId}
                        onClick={handleWhatsappSave}
                      >
                        حفظ
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">اكتب الرقم مع كود الدولة بدون + أو 00.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
                <h3 className="text-lg font-semibold text-gray-900">اختر خطة</h3>
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {plans.map((plan) => (
                    <label
                      key={plan.id}
                      className={`flex cursor-pointer flex-col rounded-xl border bg-white p-3 text-sm ${
                        formData.planId === plan.id
                          ? 'border-indigo-500 shadow-sm'
                          : 'border-gray-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{plan.name}</p>
                        <span className="text-xs text-gray-600">
                          {plan.features?.filter((f) => f.enabled).length ?? 0} ميزة
                        </span>
                      </div>
                      <p className="text-gray-600">{plan.description ?? 'بدون وصف'}</p>
                      <input
                        type="radio"
                        name="plan"
                        checked={formData.planId === plan.id}
                        onChange={() => setFormData({ ...formData, planId: plan.id })}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-100 p-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">إعداد جاهز</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {subscriptionPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`rounded-2xl border px-3 py-3 text-right ${
                        presetId === preset.id
                          ? 'border-indigo-500 bg-white text-gray-900 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{preset.label}</p>
                      <p className="text-xs text-gray-600">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">الحالة والتجربة</h3>
                  <div>
                    <label className="mb-2 block text-sm text-gray-600">الحالة</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as SubscriptionStatus,
                          isTrial: e.target.value === 'TRIAL',
                        })
                      }
                    >
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key} className="bg-white text-gray-900">
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="trial_toggle"
                      checked={formData.isTrial}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isTrial: e.target.checked,
                          status: e.target.checked ? 'TRIAL' : 'ACTIVE',
                        })
                      }
                    />
                    <label htmlFor="trial_toggle" className="text-sm text-gray-600">
                      تفعيل الفترة التجريبية
                    </label>
                  </div>

                  {formData.isTrial && (
                    <div>
                      <label className="mb-2 block text-sm text-gray-600">مدة التجربة (أيام)</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={formData.trialDays}
                        onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">معاينة سريعة</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">العميل</p>
                        <p className="font-semibold text-gray-900">{selectedClient?.name ?? 'لم يتم اختيار عميل'}</p>
                        <p className="text-xs text-gray-600">{selectedClient?.email}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">الخطة</p>
                        <p className="font-semibold text-gray-900">{selectedPlan?.name ?? 'اختر خطة'}</p>
                        <p className="text-xs text-gray-600">
                          {selectedPlan?.features?.filter((f) => f.enabled).length ?? 0} ميزة مفعلة
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">حدود العميل</p>
                        <p className="text-xs text-gray-600">
                          غرف: {selectedClient?.maxRooms ?? '-'} • مشاركون: {selectedClient?.maxParticipants ?? '-'}
                        </p>
                    <p className="text-xs text-gray-600">
                      واتساب: {selectedClient?.whatsappNumber ?? clientWhatsapp || 'غير مضاف'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">التواريخ والمبلغ</h3>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">تاريخ بدء الاشتراك</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">تاريخ انتهاء الاشتراك</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">قيمة الاشتراك (جنيه مصري)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.amountEGP}
                      onChange={(e) =>
                        setFormData({ ...formData, amountEGP: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                      </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">مصدر الاشتراك</label>
                    <select
                      value={formData.sourceId}
                      onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">بدون مصدر</option>
                      {sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <div className="text-xs text-gray-500">يتم حفظ البيانات مع احترام الإعدادات الحالية</div>
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="ghost" onClick={handlePrev}>
                رجوع
              </Button>
            )}
            {step < 2 && (
              <Button variant="secondary" onClick={handleNext} disabled={!formData.clientId || !formData.planId}>
                التالي
              </Button>
            )}
            {step === 2 && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={isLoading}
                leftIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              >
                {existingSubscription ? 'تحديث الاشتراك' : 'حفظ الاشتراك'}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function PlanDistributionCard({
  data,
}: {
  data: Array<{ plan: string; value: number; percentage: number }>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">توزيع الخطط</p>
          <h3 className="text-xl font-bold text-gray-900">كيف ينتشر العملاء عبر الخطط</h3>
        </div>
        <PieChart className="h-8 w-8 text-indigo-500" />
      </div>
      <div className="mt-6 space-y-4">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد بيانات كافية لعرض الرسم.</p>
        ) : (
          data.map((item) => (
            <div key={item.plan}>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="font-medium text-gray-900">{item.plan}</span>
                <span>
                  {item.value} عميل • {item.percentage}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
