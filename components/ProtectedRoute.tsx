'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'admin' | 'staff';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/');
        return;
      }
      if (role && user.role !== role) {
        if (user.role === 'admin' && role === 'staff') return;
        router.replace('/');
      }
    }
  }, [user, loading, role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;
  if (role && user.role !== role && !(user.role === 'admin' && role === 'staff')) return null;

  return <>{children}</>;
}
