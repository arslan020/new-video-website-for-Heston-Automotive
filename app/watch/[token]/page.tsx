'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [status, setStatus] = useState<'loading' | 'invalid' | 'expired'>('loading');

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`/api/magic-links/${token}`);
        if (res.status === 410) { setStatus('expired'); return; }
        if (!res.ok) { setStatus('invalid'); return; }
        const data = await res.json();
        if (data._id) {
          router.replace(`/view/${data._id}`);
        } else {
          setStatus('invalid');
        }
      } catch {
        setStatus('invalid');
      }
    };
    verify();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400">Loading your video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 sm:p-8">
      <div className="text-center text-white max-w-sm sm:max-w-md px-2">
        <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">{status === 'expired' ? '⏰' : '❌'}</div>
        <h1 className="text-xl sm:text-2xl font-bold mb-3">
          {status === 'expired' ? 'Link Expired' : 'Invalid Link'}
        </h1>
        <p className="text-gray-400 text-sm sm:text-base">
          {status === 'expired'
            ? 'This magic link has expired. Please contact the dealership to get a new one.'
            : 'This link is invalid or has already been used.'}
        </p>
      </div>
    </div>
  );
}
