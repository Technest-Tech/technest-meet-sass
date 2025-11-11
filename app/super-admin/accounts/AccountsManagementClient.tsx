'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Key, CheckCircle, XCircle } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import DataTable from '@/lib/components/DataTable';
import Modal from '@/lib/components/Modal';
import FormInput from '@/lib/components/FormInput';
import Button from '@/lib/components/Button';
import Card from '@/lib/components/Card';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';
import { Activity, Users, Package, CreditCard, Building2 } from 'lucide-react';

interface Account {
  id: string;
  email: string;
  role: string;
  status: string;
  client?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

function AccountsManagementContent({ userEmail }: { userEmail: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    clientName: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/super-admin/accounts', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('فشل تحميل الحسابات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/super-admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: 'CLIENT',
          clientName: formData.clientName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }

      toast.success('تم إنشاء الحساب بنجاح');
      setShowCreateModal(false);
      setFormData({ email: '', password: '', clientName: '' });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'فشل إنشاء الحساب');
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset password');
      }

      toast.success('تم إعادة تعيين كلمة المرور بنجاح');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('فشل إعادة تعيين كلمة المرور');
    }
  };

  const handleStatusChange = async (accountId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/super-admin/accounts/${accountId}/status`, {
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

      toast.success('تم تحديث حالة الحساب بنجاح');
      fetchAccounts();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('فشل تحديث حالة الحساب');
    }
  };

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: Package },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
  ];

  const getStatusBadge = (status: string) => {
    const colors = {
      ACTIVE: 'bg-green-100 text-green-700 border-green-200',
      SUSPENDED: 'bg-red-100 text-red-700 border-red-200',
      INACTIVE: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    const texts = {
      ACTIVE: 'نشط',
      SUSPENDED: 'معلق',
      INACTIVE: 'غير نشط',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[status as keyof typeof colors] || colors.INACTIVE}`}>
        {texts[status as keyof typeof texts] || texts.INACTIVE}
      </span>
    );
  };

  const columns = [
    {
      key: 'email',
      header: 'البريد الإلكتروني',
      sortable: true,
    },
    {
      key: 'role',
      header: 'الدور',
      render: (account: Account) => (
        <span className="text-sm text-gray-700">{account.role === 'CLIENT' ? 'عميل' : 'مشرف'}</span>
      ),
    },
    {
      key: 'client',
      header: 'العميل',
      render: (account: Account) => (
        <span className="text-sm text-gray-700">{account.client?.name || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (account: Account) => getStatusBadge(account.status),
    },
    {
      key: 'createdAt',
      header: 'تاريخ الإنشاء',
      render: (account: Account) => {
        const date = new Date(account.createdAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return (
          <span className="text-sm text-gray-600">
            {year}-{month}-{day}
          </span>
        );
      },
    },
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
          title="إدارة الحسابات"
          subtitle="إنشاء وإدارة حسابات المستخدمين"
          userEmail={userEmail}
          actions={
            <Button
              variant="primary"
              size="md"
              rightIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              إنشاء حساب جديد
            </Button>
          }
        />

        <main className="p-6 lg:p-8">
          <Card padding="lg">
            <DataTable
              data={accounts}
              columns={columns}
              searchable
              searchPlaceholder="ابحث عن حساب..."
              emptyMessage="لا توجد حسابات"
              isLoading={isLoading}
              actions={(account) => (
                <div className="flex items-center gap-2 justify-end">
                  {/* Reset Password Tooltip */}
                  <div className="relative group">
                    <button
                      onClick={() => handleResetPassword(account.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="إعادة تعيين كلمة المرور"
                    >
                      <Key className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
                      إعادة تعيين كلمة المرور
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  
                  {/* Status Toggle Tooltip */}
                  {account.status === 'ACTIVE' ? (
                    <div className="relative group">
                      <button
                        onClick={() => handleStatusChange(account.id, 'INACTIVE')}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="تعطيل الحساب"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
                        تعطيل الحساب
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <button
                        onClick={() => handleStatusChange(account.id, 'ACTIVE')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="تفعيل الحساب"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
                        تفعيل الحساب
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
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
          <FormInput
            label="البريد الإلكتروني"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
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
