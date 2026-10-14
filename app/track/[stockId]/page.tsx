'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  FaCar,
  FaCheck,
  FaClipboardCheck,
  FaFileInvoiceDollar,
  FaHandshake,
  FaKey,
  FaShieldAlt,
  FaShippingFast,
  FaWarehouse,
  FaWrench,
} from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { TRACKING_STAGE_DESCRIPTIONS } from '@/lib/trackingStages';
import { findExteriorColour } from '@/lib/exteriorColours';

const STAGE_ICONS: IconType[] = [
  FaClipboardCheck,
  FaShippingFast,
  FaWarehouse,
  FaFileInvoiceDollar,
  FaWrench,
  FaShieldAlt,
  FaKey,
  FaHandshake,
];

interface StageRemark {
  stage: number;
  text: string;
  createdAt: string;
  customerReply?: string;
  repliedAt?: string;
}

interface TrackingData {
  stockId: string;
  registration?: string;
  make?: string;
  model?: string;
  derivative?: string;
  colour?: string;
  image?: string;
  currentStage: number;
  updatedAt: string;
  stages: string[];
  customerName?: string;
  remarks?: StageRemark[];
}

export default function VehicleTrackingPage() {
  const params = useParams();
  const stockId = params.stockId as string;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [sendingReplyStage, setSendingReplyStage] = useState<number | null>(null);
  const [shownProgress, setShownProgress] = useState(0);
  const shownRef = useRef(0);
  const barFrame = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const fetchTracking = async (isInitial: boolean) => {
      try {
        const res = await fetch(`/api/vehicle-tracking/${stockId}`);
        if (!res.ok) {
          if (isMounted && isInitial) setNotFound(true);
          return;
        }
        const json = await res.json();
        if (isMounted) setData(json);
      } catch {
        if (isMounted && isInitial) setNotFound(true);
      } finally {
        if (isMounted && isInitial) setLoading(false);
      }
    };

    fetchTracking(true);
    const interval = setInterval(() => fetchTracking(false), 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [stockId]);

  useEffect(() => {
    if (!data) return;
    const to = data.stages.length <= 1 ? 100 : (data.currentStage / (data.stages.length - 1)) * 100;
    const from = shownRef.current;
    if (Math.abs(to - from) < 0.4) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cancelAnimationFrame(barFrame.current);
    if (reduce) {
      shownRef.current = to;
      setShownProgress(to);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      shownRef.current = value;
      setShownProgress(value);
      if (t < 1) barFrame.current = requestAnimationFrame(tick);
    };
    barFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(barFrame.current);
  }, [data]);

  const handleSendReply = async (stage: number) => {
    const reply = (replyDrafts[stage] || '').trim();
    if (!reply) return;
    setSendingReplyStage(stage);
    try {
      const res = await fetch(`/api/vehicle-tracking/${stockId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, reply }),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      setData((prev) => {
        if (!prev) return prev;
        const remarks = (prev.remarks || []).map((r) =>
          r.stage === stage ? { ...r, customerReply: reply, repliedAt: new Date().toISOString() } : r
        );
        return { ...prev, remarks };
      });
      setReplyDrafts((prev) => ({ ...prev, [stage]: '' }));
    } catch {
      alert('Failed to send your reply. Please try again.');
    } finally {
      setSendingReplyStage(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fb]">
        <div className="animate-pulse font-semibold text-[#0b457f]">Loading status...</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-red-600 text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Status Unavailable</h2>
        <p className="text-gray-500 max-w-md">
          We couldn&apos;t find a tracking status for this vehicle. Call the Heathrow showroom and we&apos;ll update you.
        </p>
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <a href="tel:+442085648030" className="bg-[#0b457f] text-white px-6 py-3 font-bold tracking-wide hover:bg-[#083460] transition">Call 020 8564 8030</a>
          <a href="mailto:changan@hestonautomotive.com" className="bg-white text-[#282828] border border-[#d2d2d2] px-6 py-3 font-bold tracking-wide hover:bg-[#f4f7fb] transition">Email Us</a>
        </div>
      </div>
    );
  }

  const vehicleName = [data.make, data.model].filter(Boolean).join(' ') || 'vehicle';
  const customerName = data.customerName?.trim();
  const exterior = findExteriorColour(data.model, data.derivative, data.colour);
  const readyIndex = data.stages.length - 2;
  const handoverIndex = data.stages.length - 1;

  return (
    <div className="min-h-screen bg-[#eef3f6] flex flex-col">
      <header className="gradient-changan px-6 py-10 sm:px-8">
        <a href="https://www.changanheathrow.co.uk/" className="mx-auto flex w-full max-w-xs items-center justify-center sm:max-w-sm">
          <img src="/heston-changan-logo-light.png" alt="Changan Heathrow" className="h-auto w-full object-contain" />
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center px-3 py-4 sm:px-4 sm:py-6 md:p-8">
        <div className="w-full max-w-2xl">
          {exterior ? (
            <div className="mb-2 px-4 py-6 sm:px-8 sm:py-8">
              <img
                src={exterior.image}
                alt={`${vehicleName} in ${exterior.name}`}
                className="mx-auto w-full max-w-lg object-contain"
              />
            </div>
          ) : null}

          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-changan text-2xl font-normal text-[#282828] sm:text-3xl lg:text-4xl mb-1 sm:mb-2">
              {customerName ? `Hello, ${customerName}` : `Your ${vehicleName}`}
            </h1>
            <p className="mt-3 text-sm text-[#505050] sm:text-base">
              {customerName ? `Your ${vehicleName}. ` : ''}
              Follow your car from order through to handover at Changan Heathrow.
            </p>
          </div>

          {exterior ? null : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-5 sm:mb-6">
              <div className="flex items-center gap-4">
                {data.image ? (
                  <img src={data.image} alt="" className="w-28 sm:w-44 h-auto rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-28 h-24 sm:w-44 sm:h-36 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300">
                    <FaCar size={36} />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-base sm:text-lg">
                    {data.make} {data.model}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{data.derivative}</p>
                  {data.colour && <p className="text-xs sm:text-sm text-gray-500">{data.colour}</p>}
                  {data.registration && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-xs rounded-md border border-blue-100">
                      {data.registration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(11,69,127,0.06)] px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-end justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b457f]">Order Progress</p>
              <p className="text-xs text-[#505050]">
                Stage {data.currentStage + 1} of {data.stages.length}
                <span className="ml-2 font-semibold tabular-nums text-[#0b457f]">{Math.round(shownProgress)}%</span>
              </p>
            </div>
            <div className="relative mb-8 h-1.5 w-full rounded-full bg-[#e7eef5]">
              <div
                className="track-bar absolute inset-y-0 left-0 overflow-hidden rounded-full"
                style={{ width: `${shownProgress}%` }}
              />
              {shownProgress > 2 && (
                <span
                  className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b457f] bg-white shadow-[0_0_0_4px_rgba(11,69,127,0.12)]"
                  style={{ left: `${Math.min(shownProgress, 100)}%` }}
                />
              )}
            </div>

            <ol>
              {data.stages.map((label, idx) => {
                const isDone = idx < data.currentStage;
                const isCurrent = idx === data.currentStage;
                const isLast = idx === data.stages.length - 1;
                const remark = data.remarks?.find((r) => r.stage === idx);
                const Icon = STAGE_ICONS[idx] || FaCar;
                return (
                  <li
                    key={label}
                    className="track-step relative flex gap-4 pb-7 last:pb-0"
                    style={{ animationDelay: `${idx * 70}ms` }}
                  >
                    {!isLast && (
                      <span
                        className={`absolute left-5 top-11 bottom-0 w-px -translate-x-1/2 ${
                          isDone ? 'bg-[#0b457f]' : 'bg-[#e2e6ea]'
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${
                        isDone
                          ? 'bg-[#0b457f] text-white'
                          : isCurrent
                          ? 'track-current-icon bg-[#0b457f] text-white'
                          : 'bg-[#f4f7fb] text-[#a0a0a0]'
                      }`}
                    >
                      {isDone ? <FaCheck size={13} /> : <Icon size={15} />}
                    </span>
                    <div className="min-w-0 pt-2">
                      <p
                        className={`font-changan font-normal text-sm sm:text-base leading-snug ${
                          isCurrent ? 'text-[#0b457f]' : isDone ? 'text-[#282828]' : 'text-[#a0a0a0]'
                        }`}
                      >
                        {label}
                      </p>
                      {isCurrent && (
                        <p className="mt-1 text-sm text-[#505050] leading-relaxed">
                          {TRACKING_STAGE_DESCRIPTIONS[idx]}
                        </p>
                      )}

                      {remark && (
                        <div className="mt-2.5 max-w-md border-l-2 border-[#0b457f] pl-3">
                          <p className="text-sm text-[#282828]">{remark.text}</p>

                          {remark.customerReply ? (
                            <p className="mt-1.5 text-sm text-[#505050]">
                              <span className="font-medium text-[#282828]">You: </span>
                              {remark.customerReply}
                            </p>
                          ) : (
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={replyDrafts[idx] || ''}
                                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [idx]: e.target.value }))}
                                placeholder="Write a reply"
                                className="flex-1 min-w-0 bg-transparent border-b border-[#d2d2d2] px-0 py-1.5 text-sm focus:outline-none focus:border-[#0b457f]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSendReply(idx)}
                                disabled={sendingReplyStage === idx || !(replyDrafts[idx] || '').trim()}
                                className="text-xs font-semibold uppercase tracking-wide text-[#0b457f] disabled:opacity-40"
                              >
                                {sendingReplyStage === idx ? '...' : 'Reply'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {data.currentStage === readyIndex && (
            <p className="mt-5 text-sm text-[#505050] text-center">
              <span className="font-semibold text-[#0b457f]">Ready for collection.</span>{' '}
              Your {vehicleName} is ready. We&apos;ll be in touch to arrange a time at Changan Heathrow.
            </p>
          )}

          {data.currentStage === handoverIndex && (
            <p className="mt-5 text-sm text-[#505050] text-center">
              <span className="font-semibold text-[#0b457f]">Handover complete.</span>{' '}
              Congratulations on your new {vehicleName}. Thank you for choosing Changan Heathrow.
            </p>
          )}

          <p className="text-center text-xs text-[#a0a0a0] mt-6">
            Last updated {new Date(data.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}Questions? Call <a href="tel:+442085648030" className="text-[#0b457f] hover:underline">020 8564 8030</a>
            {' · '}
            <a href="mailto:changan@hestonautomotive.com" className="text-[#0b457f] hover:underline">changan@hestonautomotive.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}
