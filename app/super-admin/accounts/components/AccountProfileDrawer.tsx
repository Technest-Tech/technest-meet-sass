'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import Button from '@/lib/components/Button';
import FormInput from '@/lib/components/FormInput';
import { formatBytes, formatDate } from '../utils';
import toast from 'react-hot-toast';

interface AccountProfileDrawerProps {
  accountId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onRefresh: () => void;
}

type OverviewResponse = {
  profile: {
    account: { id: string; email: string; status: string; role: string; createdAt: string };
    client: {
      id: string;
      name: string;
      email: string;
      maxRooms: number;
      maxParticipants: number;
      enableObserverLinks: boolean;
      createdAt: string;
    };
    subscription: {
      id: string;
      status: string;
      plan?: {
        id: string;
        name: string;
      };
      startDate?: string;
      endDate?: string;
    } | null;
    totals: {
      rooms: number;
      activeRooms: number;
      files: number;
      storageBytes: number;
    };
    rooms: Array<{
      id: string;
      name: string;
      isActive: boolean;
      createdAt: string;
      fileCount: number;
      storageBytes: number;
    }>;
    storageSnapshot: {
      totalBytes: number;
      capturedAt: string;
    } | null;
    invoices: Array<{
      id: string;
      status: string;
      amountCents: number;
      issuedAt: string;
    }>;
    notes: Array<{
      id: string;
      content: string;
      tags: string[];
      isPinned: boolean;
      createdAt: string;
    }>;
  };
  activity: Array<{
    id: string;
    event: string;
    description?: string;
    occurredAt: string;
  }>;
  storageByType: Array<{
    fileType: string;
    fileCount: number;
    storageBytes: number;
  }>;
};

type RoomsResponse = {
  rooms: Array<{
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    stats: {
      fileCount: number;
      storageBytes: number;
      participantSlots: number;
    };
    recentFiles: Array<{
      id: string;
      filename: string;
      fileType: string;
      size: number;
      uploadedBy: string;
      uploadedAt: string;
    }>;
    recentActivity: Array<{
      id: string;
      event: string;
      description?: string;
      occurredAt: string;
    }>;
  }>;
  total: number;
};

type BillingResponse = {
  snapshot: {
    subscription: OverviewResponse['profile']['subscription'];
    latestInvoice: {
      id: string;
      status: string;
      amountCents: number;
      issuedAt: string;
      dueAt?: string;
    } | null;
    overdueInvoices: BillingInvoice[];
    paidInvoices: BillingInvoice[];
  };
  aggregates: {
    lifetimePaidCents: number;
    upcomingRenewal: string | null;
    overdueCount: number;
  };
};

type BillingInvoice = {
  id: string;
  status: string;
  amountCents: number;
  issuedAt: string;
  periodStart?: string;
  periodEnd?: string;
};

type NotesResponse = {
  notes: Array<{
    id: string;
    content: string;
    tags: string[];
    isPinned: boolean;
    createdAt: string;
    author?: { id: string; email: string };
  }>;
};

const tabs = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'rooms', label: 'الغرف والنشاط' },
  { id: 'storage', label: 'التخزين والملفات' },
  { id: 'billing', label: 'الفوترة والاشتراك' },
  { id: 'notes', label: 'الملاحظات' },
] as const;

export default function AccountProfileDrawer({
  accountId,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
}: AccountProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('overview');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [rooms, setRooms] = useState<RoomsResponse | null>(null);
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [notes, setNotes] = useState<NotesResponse['notes']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

useEffect(() => {
  if (!accountId || !isOpen) return;
  setActiveTab('overview');
  setRooms(null);
  setBilling(null);
  setNotes([]);
  loadOverview(accountId);
}, [accountId, isOpen]);

useEffect(() => {
  if (!accountId || !isOpen) return;
  if (activeTab === 'rooms' && !rooms) {
    loadRooms(accountId);
  } else if (activeTab === 'billing' && !billing) {
    loadBilling(accountId);
  } else if (activeTab === 'notes' && !notes.length) {
    loadNotes(accountId);
  }
}, [activeTab, accountId, isOpen, rooms, billing, notes.length]);

  const loadOverview = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('فشل تحميل النظرة العامة');
      const data = (await response.json()) as OverviewResponse;
      setOverview(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'تعذر تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRooms = async (id: string) => {
    setIsRoomsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${id}/rooms?page=1&pageSize=50`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('فشل تحميل الغرف');
      const data = (await response.json()) as RoomsResponse;
      setRooms(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'تعذر تحميل الغرف');
    } finally {
      setIsRoomsLoading(false);
    }
  };

  const loadBilling = async (id: string) => {
    setIsBillingLoading(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${id}/billing`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('فشل تحميل بيانات الفوترة');
      const data = (await response.json()) as BillingResponse;
      setBilling(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'تعذر تحميل بيانات الفوترة');
    } finally {
      setIsBillingLoading(false);
    }
  };

  const loadNotes = async (id: string) => {
    setIsNotesLoading(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${id}/notes`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('فشل تحميل الملاحظات');
      const data = (await response.json()) as NotesResponse;
      setNotes(data.notes);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'تعذر تحميل الملاحظات');
    } finally {
      setIsNotesLoading(false);
    }
  };

  const handleNoteSubmit = async () => {
    if (!newNote.trim() || !accountId) return;
    setIsAddingNote(true);
    try {
      const response = await fetch(`/api/super-admin/accounts/${accountId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newNote }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'فشل إضافة الملاحظة');
      }
      setNewNote('');
      await loadNotes(accountId);
      toast.success('تمت إضافة الملاحظة');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'تعذر إضافة الملاحظة');
    } finally {
      setIsAddingNote(false);
    }
  };

  const overviewMetrics = useMemo(() => {
    if (!overview) return [];
    return [
      {
        label: 'الغرف النشطة',
        value: `${overview.profile.totals.activeRooms}/${overview.profile.totals.rooms}`,
      },
      {
        label: 'إجمالي الملفات',
        value: overview.profile.totals.files.toLocaleString('ar-EG'),
      },
      {
        label: 'إجمالي التخزين',
        value: formatBytes(overview.profile.totals.storageBytes),
      },
    ];
  }, [overview]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[61] h-full w-full max-w-4xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-xs text-gray-500">معرف الحساب</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {overview?.profile.client.name || overview?.profile.account.email || '...'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {accountId && (
              <>
                <Button variant="outline" size="sm" onClick={() => onEdit(accountId)}>
                  تعديل
                </Button>
                <Button variant="danger" size="sm" onClick={() => onDelete(accountId)}>
                  حذف / أرشفة
                </Button>
              </>
            )}
            <button
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              onClick={onClose}
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-100 px-6">
          <nav className="flex flex-wrap gap-2 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              isLoading={isLoading}
              overview={overview}
              metrics={overviewMetrics}
              onRefresh={() => {
                if (accountId) {
                  loadOverview(accountId);
                  onRefresh();
                }
              }}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomsTab isLoading={isRoomsLoading} rooms={rooms} onRefresh={() => accountId && loadRooms(accountId)} />
          )}

          {activeTab === 'storage' && (
            <StorageTab overview={overview} isLoading={isLoading} storageByType={overview?.storageByType || []} />
          )}

          {activeTab === 'billing' && (
            <BillingTab
              isLoading={isBillingLoading}
              billing={billing}
              onLoad={() => accountId && loadBilling(accountId)}
            />
          )}

          {activeTab === 'notes' && (
            <NotesTab
              isLoading={isNotesLoading}
              notes={notes}
              newNote={newNote}
              onNoteChange={setNewNote}
              onSubmit={handleNoteSubmit}
              isSubmitting={isAddingNote}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  isLoading,
  overview,
  metrics,
  onRefresh,
}: {
  isLoading: boolean;
  overview: OverviewResponse | null;
  metrics: { label: string; value: string }[];
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جاري التحميل...
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center text-gray-500 py-24">
        لا توجد بيانات متاحة حالياً
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500">{metric.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">بيانات العميل</p>
          <div className="text-sm text-gray-600 space-y-1">
            <p>الاسم: {overview.profile.client.name}</p>
            <p>البريد: {overview.profile.client.email}</p>
            <p>أنشئ في: {formatDate(overview.profile.client.createdAt)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">الاشتراك</p>
          {overview.profile.subscription ? (
            <div className="text-sm text-gray-600 space-y-1">
              <p>الخطة: {overview.profile.subscription.plan?.name || 'غير محدد'}</p>
              <p>الحالة: {overview.profile.subscription.status}</p>
              <p>تاريخ الانتهاء: {formatDate(overview.profile.subscription.endDate)}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">لا يوجد اشتراك نشط</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">أحدث الفواتير</p>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            تحديث
          </Button>
        </div>
        <div className="divide-y divide-gray-100">
          {overview.profile.invoices.slice(0, 5).map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{formatDate(invoice.issuedAt)}</p>
                <p className="text-gray-500">{invoice.status}</p>
              </div>
              <p className="font-semibold text-gray-900">{(invoice.amountCents / 100).toFixed(2)} EGP</p>
            </div>
          ))}
          {overview.profile.invoices.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">لا توجد فواتير مسجلة</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomsTab({
  isLoading,
  rooms,
  onRefresh,
}: {
  isLoading: boolean;
  rooms: RoomsResponse | null;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جاري تحميل الغرف...
      </div>
    );
  }

  if (!rooms || rooms.rooms.length === 0) {
    return (
      <div className="text-center text-gray-500 py-16">
        لا توجد غرف لعرضها
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            تحديث
          </Button>
        </div>
      </div>
    );
  }

  const roomList = rooms.rooms;
  const activeRooms = roomList.filter((room) => room.isActive);
  const inactiveRooms = roomList.filter((room) => !room.isActive);
  const totalRooms = roomList.length;
  const activePercentage = totalRooms ? Math.round((activeRooms.length / totalRooms) * 100) : 0;

  const renderRoomCard = (room: RoomsResponse['rooms'][number], keyPrefix = 'room') => (
    <div key={`${keyPrefix}-${room.id}`} className="rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-gray-900">{room.name}</p>
          <p className="text-xs text-gray-500">أُنشئ في {formatDate(room.createdAt)}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            room.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {room.isActive ? 'نشط' : 'معطل'}
        </span>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <span>الملفات: {room.stats.fileCount.toLocaleString('ar-EG')}</span>
        <span>التخزين: {formatBytes(room.stats.storageBytes)}</span>
        <span>فتحات المشاركين: {room.stats.participantSlots}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">أحدث الملفات</p>
          {room.recentFiles.length ? (
            <div className="space-y-2">
              {room.recentFiles.map((file) => (
                <div key={file.id} className="text-sm text-gray-700 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{file.filename}</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(file.size)} • {file.fileType}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(file.uploadedAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">لا توجد ملفات</p>
          )}
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">آخر النشاطات</p>
          {room.recentActivity.length ? (
            <div className="space-y-2">
              {room.recentActivity.map((activity) => (
                <div key={activity.id} className="text-sm text-gray-700">
                  <p className="font-medium">{activity.event}</p>
                  <p className="text-xs text-gray-500">
                    {activity.description || '—'} • {formatDate(activity.occurredAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">لا يوجد نشاط حديث</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 p-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-gray-100" />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(#22c55e ${totalRooms ? (activeRooms.length / totalRooms) * 360 : 0}deg, #e5e7eb 0)`,
              }}
            />
            <div className="absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{activeRooms.length}</span>
              <span className="text-xs text-gray-500">نشط</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">نسبة الغرف النشطة</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{activePercentage}%</p>
            <p className="text-sm text-gray-500">من أصل {totalRooms} غرفة</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <div className="rounded-xl bg-green-50 px-4 py-3">
            <p className="text-xs font-semibold text-green-700">النشطة حالياً</p>
            <p className="text-lg font-bold text-green-800">{activeRooms.length}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-600">غير النشطة</p>
            <p className="text-lg font-bold text-gray-800">{inactiveRooms.length}</p>
          </div>
        </div>
      </div>

      {activeRooms.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">الغرف النشطة الآن</p>
            <span className="text-xs text-gray-500">{activeRooms.length} غرفة</span>
          </div>
          {activeRooms.map((room) => renderRoomCard(room, 'active'))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">جميع الغرف</p>
          <span className="text-xs text-gray-500">{totalRooms} غرفة</span>
        </div>
        {roomList.map((room) => renderRoomCard(room, 'all'))}
      </div>

      <div className="text-center">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          تحديث القائمة
        </Button>
      </div>
    </div>
  );
}

function StorageTab({
  overview,
  storageByType,
  isLoading,
}: {
  overview: OverviewResponse | null;
  storageByType: OverviewResponse['storageByType'];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جاري التحميل...
      </div>
    );
  }

  if (!overview) {
    return <div className="text-center text-gray-500 py-16">لا توجد بيانات تخزين متاحة</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500">آخر لقطة تخزين</p>
          <p className="text-xl font-bold text-gray-900">{formatBytes(overview.profile.storageSnapshot?.totalBytes)}</p>
        </div>
        <p className="text-sm text-gray-500">
          تم الالتقاط في {formatDate(overview.profile.storageSnapshot?.capturedAt)}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">توزيع الملفات</p>
        </div>
        <div className="divide-y divide-gray-100">
          {storageByType.length ? (
            storageByType.map((item) => (
              <div key={item.fileType} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{item.fileType}</p>
                  <p className="text-xs text-gray-500">{item.fileCount} ملف</p>
                </div>
                <p className="font-semibold text-gray-900">{formatBytes(item.storageBytes)}</p>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">لا توجد ملفات مسجلة</div>
          )}
        </div>
      </div>
    </div>
  );
}

function BillingTab({
  isLoading,
  billing,
  onLoad,
}: {
  isLoading: boolean;
  billing: BillingResponse | null;
  onLoad: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جاري تحميل بيانات الفوترة...
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="text-center text-gray-500 py-16">
        لا توجد بيانات فوترة بعد
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={onLoad}>
            تحديث
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 p-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-gray-500">إجمالي المدفوع</p>
          <p className="text-xl font-bold text-gray-900">
            {(billing.aggregates.lifetimePaidCents / 100).toFixed(2)} EGP
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">تجديد قادم</p>
          <p className="text-xl font-bold text-gray-900">{formatDate(billing.aggregates.upcomingRenewal || undefined)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">فواتير متأخرة</p>
          <p className="text-xl font-bold text-gray-900">{billing.aggregates.overdueCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">الفواتير المتأخرة</p>
        </div>
        <div className="divide-y divide-gray-100">
          {billing.snapshot.overdueInvoices.length ? (
            billing.snapshot.overdueInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{formatDate(invoice.issuedAt)}</p>
                  <p className="text-xs text-gray-500">{invoice.status}</p>
                </div>
                <p className="font-semibold text-red-600">{(invoice.amountCents / 100).toFixed(2)} EGP</p>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">لا توجد فواتير متأخرة</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">الفواتير المدفوعة</p>
        </div>
        <div className="divide-y divide-gray-100">
          {billing.snapshot.paidInvoices.slice(0, 5).map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{formatDate(invoice.issuedAt)}</p>
                <p className="text-xs text-gray-500">{invoice.status}</p>
              </div>
              <p className="font-semibold text-green-600">{(invoice.amountCents / 100).toFixed(2)} EGP</p>
            </div>
          ))}
          {billing.snapshot.paidInvoices.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">لا توجد فواتير مدفوعة</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotesTab({
  isLoading,
  notes,
  newNote,
  onNoteChange,
  onSubmit,
  isSubmitting,
}: {
  isLoading: boolean;
  notes: NotesResponse['notes'];
  newNote: string;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
        <FormInput
          label="إضافة ملاحظة"
          value={newNote}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="اكتب ملاحظة داخلية..."
        />
        <Button variant="primary" size="sm" onClick={onSubmit} isLoading={isSubmitting} disabled={!newNote.trim()}>
          حفظ الملاحظة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin ml-2" />
          جاري تحميل الملاحظات...
        </div>
      ) : notes.length ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-gray-100 p-4 space-y-2 bg-gray-50">
              <p className="text-sm text-gray-800">{note.content}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatDate(note.createdAt)}</span>
                {note.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {note.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-white border border-gray-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-16">لا توجد ملاحظات حتى الآن</div>
      )}
    </div>
  );
}

