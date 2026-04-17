'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FaLock, FaCheckCircle } from 'react-icons/fa';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid or expired token.');
      setMessage('Password reset successful! You can now login.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f4f8] px-4 font-sans text-gray-700">
      <div className="mb-6">
        <Image
          src="/business-logo.png"
          alt="Heston Automotive"
          width={200}
          height={64}
          style={{ width: 'auto', height: '64px' }}
          className="object-contain"
        />
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h2>
          <p className="text-gray-500 text-sm">Create a new strong password for your account.</p>
        </div>

        {message ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheckCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Success!</h3>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link
              href="/"
              className="inline-block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md text-center"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <FaLock />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <FaLock />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all duration-200 shadow-md ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {loading ? 'Resetting...' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
