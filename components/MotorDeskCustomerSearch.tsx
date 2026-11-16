'use client';

import { useEffect, useState } from 'react';
import type { MotorDeskCustomer } from '@/lib/motordesk';

type Props = {
  token?: string;
  onSelect: (customer: MotorDeskCustomer) => void;
};

export default function MotorDeskCustomerSearch({ token, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<MotorDeskCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (!token || q.length < 2) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/motordesk/contacts?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCustomers(res.ok ? data.customers || [] : []);
        setOpen(true);
      } catch {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, token]);

  const choose = (customer: MotorDeskCustomer) => {
    onSelect(customer);
    setQuery(customer.name);
    setAddress(customer.address);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-gray-700">Motor Desk customer</label>
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => customers.length > 0 && setOpen(true)}
        placeholder="Search name, email or mobile"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0B3D73] focus:ring-2 focus:ring-[#0B3D73]/15"
      />
      {loading ? <p className="mt-1 text-xs text-gray-400">Searching...</p> : null}
      {open && customers.length > 0 ? (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => choose(customer)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-900">{customer.name}</p>
              <p className="truncate text-xs text-gray-500">
                {[customer.email, customer.mobile ? `+44 ${customer.mobile}` : '', customer.address].filter(Boolean).join(' · ') || 'No contact details'}
              </p>
            </button>
          ))}
        </div>
      ) : null}
      {address ? <p className="mt-1 text-xs text-gray-500">Address: {address}</p> : null}
    </div>
  );
}
