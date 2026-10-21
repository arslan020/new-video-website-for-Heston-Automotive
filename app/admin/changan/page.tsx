'use client';

import { Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChanganTrackerContent from '@/components/ChanganTrackerContent';

export default function AdminChanganPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <Suspense fallback={null}>
          <ChanganTrackerContent />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
