'use client';

import { useState } from 'react';
import Modal from '@/lib/components/Modal';
import Button from '@/lib/components/Button';
import FormInput from '@/lib/components/FormInput';
import toast from 'react-hot-toast';
import { formatBytes } from '../utils';

interface DeleteAccountDialogProps {
  account:
    | {
        id: string;
        email: string;
        metrics?: {
          totalRooms: number;
          storageBytes: number;
        } | null;
      }
    | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteAccountDialog({ account, isOpen, onClose, onDeleted }: DeleteAccountDialogProps) {
  const [mode, setMode] = useState<'ARCHIVE' | 'DELETE'>('ARCHIVE');
  const [reason, setReason] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setMode('ARCHIVE');
    setReason('');
    setConfirmInput('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (!account) return;
    if (mode === 'DELETE' && confirmInput !== account.email) {
      toast.error('يرجى كتابة البريد الإلكتروني للتأكيد');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${account.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode,
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'حدث خطأ أثناء معالجة الطلب');
      }

      toast.success(mode === 'DELETE' ? 'تم حذف الحساب نهائياً' : 'تم أرشفة الحساب');
      onDeleted();
      handleClose();
    } catch (error: any) {
      console.error('Delete account error', error);
      toast.error(error.message || 'فشل تنفيذ العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="إدارة الحذف / الأرشفة" isOpen={isOpen} onClose={handleClose}>
      {!account ? (
        <div className="py-6 text-center text-gray-500">اختر حساباً من الجدول أولاً</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ستقوم بالتصرف على الحساب <span className="font-semibold text-gray-900">{account.email}</span>
          </p>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600 space-y-1">
            <p>إجمالي الغرف: {account.metrics?.totalRooms ?? 0}</p>
            <p>الحجم المخزن: {formatBytes(account.metrics?.storageBytes)}</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700">اختيار الإجراء</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-primary-200">
                <input
                  type="radio"
                  name="delete-mode"
                  value="ARCHIVE"
                  checked={mode === 'ARCHIVE'}
                  onChange={() => setMode('ARCHIVE')}
                  className="mt-1 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <div>
                  <p className="font-semibold text-gray-800">أرشفة الحساب</p>
                  <p className="text-sm text-gray-600">
                    سيتم تعطيل الحساب والغرف مع الاحتفاظ بالبيانات للرجوع إليها لاحقاً.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-red-200">
                <input
                  type="radio"
                  name="delete-mode"
                  value="DELETE"
                  checked={mode === 'DELETE'}
                  onChange={() => setMode('DELETE')}
                  className="mt-1 h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <div>
                  <p className="font-semibold text-red-700">حذف نهائي</p>
                  <p className="text-sm text-gray-600">
                    سيتم حذف جميع البيانات المرتبطة بالحساب بشكل لا رجعة فيه. يتطلب تأكيداً كتابياً.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <FormInput
            label="سبب الإجراء"
            placeholder="اختياري - لتوثيق السبب في السجل"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          {mode === 'DELETE' && (
            <FormInput
              label="اكتب البريد الإلكتروني لتأكيد الحذف"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={account.email}
            />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button variant={mode === 'DELETE' ? 'danger' : 'primary'} onClick={handleSubmit} isLoading={isSubmitting}>
              {mode === 'DELETE' ? 'حذف نهائي' : 'أرشفة'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

