'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import { FaUserCircle, FaSignOutAlt, FaChevronDown, FaBars } from 'react-icons/fa';

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

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans relative">
      {/* Sidebar (Fixed) */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar role={user.role} />
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300 w-full">
        {/* Header */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden text-gray-500 hover:text-primary focus:outline-none"
            >
              <FaBars size={24} />
            </button>
            <Image
              src="/business-logo.png"
              alt="Heston Automotive"
              width={160}
              height={40}
              style={{ width: 'auto', height: '40px' }}
              className="object-contain"
            />
          </div>

          {/* Right side — User dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-lg transition focus:outline-none"
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-700">{user.username}</div>
                <div className="text-xs text-gray-500 capitalize">{user.role}</div>
              </div>
              <FaUserCircle size={32} className="text-gray-400" />
              <FaChevronDown
                size={12}
                className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
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
        </header>

        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
