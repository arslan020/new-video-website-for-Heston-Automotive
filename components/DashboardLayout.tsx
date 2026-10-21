'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import { FaSignOutAlt, FaChevronDown, FaBars, FaBell } from 'react-icons/fa';
import HeaderSearch from './HeaderSearch';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) return null;

  const name = user.name || user.username;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="relative flex min-h-screen bg-[#F5F6F8] font-sans">
      {/* Sidebar (Fixed) */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar role={user.role} canViewCustomerViews={user.canViewCustomerViews !== false} />
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-hidden min-h-screen transition-all duration-300 md:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F5F6F8] md:hidden"
            >
              <FaBars size={18} />
            </button>
            <HeaderSearch />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569]"
            >
              <FaBell size={15} />
            </button>
            <div
              className="relative"
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex h-10 items-center gap-2 rounded-lg pl-2 pr-1.5 hover:bg-[#F5F6F8] focus:outline-none"
            >
              <span className="hidden text-sm font-semibold text-[#0F172A] sm:block">{name}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF0F7] text-xs font-semibold text-[#0B3D73]">
                {initials}
              </span>
              <FaChevronDown
                size={10}
                className={`text-[#64748B] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full pt-1 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-100 animate-fadeIn z-50">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <FaSignOutAlt />
                  Logout
                </button>
              </div>
            )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
