'use client';

import { useState, useEffect, useCallback } from 'react';
import { Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomerViewsContent from '@/components/CustomerViewsContent';

export default function AdminViewsPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <Suspense fallback={null}>
          <CustomerViewsContent isAdmin={true} />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
