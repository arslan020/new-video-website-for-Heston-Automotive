'use client';

import { Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChanganTrackerContent from '@/components/ChanganTrackerContent';

export default function StaffChanganPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <Suspense fallback={null}>
          <ChanganTrackerContent />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
