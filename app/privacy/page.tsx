'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#00C48C] hover:text-[#00b37d] font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.common.back}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {t.footer.privacyPolicy}
          </h1>
          <p className="text-gray-600 mt-2">
            {t.pages?.privacy?.lastUpdated || "Last updated: November 2025"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Introduction */}
          <div className="mb-8">
            <p className="text-gray-700 leading-relaxed mb-4">
              {t.pages?.privacy?.introduction}
            </p>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.privacy?.consent}
            </p>
          </div>

          {/* Privacy Sections */}
          <div className="space-y-8">
            {/* 1. Information Collected */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.informationCollected}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.informationCollectedText}
              </div>
            </section>

            {/* 2. How We Use */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.howWeUse}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.howWeUseText}
              </div>
            </section>

            {/* 3. Legal Basis */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.legalBasis}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.legalBasisText}
              </div>
            </section>

            {/* 4. Data Disclosure */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.dataDisclosure}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.dataDisclosureText}
              </div>
            </section>

            {/* 5. Data Storage */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.dataStorage}
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {t.pages?.privacy?.dataStorageText}
              </p>
            </section>

            {/* 6. Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.cookies}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.cookiesText}
              </div>
            </section>

            {/* 7. User Rights */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.userRights}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.userRightsText}
              </div>
            </section>

            {/* 8. External Services */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.externalServices}
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {t.pages?.privacy?.externalServicesText}
              </p>
            </section>

            {/* 9. Minors Privacy */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.minorsPrivacy}
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {t.pages?.privacy?.minorsPrivacyText}
              </p>
            </section>

            {/* 10. Policy Changes */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.policyChanges}
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {t.pages?.privacy?.policyChangesText}
              </p>
            </section>

            {/* 11. Contact */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t.pages?.privacy?.contact}
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {t.pages?.privacy?.contactText}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
