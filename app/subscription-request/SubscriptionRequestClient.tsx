'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  Loader2,
  Mail,
  Phone,
  Users,
  MessageCircle,
  Building2,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/lib/components/Card';

export default function SubscriptionRequestClient({ referralCode }: { referralCode: string }) {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    companyName: '',
    notes: '',
    roomCount: '',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name || !form.email) {
      toast.error('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/referrals/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode,
          email: form.email,
          prospect: {
            name: form.name,
            phone: form.whatsapp,
            companyName: form.companyName,
            notes: form.notes || undefined,
            metadata: {
              whatsapp: form.whatsapp || undefined,
              roomCount: form.roomCount || undefined,
            },
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'تعذر إرسال الطلب');
      }

      toast.success('تم إرسال طلب الاشتراك بنجاح');
      setSuccess(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">تم استلام طلبك</h1>
          <p className="text-gray-600">
            شكرًا لانضمامك إلينا! سيقوم أحد مدراء الحسابات بالتواصل معك قريبًا لإكمال تفعيل الاشتراك.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition"
          >
            العودة إلى الصفحة الرئيسية
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4 sm:p-6">
      <Card className="max-w-3xl w-full space-y-6">
        <header className="space-y-2 text-center">
          <p className="text-sm text-primary-600 font-semibold">رمز الإحالة</p>
          <p className="text-3xl font-bold text-gray-900">{referralCode}</p>
          <p className="text-gray-600 mt-4">
            املأ النموذج أدناه للانضمام إلى <span className="font-semibold">Academiq Meet</span>. سنستخدم بياناتك للتواصل عبر الواتساب وترشيح أفضل باقة لك.
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-gray-700">
              الاسم الكامل
              <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Users className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="flex-1 bg-transparent focus:outline-none"
                  placeholder="أدخل اسمك"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            </label>

            <label className="text-sm font-semibold text-gray-700">
              البريد الإلكتروني
              <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Mail className="w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  className="flex-1 bg-transparent focus:outline-none"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </label>

            <label className="text-sm font-semibold text-gray-700">
              رقم الواتساب
              <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Phone className="w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  className="flex-1 bg-transparent focus:outline-none"
                  placeholder="+20 123 456 789"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </div>
            </label>

            <label className="text-sm font-semibold text-gray-700">
              اسم الشركة / المؤسسة
              <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Building2 className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="flex-1 bg-transparent focus:outline-none"
                  placeholder="اسم المؤسسة"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </div>
            </label>
          </div>

          <label className="text-sm font-semibold text-gray-700">
            عدد الغرف المطلوبة
            <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <ClipboardList className="w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="1"
                className="flex-1 bg-transparent focus:outline-none"
                placeholder="مثال: 5 غرف"
                value={form.roomCount}
                onChange={(e) => setForm({ ...form, roomCount: e.target.value })}
              />
            </div>
          </label>

          <label className="text-sm font-semibold text-gray-700">
            ملاحظات إضافية
            <div className="mt-1.5 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <MessageCircle className="w-4 h-4 text-gray-400 mt-1" />
              <textarea
                className="flex-1 bg-transparent focus:outline-none h-24 resize-none"
                placeholder="اذكر عدد الغرف المطلوبة، عدد المستخدمين، أو أي احتياجات خاصة"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-lg font-semibold hover:bg-primary-700 transition disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              'إرسال طلب الاشتراك'
            )}
          </button>
        </form>
      </Card>
    </div>
  );
}
