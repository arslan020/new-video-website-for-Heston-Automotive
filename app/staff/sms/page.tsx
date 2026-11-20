'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomSmsContent from '@/components/CustomSmsContent';

export default function StaffSmsPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <CustomSmsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
