'use client';

import { useRouter } from 'next/navigation';
import { Video, Settings, CreditCard } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import FormInput from '@/lib/components/FormInput';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';

function SettingsPageContent({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const { isCollapsed } = useSidebar();

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

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم العميل"
        onLogout={handleLogout}
      />

      <div className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="الإعدادات"
          subtitle="إعدادات حسابك"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8">
          <Card className="max-w-2xl">
            <div className="space-y-6">
              <div>
                <FormInput
                  label="البريد الإلكتروني"
                  type="email"
                  value={userEmail}
                  disabled
                />
                <p className="mt-2 text-sm text-gray-500">
                  لا يمكن تغيير البريد الإلكتروني. يرجى التواصل مع المسؤول
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">تغيير كلمة المرور</h3>
                <p className="text-sm text-gray-600 mb-4">
                  لطلب تغيير كلمة المرور، يرجى التواصل مع المسؤول
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default function SettingsPageClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <SettingsPageContent userEmail={userEmail} />
    </SidebarProvider>
  );
}
