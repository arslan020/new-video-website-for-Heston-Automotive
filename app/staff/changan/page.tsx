'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChanganTrackerContent from '@/components/ChanganTrackerContent';

export default function StaffChanganPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <ChanganTrackerContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
