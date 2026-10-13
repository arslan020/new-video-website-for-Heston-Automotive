'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FaCheck, FaCar, FaCheckCircle } from 'react-icons/fa';

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
}

export default function VehicleTrackingPage() {
  const params = useParams();
  const stockId = params.stockId as string;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

    return () => { isMounted = false; clearInterval(interval); };
  }, [stockId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-blue-800 font-semibold">Loading tracking status...</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-red-600 text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Tracking Unavailable</h2>
        <p className="text-gray-500 max-w-md">
          We couldn&apos;t find a tracking status for this vehicle. Please contact Heston Automotive for an update.
        </p>
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <a href="tel:02085648030" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg">Call 020 8564 8030</a>
          <a href="mailto:enquiries@hestonautomotive.com" className="bg-white text-gray-700 border border-gray-200 px-6 py-3 rounded-lg font-bold hover:bg-gray-50 transition">Email Us</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans">
      <header className="bg-white shadow-sm py-3 px-4 flex justify-center sticky top-0 z-30">
        <img src="/business-logo.webp" alt="Changan Heston Automotive" className="h-6 sm:h-8 md:h-9 object-contain max-w-full" />
      </header>

      <main className="flex-1 flex flex-col items-center px-3 py-4 sm:px-4 sm:py-6 md:p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
              Your Vehicle Status
            </h1>
            <p className="text-sm sm:text-base text-gray-500">
              Track your vehicle&apos;s progress before handover.
            </p>
          </div>

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
                {data.registration && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-xs rounded-md border border-blue-100">
                    {data.registration}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-8">
            <ol className="relative">
              {data.stages.map((label, idx) => {
                const isDone = idx < data.currentStage;
                const isCurrent = idx === data.currentStage;
                const isLast = idx === data.stages.length - 1;
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
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full border border-blue-100">
                            Current Stage
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {data.currentStage === data.stages.length - 1 && (
            <div className="mt-5 sm:mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex items-start gap-3">
              <FaCheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="font-bold text-emerald-800 text-sm sm:text-base">Your car is ready! 🎉</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Great news, your {data.make} {data.model} is ready for handover. We&apos;ll be in touch shortly to arrange a convenient time, or call us to book your collection.
                </p>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Last updated {new Date(data.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}Questions? Call <a href="tel:02085648030" className="text-blue-600 hover:underline">020 8564 8030</a>
          </p>
        </div>
      </main>
    </div>
  );
}
