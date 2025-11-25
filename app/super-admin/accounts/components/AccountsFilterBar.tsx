'use client';

import { useMemo } from 'react';
import FormInput from '@/lib/components/FormInput';
import Button from '@/lib/components/Button';
import { Search } from 'lucide-react';

export type AccountFilterState = {
  search: string;
  status: string[];
  planId: string;
  subscriptionStatus: string;
  storageTier: string;
  createdFrom?: string;
  createdTo?: string;
};

interface AccountsFilterBarProps {
  filters: AccountFilterState;
  onChange: (next: AccountFilterState) => void;
  planOptions: { id: string; name: string }[];
  isBusy?: boolean;
}

const statusOptions = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'SUSPENDED', label: 'معلق' },
  { value: 'INACTIVE', label: 'غير نشط' },
];

const subscriptionOptions = [
  { value: 'ALL', label: 'كل الحالات' },
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'INACTIVE', label: 'غير نشط' },
  { value: 'TRIAL', label: 'تجريبي' },
  { value: 'TRIAL_EXPIRED', label: 'انتهى التجريب' },
  { value: 'EXPIRED', label: 'منتهي' },
];

const storageOptions = [
  { value: 'ALL', label: 'جميع الحدود' },
  { value: 'low', label: 'أقل من 500MB' },
  { value: 'medium', label: 'حتى 5GB' },
  { value: 'high', label: 'أكثر من 5GB' },
];

export default function AccountsFilterBar({ filters, onChange, planOptions, isBusy }: AccountsFilterBarProps) {
  const appliedFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status.length) count++;
    if (filters.planId !== 'ALL') count++;
    if (filters.subscriptionStatus !== 'ALL') count++;
    if (filters.storageTier !== 'ALL') count++;
    if (filters.createdFrom || filters.createdTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (status: string) => {
    const exists = filters.status.includes(status);
    const statusSet = exists ? filters.status.filter((item) => item !== status) : [...filters.status, status];
    onChange({ ...filters, status: statusSet });
  };

  const handleInputChange = (field: keyof AccountFilterState, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    onChange({
      search: '',
      status: [],
      planId: 'ALL',
      subscriptionStatus: 'ALL',
      storageTier: 'ALL',
      createdFrom: undefined,
      createdTo: undefined,
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <FormInput
          value={filters.search}
          onChange={(e) => handleInputChange('search', e.target.value)}
          placeholder="ابحث بالبريد أو اسم العميل..."
          leftIcon={<Search className="w-5 h-5 text-gray-400" />}
        />
        <div className="flex flex-wrap items-center gap-3">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleStatus(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                filters.status.includes(option.value)
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">الخطة</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white"
            value={filters.planId}
            onChange={(e) => handleInputChange('planId', e.target.value)}
          >
            <option value="ALL">كل الخطط</option>
            {planOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">حالة الاشتراك</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white"
            value={filters.subscriptionStatus}
            onChange={(e) => handleInputChange('subscriptionStatus', e.target.value)}
          >
            {subscriptionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">سعة التخزين</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white"
            value={filters.storageTier}
            onChange={(e) => handleInputChange('storageTier', e.target.value)}
          >
            {storageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500">تاريخ الإنشاء</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.createdFrom || ''}
              onChange={(e) => handleInputChange('createdFrom', e.target.value || undefined)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <input
              type="date"
              value={filters.createdTo || ''}
              onChange={(e) => handleInputChange('createdTo', e.target.value || undefined)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {appliedFiltersCount > 0
            ? `${appliedFiltersCount} عوامل تصفية مفعّلة`
            : 'لا توجد عوامل تصفية مفعّلة'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={isBusy}>
            إعادة تعيين
          </Button>
        </div>
      </div>
    </div>
  );
}

