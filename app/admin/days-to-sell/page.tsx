'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import DaysToSellContent from '@/components/DaysToSellContent';

export default function AdminDaysToSellPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <DaysToSellContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
