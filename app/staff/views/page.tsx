'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomerViewsContent from '@/components/CustomerViewsContent';
import { useAuth } from '@/context/AuthContext';
import { FaBan } from 'react-icons/fa';

export default function StaffViewsPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <StaffViewsGate />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function StaffViewsGate() {
  const { user } = useAuth();

  if (user?.canViewCustomerViews === false) {
    return (
      <div className="w-full px-6 py-20 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <FaBan className="text-red-400" size={24} />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Access restricted</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          You don&apos;t have permission to view Customer Views. Ask an admin to enable it for your account.
        </p>
      </div>
    );
  }

  return <CustomerViewsContent isAdmin={false} />;
}
