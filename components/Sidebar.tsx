'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaHome, FaVideo, FaCar, FaCog, FaUsersCog, FaHistory, FaEye } from 'react-icons/fa';

interface SidebarProps {
  role: 'admin' | 'staff';
}

const adminMenu = [
  { icon: FaHome, label: 'Dashboard', path: '/admin' },
  { icon: FaCar, label: 'Browse Vehicles', path: '/admin/stock' },
  { icon: FaVideo, label: 'Uploaded Videos', path: '/staff/videos' },
  { icon: FaUsersCog, label: 'Manage Staff', path: '/admin/staff' },
  { icon: FaHistory, label: 'Activity Logs', path: '/admin/activity-logs' },
  { icon: FaEye, label: 'Customer Views', path: '/admin/views' },
  { icon: FaCog, label: 'Settings', path: '/admin/settings' },
];

const staffMenu = [
  { icon: FaHome, label: 'Dashboard', path: '/staff' },
  { icon: FaCar, label: 'Browse Vehicles', path: '/staff/stock' },
  { icon: FaVideo, label: 'My Videos', path: '/staff/videos' },
  { icon: FaEye, label: 'Customer Views', path: '/staff/views' },
  { icon: FaCog, label: 'Settings', path: '/staff/settings' },
];

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const menu = role === 'admin' ? adminMenu : staffMenu;

  return (
    <div className="w-64 bg-white border-r border-gray-200 text-gray-600 flex flex-col min-h-screen transition-all duration-300">
      {/* Sidebar Header */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-100">
        <div className="bg-blue-600 rounded p-1">
          <FaHome className="text-white" size={14} />
        </div>
        <h1 className="text-lg font-bold text-gray-800 tracking-tight">
          {role === 'admin' ? 'Admin Panel' : 'Staff Panel'}
        </h1>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 mt-2">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon
                size={18}
                className={`${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}
              />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
