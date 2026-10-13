'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChanganTrackerContent from '@/components/ChanganTrackerContent';

export default function AdminChanganPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <ChanganTrackerContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
