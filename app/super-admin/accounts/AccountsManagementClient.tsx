'use client';

import { ButtonHTMLAttributes, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Users,
  Package,
  CreditCard,
  Building2,
  Gift,
  Plus,
  Key,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import DataTable from '@/lib/components/DataTable';
import Modal from '@/lib/components/Modal';
import FormInput from '@/lib/components/FormInput';
import Button from '@/lib/components/Button';
import Card from '@/lib/components/Card';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';

import AccountsFilterBar, { AccountFilterState } from './components/AccountsFilterBar';
import AccountProfileDrawer from './components/AccountProfileDrawer';
import EditAccountModal from './components/EditAccountModal';
import DeleteAccountDialog from './components/DeleteAccountDialog';
import { formatBytes, formatDate } from './utils';

const PAGE_SIZE = 12;

interface AccountRow {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  client?: {
    id: string;
    name: string;
    email: string;
    subscription?: {
      status: string;
      plan?: {
        id: string;
        name: string;
      } | null;
      endDate?: string | null;
    } | null;
  } | null;
  metrics?: {
    totalRooms: number;
    activeRooms: number;
    storageBytes: number;
    storageCapturedAt: string | null;
  } | null;
}

interface PlanOption {
  id: string;
  name: string;
}

const initialFilters: AccountFilterState = {
  search: '',
  status: [],
  planId: 'ALL',
  subscriptionStatus: 'ALL',
  storageTier: 'ALL',
  createdFrom: undefined,
  createdTo: undefined,
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

function IconButton({ label, children, className = '', ...props }: IconButtonProps) {
  return (
    <div className="relative group">
      <button
        className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 ${className}`}
        aria-label={label}
        {...props}
      >
        {children}
      </button>
      <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">
        {label}
      </span>
    </div>
  );
}

function AccountsManagementContent({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AccountFilterState>(initialFilters);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', clientName: '' });
  const [profileAccountId, setProfileAccountId] = useState<string | null>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string; metrics?: AccountRow['metrics'] | null } | null>(null);

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: Package },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
    { href: '/super-admin/referrals', label: 'الإحالات والمكافآت', icon: Gift },
  ];

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/super-admin/plans', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setPlans((data.plans || []).map((plan: any) => ({ id: plan.id, name: plan.name })));
    } catch (error) {
      console.error('Failed to load plans', error);
    }
  }, []);

  const loadAccounts = useCallback(
    async (pageValue: number, filterValue: AccountFilterState, signal?: AbortSignal) => {
      setIsLoading(true);
      setIsRefreshing(true);
      try {
        const params = new URLSearchParams({
          page: String(pageValue),
          pageSize: String(PAGE_SIZE),
        });

        if (filterValue.search) params.set('search', filterValue.search);
        if (filterValue.status.length) params.set('status', filterValue.status.join(','));
        if (filterValue.planId !== 'ALL') params.set('planId', filterValue.planId);
        if (filterValue.subscriptionStatus !== 'ALL') params.set('subscriptionStatus', filterValue.subscriptionStatus);
        if (filterValue.storageTier !== 'ALL') params.set('storageTier', filterValue.storageTier);
        if (filterValue.createdFrom) params.set('createdFrom', filterValue.createdFrom);
        if (filterValue.createdTo) params.set('createdTo', filterValue.createdTo);

        const response = await fetch(`/api/super-admin/accounts?${params.toString()}`, {
          credentials: 'include',
          signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'فشل تحميل الحسابات');
        }

        const data = await response.json();
        setAccounts(data.accounts || []);
        setTotal(data.total || 0);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to load accounts', error);
        toast.error(error.message || 'تعذر تحميل الحسابات');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAccounts(page, filters, controller.signal);
    return () => controller.abort();
  }, [page, filters, loadAccounts]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/super-admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: 'CLIENT',
          clientName: formData.clientName,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'فشل إنشاء الحساب');
      }

      toast.success('تم إنشاء الحساب بنجاح');
      setShowCreateModal(false);
      setFormData({ email: '', password: '', clientName: '' });
      loadAccounts(page, filters);
    } catch (error: any) {
      console.error('Create account error', error);
      toast.error(error.message || 'تعذر إنشاء الحساب');
    }
  };

  const handleResetPassword = async (accountId: string) => {
    const newPassword = prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):');
    if (!newPassword || newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    try {
      const response = await fetch(`/api/super-admin/accounts/${accountId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        throw new Error('فشل إعادة التعيين');
      }

      toast.success('تمت إعادة تعيين كلمة المرور');
    } catch (error: any) {
      console.error('Reset password error', error);
      toast.error(error.message || 'تعذر إعادة التعيين');
    }
  };

  const handleStatusToggle = async (account: AccountRow) => {
    const nextStatus = account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await fetch(`/api/super-admin/accounts/${account.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error('فشل تحديث الحالة');
      }

      toast.success('تم تحديث حالة الحساب');
      loadAccounts(page, filters);
    } catch (error: any) {
      console.error('Status toggle error', error);
      toast.error(error.message || 'تعذر تحديث الحالة');
    }
  };

  const stats = useMemo(() => {
    const activeCount = accounts.filter((account) => account.status === 'ACTIVE').length;
    const suspendedCount = accounts.filter((account) => account.status === 'SUSPENDED').length;
    const totalStorage = accounts.reduce((sum, account) => sum + (account.metrics?.storageBytes || 0), 0);

    return [
      { label: 'إجمالي الحسابات', value: total.toLocaleString('ar-EG') },
      { label: 'الحسابات النشطة', value: activeCount.toLocaleString('ar-EG') },
      { label: 'المعلقة', value: suspendedCount.toLocaleString('ar-EG') },
      { label: 'إجمالي التخزين', value: formatBytes(totalStorage) },
    ];
  }, [accounts, total]);

  const columns = useMemo(
    () => [
      {
        key: 'email',
        header: 'الحساب / العميل',
        render: (account: AccountRow) => (
          <div>
            <p className="font-medium text-gray-900">{account.email}</p>
            <p className="text-xs text-gray-500">{account.client?.name || '—'}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'الحالة',
        render: (account: AccountRow) => {
          const colors = {
            ACTIVE: 'bg-green-100 text-green-700 border-green-200',
            SUSPENDED: 'bg-orange-100 text-orange-700 border-orange-200',
            INACTIVE: 'bg-gray-100 text-gray-700 border-gray-200',
          };
          const labels = {
            ACTIVE: 'نشط',
            SUSPENDED: 'معلق',
            INACTIVE: 'غير نشط',
          };
          return (
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                colors[account.status as keyof typeof colors] || colors.INACTIVE
              }`}
            >
              {labels[account.status as keyof typeof labels] || labels.INACTIVE}
            </span>
          );
        },
      },
      {
        key: 'subscription',
        header: 'الاشتراك',
        render: (account: AccountRow) => {
          const subscription = account.client?.subscription;
          if (!subscription) return <span className="text-xs text-gray-500">لا يوجد</span>;
          return (
            <div className="text-xs text-gray-700">
              <p className="font-medium">{subscription.plan?.name || 'خطة مخصصة'}</p>
              <p className="text-gray-500">{subscription.status}</p>
            </div>
          );
        },
      },
      {
        key: 'rooms',
        header: 'الغرف',
        render: (account: AccountRow) => (
          <span className="text-sm text-gray-700">
            {account.metrics?.activeRooms ?? 0}/{account.metrics?.totalRooms ?? 0}
          </span>
        ),
      },
      {
        key: 'storage',
        header: 'التخزين',
        render: (account: AccountRow) => (
          <span className="text-sm text-gray-700">{formatBytes(account.metrics?.storageBytes)}</span>
        ),
      },
      {
        key: 'createdAt',
        header: 'تاريخ الإنشاء',
        render: (account: AccountRow) => <span className="text-sm text-gray-600">{formatDate(account.createdAt)}</span>,
      },
    ],
    [],
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar userEmail={userEmail} menuItems={menuItems} title="لوحة تحكم المشرف" onLogout={handleLogout} />

      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="إدارة الحسابات"
          subtitle="لوحة تشغيل شاملة لجميع حسابات العملاء"
          userEmail={userEmail}
          actions={
            <Button variant="primary" size="md" rightIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              إنشاء حساب جديد
            </Button>
          }
        />

        <main className="p-6 lg:p-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} padding="lg">
                <p className="text-xs font-semibold text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </Card>
            ))}
          </div>

          <AccountsFilterBar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            planOptions={plans}
            isBusy={isRefreshing}
          />

          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">إجمالي النتائج</p>
                <p className="text-lg font-semibold text-gray-900">{total.toLocaleString('ar-EG')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadAccounts(page, filters)} leftIcon={<RefreshCw className="w-4 h-4" />}>
                تحديث
              </Button>
            </div>

            <DataTable
              data={accounts}
              columns={columns}
              searchable={false}
              emptyMessage="لا توجد حسابات مطابقة"
              isLoading={isLoading}
              pagination={{
                pageSize: PAGE_SIZE,
                currentPage: page,
                total,
                onPageChange: (nextPage) => {
                  if (nextPage < 1) return;
                  setPage(nextPage);
                },
              }}
              actions={(account) => (
                <div className="flex items-center gap-2 justify-end">
                  <IconButton
                    label="عرض الملف"
                    className="text-gray-600 hover:bg-gray-100"
                    onClick={() => {
                      setProfileAccountId(account.id);
                      setShowProfileDrawer(true);
                    }}
                  >
                    <Eye className="w-5 h-5" />
                  </IconButton>
                  <IconButton label="تعديل" className="text-blue-600 hover:bg-blue-50" onClick={() => setEditAccountId(account.id)}>
                    <Pencil className="w-5 h-5" />
                  </IconButton>
                  <IconButton
                    label="إعادة تعيين كلمة المرور"
                    className="text-purple-600 hover:bg-purple-50"
                    onClick={() => handleResetPassword(account.id)}
                  >
                    <Key className="w-5 h-5" />
                  </IconButton>
                  <IconButton
                    label={account.status === 'ACTIVE' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                    className={
                      account.status === 'ACTIVE'
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-green-600 hover:bg-green-50'
                    }
                    onClick={() => handleStatusToggle(account)}
                  >
                    {account.status === 'ACTIVE' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  </IconButton>
                  <IconButton
                    label="حذف / أرشفة"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget({ id: account.id, email: account.email, metrics: account.metrics })}
                  >
                    <Trash2 className="w-5 h-5" />
                  </IconButton>
                </div>
              )}
            />
          </Card>
        </main>
      </div>

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData({ email: '', password: '', clientName: '' });
        }}
        title="إنشاء حساب جديد"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <FormInput label="البريد الإلكتروني" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
          <FormInput
            label="كلمة المرور"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength={6}
            helperText="يجب أن تكون 6 أحرف على الأقل"
          />
          <FormInput
            label="اسم العميل"
            type="text"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            required
          />
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setFormData({ email: '', password: '', clientName: '' });
              }}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary">
              إنشاء
            </Button>
          </div>
        </form>
      </Modal>

      <AccountProfileDrawer
        accountId={profileAccountId}
        isOpen={showProfileDrawer && Boolean(profileAccountId)}
        onClose={() => setShowProfileDrawer(false)}
        onEdit={(id) => {
          setEditAccountId(id);
          setShowProfileDrawer(false);
        }}
        onDelete={(id) => {
          const account = accounts.find((item) => item.id === id);
          if (account) {
            setDeleteTarget({ id: account.id, email: account.email, metrics: account.metrics });
          }
        }}
        onRefresh={() => loadAccounts(page, filters)}
      />

      <EditAccountModal
        accountId={editAccountId}
        isOpen={Boolean(editAccountId)}
        onClose={() => setEditAccountId(null)}
        onUpdated={() => {
          setEditAccountId(null);
          loadAccounts(page, filters);
        }}
      />

      <DeleteAccountDialog
        account={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          setShowProfileDrawer(false);
          loadAccounts(page, filters);
        }}
      />
    </div>
  );
}

export default function AccountsManagementClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <AccountsManagementContent userEmail={userEmail} />
    </SidebarProvider>
  );
}
