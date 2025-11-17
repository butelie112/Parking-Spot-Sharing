'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import { Language } from '@/i18n';
import Link from 'next/link';

export function Footer() {
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between py-4">
          {/* Links Section */}
          <div className="flex items-center gap-6">
            <Link
              href="/how-it-works"
              className="text-sm text-gray-600 hover:text-[#00C48C] font-medium transition-colors"
            >
              {t.footer.howItWorks}
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/contact"
              className="text-sm text-gray-600 hover:text-[#00C48C] font-medium transition-colors"
            >
              {t.footer.contact}
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/terms"
              className="text-sm text-gray-600 hover:text-[#00C48C] font-medium transition-colors"
            >
              {t.footer.termsOfService}
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/privacy"
              className="text-sm text-gray-600 hover:text-[#00C48C] font-medium transition-colors"
            >
              {t.footer.privacyPolicy}
            </Link>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-6">
            {/* Copyright */}
            <span className="text-sm text-gray-500">
              {t.footer.copyright}
            </span>
            
            {/* Language Selector */}
            <div className="flex items-center gap-2 pl-6 border-l border-gray-200">
              <Globe className="w-4 h-4 text-gray-600" />
              <select
                value={language}
                onChange={handleLanguageChange}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none bg-white text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors font-medium"
                aria-label={t.footer.changeLanguage}
              >
                <option value="ro">🇷🇴 Română</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="sm:hidden py-4 space-y-4">
          {/* Links Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/how-it-works"
              className="text-center py-2 px-3 text-sm text-gray-600 hover:text-[#00C48C] hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              {t.footer.howItWorks}
            </Link>
            <Link
              href="/contact"
              className="text-center py-2 px-3 text-sm text-gray-600 hover:text-[#00C48C] hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              {t.footer.contact}
            </Link>
            <Link
              href="/terms"
              className="text-center py-2 px-3 text-sm text-gray-600 hover:text-[#00C48C] hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              {t.footer.termsOfService}
            </Link>
            <Link
              href="/privacy"
              className="text-center py-2 px-3 text-sm text-gray-600 hover:text-[#00C48C] hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              {t.footer.privacyPolicy}
            </Link>
          </div>

          {/* Bottom Row */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            {/* Copyright */}
            <span className="text-xs text-gray-500">
              {t.footer.copyright}
            </span>
            
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-600" />
              <select
                value={language}
                onChange={handleLanguageChange}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none bg-white text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors font-medium"
                aria-label={t.footer.changeLanguage}
              >
                <option value="ro">🇷🇴 RO</option>
                <option value="en">🇬🇧 EN</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
