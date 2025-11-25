'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  LayoutGrid,
  Target,
  Users,
  X,
} from 'lucide-react';

import Button from '@/lib/components/Button';
import Card from '@/lib/components/Card';
import { SubscriptionRecord } from '@/lib/hooks/useSubscriptionsData';

type DrawerProps = {
  subscription: SubscriptionRecord | null;
  onClose: () => void;
  onEdit: (subscription: SubscriptionRecord) => void;
  onWhatsappSave: (clientId: string, whatsappNumber: string) => void | Promise<void>;
  savingWhatsappClientId?: string | null;
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

const statusClasses: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-amber-50 text-amber-700',
  EXPIRED: 'bg-rose-50 text-rose-700',
  TRIAL: 'bg-blue-50 text-blue-700',
  TRIAL_EXPIRED: 'bg-rose-50 text-rose-700',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  EXPIRED: 'منتهي',
  TRIAL: 'تجريبي',
  TRIAL_EXPIRED: 'انتهت التجربة',
};

export default function SubscriptionDetailDrawer({
  subscription,
  onClose,
  onEdit,
  onWhatsappSave,
  savingWhatsappClientId,
}: DrawerProps) {
  if (!subscription) return null;

  const planFeatures = subscription.plan?.features?.filter((feature) => feature.enabled) ?? [];
  const [localWhatsapp, setLocalWhatsapp] = useState(subscription.client.whatsappNumber ?? '');

  useEffect(() => {
    setLocalWhatsapp(subscription.client.whatsappNumber ?? '');
  }, [subscription.client.whatsappNumber, subscription.client.id]);

  const isSavingWhatsapp = savingWhatsappClientId === subscription.client.id;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">معلومات الاشتراك</p>
            <h2 className="text-2xl font-bold text-gray-900">{subscription.client.name}</h2>
            <p className="text-sm text-gray-500">{subscription.client.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <main className="space-y-6 p-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusClasses[subscription.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {statusLabels[subscription.status] ?? subscription.status}
              </span>
              {subscription.metrics?.trialDaysRemaining !== null && (
                <span className="text-xs text-gray-500">
                  تبقى {subscription.metrics?.trialDaysRemaining} يوم في التجربة
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                أنشئ في {formatDate(subscription.createdAt)}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">الخطة</p>
                <p className="text-lg font-semibold text-gray-900">{subscription.plan?.name ?? 'غير محدد'}</p>
                <p className="text-xs text-gray-500">
                  {planFeatures.length} ميزة مفعلة • معدل المشاركين{' '}
                  {subscription.client.roomStats?.avgRoomCapacity ?? 0}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">استخدام الغرف</p>
                <p className="text-lg font-semibold text-gray-900">
                  {subscription.client.roomStats?.totalRooms ?? 0} / {subscription.client.maxRooms}
                </p>
                <p className="text-xs text-gray-500">
                  فعال الآن: {subscription.client.roomStats?.activeNow ?? 0} غرفة
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900">الفوترة والاتصال</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-gray-600">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">بداية الاشتراك</p>
                <p className="font-semibold text-gray-900">{formatDate(subscription.startDate)}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">انتهاء الاشتراك</p>
                <p className="font-semibold text-gray-900">{formatDate(subscription.endDate)}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">قيمة الاشتراك</p>
                <p className="font-semibold text-gray-900">
                  {typeof subscription.amountEGP === 'number'
                    ? `${subscription.amountEGP.toLocaleString('ar-EG')} ج.م`
                    : 'غير محدد'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">المصدر</p>
                <p className="font-semibold text-gray-900">
                  {subscription.source?.label ?? 'غير محدد'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">رقم واتساب للتواصل</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={localWhatsapp}
                  onChange={(e) => setLocalWhatsapp(e.target.value)}
                  placeholder="مثال: 201234567890"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isSavingWhatsapp}
                  onClick={() => onWhatsappSave(subscription.client.id, localWhatsapp)}
                >
                  حفظ
                </Button>
              </div>
              <p className="text-xs text-gray-500">اكتب الرقم مع كود الدولة بدون + أو 00.</p>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900">تفاصيل الخطة</h3>
            </div>
            {planFeatures.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد ميزات مفعلة لهذه الخطة.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {planFeatures.map((feature) => (
                  <span
                    key={feature.feature}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {feature.feature}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900">النشاط</h3>
            </div>
            <div className="grid gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="font-semibold text-gray-900">متوسط تفعيل الغرف</p>
                  <p>{subscription.client.roomStats?.activeRooms ?? 0} غرفة مفعلة في آخر ٧ أيام</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <LayoutGrid className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="font-semibold text-gray-900">آخر غرفة تم إنشاؤها</p>
                  <p>{formatDate(subscription.metrics?.lastRoomCreatedAt)}</p>
                </div>
              </div>
            </div>
          </Card>
        </main>

        <footer className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="h-4 w-4" />
            <span>جميع التعديلات يتم تسجيلها في سجل التدقيق.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(subscription)}>
              تعديل الاشتراك
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

