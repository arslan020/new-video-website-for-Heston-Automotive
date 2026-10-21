'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { TRACKING_STAGES } from '@/lib/trackingStages';
import { coloursForVehicle, matchStockColour } from '@/lib/exteriorColours';
import UKPhoneInput from '@/components/UKPhoneInput';
import { PageTitle } from '@/components/ui/PageTitle';
import { FaCar, FaLink, FaCheck, FaSync, FaPaperPlane, FaTimes, FaPlus, FaTrash, FaCommentDots } from 'react-icons/fa';

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
  metadata?: { stockId?: string; lifecycleState?: string };
  adverts?: { forecourtPrice?: { amountGBP?: number } };
  media?: { images?: { url?: string; href?: string }[] };
}

interface StageRemark {
  stage: number;
  text: string;
  createdAt: string;
  customerReply?: string;
  repliedAt?: string;
}

interface TrackingRecord {
  stockId: string;
  currentStage: number;
  vin?: string;
  make?: string;
  model?: string;
  image?: string;
  colour?: string;
  derivative?: string;
  isPreOrder?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  lastViewedAt?: string;
  remarks?: StageRemark[];
}

interface SendTarget {
  stockId: string;
  make?: string;
  model?: string;
  registration?: string;
}

interface OrderTarget {
  label: string;
  vin?: string;
  registration?: string;
  make?: string;
  model?: string;
  derivative?: string;
  colour?: string;
  image?: string;
  colourLocked?: boolean;
}

function OrderCard({
  order, updatingId, copiedId, sendingOrderId, confirmDeleteId, deletingOrderId,
  onSetStage, onCopy, onSend, onConfirmDelete, onCancelDelete, onDelete, onOpenRemark, onChangeColour,
}: {
  order: TrackingRecord;
  updatingId: string | null;
  copiedId: string | null;
  sendingOrderId: string | null;
  confirmDeleteId: string | null;
  deletingOrderId: string | null;
  onSetStage: (order: TrackingRecord, stage: number) => void;
  onCopy: (stockId: string) => void;
  onSend: (order: TrackingRecord) => void;
  onConfirmDelete: (stockId: string) => void;
  onCancelDelete: () => void;
  onDelete: (order: TrackingRecord) => void;
  onOpenRemark: (order: TrackingRecord, stage: number) => void;
  onChangeColour: (order: TrackingRecord, colourName: string) => void;
}) {
  const [colourOpen, setColourOpen] = useState(false);
  const colourOptions = coloursForVehicle(order.model, order.derivative);
  const selectedColour = matchStockColour(order.model, order.derivative, order.colour);
  const colourLocked = Boolean(order.vin);
  const contact = [order.customerEmail, order.customerMobile].filter(Boolean).join(' · ');
  const viewedLabel = order.lastViewedAt
    ? `Last viewed ${new Date(order.lastViewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${new Date(order.lastViewedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedColour ? (
            <img
              src={selectedColour.swatch}
              alt=""
              className="h-7 w-7 rounded-full border border-gray-200 flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {(order.customerName || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-2 min-w-0 text-sm font-semibold text-gray-800">
              <span className="truncate">{order.customerName || 'Customer'}</span>
              {selectedColour && (
                colourLocked ? (
                  <span className="flex-shrink-0 font-semibold text-gray-700">{selectedColour.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setColourOpen((open) => !open)}
                    className="flex-shrink-0 font-semibold text-[#0b457f] underline decoration-[#0b457f]/40 underline-offset-2"
                    title="Change colour"
                  >
                    {selectedColour.name}
                  </button>
                )
              )}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {contact || 'No contact details'}
              {' · '}
              {viewedLabel ? (
                <span className="font-medium text-emerald-600">{viewedLabel}</span>
              ) : (
                'Not viewed yet'
              )}
            </p>
            {colourOpen && !colourLocked && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {colourOptions.map((entry) => {
                  const active = entry.name === selectedColour?.name;
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      title={entry.name}
                      disabled={updatingId === order.stockId}
                      onClick={() => {
                        setColourOpen(false);
                        if (!active) onChangeColour(order, entry.name);
                      }}
                      className="flex flex-col items-center gap-1 disabled:opacity-50"
                    >
                      <span
                        className={`overflow-hidden rounded-full border-2 transition ${
                          active ? 'border-[#0b457f] ring-2 ring-[#0b457f]/25' : 'border-gray-300 hover:border-[#0b457f]/60'
                        }`}
                      >
                        <img src={entry.swatch} alt="" className="h-7 w-7" />
                      </span>
                      <span className={`text-[10px] leading-tight ${active ? 'font-semibold text-[#0b457f]' : 'text-gray-500'}`}>
                        {entry.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {confirmDeleteId === order.stockId ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">Delete this order?</span>
            <button
              type="button"
              onClick={() => onDelete(order)}
              disabled={deletingOrderId === order.stockId}
              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition disabled:opacity-50"
            >
              {deletingOrderId === order.stockId ? '...' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => onCopy(order.stockId)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
            >
              {copiedId === order.stockId ? <FaCheck size={11} /> : <FaLink size={11} />}
              {copiedId === order.stockId ? 'Copied' : 'Copy Track Link'}
            </button>
            <button
              type="button"
              onClick={() => onSend(order)}
              disabled={sendingOrderId === order.stockId}
              title={order.customerEmail || order.customerMobile ? 'Send tracking link to customer' : 'Add contact details to send'}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-50"
            >
              <FaPaperPlane size={11} className={sendingOrderId === order.stockId ? 'animate-pulse' : ''} />
              Send to Customer
            </button>
            <button
              type="button"
              onClick={() => onConfirmDelete(order.stockId)}
              title="Delete this customer order"
              className="flex items-center justify-center w-9 h-9 bg-gray-50 text-gray-500 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 transition"
            >
              <FaTrash size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TRACKING_STAGES.map((label, idx) => {
          const isActive = idx === order.currentStage;
          const isPast = idx < order.currentStage;
          const remark = order.remarks?.find((r) => r.stage === idx);
          return (
            <div key={label} className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={updatingId === order.stockId}
                onClick={() => onSetStage(order, idx)}
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
              <button
                type="button"
                onClick={() => onOpenRemark(order, idx)}
                title={
                  remark?.customerReply
                    ? 'Customer replied, tap to view'
                    : remark
                    ? 'Remark added, tap to view or edit'
                    : 'Add a remark for this step'
                }
                className={`w-6 h-6 flex items-center justify-center rounded-full border transition flex-shrink-0 ${
                  remark?.customerReply
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : remark
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white border-gray-200 text-gray-300 hover:text-gray-500 hover:border-gray-300'
                }`}
              >
                <FaCommentDots size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INCOMING_MODELS = [
  {
    name: 'Deepal S05 RWD',
    powertrain: 'Electric',
    image: '/models/deepal-s05.jpg',
  },
  {
    name: 'Deepal S05 AWD',
    powertrain: 'Electric',
    image: '/models/deepal-s05.jpg',
  },
  {
    name: 'Deepal S07',
    powertrain: 'Electric',
    image: '/models/deepal-s07.jpg',
  },
  {
    name: 'Deepal S05 Ultra PHEV Pro',
    powertrain: 'Plug-in Hybrid',
    image: '/models/deepal-s05-ultra-phev.jpg',
  },
  {
    name: 'Deepal S05 Ultra PHEV Max',
    powertrain: 'Plug-in Hybrid',
    image: '/models/deepal-s05-ultra-phev.jpg',
  },
];

export default function ChanganTrackerContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [tracking, setTracking] = useState<Record<string, TrackingRecord>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'showroom' | 'incoming'>('showroom');
  const [sendModalItem, setSendModalItem] = useState<SendTarget | null>(null);
  const [sendForm, setSendForm] = useState({ title: 'Mr', name: '', email: '', mobile: '' });
  const [sending, setSending] = useState(false);
  const [orderModalTarget, setOrderModalTarget] = useState<OrderTarget | null>(null);
  const [orderForm, setOrderForm] = useState({ title: 'Mr', name: '', email: '', mobile: '', colour: '' });
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [remarkTarget, setRemarkTarget] = useState<{ stockId: string; stage: number } | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);

  const patchStage = useCallback(async (stockId: string, stage: number, extra: Record<string, unknown> = {}): Promise<TrackingRecord> => {
    if (!user?.token) throw new Error('Missing auth token');
    const res = await fetch(`/api/vehicle-tracking/${stockId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, ...extra }),
    });
    if (!res.ok) throw new Error('Failed to update stage');
    return res.json();
  }, [user]);

  const fetchData = useCallback(async (isInitial = true) => {
    if (!user?.token) return;
    if (isInitial) setLoading(true);
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
    } catch (err) {
      console.error(err);
      if (isInitial) showToast('Failed to load Changan stock', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchData(true);
    // Keep the dashboard fresh so stage changes, new orders, and customer replies made
    // elsewhere (or by the customer on their tracking page) show up without a manual refresh.
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const applyStage = async (stockId: string, run: () => Promise<TrackingRecord>, stage: number) => {
    setUpdatingId(stockId);
    try {
      const updated = await run();
      setTracking((prev) => ({ ...prev, [stockId]: updated }));
      showToast(`Stage updated to "${TRACKING_STAGES[stage]}"`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update stage', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSetOrderStage = (record: TrackingRecord, stage: number) => {
    applyStage(record.stockId, () => patchStage(record.stockId, stage), stage);
  };

  const handleChangeColour = async (order: TrackingRecord, colourName: string) => {
    if (order.vin) return;
    const selected = coloursForVehicle(order.model, order.derivative).find((entry) => entry.name === colourName);
    if (!selected || !user?.token) return;
    setUpdatingId(order.stockId);
    try {
      const res = await fetch(`/api/vehicle-tracking/${order.stockId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ colourOnly: true, colour: selected.name, image: selected.image }),
      });
      if (!res.ok) throw new Error('Failed to update colour');
      const updated: TrackingRecord = await res.json();
      setTracking((prev) => ({ ...prev, [updated.stockId]: updated }));
      showToast(`Colour updated to ${selected.name}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update colour', 'error');
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

  const openSendModal = (target: SendTarget) => {
    setSendModalItem(target);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
  };

  const closeSendModal = () => {
    setSendModalItem(null);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
  };

  const postSendLink = useCallback(async (payload: Record<string, unknown>) => {
    if (!user?.token) throw new Error('Missing auth token');
    const res = await fetch('/api/vehicle-tracking/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { message?: string }).message || 'Failed to send link');
  }, [user]);

  const handleSendTrackLink = async () => {
    if (!sendModalItem) return;
    const stockId = sendModalItem.stockId;
    if (!sendForm.name.trim() || (!sendForm.email && !sendForm.mobile)) {
      showToast('Please enter customer name and email or mobile', 'error');
      return;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        trackLink: `${window.location.origin}/track/${stockId}`,
        stockId,
        customerName: sendForm.name,
        customerTitle: sendForm.title,
        vehicleDetails: {
          make: sendModalItem.make,
          model: sendModalItem.model,
          registration: sendModalItem.registration,
        },
      };
      if (sendForm.email) payload.email = sendForm.email;
      if (sendForm.mobile) payload.mobile = sendForm.mobile.replace(/\D/g, '');

      await postSendLink(payload);
      showToast('Tracking link sent successfully!', 'success');
      closeSendModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send tracking link', 'error');
    } finally {
      setSending(false);
    }
  };

  // Orders already have the customer's contact details captured at creation time,
  // so sending the link again shouldn't re-ask for them — send immediately. Only
  // fall back to the modal if no email/mobile was captured, so staff can add one.
  const handleSendOrderLink = async (order: TrackingRecord) => {
    if (!order.customerEmail && !order.customerMobile) {
      openSendModal({ stockId: order.stockId, make: order.make, model: order.model });
      return;
    }

    setSendingOrderId(order.stockId);
    try {
      const payload: Record<string, unknown> = {
        trackLink: `${window.location.origin}/track/${order.stockId}`,
        stockId: order.stockId,
        customerName: order.customerName,
        vehicleDetails: { make: order.make, model: order.model },
      };
      if (order.customerEmail) payload.email = order.customerEmail;
      if (order.customerMobile) payload.mobile = order.customerMobile;

      await postSendLink(payload);
      showToast('Tracking link sent successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send tracking link', 'error');
    } finally {
      setSendingOrderId(null);
    }
  };

  const handleDeleteOrder = async (order: TrackingRecord) => {
    if (!user?.token) return;
    setDeletingOrderId(order.stockId);
    try {
      const res = await fetch(`/api/vehicle-tracking/${order.stockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error('Failed to delete order');
      setTracking((prev) => {
        const next = { ...prev };
        delete next[order.stockId];
        return next;
      });
      showToast('Customer order deleted', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete order', 'error');
    } finally {
      setDeletingOrderId(null);
      setConfirmDeleteId(null);
    }
  };

  const openRemarkModal = (order: TrackingRecord, stage: number) => {
    const existing = order.remarks?.find((r) => r.stage === stage);
    setRemarkTarget({ stockId: order.stockId, stage });
    setRemarkText(existing?.text || '');
    // Refresh in the background so a customer reply made since the last load shows up
    // immediately, instead of needing a manual "Refresh" click.
    fetchData(false);
  };

  const closeRemarkModal = () => {
    setRemarkTarget(null);
    setRemarkText('');
  };

  const handleSaveRemark = async () => {
    if (!remarkTarget || !user?.token) return;
    if (!remarkText.trim()) {
      showToast('Please enter a remark', 'error');
      return;
    }
    setSavingRemark(true);
    try {
      const res = await fetch(`/api/vehicle-tracking/${remarkTarget.stockId}/remark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: remarkTarget.stage, text: remarkText }),
      });
      if (!res.ok) throw new Error('Failed to save remark');
      const updated: TrackingRecord = await res.json();
      setTracking((prev) => ({ ...prev, [updated.stockId]: updated }));
      showToast('Remark saved', 'success');
      closeRemarkModal();
    } catch (err) {
      console.error(err);
      showToast('Failed to save remark', 'error');
    } finally {
      setSavingRemark(false);
    }
  };

  const openOrderModal = (target: OrderTarget) => {
    const colours = coloursForVehicle(target.model, target.derivative);
    const match = matchStockColour(target.model, target.derivative, target.colour);
    const locked = Boolean(target.colourLocked);
    setOrderModalTarget(target);
    setOrderForm({
      title: 'Mr',
      name: '',
      email: '',
      mobile: '',
      colour: match?.name || (locked ? target.colour || '' : colours[0]?.name || ''),
    });
  };

  const closeOrderModal = () => {
    setOrderModalTarget(null);
    setOrderForm({ title: 'Mr', name: '', email: '', mobile: '', colour: '' });
  };

  const handleCreateOrder = async () => {
    if (!orderModalTarget) return;
    if (!orderForm.name.trim()) {
      showToast('Please enter the customer name', 'error');
      return;
    }

    const colourOptions = coloursForVehicle(orderModalTarget.model, orderModalTarget.derivative);
    const selectedColour = colourOptions.find((entry) => entry.name === orderForm.colour);
    if (!orderModalTarget.colourLocked && colourOptions.length > 0 && !selectedColour) {
      showToast('Please select an exterior colour', 'error');
      return;
    }

    setCreatingOrder(true);
    try {
      const stockId = `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const created = await patchStage(stockId, 0, {
        vin: orderModalTarget.vin,
        registration: orderModalTarget.registration,
        make: orderModalTarget.make,
        model: orderModalTarget.model,
        derivative: orderModalTarget.derivative,
        colour: selectedColour?.name || orderModalTarget.colour,
        image: selectedColour?.image || orderModalTarget.image,
        isPreOrder: true,
        customerName: `${orderForm.title} ${orderForm.name}`.trim(),
        customerEmail: orderForm.email || undefined,
        customerMobile: orderForm.mobile || undefined,
      });
      setTracking((prev) => ({ ...prev, [created.stockId]: created }));
      showToast('Customer order created!', 'success');
      closeOrderModal();
    } catch (err) {
      console.error(err);
      showToast('Failed to create order', 'error');
    } finally {
      setCreatingOrder(false);
    }
  };

  const sortedStock = useMemo(
    () => [...stock].sort((a, b) => (a.vehicle?.model || '').localeCompare(b.vehicle?.model || '')),
    [stock]
  );

  // AutoTrader marks stock that hasn't physically arrived yet as "DUE_IN" — everything else
  // (FORECOURT, SALE_IN_PROGRESS, etc.) means the vehicle is already on site.
  const incomingStock = useMemo(
    () => sortedStock.filter((item) => item.metadata?.lifecycleState === 'DUE_IN'),
    [sortedStock]
  );

  const inShowroomStock = useMemo(
    () => sortedStock.filter((item) => item.metadata?.lifecycleState !== 'DUE_IN'),
    [sortedStock]
  );

  const orderColours = coloursForVehicle(orderModalTarget?.model, orderModalTarget?.derivative);
  const selectedOrderColour = orderColours.find((entry) => entry.name === orderForm.colour);

  const visibleStock = activeTab === 'showroom' ? inShowroomStock : incomingStock;
  const incomingCount = incomingStock.length + INCOMING_MODELS.length;

  // Incoming orders are tied to a catalog model (no VIN yet); showroom orders are tied
  // to a specific physical vehicle by VIN. This keeps the two kinds of orders separate.
  const preOrdersByModel = useMemo(() => {
    const map: Record<string, TrackingRecord[]> = {};
    Object.values(tracking).forEach((t) => {
      if (t.isPreOrder && t.model && !t.vin) {
        (map[t.model] ||= []).push(t);
      }
    });
    return map;
  }, [tracking]);

  const preOrdersByVin = useMemo(() => {
    const map: Record<string, TrackingRecord[]> = {};
    Object.values(tracking).forEach((t) => {
      if (t.isPreOrder && t.vin) {
        (map[t.vin] ||= []).push(t);
      }
    });
    return map;
  }, [tracking]);

  return (
    <div className="w-full px-3 sm:px-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
        <PageTitle title="Changan Tracker">
          Track Changan vehicles through to handover and share live status links with customers.
        </PageTitle>
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition shadow-sm text-sm disabled:opacity-50"
        >
          <FaSync size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-lg self-start mb-5 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('showroom')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            activeTab === 'showroom' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          In Showroom <span className="ml-1 text-xs opacity-60">({inShowroomStock.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('incoming')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            activeTab === 'incoming' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Incoming <span className="ml-1 text-xs opacity-60">({incomingCount})</span>
        </button>
      </div>

      {activeTab === 'incoming' && (
        <div className="space-y-4 mb-6">
          {INCOMING_MODELS.map((model) => {
            const orders = preOrdersByModel[model.name] || [];
            return (
              <div key={model.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <div className="w-full sm:w-32 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">{model.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-md border border-blue-100">
                        {model.powertrain}
                      </span>
                      {orders.length > 0 && (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs font-medium rounded-md border border-gray-200">
                          {orders.length} customer{orders.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openOrderModal({ label: model.name, make: 'Changan', model: model.name, image: model.image })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                    >
                      <FaPlus size={11} /> Add Customer Order
                    </button>
                  </div>
                </div>

                {orders.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    {orders.map((order) => (
                      <OrderCard
                        key={order.stockId}
                        order={order}
                        updatingId={updatingId}
                        copiedId={copiedId}
                        sendingOrderId={sendingOrderId}
                        confirmDeleteId={confirmDeleteId}
                        deletingOrderId={deletingOrderId}
                        onSetStage={handleSetOrderStage}
                        onCopy={copyTrackLink}
                        onSend={handleSendOrderLink}
                        onConfirmDelete={setConfirmDeleteId}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        onDelete={handleDeleteOrder}
                        onOpenRemark={openRemarkModal}
                        onChangeColour={handleChangeColour}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading && activeTab === 'showroom' ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : !loading && visibleStock.length === 0 && activeTab === 'showroom' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <FaCar className="text-gray-300" size={36} />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No vehicles in the showroom yet</h3>
          <p className="text-sm text-gray-400">Vehicles will move here automatically once marked as arrived.</p>
        </div>
      ) : visibleStock.length > 0 ? (
        <div className="space-y-4">
          {visibleStock.map((item) => {
            const stockId = item.metadata?.stockId;
            if (!stockId) return null;
            const image = item.media?.images?.[0]?.url || item.media?.images?.[0]?.href;
            const orders = (item.vehicle?.vin && preOrdersByVin[item.vehicle.vin]) || [];

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
                      {orders.length > 0 && (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs font-medium rounded-md border border-gray-200">
                          {orders.length} customer{orders.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openOrderModal({
                        label: `${item.vehicle?.make || ''} ${item.vehicle?.model || ''}`.trim(),
                        vin: item.vehicle?.vin,
                        registration: item.vehicle?.registration || undefined,
                        make: item.vehicle?.make,
                        model: item.vehicle?.model,
                        derivative: item.vehicle?.derivative,
                        colour: item.vehicle?.colour,
                        image,
                        colourLocked: true,
                      })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                    >
                      <FaPlus size={11} /> Add Customer Order
                    </button>
                  </div>
                </div>

                {orders.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    {orders.map((order) => (
                      <OrderCard
                        key={order.stockId}
                        order={order}
                        updatingId={updatingId}
                        copiedId={copiedId}
                        sendingOrderId={sendingOrderId}
                        confirmDeleteId={confirmDeleteId}
                        deletingOrderId={deletingOrderId}
                        onSetStage={handleSetOrderStage}
                        onCopy={copyTrackLink}
                        onSend={handleSendOrderLink}
                        onConfirmDelete={setConfirmDeleteId}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        onDelete={handleDeleteOrder}
                        onOpenRemark={openRemarkModal}
                        onChangeColour={handleChangeColour}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {sendModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Send Tracking Link</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sendModalItem.make} {sendModalItem.model}
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

      {orderModalTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b1220]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_80px_-24px_rgba(11,69,127,0.45)] animate-fade-in sm:max-w-[460px] sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b457f]">
                  {orderModalTarget.label}
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-gray-900">Add customer order</h3>
              </div>
              <button
                type="button"
                onClick={closeOrderModal}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Title</label>
                  <select
                    value={orderForm.title}
                    onChange={(e) => setOrderForm((p) => ({ ...p, title: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#0b457f] focus:ring-2 focus:ring-[#0b457f]/15"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Customer name</label>
                  <input
                    type="text"
                    value={orderForm.name}
                    onChange={(e) => setOrderForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="John Smith"
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#0b457f] focus:ring-2 focus:ring-[#0b457f]/15"
                  />
                </div>
              </div>

              {orderColours.length > 0 && selectedOrderColour && (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="bg-[#f4f7fb] px-4 py-5">
                    <img
                      src={selectedOrderColour.image}
                      alt={selectedOrderColour.name}
                      className="mx-auto h-32 w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Exterior colour</p>
                      <p className="truncate text-sm font-medium text-gray-900">{selectedOrderColour.name}</p>
                    </div>
                    {orderModalTarget.colourLocked ? (
                      <img
                        src={selectedOrderColour.swatch}
                        alt=""
                        className="h-7 w-7 rounded-full border-2 border-[#0b457f] ring-2 ring-[#0b457f]/20"
                      />
                    ) : (
                      <div className="flex flex-shrink-0 gap-1.5">
                        {orderColours.map((entry) => {
                          const active = entry.name === orderForm.colour;
                          return (
                            <button
                              key={entry.name}
                              type="button"
                              title={entry.name}
                              aria-label={entry.name}
                              aria-pressed={active}
                              onClick={() => setOrderForm((p) => ({ ...p, colour: entry.name }))}
                              className={`overflow-hidden rounded-full border-2 transition ${
                                active ? 'border-[#0b457f] ring-2 ring-[#0b457f]/20' : 'border-transparent hover:border-gray-300'
                              }`}
                            >
                              <img src={entry.swatch} alt="" className="h-7 w-7" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Email address</label>
                <input
                  type="email"
                  value={orderForm.email}
                  onChange={(e) => setOrderForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#0b457f] focus:ring-2 focus:ring-[#0b457f]/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Mobile number</label>
                <UKPhoneInput
                  value={orderForm.mobile}
                  onChange={(v) => setOrderForm((p) => ({ ...p, mobile: v }))}
                  className="h-11 border-gray-200 focus-within:border-[#0b457f] focus-within:ring-[#0b457f]/15"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-100 bg-[#f8fafc] px-6 py-4">
              <button
                type="button"
                onClick={closeOrderModal}
                className="h-11 flex-1 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={creatingOrder || !orderForm.name.trim()}
                className="h-11 flex-1 rounded-lg bg-[#0b457f] text-sm font-semibold text-white transition hover:bg-[#093864] disabled:opacity-50"
              >
                {creatingOrder ? 'Creating...' : 'Create order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {remarkTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Remark</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {tracking[remarkTarget.stockId]?.customerName || 'Customer'} · {TRACKING_STAGES[remarkTarget.stage]}
                </p>
              </div>
              <button type="button" onClick={closeRemarkModal} className="text-gray-400 hover:text-gray-600 transition">
                <FaTimes size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note for the customer at this step
                </label>
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Waiting on your signed finance documents"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Only shows on the customer&apos;s link once saved, and only at this step.
                </p>
              </div>

              {(() => {
                const existing = tracking[remarkTarget.stockId]?.remarks?.find((r) => r.stage === remarkTarget.stage);
                if (!existing?.customerReply) return null;
                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Customer replied</p>
                    <p className="text-sm text-emerald-800">{existing.customerReply}</p>
                    {existing.repliedAt && (
                      <p className="text-xs text-emerald-600 mt-1">
                        {new Date(existing.repliedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })},{' '}
                        {new Date(existing.repliedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRemarkModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRemark}
                  disabled={savingRemark || !remarkText.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {savingRemark ? 'Saving...' : 'Save Remark'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
