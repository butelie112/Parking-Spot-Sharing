'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { LoginForm } from '@/components/LoginForm';
import { SignUpForm } from '@/components/SignUpForm';
import { ParkingGrid } from '@/components/ParkingGrid';
import { LogOut, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const [showSignUp, setShowSignUp] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#007BFF] via-[#00C48C] to-[#007BFF]">
        <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
          <Loader2 className="animate-spin h-12 w-12 text-[#00C48C] mx-auto mb-4" />
          <p className="text-[#2E2E2E] font-medium">{t.common.loading} Parkezz...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showSignUp) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#007BFF] via-[#00C48C] to-[#007BFF] p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md backdrop-blur-lg bg-opacity-95">
            <SignUpForm onSwitchToLogin={() => setShowSignUp(false)} />
          </div>
        </div>
      );
    }
    return <LoginForm onSwitchToSignUp={() => setShowSignUp(true)} />;
  }

  return (
    <div className="relative">
      <ParkingGrid />
    </div>
  );
}
