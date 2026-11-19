'use client';

import { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { MotorDeskCustomer } from '@/lib/motordesk';

const MAX_RECIPIENTS = 60;

type Props = {
  token?: string;
  onClose: () => void;
  onSent: (message: string) => void;
  onError: (message: string) => void;
};

export default function OffersModal({ token, onClose, onSent, onError }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MotorDeskCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MotorDeskCustomer[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!token || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/motordesk/contacts?q=${encodeURIComponent(q)}&limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setResults(res.ok ? data.customers || [] : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, token]);

  const toggle = (customer: MotorDeskCustomer) => {
    if (!customer.mobile) return;
    setSelected((current) => {
      const exists = current.some((item) => item.id === customer.id);
      if (exists) return current.filter((item) => item.id !== customer.id);
      if (current.length >= MAX_RECIPIENTS) {
        onError(`You can select up to ${MAX_RECIPIENTS} customers`);
        return current;
      }
      return [...current, customer];
    });
  };

  const send = async () => {
    if (!token || sending) return;
    if (selected.length === 0) {
      onError('Select at least one customer');
      return;
    }
    if (!message.trim()) {
      onError('Write a message first');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/offers/sms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selected.map((customer) => customer.id), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send');
      const failed = Array.isArray(data.failed) ? data.failed.length : 0;
      const sent = Number(data.sent) || 0;
      if (sent === 0) {
        onError(failed ? 'No messages were sent. Check the customers have a mobile number.' : 'No messages were sent');
        return;
      }
      onSent(failed ? `SMS sent to ${sent} customers. ${failed} could not be sent.` : `SMS sent to ${sent} customers`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/40 p-4 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_30px_80px_-30px_rgba(11,61,115,0.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/70 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B3D73]">Offers</p>
            <h3 className="text-base font-semibold text-[#0F172A]">Send an SMS offer</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/70 text-slate-500 hover:text-[#0F172A]">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Customers</label>
              <span className="text-xs text-slate-500">{selected.length} of {MAX_RECIPIENTS}</span>
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email or mobile"
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#0B3D73] focus:ring-2 focus:ring-[#0B3D73]/15"
            />
            {searching ? <p className="mt-1 text-xs text-slate-400">Searching...</p> : null}
            {results.length > 0 ? (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white">
                {results.map((customer) => {
                  const checked = selected.some((item) => item.id === customer.id);
                  return (
                    <label key={customer.id} className="flex cursor-pointer items-start gap-3 border-b border-[#F1F5F9] px-3 py-2 last:border-b-0 hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!customer.mobile && !checked}
                        onChange={() => toggle(customer)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[#0F172A]">{customer.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {customer.mobile ? `+44 ${customer.mobile}` : 'No mobile number'}
                          {customer.email ? ` · ${customer.email}` : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
            {selected.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => toggle(customer)}
                    className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-medium text-[#0F172A]"
                  >
                    {customer.name} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Write your message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={480}
              rows={5}
              placeholder="Write the offer you want to send"
              className="mt-1 w-full resize-none rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0B3D73] focus:ring-2 focus:ring-[#0B3D73]/15"
            />
            <span className="mt-1 block text-right text-xs text-slate-400">{message.trim().length}/480</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/70 bg-white/50 px-6 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#E2E8F0] bg-white px-5 text-sm font-semibold text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || selected.length === 0 || !message.trim()}
            className="h-11 rounded-xl bg-[#0B3D73] px-5 text-sm font-semibold text-white hover:bg-[#072A50] disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  );
}
