'use client';

import { useState, useEffect } from 'react';
import { FaDownload } from 'react-icons/fa';

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      (deferredPrompt as any).prompt();
      await (deferredPrompt as any).userChoice;
      setDeferredPrompt(null);
    } else {
      alert('App is likely already installed or your browser is blocking the install prompt. Check your address bar for the install icon.');
    }
  };

  if (isInstalled) return null;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Install App</h3>
      <p className="text-sm text-gray-500 mb-4">
        Install this application on your device for a better experience.
      </p>
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200"
      >
        <FaDownload />
        Install App
      </button>
    </div>
  );
}
