'use client';

import { ReactNode, useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon, X, Menu, LogOut, User, ChevronRight, ChevronLeft } from 'lucide-react';
import { logout } from '@/lib/auth/client-auth';
import { useRouter } from 'next/navigation';
import { SidebarContext, useSidebar } from './SidebarContext';

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface SidebarProps {
  userEmail: string;
  menuItems: MenuItem[];
  title: string;
  onLogout?: () => void;
  logo?: ReactNode;
}

export default function Sidebar({
  userEmail,
  menuItems,
  title,
  onLogout,
  logo,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false); // Mobile menu state
  const [localCollapsed, setLocalCollapsed] = useState(false); // Local state for backward compatibility
  const pathname = usePathname();
  const router = useRouter();
  
  // Try to use context, fallback to local state
  const contextValue = useContext(SidebarContext);
  const isCollapsed = contextValue?.isCollapsed ?? localCollapsed;
  const setIsCollapsed = contextValue?.setIsCollapsed ?? setLocalCollapsed;

  useEffect(() => {
    // Close sidebar on mobile when route changes
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  }, [pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(false); // Close mobile menu on desktop
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      router.push('/');
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 lg:hidden p-2.5 bg-white rounded-xl shadow-medium border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed right-0 top-0 h-full bg-white border-l border-gray-200 z-50
          transform transition-all duration-300 ease-in-out
          flex flex-col shadow-large
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'w-20 lg:w-20' : 'w-72 lg:w-72'}
        `}
      >
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-gray-200 bg-gradient-to-br from-primary-50 to-primary-100">
          {logo || (
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-medium flex-shrink-0 p-1.5">
                <img 
                  src="/academiq-logo.png" 
                  alt="Academic-meet Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <h2 className="text-base lg:text-lg font-bold text-gray-900 truncate">{title}</h2>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{userEmail}</p>
                </div>
              )}
            </div>
          )}
          {/* Collapse button - Desktop only */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors border border-gray-200"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-primary text-white shadow-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                {!isCollapsed && (
                  <>
                    <span className="font-medium flex-1 text-sm lg:text-base">{item.label}</span>
                    {item.badge && (
                      <span className={`
                        px-2 py-0.5 text-xs font-semibold rounded-full
                        ${isActive ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'}
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 lg:p-4 border-t border-gray-200 bg-gray-50">
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-white">
              <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userEmail}</p>
                <p className="text-xs text-gray-500">مستخدم نشط</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center mb-2">
              <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 w-full px-3 lg:px-4 py-2.5 lg:py-3 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? 'تسجيل الخروج' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm lg:text-base">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
