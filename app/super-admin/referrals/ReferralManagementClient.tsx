'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Users,
  Package,
  CreditCard,
  Building2,
  Gift,
  Settings2,
  Coins,
  Award,
  ClipboardList,
  UserPlus,
  Mail,
  Phone,
  Building,
  Sparkles,
} from 'lucide-react';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import Button from '@/lib/components/Button';
import FormInput from '@/lib/components/FormInput';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';
import toast from 'react-hot-toast';
import { Modal } from '@/lib/components/ui/Modal';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';

type ReferralSettings = {
  id: string;
  registerPoints: number;
  subscribePoints: number;
  largePlanPoints: number;
  largePlanThreshold?: number | null;
  minRedeemPoints: number;
  creditPointValue: number;
  freeRoomDays: number;
};

type Reward = {
  id: string;
  label: string;
  description?: string | null;
  rewardType: string;
  costPoints: number;
  isActive: boolean;
};

type RedeemRequest = {
  id: string;
  status: string;
  pointsSpent: number;
  notes?: string | null;
  createdAt: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  reward?: Reward | null;
};

type Prospect = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  referralEvent?: {
    eventType: string;
    metadata?: Record<string, unknown> | null;
    referralLink: {
      client: {
        name: string;
      };
    };
  };
};

const REDEEM_STATUS_ACTIONS = [
  { value: 'APPROVED', label: 'موافقة' },
  { value: 'REJECTED', label: 'رفض' },
  { value: 'FULFILLED', label: 'تم التنفيذ' },
];

function ReferralManagementContent({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<ReferralSettings | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemRequests, setRedeemRequests] = useState<RedeemRequest[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rewardUpdates, setRewardUpdates] = useState<Record<string, string>>({});
  const [rewardLoading, setRewardLoading] = useState<string | null>(null);
  const [prospectActionLoading, setProspectActionLoading] = useState<string | null>(null);
  const [customPoints, setCustomPoints] = useState<Record<string, string>>({});
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [openDetailsModal, setOpenDetailsModal] = useState<string | null>(null);
  const [openProspectDetailsModal, setOpenProspectDetailsModal] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, rewardsRes, redeemRes, prospectsRes] = await Promise.all([
        fetch('/api/super-admin/referrals/settings', { credentials: 'include' }),
        fetch('/api/super-admin/referrals/rewards', { credentials: 'include' }),
        fetch('/api/super-admin/referrals/redeem', { credentials: 'include' }),
        fetch('/api/super-admin/referrals/prospects', { credentials: 'include' }),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
        setSettingsForm(data.settings);
      }

      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewards(data.rewards || []);
      }

      if (redeemRes.ok) {
        const data = await redeemRes.json();
        setRedeemRequests(data.requests || []);
      }

      if (prospectsRes.ok) {
        const data = await prospectsRes.json();
        setProspects(data.prospects || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل بيانات الإحالات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/super-admin/login');
  };

  const handleSettingsSave = async () => {
    if (!settingsForm) return;
    try {
      const response = await fetch('/api/super-admin/referrals/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settingsForm),
      });

      if (!response.ok) {
        throw new Error('تعذر حفظ الإعدادات');
      }

      toast.success('تم حفظ الإعدادات');
      fetchAll();
    } catch (error) {
      console.error(error);
      toast.error('فشل حفظ الإعدادات');
    }
  };

  const toggleRewardActive = async (reward: Reward) => {
    try {
      const response = await fetch(`/api/super-admin/referrals/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !reward.isActive }),
      });

      if (!response.ok) {
        throw new Error('تعذر تحديث حالة المكافأة');
      }

      fetchAll();
    } catch (error) {
      console.error(error);
      toast.error('فشل تحديث المكافأة');
    }
  };

  const handleRewardCostSave = async (reward: Reward) => {
    const pendingValue = rewardUpdates[reward.id];
    const nextCost =
      pendingValue !== undefined && pendingValue !== ''
        ? Number(pendingValue)
        : reward.costPoints;

    if (!Number.isFinite(nextCost) || nextCost < 1) {
      toast.error('الرجاء إدخال قيمة نقاط صحيحة (1 فأكثر)');
      return;
    }

    try {
      setRewardLoading(reward.id);
      const response = await fetch(`/api/super-admin/referrals/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ costPoints: nextCost }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل تحديث النقاط');
      }

      toast.success('تم تحديث النقاط');
      setRewardUpdates((prev) => ({ ...prev, [reward.id]: '' }));
      fetchAll();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'فشل تحديث النقاط');
    } finally {
      setRewardLoading(null);
    }
  };

  const handleRedeemAction = async (requestId: string, status: string) => {
    try {
      const response = await fetch(`/api/super-admin/referrals/redeem/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل تحديث الطلب');
      }

      toast.success('تم تحديث الطلب');
      fetchAll();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'فشل تحديث الطلب');
    }
  };

  const handleProspectAction = async (
    prospectId: string,
    action: 'APPROVE' | 'REJECT',
    points?: number,
  ) => {
    try {
      setProspectActionLoading(`${prospectId}-${action}`);
      const response = await fetch('/api/super-admin/referrals/prospects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prospectId, action, points }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل تحديث حالة العميل المحتمل');
      }

      toast.success(
        action === 'APPROVE' ? 'تم منح النقاط وتفعيل الإحالة' : 'تم رفض الطلب بدون منح نقاط',
      );
      fetchAll();
    } catch (error) {
      console.error(error);
      toast.error('تعذر تحديث العميل المحتمل');
    } finally {
      setProspectActionLoading(null);
    }
  };

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'لوحة التحكم', icon: Activity },
    { href: '/super-admin/accounts', label: 'إدارة الحسابات', icon: Users },
    { href: '/super-admin/plans', label: 'الخطط', icon: Package },
    { href: '/super-admin/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { href: '/super-admin/clients', label: 'العملاء', icon: Building2 },
    { href: '/super-admin/referrals', label: 'الإحالات والمكافآت', icon: Gift },
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
          title="إدارة الإحالات والمكافآت"
          subtitle="تحكم في نظام الإحالات، المكافآت، والطلبات"
          userEmail={userEmail}
        />

        <main className="p-6 lg:p-8 xl:p-10 space-y-8 lg:space-y-10">
          {isLoading ? (
            <Card padding="lg">
              <div className="text-center py-16">
                <div className="inline-block w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-gray-600 text-base">جاري تحميل بيانات الإحالات...</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Points Settings Section */}
              <section>
                <Card padding="lg" className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-50" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                      <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                        <Settings2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">إعدادات النقاط</h3>
                        <p className="text-sm text-gray-500 mt-0.5">تكوين نظام النقاط والمكافآت</p>
                      </div>
                    </div>
                    {settingsForm ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="md:col-span-2 lg:col-span-1">
                          <FormInput
                            label="نقاط التسجيل"
                            type="number"
                            value={settingsForm.registerPoints}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, registerPoints: Number(e.target.value) })
                            }
                            className="text-base"
                          />
                        </div>
                        <FormInput
                          label="نقاط الاشتراك"
                          type="number"
                          value={settingsForm.subscribePoints}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, subscribePoints: Number(e.target.value) })
                          }
                          className="text-base"
                        />
                        <FormInput
                          label="نقاط الخطة الكبيرة"
                          type="number"
                          value={settingsForm.largePlanPoints}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, largePlanPoints: Number(e.target.value) })
                          }
                          className="text-base"
                        />
                        <FormInput
                          label="الحد الأدنى للاستبدال"
                          type="number"
                          value={settingsForm.minRedeemPoints}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, minRedeemPoints: Number(e.target.value) })
                          }
                          className="text-base"
                        />
                        <FormInput
                          label="قيمة النقطة الواحدة (EGP)"
                          type="number"
                          value={settingsForm.creditPointValue}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              creditPointValue: Number(e.target.value),
                            })
                          }
                          className="text-base"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-8 text-center">لم يتم ضبط الإعدادات بعد.</p>
                    )}
                    <div className="flex justify-end mt-8 pt-6 border-t border-gray-100">
                      <Button 
                        variant="primary" 
                        onClick={handleSettingsSave}
                        className="px-6 py-2.5 text-base font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all"
                      >
                        حفظ الإعدادات
                      </Button>
                    </div>
                  </div>
                </Card>
              </section>

              {/* Rewards Section - Full Width Row Grid */}
              <section>
                <Card padding="lg" className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-50 to-transparent rounded-bl-full opacity-50" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                          <Award className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">قائمة المكافآت</h3>
                          <p className="text-sm text-gray-500 mt-0.5">أقصى 4 مكافآت</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                        بالعربية
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="border-2 border-gray-100 rounded-2xl p-5 space-y-4 bg-gradient-to-br from-white to-gray-50/50 hover:border-blue-200 hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <p className="font-bold text-gray-900 text-sm">{reward.label}</p>
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                                    reward.isActive
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {reward.isActive ? 'مفعل' : 'معطل'}
                                </span>
                              </div>
                              {reward.description && (
                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{reward.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                            <p className="text-xs font-semibold text-gray-700 mb-0.5">النقاط المطلوبة</p>
                            <p className="text-base font-bold text-blue-600">{reward.costPoints} نقطة</p>
                          </div>

                          <div className="space-y-2.5 pt-2 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                              تعديل عدد النقاط
                            </label>
                            <input
                              type="number"
                              min={1}
                              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white placeholder:text-gray-400"
                              placeholder={`${reward.costPoints}`}
                              value={rewardUpdates[reward.id] ?? ''}
                              onChange={(e) =>
                                setRewardUpdates((prev) => ({
                                  ...prev,
                                  [reward.id]: e.target.value,
                                }))
                              }
                            />
                            <div className="flex flex-col gap-2">
                              <Button
                                className="w-full font-semibold shadow-md hover:shadow-lg transition-all text-xs py-1.5"
                                variant="primary"
                                size="sm"
                                disabled={rewardLoading === reward.id}
                                onClick={() => handleRewardCostSave(reward)}
                              >
                                {rewardLoading === reward.id ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
                              </Button>
                              <Button
                                className="w-full font-semibold text-xs py-1.5"
                                variant={reward.isActive ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => toggleRewardActive(reward)}
                              >
                                {reward.isActive ? 'إيقاف العرض' : 'تفعيل العرض'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </section>

              {/* Redeem Requests Section */}
              <section>
                <Card padding="lg" className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-50 to-transparent rounded-bl-full opacity-50" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
                          <ClipboardList className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">طلبات الاستبدال</h3>
                          <p className="text-sm text-gray-500 mt-0.5">إدارة طلبات استبدال النقاط</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-xl border border-purple-100">
                        <span className="text-sm font-bold text-purple-700">{redeemRequests.length}</span>
                        <span className="text-sm text-gray-600">طلب</span>
                      </div>
                    </div>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {redeemRequests.length === 0 ? (
                        <div className="text-center py-12">
                          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">لا توجد طلبات حالياً</p>
                        </div>
                      ) : (
                        redeemRequests.map((request) => {
                          const getStatusBadge = (status: string) => {
                            const statusMap: Record<string, { label: string; className: string }> = {
                              PENDING: { label: 'قيد الانتظار', className: 'bg-amber-100 text-amber-700 border-amber-200' },
                              APPROVED: { label: 'موافق عليه', className: 'bg-green-100 text-green-700 border-green-200' },
                              REJECTED: { label: 'مرفوض', className: 'bg-red-100 text-red-700 border-red-200' },
                              FULFILLED: { label: 'تم التنفيذ', className: 'bg-blue-100 text-blue-700 border-blue-200' },
                            };
                            const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
                            return (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                            );
                          };

                          return (
                            <div
                              key={request.id}
                              className="p-4 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 rounded-2xl space-y-3 hover:border-purple-200 hover:shadow-lg transition-all duration-300"
                            >
                              {/* Header with Name and Status */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-900 text-base mb-2 truncate">{request.client.name}</p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {getStatusBadge(request.status)}
                                  </div>
                                </div>
                                <div className="px-3 py-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md shrink-0">
                                  <span className="text-sm font-bold text-white">
                                    {request.pointsSpent} نقطة
                                  </span>
                                </div>
                              </div>

                              {/* Contact Information */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span className="text-gray-600 truncate">{request.client.email}</span>
                                </div>
                                {request.client.phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-600">{request.client.phone}</span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="flex-1 min-w-[100px] font-semibold shadow-sm hover:shadow-md transition-all text-xs"
                                  disabled={request.status === 'APPROVED' || request.status === 'FULFILLED'}
                                  onClick={() => handleRedeemAction(request.id, 'APPROVED')}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                                  موافقة
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1 min-w-[100px] font-semibold shadow-sm hover:shadow-md transition-all text-xs"
                                  disabled={request.status === 'REJECTED'}
                                  onClick={() => handleRedeemAction(request.id, 'REJECTED')}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1 inline" />
                                  رفض
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="font-semibold shadow-sm hover:shadow-md transition-all text-xs"
                                  onClick={() => setOpenDetailsModal(request.id)}
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1 inline" />
                                  التفاصيل
                                </Button>
                              </div>

                              {/* Details Modal */}
                              <Modal
                                isOpen={openDetailsModal === request.id}
                                onClose={() => setOpenDetailsModal(null)}
                                title="تفاصيل طلب الاستبدال"
                                size="lg"
                              >
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">اسم العميل</p>
                                      <p className="text-sm font-bold text-gray-900">{request.client.name}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">الحالة</p>
                                      {getStatusBadge(request.status)}
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">البريد الإلكتروني</p>
                                      <p className="text-sm text-gray-900">{request.client.email}</p>
                                    </div>
                                    {request.client.phone && (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-500 mb-1">رقم الواتساب</p>
                                        <p className="text-sm text-gray-900">{request.client.phone}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">النقاط المستخدمة</p>
                                      <p className="text-sm font-bold text-purple-600">{request.pointsSpent} نقطة</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">تاريخ الطلب</p>
                                      <p className="text-sm text-gray-900">
                                        {new Date(request.createdAt).toLocaleString('ar-EG')}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">المكافأة</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {request.reward?.label || 'مكافأة مخصصة'}
                                    </p>
                                    {request.reward?.description && (
                                      <p className="text-xs text-gray-500 mt-1">{request.reward.description}</p>
                                    )}
                                  </div>
                                  {request.notes && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">ملاحظات</p>
                                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        {request.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </Modal>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </Card>
              </section>

              {/* Prospects Section */}
              <section>
                <Card padding="lg" className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-50 to-transparent rounded-bl-full opacity-50" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg shadow-green-500/20">
                          <UserPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">العملاء المحتملون من الإحالات</h3>
                          <p className="text-sm text-gray-500 mt-0.5">مراجعة واعتماد العملاء المحتملين</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-100">
                        <span className="text-sm font-bold text-green-700">{prospects.length}</span>
                        <span className="text-sm text-gray-600">عميل</span>
                      </div>
                    </div>
                    {prospects.length === 0 ? (
                      <div className="text-center py-16">
                        <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-base">لا توجد بيانات حالياً</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {prospects.map((prospect) => {
                          const metadata =
                            prospect.referralEvent?.metadata &&
                            typeof prospect.referralEvent.metadata === 'object' &&
                            !Array.isArray(prospect.referralEvent.metadata)
                              ? (prospect.referralEvent.metadata as Record<string, unknown>)
                              : {};
                          const roomCount = metadata.roomCount ?? '-';
                          const pendingPoints =
                            (metadata.pendingPoints as number | undefined) ?? settings?.registerPoints ?? 0;
                          const isApproved = prospect.status === 'ACTIVATED';
                          const formattedRoomCount =
                            typeof roomCount === 'number'
                              ? roomCount.toLocaleString('ar-EG')
                              : (roomCount as string);
                          const referralOwner = prospect.referralEvent?.referralLink.client.name || '-';
                          const detailItems = [
                            {
                              label: 'واتساب',
                              value: prospect.phone,
                              icon: Phone,
                            },
                            {
                              label: 'البريد',
                              value: prospect.email,
                              icon: Mail,
                            },
                            {
                              label: 'الشركة',
                              value: prospect.companyName,
                              icon: Building,
                            },
                            {
                              label: 'الغرف المطلوبة',
                              value: formattedRoomCount,
                            },
                            {
                              label: 'الجهة المحيلة',
                              value: referralOwner,
                            },
                            {
                              label: 'نقاط عند الاعتماد',
                              value: `${pendingPoints} نقطة`,
                              icon: Sparkles,
                              highlight: true,
                            },
                          ].filter((item) => item.value && item.value !== '-');

                          return (
                            <>
                              <div
                                key={prospect.id}
                                className="border-2 border-gray-100 rounded-2xl p-3 bg-gradient-to-br from-white to-gray-50/30 space-y-2.5 hover:border-green-200 hover:shadow-lg transition-all duration-300"
                              >
                                {/* Header with Name and Status */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="text-sm font-bold text-gray-900 truncate">
                                        {prospect.name || 'غير معروف'}
                                      </p>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                                          isApproved
                                            ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700 border border-green-200'
                                            : 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                      >
                                        {isApproved ? 'مُعتمد' : 'بانتظار'}
                                      </span>
                                    </div>
                                    {/* Show only email or phone, whichever is available */}
                                    {prospect.email && (
                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="truncate">{prospect.email}</span>
                                      </div>
                                    )}
                                    {!prospect.email && prospect.phone && (
                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="truncate">{prospect.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Show only points highlight */}
                                <div className="p-2 bg-gradient-to-r from-green-50 to-green-50/50 rounded-lg border border-green-200">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-gray-600 text-[10px] font-medium">
                                      <Sparkles className="w-3 h-3 text-gray-400 shrink-0" />
                                      نقاط عند الاعتماد
                                    </span>
                                    <span className="font-bold text-xs text-green-700">
                                      {pendingPoints} نقطة
                                    </span>
                                  </div>
                                </div>

                                {/* Date */}
                                <p className="text-gray-400 text-[10px] text-center py-1 bg-gray-50 rounded-md">
                                  {new Date(prospect.createdAt).toLocaleDateString('ar-EG')}
                                </p>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2 pt-2 border-t border-dashed border-gray-200">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full font-semibold shadow-sm hover:shadow-md transition-all text-xs py-1.5"
                                    onClick={() => setOpenProspectDetailsModal(prospect.id)}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1 inline" />
                                    عرض التفاصيل
                                  </Button>
                                  <div className="flex gap-2">
                                    <Button
                                      className="flex-1 font-semibold shadow-sm hover:shadow-md transition-all text-xs py-1.5"
                                      variant="primary"
                                      size="sm"
                                      disabled={
                                        isApproved || prospectActionLoading === `${prospect.id}-APPROVE`
                                      }
                                      onClick={() =>
                                        handleProspectAction(
                                          prospect.id,
                                          'APPROVE',
                                          Number(
                                            customPoints[prospect.id] && customPoints[prospect.id] !== ''
                                              ? customPoints[prospect.id]
                                              : pendingPoints,
                                          ),
                                        )
                                      }
                                    >
                                      {prospectActionLoading === `${prospect.id}-APPROVE`
                                        ? 'جارٍ...'
                                        : 'اعتماد'}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="flex-1 font-semibold shadow-sm hover:shadow-md transition-all text-xs py-1.5"
                                      disabled={prospectActionLoading === `${prospect.id}-REJECT`}
                                      onClick={() => handleProspectAction(prospect.id, 'REJECT')}
                                    >
                                      {prospectActionLoading === `${prospect.id}-REJECT`
                                        ? 'جارٍ...'
                                        : 'رفض'}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Prospect Details Modal */}
                              <Modal
                                isOpen={openProspectDetailsModal === prospect.id}
                                onClose={() => setOpenProspectDetailsModal(null)}
                                title="تفاصيل العميل المحتمل"
                                size="lg"
                              >
                                <div className="space-y-4">
                                  {/* Basic Info */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">الاسم</p>
                                      <p className="text-sm font-bold text-gray-900">
                                        {prospect.name || 'غير معروف'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">الحالة</p>
                                      <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                                          isApproved
                                            ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700 border border-green-200'
                                            : 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                      >
                                        {isApproved ? 'مُعتمد' : 'بانتظار الاعتماد'}
                                      </span>
                                    </div>
                                    {prospect.email && (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-500 mb-1">البريد الإلكتروني</p>
                                        <p className="text-sm text-gray-900">{prospect.email}</p>
                                      </div>
                                    )}
                                    {prospect.phone && (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-500 mb-1">رقم الواتساب</p>
                                        <p className="text-sm text-gray-900">{prospect.phone}</p>
                                      </div>
                                    )}
                                    {prospect.companyName && (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-500 mb-1">الشركة</p>
                                        <p className="text-sm text-gray-900">{prospect.companyName}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">تاريخ الإضافة</p>
                                      <p className="text-sm text-gray-900">
                                        {new Date(prospect.createdAt).toLocaleString('ar-EG')}
                                      </p>
                                    </div>
                                  </div>

                                  {/* All Detail Items */}
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-2">المعلومات الإضافية</p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {detailItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                          <div
                                            key={`${prospect.id}-${item.label}`}
                                            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                                              item.highlight
                                                ? 'ring-1 ring-green-100 bg-gradient-to-r from-green-50 to-green-50/50 border-green-200'
                                                : 'border-gray-100 bg-gray-50/50'
                                            }`}
                                          >
                                            <span className="flex items-center gap-2 text-gray-600 text-xs font-medium">
                                              {Icon && <Icon className="w-4 h-4 text-gray-400 shrink-0" />}
                                              {item.label}
                                            </span>
                                            <span
                                              className={`font-bold text-sm ${
                                                item.highlight ? 'text-green-700' : 'text-gray-900'
                                              }`}
                                            >
                                              {item.value}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Notes */}
                                  {prospect.notes && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 mb-1">الملاحظات</p>
                                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        {prospect.notes}
                                      </p>
                                    </div>
                                  )}

                                  {/* Action Section */}
                                  <div className="space-y-3 border-t border-gray-200 pt-4">
                                    <div className="space-y-2">
                                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                                        عدد النقاط لمنحها
                                      </label>
                                      <div className="flex flex-col gap-2">
                                        <input
                                          type="number"
                                          min={0}
                                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white placeholder:text-gray-400"
                                          placeholder={`${pendingPoints}`}
                                          value={customPoints[prospect.id] ?? ''}
                                          onChange={(e) =>
                                            setCustomPoints((prev) => ({
                                              ...prev,
                                              [prospect.id]: e.target.value,
                                            }))
                                          }
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            className="flex-1 font-semibold shadow-md hover:shadow-lg transition-all"
                                            variant="primary"
                                            size="sm"
                                            disabled={
                                              isApproved || prospectActionLoading === `${prospect.id}-APPROVE`
                                            }
                                            onClick={() =>
                                              handleProspectAction(
                                                prospect.id,
                                                'APPROVE',
                                                Number(
                                                  customPoints[prospect.id] && customPoints[prospect.id] !== ''
                                                    ? customPoints[prospect.id]
                                                    : pendingPoints,
                                                ),
                                              )
                                            }
                                          >
                                            {prospectActionLoading === `${prospect.id}-APPROVE`
                                              ? 'جارٍ الاعتماد...'
                                              : 'اعتماد ومنح النقاط'}
                                          </Button>
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            className="flex-1 font-semibold shadow-sm hover:shadow-md transition-all"
                                            disabled={prospectActionLoading === `${prospect.id}-REJECT`}
                                            onClick={() => handleProspectAction(prospect.id, 'REJECT')}
                                          >
                                            {prospectActionLoading === `${prospect.id}-REJECT`
                                              ? 'جارٍ الرفض...'
                                              : 'رفض الطلب'}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Modal>
                            </>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ReferralManagementClient({ userEmail }: { userEmail: string }) {
  return (
    <SidebarProvider>
      <ReferralManagementContent userEmail={userEmail} />
    </SidebarProvider>
  );
}

