'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FaCheck, FaCar, FaCheckCircle } from 'react-icons/fa';
import { TRACKING_STAGE_DESCRIPTIONS } from '@/lib/trackingStages';
import { findExteriorColour } from '@/lib/exteriorColours';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-blue-800 font-semibold">Loading status...</div>
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
          <a href="tel:+442085648030" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg">Call 020 8564 8030</a>
          <a href="mailto:changan@hestonautomotive.com" className="bg-white text-gray-700 border border-gray-200 px-6 py-3 rounded-lg font-bold hover:bg-gray-50 transition">Email Us</a>
        </div>
      </div>
    );
  }

  const vehicleName = [data.make, data.model].filter(Boolean).join(' ') || 'vehicle';
  const exterior = findExteriorColour(data.model, data.derivative, data.colour);
  const readyIndex = data.stages.length - 2;
  const handoverIndex = data.stages.length - 1;
  const progress = data.stages.length <= 1 ? 100 : Math.round((data.currentStage / (data.stages.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans">
      <header className="bg-white shadow-sm py-3 px-4 flex justify-center sticky top-0 z-30">
        <img src="/business-logo.webp" alt="Changan Heston Automotive" className="h-6 sm:h-8 md:h-9 object-contain max-w-full" />
      </header>

      <main className="flex-1 flex flex-col items-center px-3 py-4 sm:px-4 sm:py-6 md:p-8">
        <div className="w-full max-w-2xl">
          {exterior ? (
            <div className="bg-[#f4f7fb] rounded-xl mb-6 px-4 py-6 sm:px-8 sm:py-8">
              <img
                src={exterior.image}
                alt={`${vehicleName} in ${exterior.name}`}
                className="mx-auto w-full max-w-lg object-contain"
              />
            </div>
          ) : null}

          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
              Your {vehicleName}
            </h1>
            <p className="text-sm sm:text-base text-gray-500">
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Order Progress</p>
              <p className="text-xs font-medium text-gray-400">
                Stage {data.currentStage + 1} of {data.stages.length}
              </p>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full mb-8">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>

            <ol className="relative">
              {data.stages.map((label, idx) => {
                const isDone = idx < data.currentStage;
                const isCurrent = idx === data.currentStage;
                const isLast = idx === data.stages.length - 1;
                const remark = data.remarks?.find((r) => r.stage === idx);
                return (
                  <li key={label} className="relative pb-8 last:pb-0">
                    {!isLast && (
                      <span
                        className={`absolute left-[15px] top-8 w-0.5 h-full ${
                          isDone ? 'bg-emerald-400' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    <div className="flex items-start gap-4">
                      <span
                        className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isCurrent
                            ? 'bg-blue-600 border-blue-600 text-white animate-pulse'
                            : 'bg-white border-gray-300 text-gray-300'
                        }`}
                      >
                        {isDone ? <FaCheck size={12} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                      </span>
                      <div className="pt-0.5">
                        <p
                          className={`font-semibold text-sm sm:text-base ${
                            isCurrent ? 'text-blue-700' : isDone ? 'text-gray-700' : 'text-gray-400'
                          }`}
                        >
                          {label}
                        </p>
                        {isCurrent && (
                          <>
                            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                              {TRACKING_STAGE_DESCRIPTIONS[idx]}
                            </p>
                            <span className="inline-block mt-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full border border-blue-100">
                              Current Stage
                            </span>
                          </>
                        )}

                        {remark && (
                          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 max-w-md">
                            <p className="text-sm text-gray-700">{remark.text}</p>

                            {remark.customerReply ? (
                              <div className="mt-2 pt-2 border-t border-blue-100">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Your reply</p>
                                <p className="text-sm text-gray-700">{remark.customerReply}</p>
                              </div>
                            ) : (
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="text"
                                  value={replyDrafts[idx] || ''}
                                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [idx]: e.target.value }))}
                                  placeholder="Type a reply..."
                                  className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(idx)}
                                  disabled={sendingReplyStage === idx || !(replyDrafts[idx] || '').trim()}
                                  className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex-shrink-0"
                                >
                                  {sendingReplyStage === idx ? '...' : 'Reply'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {data.currentStage === readyIndex && (
            <div className="mt-5 sm:mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex items-start gap-3">
              <FaCheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="font-bold text-emerald-800 text-sm sm:text-base">Ready for collection! 🎉</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Your {vehicleName} is ready. We&apos;ll be in touch to arrange a time at Changan Heathrow.
                </p>
              </div>
            </div>
          )}

          {data.currentStage === handoverIndex && (
            <div className="mt-5 sm:mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex items-start gap-3">
              <FaCheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="font-bold text-emerald-800 text-sm sm:text-base">Handover complete! 🎉</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Congratulations on your new {vehicleName}. Thank you for choosing Changan Heathrow.
                </p>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Last updated {new Date(data.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}Questions? Call <a href="tel:+442085648030" className="text-blue-600 hover:underline">020 8564 8030</a>
            {' · '}
            <a href="mailto:changan@hestonautomotive.com" className="text-blue-600 hover:underline">changan@hestonautomotive.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}
