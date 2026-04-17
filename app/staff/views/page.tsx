'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomerViewsContent from '@/components/CustomerViewsContent';

export default function StaffViewsPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <CustomerViewsContent isAdmin={false} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
