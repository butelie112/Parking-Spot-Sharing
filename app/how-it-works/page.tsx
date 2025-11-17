'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, MapPin, Search, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: <MapPin className="w-8 h-8" />,
      title: t.pages?.howItWorks?.step1Title || "Find Parking Spots",
      description: t.pages?.howItWorks?.step1Desc || "Browse available parking spots on our interactive map. Use filters to find the perfect spot that matches your needs."
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: t.pages?.howItWorks?.step2Title || "Book Your Spot",
      description: t.pages?.howItWorks?.step2Desc || "Select your preferred dates and times. Send a booking request to the spot owner and wait for approval."
    },
    {
      icon: <CreditCard className="w-8 h-8" />,
      title: t.pages?.howItWorks?.step3Title || "Pay Securely",
      description: t.pages?.howItWorks?.step3Desc || "Once approved, pay through our secure platform. Funds are held safely until your booking is complete."
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      title: t.pages?.howItWorks?.step4Title || "Park with Confidence",
      description: t.pages?.howItWorks?.step4Desc || "Arrive at your designated time and enjoy your reserved parking spot. Get directions right in the app."
    }
  ];

  const features = [
    {
      title: t.pages?.howItWorks?.feature1Title || "For Drivers",
      description: t.pages?.howItWorks?.feature1Desc || "Find and book available parking spots easily. Never worry about finding parking again.",
      benefits: [
        t.pages?.howItWorks?.driverBenefit1 || "Real-time availability",
        t.pages?.howItWorks?.driverBenefit2 || "Secure payments",
        t.pages?.howItWorks?.driverBenefit3 || "GPS directions",
        t.pages?.howItWorks?.driverBenefit4 || "Instant booking confirmations"
      ]
    },
    {
      title: t.pages?.howItWorks?.feature2Title || "For Spot Owners",
      description: t.pages?.howItWorks?.feature2Desc || "Share your unused parking space and earn extra income. Set your own schedule and prices.",
      benefits: [
        t.pages?.howItWorks?.ownerBenefit1 || "Flexible scheduling",
        t.pages?.howItWorks?.ownerBenefit2 || "Set your own rates",
        t.pages?.howItWorks?.ownerBenefit3 || "Easy management",
        t.pages?.howItWorks?.ownerBenefit4 || "Secure payments"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#00C48C] hover:text-[#00b37d] font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.common.back}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {t.pages?.howItWorks?.title || "How Parkezz Works"}
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            {t.pages?.howItWorks?.subtitle || "Simple parking sharing made easy"}
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#00C48C] to-[#007BFF] text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            {t.pages?.howItWorks?.heroTitle || "Find Parking, Share Spaces, Save Time"}
          </h2>
          <p className="text-xl opacity-90 max-w-3xl mx-auto">
            {t.pages?.howItWorks?.heroDesc || "Parkezz connects drivers with available parking spots and helps property owners monetize their unused spaces."}
          </p>
        </div>
      </div>

      {/* How It Works Steps */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t.pages?.howItWorks?.howItWorksTitle || "How It Works"}
          </h2>
          <p className="text-gray-600 text-lg">
            {t.pages?.howItWorks?.howItWorksDesc || "Getting started with Parkezz is simple. Follow these easy steps."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm p-6 text-center">
              <div className="w-16 h-16 bg-[#00C48C] text-white rounded-full flex items-center justify-center mx-auto mb-4">
                {step.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t.pages?.howItWorks?.featuresTitle || "Built for Everyone"}
            </h2>
            <p className="text-gray-600 text-lg">
              {t.pages?.howItWorks?.featuresDesc || "Whether you're looking for parking or want to share your space, Parkezz has you covered."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>
                <ul className="space-y-3">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <li key={benefitIndex} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-[#00C48C] mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-[#00C48C] to-[#007BFF] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            {t.pages?.howItWorks?.ctaTitle || "Ready to Get Started?"}
          </h2>
          <p className="text-xl opacity-90 mb-8">
            {t.pages?.howItWorks?.ctaDesc || "Join thousands of users who have already discovered the convenience of Parkezz."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-8 py-4 bg-white text-[#00C48C] font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
          >
            {t.pages?.howItWorks?.ctaButton || "Start Using Parkezz"}
          </Link>
        </div>
      </div>
    </div>
  );
}
