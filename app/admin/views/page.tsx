'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomerViewsContent from '@/components/CustomerViewsContent';

export default function AdminViewsPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <CustomerViewsContent isAdmin={true} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
