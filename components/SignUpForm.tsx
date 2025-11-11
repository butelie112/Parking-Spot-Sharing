'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type SignUpFormProps = {
  onSwitchToLogin: () => void;
};

export function SignUpForm({ onSwitchToLogin }: SignUpFormProps) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Validation
    if (!fullName.trim()) {
      setMessage({ type: 'error', text: t.auth.signup.enterFullName });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: t.auth.signup.passwordTooShort });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: t.auth.signup.passwordMismatch });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        setMessage({ 
          type: 'success', 
          text: t.auth.signup.accountCreated 
        });
        
        // Switch to login after 2 seconds
        setTimeout(() => {
          onSwitchToLogin();
        }, 2000);
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || t.auth.signup.accountCreationFailed 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-5 sm:space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t.auth.signup.title}</h2>
        <p className="text-sm sm:text-base text-gray-600">{t.auth.signup.subtitle}</p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            {t.auth.signup.fullName}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
              placeholder={t.auth.signup.fullNamePlaceholder}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            {t.auth.signup.email}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                placeholder={t.auth.signup.emailPlaceholder}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            {t.auth.signup.password}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
              placeholder={t.auth.signup.passwordPlaceholder}
            />
          </div>
          <p className="text-xs text-gray-500">{t.auth.signup.passwordHint}</p>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            {t.auth.signup.confirmPassword}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
              placeholder={t.auth.signup.confirmPasswordPlaceholder}
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
              {t.auth.signup.creatingAccount}
            </>
          ) : (
            <>
              {t.auth.signup.createButton}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Switch to Login */}
      <div className="text-center">
        <p className="text-gray-600">
          {t.auth.signup.alreadyHaveAccount}{' '}
          <button
            onClick={onSwitchToLogin}
            type="button"
            className="text-[#007BFF] hover:text-[#0056b3] font-semibold transition-colors cursor-pointer hover:underline"
          >
            {t.auth.signup.signIn}
          </button>
        </p>
      </div>
    </div>
  );
}

