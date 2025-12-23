'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, AlertCircle, Video, Settings, Gift, Film } from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';

interface Subscription {
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'TRIAL' | 'TRIAL_EXPIRED';
  createdAt?: string;
  updatedAt?: string;
  isTrial?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDays?: number;
  trialDaysRemaining?: number | null;
  plan: {
    name: string;
    description?: string;
    features: Array<{ feature: string; enabled: boolean }>;
  } | null;
}

interface ClientLimits {
  name: string;
  email: string;
  maxRooms: number;
  maxParticipants: number;
  currentRooms: number;
}

const FEATURE_LABELS: Record<string, string> = {
  RECORDING: 'التسجيل',
  WAITING_ROOM: 'غرفة الانتظار',
  PRIVATE_CHAT: 'الدردشة الخاصة',
  GUEST_UNMUTE: 'إلغاء كتم الضيوف',
  HOST_APPROVAL: 'موافقة المضيف',
  SCREEN_ANNOTATION: 'تعليقات الشاشة',
  FILE_SHARING: 'مشاركة الملفات',
  PDF_VIEWER: 'عارض PDF',
  REACTIONS: 'التفاعلات',
  RAISE_HAND: 'رفع اليد',
  E2EE: 'التشفير من طرف لطرف',
  CUSTOM_BRANDING: 'العلامة التجارية المخصصة',
  PICTURE_IN_PICTURE: 'صورة داخل صورة',
  STUDENT_MONITOR_PIP: 'مراقبة الطلاب',
  COLLABORATIVE_WHITEBOARD: 'السبورة التعاونية',
  NORMAL_WHITEBOARD: 'السبورة العادية',
  MANAGE_PARTICIPANTS: 'إدارة المشاركين',
  VIRTUAL_BACKGROUND: 'الخلفية الافتراضية',
};

function SubscriptionPageContent({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<ClientLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
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
      console.error('Error fetching data:', error);
      toast.error('فشل تحميل المعلومات');
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
    { href: '/client/recordings', label: 'التسجيلات', icon: Film },
    { href: '/client/subscription', label: 'الاشتراك', icon: CreditCard },
    { href: '/client/settings', label: 'الإعدادات', icon: Settings },
    { href: '/client/referral-center', label: 'مركز الإحالات', icon: Gift },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'TRIAL':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'EXPIRED':
      case 'TRIAL_EXPIRED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
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
    // Use Gregorian calendar by using 'ar-EG' locale or manually format
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const calculateRenewalDate = (createdAt?: string) => {
    if (!createdAt) return null;
    const startDate = new Date(createdAt);
    // Calculate renewal date as 1 year from creation
    const renewalDate = new Date(startDate);
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    return renewalDate;
  };

  return (
    <div dir="rtl" className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex overflow-hidden">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم العميل"
        onLogout={handleLogout}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
        <Header
          title="معلومات الاشتراك"
          subtitle="عرض تفاصيل اشتراكك وخطتك"
          userEmail={userEmail}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {isLoading ? (
            <Card>
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-gray-600">جاري التحميل...</p>
              </div>
            </Card>
          ) : subscription ? (
            <div className="space-y-6">
              {/* Status Card */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">حالة الاشتراك</h2>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(subscription.status)}`}
                  >
                    {getStatusText(subscription.status)}
                  </span>
                </div>
                
                {/* Trial Information */}
                {subscription.isTrial && subscription.trialEndDate && (
                  <div className={`mt-4 p-4 border rounded-xl ${
                    subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 1
                      ? 'bg-red-50 border-red-200'
                      : subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 2
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 1
                          ? 'text-red-600'
                          : subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 2
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                      }`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium mb-2 ${
                          subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 1
                            ? 'text-red-800'
                            : subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 2
                            ? 'text-yellow-800'
                            : 'text-blue-800'
                        }`}>
                          {(() => {
                            // Check if trial is actually still active based on date
                            if (!subscription.trialEndDate) {
                              return 'انتهت الفترة التجريبية';
                            }
                            
                            const now = new Date();
                            const endDate = new Date(subscription.trialEndDate);
                            const isTrialActive = now <= endDate;
                            
                            if (isTrialActive) {
                              // Calculate days remaining on frontend as well for accuracy
                              const diffTime = endDate.getTime() - now.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              const daysRemaining = Math.max(0, diffDays);
                              
                              if (daysRemaining > 0) {
                                return `فترة تجريبية نشطة - متبقي ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}`;
                              } else {
                                return 'انتهت الفترة التجريبية';
                              }
                            } else {
                              return 'انتهت الفترة التجريبية';
                            }
                          })()}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-600 mb-1">تاريخ بداية التجربة</p>
                            <p className="font-semibold text-gray-900">
                              {formatDate(subscription.trialStartDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-1">تاريخ انتهاء التجربة</p>
                            <p className="font-semibold text-gray-900">
                              {formatDate(subscription.trialEndDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subscription Dates */}
                {(subscription.createdAt || subscription.updatedAt) && !subscription.isTrial && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">تاريخ الاشتراك</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDate(subscription.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">تاريخ التجديد</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {subscription.createdAt ? formatDate(calculateRenewalDate(subscription.createdAt)?.toISOString()) : 'غير متوفر'}
                      </p>
                    </div>
                  </div>
                )}

                {subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL' && (
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

              {/* Plan Details */}
              {subscription.plan && (
                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">تفاصيل الخطة</h2>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{subscription.plan.name}</h3>
                    {subscription.plan.description && (
                      <p className="text-gray-600">{subscription.plan.description}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">الميزات المتاحة</h4>
                      <button
                        onClick={() => toast.info('يرجى التواصل مع المسؤول لترقية الاشتراك')}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
                      >
                        ترقية الاشتراك
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {subscription.plan.features.map((feature) => (
                        <div
                          key={feature.feature}
                          className={`flex items-center gap-2 p-3 rounded-lg border ${
                            feature.enabled 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          {feature.enabled ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={`text-sm ${feature.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {FEATURE_LABELS[feature.feature] || feature.feature}
                          </span>
                          {!feature.enabled && (
                            <span className="ml-auto px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded">
                              PRO
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {!subscription.plan && (
                <Card>
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">لا توجد خطة مفعلة</h3>
                    <p className="text-gray-600">يرجى التواصل مع المسؤول لتفعيل خطة اشتراك</p>
                  </div>
                </Card>
              )}

              {/* Quota and Usage */}
              {limits && (
                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">الحصص والاستخدام</h2>
                  <div className="space-y-6">
                    {/* Rooms Quota */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">الغرف</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            المستخدم: {limits.currentRooms} / الحصة: {limits.maxRooms}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-lg font-bold text-primary-600">
                            {limits.maxRooms - limits.currentRooms}
                          </p>
                          <p className="text-xs text-gray-500">متبقي</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (limits.currentRooms / limits.maxRooms) * 100 >= 90
                              ? 'bg-red-500'
                              : (limits.currentRooms / limits.maxRooms) * 100 >= 70
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min((limits.currentRooms / limits.maxRooms) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {((limits.currentRooms / limits.maxRooms) * 100).toFixed(1)}% مستخدم
                      </p>
                    </div>

                    {/* Max Participants Per Room */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">الحد الأقصى للمشاركين</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            لكل غرفة
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-lg font-bold text-primary-600">
                            {limits.maxParticipants}
                          </p>
                          <p className="text-xs text-gray-500">مشارك</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">لا يوجد اشتراك</h3>
                <p className="text-gray-600">يرجى التواصل مع المسؤول لإنشاء اشتراك</p>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SubscriptionPageClient({ 
  clientId, 
  userEmail 
}: { 
  clientId: string;
  userEmail: string;
}) {
  return (
    <SidebarProvider>
      <SubscriptionPageContent clientId={clientId} userEmail={userEmail} />
    </SidebarProvider>
  );
}
