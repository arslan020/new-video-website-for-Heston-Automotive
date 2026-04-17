'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import UKPhoneInput from '@/components/UKPhoneInput';
import {
  FaUserPlus,
  FaSearch,
  FaEllipsisV,
  FaUserTie,
  FaEnvelope,
  FaPhone,
  FaTimes,
  FaEdit,
  FaTrash,
  FaKey,
} from 'react-icons/fa';

interface StaffMember {
  _id: string;
  username: string;
  name?: string;
  email: string;
  phoneNumber: string;
  isTwoFactorEnabled: boolean;
  role: string;
}

interface FormData {
  username: string;
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  isTwoFactorEnabled: boolean;
}

export default function ManageStaffPage() {
  return (
    <ProtectedRoute role="admin">
      <ManageStaffContent />
    </ProtectedRoute>
  );
}

function ManageStaffContent() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const [showModal, setShowModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    isTwoFactorEnabled: false,
  });

  const [resetPasswordModal, setResetPasswordModal] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const fetchStaff = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/auth/staff', { headers: { Authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      setStaff(data);
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openModal = (member: StaffMember | null = null) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        username: member.username,
        name: member.name || '',
        email: member.email,
        phoneNumber: member.phoneNumber ? member.phoneNumber.replace('+44', '').replace(/^0/, '') : '',
        password: '',
        isTwoFactorEnabled: member.isTwoFactorEnabled || false,
      });
    } else {
      setEditingMember(null);
      setFormData({
        username: '',
        name: '',
        email: '',
        phoneNumber: '',
        password: '',
        isTwoFactorEnabled: false,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMember(null);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formattedPhone = formData.phoneNumber.startsWith('+44')
        ? formData.phoneNumber
        : `+44${formData.phoneNumber.replace(/^0/, '')}`;

      const payload = {
        ...formData,
        phoneNumber: formattedPhone,
        password: formData.password || undefined,
      };

      const url = editingMember ? `/api/auth/staff/${editingMember._id}` : '/api/auth/staff';
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error processing request');

      closeModal();
      fetchStaff();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error processing request');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    if (!resetPasswordModal) return;
    try {
      const res = await fetch(`/api/auth/staff/${resetPasswordModal._id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error resetting password');
      alert('Password reset successfully!');
      setResetPasswordModal(null);
      setNewPassword('');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error resetting password');
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this staff member? This action will permanently remove their account and all associated data (including uploaded videos).'
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/auth/staff/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      fetchStaff();
      setActiveMenu(null);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error deleting staff member');
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'All' ||
      (filterStatus === 'Active' && true) ||
      (filterStatus === 'Inactive' && false);
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="w-full px-3 sm:px-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Staff</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your staff members and their account permissions.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition shadow-sm text-sm"
            >
              <FaUserPlus size={14} />
              <span>New Member</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-3 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg self-start">
              {['All', 'Active', 'Inactive'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition ${
                    filterStatus === status
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {status}{' '}
                  {status === 'All' && <span className="ml-1 text-xs opacity-60">({staff.length})</span>}
                </button>
              ))}
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0">
                <tr>
                  <th className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4 w-10">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" readOnly />
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4">Member</th>
                  <th className="hidden md:table-cell px-4 sm:px-6 py-3 sm:py-4">Contact Details</th>
                  <th className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4">Status</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((member) => (
                    <tr key={member._id} className="hover:bg-gray-50 transition relative">
                      <td className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" readOnly />
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm text-sm">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{member.name || member.username}</p>
                            <p className="text-xs text-gray-500">@{member.username}</p>
                            {/* Show contact inline on small screens */}
                            <div className="md:hidden mt-1 space-y-0.5">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <FaPhone size={9} className="text-gray-400" />
                                <span className="truncate">{member.phoneNumber}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <FaEnvelope size={9} className="text-gray-400" />
                                <span className="truncate max-w-[140px]">{member.email}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 sm:px-6 py-3 sm:py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FaPhone size={12} className="text-gray-400" />
                            {member.phoneNumber}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <FaEnvelope size={10} className="text-gray-400" />
                            {member.email}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Available
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeMenu === member._id) {
                                setActiveMenu(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPos({
                                  top: rect.bottom + 5,
                                  right: window.innerWidth - rect.right,
                                });
                                setActiveMenu(member._id);
                              }
                            }}
                            className={`p-2 rounded-full transition ${
                              activeMenu === member._id
                                ? 'bg-blue-100 text-blue-600'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <FaEllipsisV />
                          </button>

                          {activeMenu === member._id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                              <div
                                className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-fade-in origin-top-right"
                                style={{ top: `${menuPos.top}px`, right: `${menuPos.right}px` }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    openModal(member);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2 transition"
                                >
                                  <FaEdit size={14} className="text-gray-400" /> Edit Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetPasswordModal(member);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-md flex items-center gap-2 transition"
                                >
                                  <FaKey size={14} className="text-amber-500/70" /> Reset Password
                                </button>
                                <div className="h-px bg-gray-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDelete(member._id)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 transition"
                                >
                                  <FaTrash size={14} className="text-red-500/70" /> Delete Member
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 text-sm">
                      No staff members found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 sm:p-4 border-t border-gray-100 flex items-center justify-between text-xs sm:text-sm text-gray-500 gap-2 flex-wrap">
            <p>
              <span className="font-medium text-gray-800">
                1-{filteredStaff.length}
              </span>{' '}
              of{' '}
              <span className="font-medium text-gray-800">{filteredStaff.length}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                disabled
              >
                Previous
              </button>
              <button
                type="button"
                className="px-3 py-1 border border-gray-200 rounded bg-blue-50 text-blue-600 border-blue-100 font-medium"
              >
                1
              </button>
              <button
                type="button"
                className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                disabled
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden animate-fade-in max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">
                {editingMember ? 'Edit Staff Member' : 'Add New Member'}
              </h3>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <FaTimes size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <FaUserTie />
                    </div>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="johndoe"
                      required
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <FaUserTie />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <FaEnvelope />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <UKPhoneInput
                    value={formData.phoneNumber}
                    onChange={(digits) => setFormData((prev) => ({ ...prev, phoneNumber: digits }))}
                    required
                    placeholder="7700 900 000"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password{' '}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      {editingMember ? '(Leave blank to keep current)' : '(Required)'}
                    </span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <FaKey />
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="••••••••"
                      required={!editingMember}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  name="isTwoFactorEnabled"
                  checked={formData.isTwoFactorEnabled}
                  onChange={handleInputChange}
                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-blue-900">Enable Two-Factor Authentication</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    User will be required to verify their email on every login.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Saving...' : editingMember ? 'Save Changes' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-amber-500 p-6 text-white text-center">
              <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <FaKey size={20} />
              </div>
              <h3 className="text-xl font-bold">Reset Password</h3>
              <p className="text-white/80 text-sm mt-1">Set a new password for {resetPasswordModal.username}</p>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-lg"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setResetPasswordModal(null)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-lg shadow-amber-200"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
