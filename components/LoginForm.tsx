'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, ArrowRight, Loader2, Car } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type LoginFormProps = {
  onSwitchToSignUp: () => void;
};

export function LoginForm({ onSwitchToSignUp }: LoginFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setMessage({ type: 'success', text: t.auth.login.loginSuccess });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || t.auth.login.invalidCredentials,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#007BFF] via-[#00C48C] to-[#007BFF] p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md backdrop-blur-lg bg-opacity-95">
        {/* Logo & Title */}
        <div className="text-center mb-6 sm:mb-8 space-y-4 sm:space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-center mx-auto">
            <img 
              src="/logo-login.png" 
              alt="Parkezz Logo" 
              className="w-24 sm:w-32 h-auto object-contain transform hover:scale-105 transition-transform"
            />
          </div>
          <div>
            <p className="text-[#2E2E2E] text-base sm:text-lg">{t.auth.login.subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t.auth.login.email}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                placeholder={t.auth.login.emailPlaceholder}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t.auth.login.password}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                placeholder={t.auth.login.passwordPlaceholder}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00C48C] hover:bg-[#00b37d] text-white font-semibold py-3 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.auth.login.signingIn}
              </>
            ) : (
              <>
                {t.auth.login.signInButton}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div
            className={`mt-4 p-4 rounded-xl text-sm font-medium animate-in fade-in duration-300 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Switch to SignUp */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {t.auth.login.noAccount}{' '}
            <button
              onClick={onSwitchToSignUp}
              type="button"
              className="text-[#007BFF] hover:text-[#0056b3] font-semibold transition-colors cursor-pointer hover:underline"
            >
              {t.auth.login.createAccount}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
