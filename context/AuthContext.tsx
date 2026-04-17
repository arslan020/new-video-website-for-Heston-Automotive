'use client';

import { createContext, useState, useEffect, useContext } from 'react';

interface UserData {
  _id: string;
  username: string;
  name?: string;
  email: string;
  phoneNumber: string;
  role: 'admin' | 'staff';
  isTwoFactorEnabled: boolean;
  token: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ requireTwoFactor?: boolean; userId?: string } & Partial<UserData>>;
  verify2FA: (userId: string, code: string) => Promise<UserData>;
  logout: () => void;
  updateUser: (data: UserData) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('userInfo');
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    if (data.token) {
      localStorage.setItem('userInfo', JSON.stringify(data));
      document.cookie = `token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      document.cookie = `role=${data.role}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      setUser(data);
    }
    return data;
  };

  const verify2FA = async (userId: string, code: string) => {
    const res = await fetch('/api/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Verification failed');
    localStorage.setItem('userInfo', JSON.stringify(data));
    document.cookie = `token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    document.cookie = `role=${data.role}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('userInfo');
    document.cookie = 'token=; path=/; max-age=0';
    document.cookie = 'role=; path=/; max-age=0';
    setUser(null);
  };

  const updateUser = (userData: UserData) => {
    localStorage.setItem('userInfo', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2FA, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
