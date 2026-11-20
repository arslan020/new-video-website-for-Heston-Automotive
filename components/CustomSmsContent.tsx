'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { PageTitle } from '@/components/ui/PageTitle';
import type { MotorDeskCustomer } from '@/lib/motordesk';
import { FaComment, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';

type SavedCustomer = { id: number; name: string; mobile: string };
type Template = { id: string; name: string; body: string; customers: SavedCustomer[] };

const MAX_RECIPIENTS = 60;

function phoneLabel(mobile: string) {
  if (!mobile) return '';
  const digits = mobile.startsWith('0') ? mobile : `0${mobile}`;
  if (digits.length === 11) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return digits;
}

export default function CustomSmsContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [customers, setCustomers] = useState<SavedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MotorDeskCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const authHeaders = useCallback((): HeadersInit => (
    user?.token ? { Authorization: `Bearer ${user.token}` } : {}
  ), [user?.token]);

  const applyTemplate = (template: Template) => {
    setActiveId(template.id);
    setName(template.name);
    setBody(template.body);
    setCustomers(template.customers || []);
    setQuery('');
    setResults([]);
  };

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sms/templates', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load templates');
      const next: Template[] = Array.isArray(data) ? data : [];
      setTemplates(next);
      if (next[0]) applyTemplate(next[0]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load Custom SMS', 'error');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, showToast, user?.token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (!user?.token || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/motordesk/contacts?q=${encodeURIComponent(q)}&limit=20`, { headers: authHeaders() });
        const data = await res.json();
        setResults(res.ok ? data.customers || [] : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [authHeaders, query, user?.token]);

  const store = async (next: { id?: string; name: string; body: string; customerIds: number[] }) => {
    const res = await fetch('/api/sms/templates', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not save template');
    const saved = data as Template;
    setTemplates((current) => {
      const without = current.filter((item) => item.id !== saved.id);
      const index = current.findIndex((item) => item.id === saved.id);
      if (index === -1) return [...without, saved];
      const copy = [...current];
      copy[index] = saved;
      return copy;
    });
    applyTemplate(saved);
    return saved;
  };

  const addTemplate = async () => {
    if (!user?.token || saving) return;
    setSaving(true);
    try {
      const saved = await store({ name: 'New template', body: '', customerIds: [] });
      applyTemplate(saved);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    if (!activeId || saving) return;
    setSaving(true);
    try {
      await store({ id: activeId, name: name.trim() || 'New template', body, customerIds: customers.map((customer) => customer.id) });
      showToast('Template saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openTemplate = async (template: Template) => {
    if (template.id === activeId) return;
    if (activeId && (name !== templates.find((item) => item.id === activeId)?.name || body !== templates.find((item) => item.id === activeId)?.body)) {
      try {
        await store({ id: activeId, name: name.trim() || 'New template', body, customerIds: customers.map((customer) => customer.id) });
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save template', 'error');
        return;
      }
    }
    applyTemplate(template);
  };

  const deleteTemplate = async (template: Template) => {
    if (!user?.token) return;
    if (!window.confirm(`Delete ${template.name}?`)) return;
    const res = await fetch(`/api/sms/templates/${template.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      showToast('Could not delete template', 'error');
      return;
    }
    const next = templates.filter((item) => item.id !== template.id);
    setTemplates(next);
    if (activeId === template.id) {
      if (next[0]) applyTemplate(next[0]);
      else {
        setActiveId('');
        setName('');
        setBody('');
        setCustomers([]);
      }
    }
  };

  const selectCustomer = async (customer: MotorDeskCustomer) => {
    if (!activeId || saving) return;
    if (!customer.mobile) {
      showToast('This customer has no mobile number', 'error');
      return;
    }
    if (customers.some((item) => item.id === customer.id)) return;
    if (customers.length >= MAX_RECIPIENTS) {
      showToast(`You can save up to ${MAX_RECIPIENTS} customers on one template`, 'error');
      return;
    }
    setSaving(true);
    try {
      await store({
        id: activeId,
        name: name.trim() || 'New template',
        body,
        customerIds: [...customers.map((item) => item.id), customer.id],
      });
      setQuery('');
      setResults([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async (customer: SavedCustomer) => {
    if (!activeId || saving) return;
    setSaving(true);
    try {
      await store({
        id: activeId,
        name: name.trim() || 'New template',
        body,
        customerIds: customers.filter((item) => item.id !== customer.id).map((item) => item.id),
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not remove customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!activeId || sending) return;
    const message = body.trim();
    if (!message) {
      showToast('Write a message first', 'error');
      return;
    }
    if (customers.length === 0) {
      showToast('Select at least one customer', 'error');
      return;
    }
    setSending(true);
    try {
      await store({ id: activeId, name: name.trim() || 'New template', body: message, customerIds: customers.map((customer) => customer.id) });
      const res = await fetch('/api/offers/sms', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: customers.map((customer) => customer.id), message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send');
      const failed = Array.isArray(data.failed) ? data.failed.length : 0;
      const sent = Number(data.sent) || 0;
      if (sent === 0) {
        showToast('No messages were sent. Check the customers have a mobile number.', 'error');
        return;
      }
      showToast(failed ? `SMS sent to ${sent} customers. ${failed} could not be sent.` : `SMS sent to ${sent} customers`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageTitle title="Custom SMS">
        Each template keeps its own message and customers. Send goes to the customers on that template.
      </PageTitle>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {templates.map((template) => (
          <div key={template.id} className={`relative min-h-[76px] rounded-2xl border bg-white p-3 text-left shadow-sm ${activeId === template.id ? 'border-[#0B3D73] ring-2 ring-[#0B3D73]/15' : 'border-[#E2E8F0]'}`}>
            <button type="button" onClick={() => openTemplate(template)} className="block w-full pr-6 text-left">
              <span className="block truncate text-sm font-semibold text-[#0F172A]">{template.name}</span>
              <span className="mt-1 block text-[11px] font-medium text-[#0B3D73]">{template.customers?.length || 0} customers</span>
            </button>
            <button type="button" onClick={() => deleteTemplate(template)} aria-label={`Delete ${template.name}`} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-[#F8FAFC] hover:text-red-600">
              <FaTimes size={11} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addTemplate} disabled={saving} className="flex min-h-[76px] items-center justify-center rounded-2xl border border-dashed border-[#0B3D73]/40 bg-white text-[#0B3D73] shadow-sm hover:bg-[#EAF0F7] disabled:opacity-50" aria-label="Add template">
          <FaPlus size={22} />
        </button>
      </div>

      {!loading && !activeId ? (
        <p className="mt-4 text-sm text-[#64748B]">Press plus to add the first template.</p>
      ) : null}

      {activeId ? (
        <section className="mt-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm text-[#475569]">
              Template name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} className="mt-1 h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-base text-[#0F172A] outline-none focus:border-[#0B3D73] sm:text-sm" />
            </label>
            <div className="lg:col-span-2">
              <label className="block text-sm text-[#475569]">
                Message
                <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={480} rows={5} placeholder="Write the SMS" className="mt-1 w-full resize-none rounded-xl border border-[#E2E8F0] px-3 py-2 text-base text-[#0F172A] outline-none focus:border-[#0B3D73] sm:text-sm" />
                <span className="mt-1 block text-right text-xs text-slate-400">{body.trim().length}/480</span>
              </label>
            </div>
          </div>
          <button type="button" onClick={saveDetails} disabled={saving || !name.trim()} className="mt-3 h-11 rounded-xl border border-[#E2E8F0] px-4 text-sm font-semibold text-[#0B3D73] hover:bg-[#F8FAFC] disabled:opacity-50">
            {saving ? 'Saving...' : 'Save template'}
          </button>

          <div className="mt-6 border-t border-[#E2E8F0] pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#0F172A]">Customers on this template</h2>
              <span className="text-xs text-[#64748B]">{customers.length} selected</span>
            </div>
            <div className="relative mt-3">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email or mobile"
                className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-3 text-base text-[#0F172A] outline-none focus:border-[#0B3D73] sm:text-sm"
              />
            </div>
            {searching ? <p className="mt-2 text-xs text-slate-400">Searching...</p> : null}
            {results.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-[#E2E8F0]">
                {results.map((customer) => {
                  const selected = customers.some((item) => item.id === customer.id);
                  return (
                    <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} disabled={saving || selected} className="flex w-full items-center justify-between gap-3 border-b border-[#F1F5F9] px-3 py-3 text-left last:border-b-0 hover:bg-[#F8FAFC] disabled:opacity-60">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[#0F172A]">{customer.name}</span>
                        <span className="block truncate text-xs text-[#64748B]">{customer.mobile ? phoneLabel(customer.mobile) : 'No mobile number'}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[#0B3D73]">{selected ? 'Saved' : 'Select'}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {customers.length === 0 ? (
              <p className="mt-4 text-sm text-[#64748B]">Search and select customers. They stay saved on this template.</p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {customers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#0F172A]">{customer.name}</p>
                      <p className="text-xs text-[#64748B]">{phoneLabel(customer.mobile)}</p>
                    </div>
                    <button type="button" onClick={() => removeCustomer(customer)} aria-label={`Remove ${customer.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-[#F8FAFC] hover:text-red-600">
                      <FaTimes size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={send} disabled={sending || saving || customers.length === 0 || !body.trim()} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3D73] text-sm font-semibold text-white hover:bg-[#072A50] disabled:opacity-50">
              <FaComment size={13} />
              {sending ? 'Sending...' : `Send to ${customers.length}`}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
