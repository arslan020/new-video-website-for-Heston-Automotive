'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { TRACKING_STAGES } from '@/lib/trackingStages';
import UKPhoneInput from '@/components/UKPhoneInput';
import { FaCar, FaLink, FaCheck, FaExternalLinkAlt, FaSync, FaPaperPlane, FaTimes } from 'react-icons/fa';

interface StockVehicle {
  registration?: string | null;
  vin?: string;
  make?: string;
  model?: string;
  derivative?: string;
  colour?: string;
}

interface StockItem {
  vehicle?: StockVehicle;
  metadata?: { stockId?: string };
  adverts?: { forecourtPrice?: { amountGBP?: number } };
  media?: { images?: { url?: string; href?: string }[] };
}

interface TrackingRecord {
  stockId: string;
  currentStage: number;
}

export default function ChanganTrackerContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [tracking, setTracking] = useState<Record<string, TrackingRecord>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendModalItem, setSendModalItem] = useState<StockItem | null>(null);
  const [sendForm, setSendForm] = useState({ title: 'Mr', name: '', email: '', mobile: '' });
  const [sending, setSending] = useState(false);

  const upsertTracking = useCallback(async (item: StockItem, stage: number): Promise<TrackingRecord> => {
    const stockId = item.metadata?.stockId;
    if (!stockId || !user?.token) throw new Error('Missing stockId or auth token');
    const res = await fetch(`/api/vehicle-tracking/${stockId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage,
        vin: item.vehicle?.vin,
        registration: item.vehicle?.registration || undefined,
        make: item.vehicle?.make,
        model: item.vehicle?.model,
        derivative: item.vehicle?.derivative,
        colour: item.vehicle?.colour,
        image: item.media?.images?.[0]?.url || item.media?.images?.[0]?.href,
      }),
    });
    if (!res.ok) throw new Error('Failed to update stage');
    return res.json();
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const [stockRes, trackingRes] = await Promise.all([
        fetch('/api/autotrader/stock', { headers }),
        fetch('/api/vehicle-tracking', { headers }),
      ]);
      const stockData = await stockRes.json();
      const trackingData: TrackingRecord[] = await trackingRes.json();

      const results: StockItem[] = stockData.results || [];
      const changan = results.filter((item) =>
        (item.vehicle?.make || '').toLowerCase().includes('changan')
      );
      setStock(changan);

      const map: Record<string, TrackingRecord> = {};
      if (Array.isArray(trackingData)) {
        trackingData.forEach((t) => { map[t.stockId] = t; });
      }
      setTracking(map);

      // Seed a tracking record (stage 0) for any Changan vehicle that doesn't have one yet,
      // so its "Copy Track Link" works immediately without staff having to click a stage first.
      const untracked = changan.filter((item) => item.metadata?.stockId && !map[item.metadata.stockId]);
      if (untracked.length > 0) {
        const seeded = await Promise.allSettled(untracked.map((item) => upsertTracking(item, 0)));
        setTracking((prev) => {
          const next = { ...prev };
          seeded.forEach((result) => {
            if (result.status === 'fulfilled') next[result.value.stockId] = result.value;
          });
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load Changan stock', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast, upsertTracking]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSetStage = async (item: StockItem, stage: number) => {
    const stockId = item.metadata?.stockId;
    if (!stockId) return;
    setUpdatingId(stockId);
    try {
      const updated = await upsertTracking(item, stage);
      setTracking((prev) => ({ ...prev, [stockId]: updated }));
      showToast(`Stage updated to "${TRACKING_STAGES[stage]}"`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update stage', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const copyTrackLink = async (stockId: string) => {
    const link = `${window.location.origin}/track/${stockId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(stockId);
      showToast('Tracking link copied!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const openSendModal = (item: StockItem) => {
    setSendModalItem(item);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
  };

  const closeSendModal = () => {
    setSendModalItem(null);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
  };

  const handleSendTrackLink = async () => {
    if (!sendModalItem || !user?.token) return;
    const stockId = sendModalItem.metadata?.stockId;
    if (!stockId) return;
    if (!sendForm.name.trim() || (!sendForm.email && !sendForm.mobile)) {
      showToast('Please enter customer name and email or mobile', 'error');
      return;
    }

    setSending(true);
    try {
      const trackLink = `${window.location.origin}/track/${stockId}`;
      const payload: Record<string, unknown> = {
        trackLink,
        stockId,
        customerName: sendForm.name,
        customerTitle: sendForm.title,
        vehicleDetails: {
          make: sendModalItem.vehicle?.make,
          model: sendModalItem.vehicle?.model,
          registration: sendModalItem.vehicle?.registration,
        },
      };
      if (sendForm.email) payload.email = sendForm.email;
      if (sendForm.mobile) payload.mobile = sendForm.mobile.replace(/\D/g, '');

      const res = await fetch('/api/vehicle-tracking/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || 'Failed to send link');

      showToast('Tracking link sent successfully!', 'success');
      closeSendModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send tracking link', 'error');
    } finally {
      setSending(false);
    }
  };

  const sortedStock = useMemo(
    () => [...stock].sort((a, b) => (a.vehicle?.model || '').localeCompare(b.vehicle?.model || '')),
    [stock]
  );

  return (
    <div className="w-full px-3 sm:px-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Changan Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track Changan vehicles through to handover and share live status links with customers.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition shadow-sm text-sm disabled:opacity-50"
        >
          <FaSync size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : sortedStock.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <FaCar className="text-gray-300" size={36} />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Changan vehicles in stock</h3>
          <p className="text-sm text-gray-400">
            Changan vehicles from your AutoTrader stock sync will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedStock.map((item) => {
            const stockId = item.metadata?.stockId;
            if (!stockId) return null;
            const stage = tracking[stockId]?.currentStage ?? 0;
            const image = item.media?.images?.[0]?.url || item.media?.images?.[0]?.href;

            return (
              <div key={stockId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <div className="w-full sm:w-32 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {image ? (
                      <img src={image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <FaCar size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                      {item.vehicle?.make} {item.vehicle?.model}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{item.vehicle?.derivative}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {item.vehicle?.registration && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-xs rounded-md border border-blue-100">
                          {item.vehicle.registration}
                        </span>
                      )}
                      {item.vehicle?.vin && (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 font-mono text-xs rounded-md border border-gray-200">
                          VIN: {item.vehicle.vin}
                        </span>
                      )}
                      {item.adverts?.forecourtPrice?.amountGBP && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
                          £{item.adverts.forecourtPrice.amountGBP.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => copyTrackLink(stockId)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                    >
                      {copiedId === stockId ? <FaCheck size={11} /> : <FaLink size={11} />}
                      {copiedId === stockId ? 'Copied' : 'Copy Track Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSendModal(item)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition"
                    >
                      <FaPaperPlane size={11} />
                      Send to Customer
                    </button>
                    <a
                      href={`/track/${stockId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-9 h-9 bg-gray-50 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                      title="Preview tracking page"
                    >
                      <FaExternalLinkAlt size={12} />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {TRACKING_STAGES.map((label, idx) => {
                    const isActive = idx === stage;
                    const isPast = idx < stage;
                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={updatingId === stockId}
                        onClick={() => handleSetStage(item, idx)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : isPast
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {isPast && <FaCheck size={9} className="inline mr-1 -mt-0.5" />}
                        {idx + 1}. {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sendModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Send Tracking Link</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sendModalItem.vehicle?.make} {sendModalItem.vehicle?.model}
                </p>
              </div>
              <button type="button" onClick={closeSendModal} className="text-gray-400 hover:text-gray-600 transition">
                <FaTimes size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <select
                    value={sendForm.title}
                    onChange={(e) => setSendForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={sendForm.name}
                    onChange={(e) => setSendForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="John Smith"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={sendForm.email}
                  onChange={(e) => setSendForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <UKPhoneInput value={sendForm.mobile} onChange={(v) => setSendForm((p) => ({ ...p, mobile: v }))} />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeSendModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTrackLink}
                  disabled={sending || (!sendForm.email && !sendForm.mobile)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
