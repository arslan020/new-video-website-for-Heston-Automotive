'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomSmsContent from '@/components/CustomSmsContent';

export default function AdminSmsPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <CustomSmsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
