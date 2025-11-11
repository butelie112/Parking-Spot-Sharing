'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import { Language } from '@/i18n';

export function Footer() {
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Copyright */}
          <div className="text-xs sm:text-sm text-gray-600">
            {t.footer.copyright}
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-600" />
            <select
              value={language}
              onChange={handleLanguageChange}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none bg-white text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
              aria-label={t.footer.changeLanguage}
            >
              <option value="ro">🇷🇴 Română</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
        </div>
      </div>
    </footer>
  );
}
