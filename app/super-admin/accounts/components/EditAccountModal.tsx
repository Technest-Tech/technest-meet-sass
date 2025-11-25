'use client';

import { useEffect, useState } from 'react';
import Modal from '@/lib/components/Modal';
import FormInput from '@/lib/components/FormInput';
import Button from '@/lib/components/Button';
import toast from 'react-hot-toast';
import { AccountStatus } from '@prisma/client';

interface EditAccountModalProps {
  accountId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const statusOptions = [
  { value: AccountStatus.ACTIVE, label: 'نشط' },
  { value: AccountStatus.SUSPENDED, label: 'معلق' },
  { value: AccountStatus.INACTIVE, label: 'غير نشط' },
];

type FormState = {
  email: string;
  clientName: string;
  status: AccountStatus;
  maxRooms: number;
  maxParticipants: number;
  enableObserverLinks: boolean;
};

const initialState: FormState = {
  email: '',
  clientName: '',
  status: AccountStatus.ACTIVE,
  maxRooms: 10,
  maxParticipants: 50,
  enableObserverLinks: true,
};

export default function EditAccountModal({ accountId, isOpen, onClose, onUpdated }: EditAccountModalProps) {
  const [formState, setFormState] = useState<FormState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!accountId || !isOpen) {
      setFormState(initialState);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/super-admin/accounts/${accountId}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('فشل تحميل بيانات الحساب');
        const data = await response.json();
        const profile = data.profile;
        if (!profile) return;

        setFormState({
          email: profile.account.email,
          clientName: profile.client.name,
          status: profile.account.status,
          maxRooms: profile.client.maxRooms,
          maxParticipants: profile.client.maxParticipants,
          enableObserverLinks: profile.client.enableObserverLinks ?? true,
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error(error);
          toast.error(error.message || 'تعذر تحميل بيانات الحساب');
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [accountId, isOpen]);

  const handleChange = (field: keyof FormState, value: string | number | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'فشل تحديث الحساب');
      }

      toast.success('تم تحديث بيانات الحساب');
      onUpdated();
      onClose();
    } catch (error: any) {
      console.error('Update account', error);
      toast.error(error.message || 'تعذر تحديث الحساب');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title="تعديل بيانات الحساب"
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) onClose();
      }}
    >
      {isLoading ? (
        <div className="py-8 text-center text-gray-500">جاري تحميل البيانات...</div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormInput
            label="البريد الإلكتروني"
            type="email"
            value={formState.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
          <FormInput
            label="اسم العميل"
            value={formState.clientName}
            onChange={(e) => handleChange('clientName', e.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
              <select
                value={formState.status}
                onChange={(e) => handleChange('status', e.target.value as AccountStatus)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <FormInput
              label="الحد الأقصى للغرف"
              type="number"
              min={1}
              value={formState.maxRooms}
              onChange={(e) => handleChange('maxRooms', Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              label="الحد الأقصى للمشاركين"
              type="number"
              min={1}
              value={formState.maxParticipants}
              onChange={(e) => handleChange('maxParticipants', Number(e.target.value))}
            />
            <div className="flex items-center gap-3 pt-6">
              <input
                id="enableObserverLinks"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={formState.enableObserverLinks}
                onChange={(e) => handleChange('enableObserverLinks', e.target.checked)}
              />
              <label htmlFor="enableObserverLinks" className="text-sm text-gray-700">
                تفعيل روابط المراقب
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              حفظ التغييرات
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

