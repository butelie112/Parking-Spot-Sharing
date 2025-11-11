'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkIfInstalled = () => {
      if (typeof window !== 'undefined') {
        // Check if running in standalone mode (installed PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        // Check if installed via related apps
        const isRelatedApp = (window.navigator as any).getInstalledRelatedApps &&
          (window.navigator as any).getInstalledRelatedApps().then((apps: any[]) => apps.length > 0);

        setIsInstalled(isStandalone || !!isRelatedApp);
      }
    };

    checkIfInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
        setIsInstalled(true);
      } else {
        console.log('User dismissed the install prompt');
        setShowInstallPrompt(false);
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Store that user dismissed to avoid showing again immediately
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or dismissed recently
  const dismissedTime = localStorage.getItem('pwa-install-dismissed');
  const recentlyDismissed = dismissedTime && (Date.now() - parseInt(dismissedTime)) < (24 * 60 * 60 * 1000); // 24 hours

  if (isInstalled || !showInstallPrompt || recentlyDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 backdrop-blur-lg bg-opacity-95">
        <div className="flex items-start gap-3">
          {/* App Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-[#00C48C] to-[#007BFF] rounded-xl flex items-center justify-center flex-shrink-0">
            <img
              src="/icon-192.png"
              alt="Parkezz"
              className="w-8 h-8 rounded-lg"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">Install Parkezz</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Get the full app experience with offline access, faster loading, and easy access from your home screen.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-[#00C48C] to-[#007BFF] text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 p-2 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

