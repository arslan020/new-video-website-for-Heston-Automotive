'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FaHome, FaVideo, FaCar, FaCog, FaUsersCog, FaHistory, FaEye, FaShippingFast, FaHourglassHalf } from 'react-icons/fa';

interface SidebarProps {
  role: 'admin' | 'staff';
  canViewCustomerViews?: boolean;
}

type MenuItem = {
  icon: typeof FaHome;
  label: string;
  path: string;
};

const adminMenu: MenuItem[] = [
  { icon: FaHome, label: 'Dashboard', path: '/admin' },
  { icon: FaCar, label: 'Browse Vehicles', path: '/admin/stock' },
  { icon: FaShippingFast, label: 'Changan Tracker', path: '/admin/changan' },
  { icon: FaHourglassHalf, label: 'Days to Sell', path: '/admin/days-to-sell' },
  { icon: FaVideo, label: 'Uploaded Videos', path: '/staff/videos' },
  { icon: FaUsersCog, label: 'Manage Staff', path: '/admin/staff' },
  { icon: FaHistory, label: 'Activity Logs', path: '/admin/activity-logs' },
  { icon: FaEye, label: 'Customer Views', path: '/admin/views' },
  { icon: FaCog, label: 'Settings', path: '/admin/settings' },
];

const staffMenu: MenuItem[] = [
  { icon: FaHome, label: 'Dashboard', path: '/staff' },
  { icon: FaCar, label: 'Browse Vehicles', path: '/staff/stock' },
  { icon: FaShippingFast, label: 'Changan Tracker', path: '/staff/changan' },
  { icon: FaHourglassHalf, label: 'Days to Sell', path: '/staff/days-to-sell' },
  { icon: FaVideo, label: 'My Videos', path: '/staff/videos' },
  { icon: FaEye, label: 'Customer Views', path: '/staff/views' },
  { icon: FaCog, label: 'Settings', path: '/staff/settings' },
];

const staffGroups = [
  { label: '', paths: ['/staff'] },
  { label: 'Videos', paths: ['/staff/stock', '/staff/videos', '/staff/views'] },
  { label: 'Changan', paths: ['/staff/changan', '/staff/days-to-sell'] },
  { label: 'Account', paths: ['/staff/settings'] },
];

const adminGroups = [
  { label: '', paths: ['/admin'] },
  { label: 'Videos', paths: ['/admin/stock', '/staff/videos', '/admin/views'] },
  { label: 'Changan', paths: ['/admin/changan', '/admin/days-to-sell'] },
  { label: 'Admin', paths: ['/admin/staff', '/admin/activity-logs'] },
  { label: 'Account', paths: ['/admin/settings'] },
];

export default function Sidebar({ role, canViewCustomerViews = true }: SidebarProps) {
  const pathname = usePathname();
  const menu = (role === 'admin' ? adminMenu : staffMenu).filter(
    (item) => canViewCustomerViews || item.path !== '/staff/views'
  );
  const groups = role === 'admin' ? adminGroups : staffGroups;
  const byPath = new Map(menu.map((item) => [item.path, item]));

  return (
    <div className="flex h-full w-full flex-col overflow-x-hidden border-r border-[#E2E8F0] bg-white text-[#475569]">
      <Link href={role === 'admin' ? '/admin' : '/staff'} className="block shrink-0 border-b border-[#E2E8F0] px-4 py-4" aria-label="Go to dashboard">
        <Image
          src="/business-logo.webp"
          alt="Changan Heston Automotive"
          width={384}
          height={32}
          priority
          className="h-auto w-full max-w-full object-contain object-left"
        />
      </Link>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group) => {
          const items = group.paths.map((path) => byPath.get(path)).filter((item): item is MenuItem => Boolean(item));
          if (items.length === 0) return null;
          return (
            <div key={group.label || 'home'}>
              {group.label ? (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{group.label}</p>
              ) : null}
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                        isActive ? 'bg-[#EAF0F7] text-[#0B3D73]' : 'text-[#475569] hover:bg-[#F5F6F8] hover:text-[#0F172A]'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[#E2E8F0] px-4 py-4">
        <p className="text-[15px] font-bold leading-tight text-[#0F172A]">Heston Automotive</p>
        <p className="mt-0.5 text-xs leading-tight text-[#64748B]">{role === 'admin' ? 'Changan Heathrow · Admin' : 'Changan Heathrow · Staff'}</p>
      </div>
    </div>
  );
}
