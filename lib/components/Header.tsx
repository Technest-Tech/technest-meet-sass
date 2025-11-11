'use client';

import { ReactNode } from 'react';
import { Bell, Search, Settings, User, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showSearch?: boolean;
  showNotifications?: boolean;
  userEmail?: string;
  onSearch?: (query: string) => void;
}

export default function Header({
  title,
  subtitle,
  actions,
  showSearch = false,
  showNotifications = true,
  userEmail,
  onSearch,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-soft">
      <div className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Title and Breadcrumbs */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">{subtitle}</p>
            )}
          </div>

          {/* Center: Search */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
            {actions}
            
            {showNotifications && (
              <button className="relative p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full" />
              </button>
            )}

            <button className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {userEmail && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <span className="hidden lg:block text-sm font-medium truncate max-w-[120px]">{userEmail}</span>
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden lg:block" />
                </button>

                {showUserMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-large border border-gray-200 py-2 animate-scale-in">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                      <p className="text-xs text-gray-500">مستخدم نشط</p>
                    </div>
                    <button className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      الإعدادات
                    </button>
                    <button className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      المساعدة
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

