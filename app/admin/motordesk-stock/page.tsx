'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import MotorDeskStockContent from '@/components/MotorDeskStockContent';

export default function AdminMotorDeskStockPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <MotorDeskStockContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
