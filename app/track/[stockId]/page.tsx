'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  FaCar,
  FaClipboardCheck,
  FaFileInvoiceDollar,
  FaHandshake,
  FaKey,
  FaPhone,
  FaShieldAlt,
  FaShippingFast,
  FaWarehouse,
  FaWrench,
} from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { FINANCE_STEP_COMPLETE_DESCRIPTION, GOOGLE_REVIEW_URL, TRACKING_STAGE_CUSTOMER_LABELS, TRACKING_STAGE_DESCRIPTIONS } from '@/lib/trackingStages';
import { findExteriorColour } from '@/lib/exteriorColours';
import CarStepReveal from '@/components/CarStepReveal';

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
  reviewEnabled?: boolean;
}

export default function VehicleTrackingPage() {
  const params = useParams();
  const stockId = params.stockId as string;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
              <CarStepReveal
                src={exterior.image}
                alt={`${vehicleName} in ${exterior.name}`}
                progress={shownProgress}
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
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 pt-2">
                      <p
                        className={`font-changan font-normal text-sm sm:text-base leading-snug ${
                          isCurrent ? 'text-[#0b457f]' : isDone ? 'text-[#282828]' : 'text-[#a0a0a0]'
                        }`}
                      >
                        {TRACKING_STAGE_CUSTOMER_LABELS[idx] || label}
                      </p>
                      {isCurrent && (
                        <div className="mt-1">
                          <p className="text-sm text-[#505050] leading-relaxed">
                            {TRACKING_STAGE_DESCRIPTIONS[idx]}
                          </p>
                          {idx === TRACKING_STAGE_CUSTOMER_LABELS.length - 1 && data.reviewEnabled ? (
                            <>
                              <p className="mt-2 text-sm text-[#505050] leading-relaxed">
                                Thank you again for your business, and enjoy your new car! If you loved your experience, we would highly appreciate it if you could leave us a quick review to help others find us.
                              </p>
                              <a
                                href={GOOGLE_REVIEW_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d2d2d2] bg-white px-4 py-2 text-sm font-semibold text-[#282828]"
                              >
                                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
                                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
                                  <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.3 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
                                </svg>
                                Leave a review
                              </a>
                            </>
                          ) : idx === TRACKING_STAGE_CUSTOMER_LABELS.length - 1 ? (
                            <p className="mt-2 text-sm text-[#505050] leading-relaxed">
                              Thank you again for your business, and enjoy your new car!
                            </p>
                          ) : idx === 5 ? (
                            <a
                              href="tel:+442051788030"
                              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d2d2d2] bg-white px-4 py-2 text-sm font-semibold text-[#282828]"
                            >
                              <FaPhone size={13} />
                              Contact us
                            </a>
                          ) : null}
                        </div>
                      )}
                      {isDone && idx === 3 && (
                        <p className="mt-1 text-sm text-[#505050] leading-relaxed">
                          {FINANCE_STEP_COMPLETE_DESCRIPTION}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

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
