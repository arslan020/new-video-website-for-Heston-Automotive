'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LeadsContent from '@/components/LeadsContent';

export default function AdminLeadsPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <LeadsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
