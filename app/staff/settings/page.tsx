'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import {
    FaUser, FaEnvelope, FaPhone, FaShieldAlt, FaEdit, FaLock,
    FaTimes, FaSignOutAlt, FaCheckCircle, FaCog, FaUserShield
} from 'react-icons/fa';

export default function StaffSettingsPage() {
    return (
        <ProtectedRoute role="staff">
            <StaffSettingsContent />
        </ProtectedRoute>
    );
}

function StaffSettingsContent() {
    const { user, logout, updateUser } = useAuth();
    const router = useRouter();
    const [showProfileForm, setShowProfileForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [formData, setFormData] = useState({
        username: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleProfileUpdate = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (!formData.currentPassword) {
            setMessage({ type: 'error', text: 'Current password is required' });
            return;
        }
        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        setLoading(true);
        try {
            const updateData: any = {
                currentPassword: formData.currentPassword
            };
            if (formData.username) updateData.username = formData.username;
            if (formData.newPassword) updateData.newPassword = formData.newPassword;

            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
                body: JSON.stringify(updateData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Update failed');

            updateUser({ ...user!, username: data.username });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setShowProfileForm(false);
            setFormData({ username: '', currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Update failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    return (
        <DashboardLayout>
            <div className="w-full pb-12 px-6">
                {/* Page Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                            <FaCog className="text-white text-lg sm:text-xl" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Settings</h1>
                    </div>
                    <p className="text-sm sm:text-base text-gray-500 ml-0 sm:ml-14">Manage your account settings and preferences</p>
                </div>

                {/* Message Toast */}
                {message.text && (
                    <div className={`mb-4 sm:mb-6 w-full p-3 sm:p-4 rounded-lg flex items-start sm:items-center gap-3 shadow-sm ${message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        <FaCheckCircle className={`flex-shrink-0 mt-0.5 sm:mt-0 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`} />
                        <span className="font-medium text-sm sm:text-base flex-1">{message.text}</span>
                        <button
                            onClick={() => setMessage({ type: '', text: '' })}
                            className="flex-shrink-0 opacity-70 hover:opacity-100 transition"
                        >
                            <FaTimes />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    {/* Left Sidebar (Settings Navigation / Actions) */}
                    <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
                        {/* Status Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Account Status</h3>

                            <div className="space-y-3 sm:space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center ${user?.isTwoFactorEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                            <FaShieldAlt size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-700 truncate">2-Factor Auth</p>
                                            <p className="text-xs text-gray-500">{user?.isTwoFactorEnabled ? 'Active' : 'Inactive'}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 italic hidden sm:block flex-shrink-0 ml-2">Admin</div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <FaUser size={14} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-700">Role</p>
                                            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-4 sm:px-5 py-3 rounded-xl font-medium transition duration-200"
                        >
                            <FaSignOutAlt />
                            <span>Sign Out</span>
                        </button>
                    </div>

                    {/* Main Content (Profile Form) */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1 lg:order-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Personal Information</h2>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1">Update your personal details and password</p>
                                </div>
                                {!showProfileForm && (
                                    <button
                                        onClick={() => setShowProfileForm(true)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                                    >
                                        <FaEdit /> <span>Edit</span>
                                    </button>
                                )}
                            </div>

                            <div className="p-4 sm:p-6">
                                {showProfileForm ? (
                                    <form onSubmit={handleProfileUpdate} className="space-y-5 sm:space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <FaUser className="text-gray-400 text-sm" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="username"
                                                        value={formData.username}
                                                        onChange={handleInputChange}
                                                        placeholder={user?.username}
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm sm:text-base"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <FaEnvelope className="text-gray-400 text-sm" />
                                                    </div>
                                                    <input
                                                        type="email"
                                                        value={user?.email || ''}
                                                        disabled
                                                        className="w-full pl-10 pr-16 sm:pr-20 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed text-sm sm:text-base"
                                                    />
                                                    <span className="absolute right-2 sm:right-3 top-2.5 text-xs text-gray-400">Read-only</span>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <FaPhone className="text-gray-400 text-sm" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={user?.phoneNumber || ''}
                                                        disabled
                                                        className="w-full pl-10 pr-16 sm:pr-20 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed text-sm sm:text-base"
                                                    />
                                                    <span className="absolute right-2 sm:right-3 top-2.5 text-xs text-gray-400">Read-only</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100 pt-5 sm:pt-6">
                                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                                <FaLock className="text-gray-400" /> Security
                                            </h3>

                                            <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6">
                                                <div className="sm:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Current Password <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="password"
                                                        name="currentPassword"
                                                        value={formData.currentPassword}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm sm:text-base"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password (Optional)</label>
                                                    <input
                                                        type="password"
                                                        name="newPassword"
                                                        value={formData.newPassword}
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm sm:text-base"
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
                                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm sm:text-base"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 text-sm sm:text-base"
                                            >
                                                {loading ? 'Saving Changes...' : 'Save Changes'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowProfileForm(false);
                                                    setMessage({ type: '', text: '' });
                                                }}
                                                className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-sm sm:text-base"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    // View Mode
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-y-8 sm:gap-x-12">
                                        <div className="group">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Username</label>
                                            <div className="flex items-center gap-3 text-gray-800">
                                                <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                                    <FaUser size={14} />
                                                </div>
                                                <span className="font-medium text-base sm:text-lg break-all">{user?.username}</span>
                                            </div>
                                        </div>

                                        <div className="group">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                                            <div className="flex items-center gap-3 text-gray-800">
                                                <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                                    <FaEnvelope size={14} />
                                                </div>
                                                <span className="font-medium text-base sm:text-lg break-all">{user?.email || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="group">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Phone Number</label>
                                            <div className="flex items-center gap-3 text-gray-800">
                                                <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                                    <FaPhone size={14} />
                                                </div>
                                                <span className="font-medium text-base sm:text-lg">{user?.phoneNumber || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="group">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Security</label>
                                            <div className="flex items-center gap-3 text-gray-800">
                                                <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                                                    <FaLock size={14} />
                                                </div>
                                                <span className="font-medium text-base sm:text-lg">Password Protected</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Help Card */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md p-5 sm:p-6 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-bold text-base sm:text-lg mb-2">Need Help?</h3>
                                <p className="text-white/90 text-sm max-w-md leading-relaxed">
                                    If you need to update your email or phone number, please contact your administrator directly as these are managed centrally.
                                </p>
                            </div>
                            <div className="absolute -right-10 -bottom-20 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
