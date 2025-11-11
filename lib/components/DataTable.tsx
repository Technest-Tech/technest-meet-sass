'use client';

import { ReactNode, useState } from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';
import FormInput from './FormInput';
import Button from './Button';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pagination?: {
    pageSize: number;
    currentPage: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  emptyMessage?: string;
  actions?: (item: T) => ReactNode;
  isLoading?: boolean;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = 'بحث...',
  pagination,
  emptyMessage = 'لا توجد بيانات',
  actions,
  isLoading = false,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = data.filter((item) => {
    if (!searchTerm) return true;
    return columns.some((col) => {
      const value = item[col.key];
      return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchable && (
        <div className="max-w-md">
          <FormInput
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`
                      px-6 py-4 text-right text-sm font-semibold text-gray-700
                      ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
                      transition-colors
                    `}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && sortConfig?.key === column.key && (
                        <span className="text-primary-600">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {actions && <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-500">جاري التحميل...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center">
                    <p className="text-gray-500">{emptyMessage}</p>
                  </td>
                </tr>
              ) : (
                sortedData.map((item, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 text-sm text-gray-900">
                        {column.render ? column.render(item) : item[column.key]}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-6 py-4" style={{ position: 'relative' }}>
                        <div className="flex items-center gap-2 justify-end" style={{ position: 'relative' }}>
                          {actions(item)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            عرض {((pagination.currentPage - 1) * pagination.pageSize) + 1} إلى{' '}
            {Math.min(pagination.currentPage * pagination.pageSize, pagination.total)} من{' '}
            {pagination.total} نتيجة
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              leftIcon={<ChevronRight className="w-4 h-4" />}
            >
              السابق
            </Button>
            <span className="text-sm text-gray-600">
              صفحة {pagination.currentPage} من {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === totalPages}
              rightIcon={<ChevronLeft className="w-4 h-4" />}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

