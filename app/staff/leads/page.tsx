'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LeadsContent from '@/components/LeadsContent';

export default function StaffLeadsPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <LeadsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
