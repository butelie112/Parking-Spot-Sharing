'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
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
            {t.footer.termsOfService}
          </h1>
          <p className="text-gray-600 mt-2">
            {t.pages?.terms?.lastUpdated || "Last updated: November 2025"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
        {/* Introduction */}
        <div className="mb-8">
          <p className="text-gray-700 leading-relaxed">
            {t.pages?.terms?.introduction}
          </p>
        </div>

        {/* Terms Sections */}
        <div className="space-y-8">
          {/* 1. Definitions */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.definitions}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.definitionsContent}
            </div>
          </section>

          {/* 2. Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.acceptance}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.acceptanceText}
            </p>
          </section>

          {/* 3. Description of Services */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.services}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.servicesText}
            </div>
          </section>

          {/* 4. User Account */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.userAccount}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.userAccountText}
            </div>
          </section>

          {/* 5. Parking Space Listing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.parkingListing}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.parkingListingText}
            </div>
          </section>

          {/* 6. Bookings and Payments */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.bookingsPayments}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.bookingsPaymentsText}
            </div>
          </section>

          {/* 7. Commissions and Fees */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.commissionsFees}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.commissionsFeesText}
            </p>
          </section>

          {/* 8. Cancellation Policy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.cancellationPolicy}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.cancellationPolicyText}
            </p>
          </section>

          {/* 9. Liability and Limitations */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.liabilityLimitations}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.liabilityLimitationsText}
            </div>
          </section>

          {/* 10. Prohibitions */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.prohibitions}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.prohibitionsText}
            </div>
          </section>

          {/* 11. Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.intellectualProperty}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.intellectualPropertyText}
            </p>
          </section>

          {/* 12. Personal Data */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.personalData}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.personalDataText}
            </p>
          </section>

          {/* 13. Modification of Terms */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.modifications}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.modificationsText}
            </p>
          </section>

          {/* 14. Applicable Law and Jurisdiction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.applicableLaw}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t.pages?.terms?.applicableLawText}
            </p>
          </section>

          {/* 15. Contact */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t.pages?.terms?.contact}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {t.pages?.terms?.contactText}
            </div>
          </section>
        </div>
      </div>
      </div>
    </div>
  );
}
