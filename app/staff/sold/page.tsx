'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import DaysToSellContent from '@/components/DaysToSellContent';

export default function StaffSoldPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <DaysToSellContent view="sold" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
