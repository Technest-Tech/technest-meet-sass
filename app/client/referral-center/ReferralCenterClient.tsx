'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gift,
  Link2,
  QrCode,
  Share2,
  RefreshCw,
  Users,
  Coins,
  Award,
  History,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '@/lib/components/Sidebar';
import Header from '@/lib/components/Header';
import Card from '@/lib/components/Card';
import { SidebarProvider, useSidebar } from '@/lib/components/SidebarContext';
import { logout } from '@/lib/auth/client-auth';

interface ReferralLink {
  id: string;
  code: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  referralCount: number;
  qrCodeUrl?: string | null;
}

interface ReferralStats {
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  referralCount: number;
  qualifiedEvents: number;
}

interface ReferralEvent {
  id: string;
  eventType: 'REGISTERED' | 'SUBSCRIBED' | 'LARGE_PLAN';
  status: 'PENDING' | 'QUALIFIED' | 'CANCELED';
  pointsAwarded: number;
  referredEmail?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

interface ReferralOverviewResponse {
  referralLink: ReferralLink;
  shareUrl: string;
  stats: ReferralStats;
  events: ReferralEvent[];
}

interface Reward {
  id: string;
  label: string;
  description?: string | null;
  rewardType: string;
  costPoints: number;
  config: Record<string, unknown> | null;
  isActive: boolean;
  isAffordable: boolean;
}

interface RedeemRequest {
  id: string;
  status: string;
  pointsSpent: number;
  createdAt: string;
  rewardId?: string | null;
  notes?: string | null;
}

interface RewardsResponse {
  referralLink: ReferralLink;
  rewards: Reward[];
  redeemRequests: RedeemRequest[];
}

function ReferralCenterContent({
  userEmail,
  clientId,
}: {
  userEmail: string;
  clientId: string;
}) {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ReferralOverviewResponse | null>(null);
  const [rewardsPayload, setRewardsPayload] = useState<RewardsResponse | null>(null);
  const [redeemModal, setRedeemModal] = useState<{
    reward: Reward | null;
    notes: string;
    isSubmitting: boolean;
  }>({ reward: null, notes: '', isSubmitting: false });
  const [isRegenerating, setIsRegenerating] = useState(false);

  const menuItems = useMemo(
    () => [
      { href: '/client/dashboard', label: 'لوحة التحكم', icon: Users },
      { href: '/client/rooms', label: 'إدارة الغرف', icon: Share2 },
      { href: '/client/subscription', label: 'الاشتراك', icon: Coins },
      { href: '/client/settings', label: 'الإعدادات', icon: History },
      { href: '/client/referral-center', label: 'مركز الإحالات', icon: Gift },
    ],
    [],
  );

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [overviewRes, rewardsRes] = await Promise.all([
        fetch('/api/client/referrals/overview', { credentials: 'include' }),
        fetch('/api/client/referrals/rewards', { credentials: 'include' }),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setOverview(data);
      } else {
        throw new Error('فشل تحميل بيانات الإحالات');
      }

      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewardsPayload(data);
      }
    } catch (error) {
      console.error(error);
      toast.error('تعذر تحميل مركز الإحالات');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/client/login');
  };

  const handleCopyLink = async () => {
    if (!overview?.shareUrl) return;
    await navigator.clipboard.writeText(overview.shareUrl);
    toast.success('تم نسخ الرابط بنجاح');
  };

  const handleRegenerateLink = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/client/referrals/link', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('تعذر إعادة إنشاء الرابط');
      }

      const data = await response.json();
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              referralLink: data.referralLink,
              shareUrl: data.shareUrl,
            }
          : null,
      );
      toast.success('تم إنشاء رابط جديد');
    } catch (error) {
      console.error(error);
      toast.error('تعذر إنشاء رابط جديد');
    } finally {
      setIsRegenerating(false);
    }
  };

  const openRedeemModal = (reward: Reward) => {
    setRedeemModal({
      reward,
      notes: '',
      isSubmitting: false,
    });
  };

  const submitRedeemRequest = async () => {
    if (!redeemModal.reward) return;
    setRedeemModal((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const response = await fetch('/api/client/referrals/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rewardId: redeemModal.reward.id,
          notes: redeemModal.notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'تعذر إرسال طلب الاستبدال');
      }

      toast.success('تم إرسال طلب الاستبدال، سيتم مراجعته من قبل الإدارة');
      setRedeemModal({ reward: null, notes: '', isSubmitting: false });
      await fetchAllData();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'تعذر إرسال الطلب');
      setRedeemModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const qrUrl = useMemo(() => {
    if (!overview?.shareUrl) return null;
    if (overview.referralLink.qrCodeUrl) {
      return overview.referralLink.qrCodeUrl;
    }
    const encoded = encodeURIComponent(overview.shareUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
  }, [overview]);

  const eventLabel = (eventType: ReferralEvent['eventType']) => {
    switch (eventType) {
      case 'REGISTERED':
        return 'تسجيل مستخدم';
      case 'SUBSCRIBED':
        return 'اشتراك مدفوع';
      case 'LARGE_PLAN':
        return 'خطة كبيرة';
      default:
        return eventType;
    }
  };

  const statusBadge = (status: ReferralEvent['status']) => {
    switch (status) {
      case 'QUALIFIED':
        return 'bg-green-100 text-green-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'CANCELED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div dir="rtl" className="h-screen bg-gray-50 flex overflow-hidden">
      <Sidebar
        userEmail={userEmail}
        menuItems={menuItems}
        title="لوحة تحكم العميل"
        onLogout={handleLogout}
      />

      <div
        className={`flex-1 flex flex-col transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'lg:mr-20' : 'lg:mr-72'
        }`}
      >
        <Header
          title="مركز الإحالات"
          subtitle="شارك رابطك واحصل على مكافآت مقابل العملاء الجدد"
          userEmail={userEmail}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {loading || !overview ? (
            <Card>
              <div className="text-center py-12">
                <div className="inline-block w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-gray-600">جاري تحميل بيانات مركز الإحالات...</p>
              </div>
            </Card>
          ) : (
            <>
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">رابط الإحالة الخاص بك</h2>
                      <p className="text-gray-600 text-sm">
                        شارك الرابط أو استخدم رمز QR لدعوة العملاء الجدد
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleRegenerateLink}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                        disabled={isRegenerating}
                      >
                        <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                        إعادة توليد
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition"
                      >
                        <Copy className="w-4 h-4" />
                        نسخ الرابط
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50">
                        <p className="text-xs text-gray-500 mb-2">الرابط الكامل</p>
                        <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 rounded-xl border border-gray-200">
                          <div className="flex items-center gap-2 overflow-auto">
                            <Link2 className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-mono text-gray-800">{overview.shareUrl}</span>
                          </div>
                          <button onClick={handleCopyLink}>
                            <Copy className="w-4 h-4 text-gray-500 hover:text-primary-600" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl text-white">
                        <p className="text-sm opacity-80 mb-2">رمز الإحالة</p>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold tracking-widest">{overview.referralLink.code}</span>
                          <Share2 className="w-8 h-8 opacity-80" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center border border-gray-200 rounded-2xl bg-white p-4">
                      <QrCode className="w-6 h-6 text-gray-500 mb-2" />
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt="Referral QR code"
                          className="rounded-xl border border-gray-200"
                        />
                      ) : (
                        <div className="w-40 h-40 bg-gray-100 rounded-xl animate-pulse" />
                      )}
                      <p className="text-xs text-gray-500 mt-2 text-center">قم بمسح الكود للدعوة</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary-500" />
                    النقاط الحالية
                  </h3>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <p className="text-xs text-gray-500 mb-1">النقاط المتاحة</p>
                      <p className="text-3xl font-bold text-gray-900">{overview.stats.availablePoints}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-xs text-gray-500">إجمالي النقاط</p>
                        <p className="text-lg font-semibold">{overview.stats.totalPoints}</p>
                      </div>
                      <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-xs text-gray-500">النقاط المستبدلة</p>
                        <p className="text-lg font-semibold text-primary-600">
                          {overview.stats.redeemedPoints}
                        </p>
                      </div>
                      <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-xs text-gray-500">الإحالات</p>
                        <p className="text-lg font-semibold">{overview.stats.referralCount}</p>
                      </div>
                      <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-xs text-gray-500">المكافآت المؤهلة</p>
                        <p className="text-lg font-semibold text-green-600">
                          {overview.stats.qualifiedEvents}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary-500" />
                      المكافآت المتاحة
                    </h3>
                    <p className="text-sm text-gray-500">استبدل نقاطك بالمزايا التالية</p>
                  </div>
                  <div className="space-y-4">
                    {rewardsPayload?.rewards && rewardsPayload.rewards.length > 0 ? (
                      rewardsPayload.rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="border border-gray-200 rounded-2xl p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        >
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{reward.label}</h4>
                            {reward.description && (
                              <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">التكلفة: {reward.costPoints} نقطة</p>
                          </div>
                          <button
                            onClick={() => openRedeemModal(reward)}
                            disabled={!reward.isAffordable}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                              reward.isAffordable
                                ? 'bg-primary-600 text-white hover:bg-primary-700'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            استبدال
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-gray-500">لا توجد مكافآت مفعلة حالياً</div>
                    )}
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-primary-500" />
                    طلبات الاستبدال
                  </h3>
                  <div className="space-y-3">
                    {rewardsPayload?.redeemRequests && rewardsPayload.redeemRequests.length > 0 ? (
                      rewardsPayload.redeemRequests.slice(0, 5).map((request) => (
                        <div
                          key={request.id}
                          className="p-3 border border-gray-200 rounded-xl bg-gray-50 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {request.pointsSpent} نقطة
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(request.createdAt).toLocaleDateString('ar-EG')}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              request.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-700'
                                : request.status === 'APPROVED'
                                ? 'bg-blue-100 text-blue-700'
                                : request.status === 'FULFILLED'
                                ? 'bg-green-100 text-green-700'
                                : request.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 text-center">لا توجد طلبات بعد</p>
                    )}
                  </div>
                </Card>
              </section>

              <section>
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary-500" />
                      سجل الإحالات
                    </h3>
                    <p className="text-sm text-gray-500">آخر 50 عملية تمت عبر رابطك</p>
                  </div>

                  {overview.events.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      لم يتم تسجيل أي إحالات بعد. شارك رابطك وابدأ في كسب النقاط!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-right text-gray-500 border-b">
                            <th className="py-3">العملية</th>
                            <th>البريد المحال</th>
                            <th>النقاط</th>
                            <th>الحالة</th>
                            <th>التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.events.map((event) => (
                            <tr key={event.id} className="border-b last:border-b-0">
                              <td className="py-3 font-semibold text-gray-900">
                                {eventLabel(event.eventType)}
                              </td>
                              <td className="text-gray-600">{event.referredEmail || '-'}</td>
                              <td className="text-gray-800">{event.pointsAwarded} نقطة</td>
                              <td>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(event.status)}`}
                                >
                                  {event.status === 'QUALIFIED'
                                    ? 'مكتملة'
                                    : event.status === 'PENDING'
                                    ? 'قيد الانتظار'
                                    : 'ملغاة'}
                                </span>
                              </td>
                              <td className="text-gray-500">
                                {new Date(
                                  event.processedAt || event.createdAt,
                                ).toLocaleDateString('ar-EG')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </section>
            </>
          )}
        </main>
      </div>

      {redeemModal.reward && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">طلب استبدال</h3>
                <p className="text-sm text-gray-500 mt-1">{redeemModal.reward.label}</p>
              </div>
              <button
                onClick={() => setRedeemModal({ reward: null, notes: '', isSubmitting: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm text-gray-700 mb-2">{redeemModal.reward.description}</p>
              <p className="text-xs text-gray-500">
                التكلفة: <span className="font-semibold">{redeemModal.reward.costPoints} نقطة</span>
              </p>
            </div>

            <label className="text-sm font-semibold text-gray-700">
              ملاحظات إضافية
              <textarea
                className="mt-2 w-full border border-gray-200 rounded-xl p-3 text-sm"
                rows={3}
                placeholder="أضف أي تفاصيل يحتاج فريق الدعم معرفتها"
                value={redeemModal.notes}
                onChange={(event) =>
                  setRedeemModal((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </label>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setRedeemModal({ reward: null, notes: '', isSubmitting: false })}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={submitRedeemRequest}
                disabled={redeemModal.isSubmitting}
                className="px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 flex items-center gap-2 disabled:opacity-60"
              >
                {redeemModal.isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                إرسال الطلب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReferralCenterClient({
  userEmail,
  clientId,
}: {
  userEmail: string;
  clientId: string;
}) {
  return (
    <SidebarProvider>
      <ReferralCenterContent userEmail={userEmail} clientId={clientId} />
    </SidebarProvider>
  );
}

