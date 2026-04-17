'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import {
    FaSignOutAlt, FaUserShield, FaUser, FaEdit, FaLock, FaEnvelope,
    FaPhone, FaShieldAlt, FaTimes, FaCheckCircle, FaWallet, FaExternalLinkAlt
} from 'react-icons/fa';

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute role="admin">
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: '', text: '' });
  };

  const handleCancelEdit = () => {
    setShowProfileForm(false);
    setFormData({
        name: '',
        username: '',
        email: '',
        phoneNumber: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    setMessage({ type: '', text: '' });
  };

  const handleProfileUpdate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
        if (!formData.currentPassword) {
            setMessage({ type: 'error', text: 'Current password is required' });
            setLoading(false);
            return;
        }

        if (!formData.name && !formData.username && !formData.email && !formData.phoneNumber && !formData.newPassword) {
            setMessage({ type: 'error', text: 'Please provide a field to update' });
            setLoading(false);
            return;
        }

        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            setLoading(false);
            return;
        }

        if (formData.newPassword && formData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
            setLoading(false);
            return;
        }

        const updateData: any = { currentPassword: formData.currentPassword };

        if (formData.name && formData.name !== user?.name) updateData.name = formData.name;
        if (formData.username && formData.username !== user?.username) updateData.username = formData.username;
        if (formData.email && formData.email !== user?.email) updateData.email = formData.email;
        if (formData.phoneNumber && formData.phoneNumber !== user?.phoneNumber) updateData.phoneNumber = formData.phoneNumber;
        if (formData.newPassword) updateData.newPassword = formData.newPassword;

        const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify(updateData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update profile');

        updateUser(data);
        setMessage({ type: 'success', text: data.message || 'Profile updated successfully!' });

        setFormData({
            name: '',
            username: '',
            email: '',
            phoneNumber: '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });

        setTimeout(() => {
            setShowProfileForm(false);
            setMessage({ type: '', text: '' });
        }, 2000);

    } catch (error: any) {
        console.error('Profile update error:', error);
        setMessage({
            type: 'error',
            text: error.message || 'Failed to update profile'
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full px-6 pb-12">
        {/* Header Section */}
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        </div>

        {/* Message Toast */}
        {message.text && (
            <div className={`mb-6 w-full p-4 rounded-lg flex items-center gap-3 shadow-sm ${message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                <FaCheckCircle className={message.type === 'success' ? 'text-green-600' : 'text-red-600'} />
                <span className="font-medium">{message.text}</span>
                <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto opacity-70 hover:opacity-100">
                    <FaTimes />
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
            {/* Left Sidebar (Settings Navigation / Actions) */}
            <div className="space-y-6">
                {/* Status Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Account Status</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                    <FaUserShield size={14} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">Role</p>
                                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                                </div>
                            </div>
                            <div className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Active</div>
                        </div>
                    </div>
                </div>

                {/* Bird SMS Balance Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">SMS Balance</h3>
                    <a
                        href="https://app.bird.com/settings/billing/overview/wallets"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition group"
                    >
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <FaWallet size={15} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 font-medium">Main Wallet</p>
                            <p className="text-sm font-semibold text-blue-600">View Balance on Bird.com</p>
                        </div>
                        <FaExternalLinkAlt size={12} className="text-blue-400 group-hover:text-blue-600 transition" />
                    </a>
                </div>

                <button
                    onClick={handleLogout}
                    className="hidden lg:flex w-full items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-5 py-3 rounded-xl font-medium transition duration-200"
                >
                    <FaSignOutAlt />
                    Sign Out
                </button>
            </div>

            {/* Main Content (Profile Form) */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Administrator Profile</h2>
                            <p className="text-sm text-gray-500 mt-1">Update your admin credentials.</p>
                        </div>
                        {!showProfileForm && (
                            <button
                                onClick={() => setShowProfileForm(true)}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition flex items-center gap-2"
                            >
                                <FaEdit /> Edit
                            </button>
                        )}
                    </div>

                    <div className="p-6">
                        {showProfileForm ? (
                            <form onSubmit={handleProfileUpdate} className="space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FaUser className="text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                placeholder={user?.name || 'Your full name'}
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FaUserShield className="text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                placeholder={user?.username}
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FaEnvelope className="text-gray-400" />
                                            </div>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder={user?.email}
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FaPhone className="text-gray-400" />
                                            </div>
                                            <input
                                                type="tel"
                                                name="phoneNumber"
                                                value={formData.phoneNumber}
                                                onChange={handleInputChange}
                                                placeholder={user?.phoneNumber || 'e.g. 07700900000'}
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-6">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                            <FaLock className="text-gray-400" /> Security
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password <span className="text-red-500">*</span></label>
                                                <input
                                                    type="password"
                                                    name="currentPassword"
                                                    value={formData.currentPassword}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                                />
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password (Optional)</label>
                                                    <input
                                                        type="password"
                                                        name="newPassword"
                                                        value={formData.newPassword}
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                                    />
                                                </div>

                                                {formData.newPassword && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                                                        <input
                                                            type="password"
                                                            name="confirmPassword"
                                                            value={formData.confirmPassword}
                                                            onChange={handleInputChange}
                                                            required
                                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition shadow-lg shadow-purple-200 disabled:opacity-50"
                                    >
                                        {loading ? 'Saving Changes...' : 'Save Changes'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                                <div className="group">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Username</label>
                                    <div className="flex items-center gap-3 text-gray-800">
                                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                            <FaUserShield size={14} />
                                        </div>
                                        <span className="font-medium text-lg">{user?.username}</span>
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                                    <div className="flex items-center gap-3 text-gray-800">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                            <FaEnvelope size={14} />
                                        </div>
                                        <span className="font-medium text-lg">{user?.email || 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Phone Number</label>
                                    <div className="flex items-center gap-3 text-gray-800">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                            <FaPhone size={14} />
                                        </div>
                                        <span className="font-medium text-lg">{user?.phoneNumber || 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Security</label>
                                    <div className="flex items-center gap-3 text-gray-800">
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                                            <FaLock size={14} />
                                        </div>
                                        <span className="font-medium text-lg">Password & Authentication</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* System Status Card */}
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl shadow-md p-6 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg mb-2">System Status</h3>
                        <p className="text-white/80 text-sm max-w-md">
                            All systems are running smoothly. Check the dashboard for detailed analytics.
                        </p>
                    </div>
                    <div className="absolute -right-10 -bottom-20 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
                </div>

                {/* Mobile Sign Out */}
                <button
                    onClick={handleLogout}
                    className="lg:hidden w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-5 py-3 rounded-xl font-medium transition duration-200"
                >
                    <FaSignOutAlt />
                    Sign Out
                </button>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
