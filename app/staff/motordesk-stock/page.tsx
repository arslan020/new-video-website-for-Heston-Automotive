'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import MotorDeskStockContent from '@/components/MotorDeskStockContent';

export default function StaffMotorDeskStockPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <MotorDeskStockContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
