'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import DaysToSellContent from '@/components/DaysToSellContent';

export default function AdminSoldPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <DaysToSellContent view="sold" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
