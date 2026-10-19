'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import DaysToSellContent from '@/components/DaysToSellContent';

export default function StaffDaysToSellPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <DaysToSellContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
