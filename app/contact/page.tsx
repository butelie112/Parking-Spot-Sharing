'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Mail, User, MessageSquare, Send, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ContactPage() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Modal */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-[scale-in_0.2s_ease-out]">
            <button
              onClick={() => setSuccess(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {t.pages?.contact?.successTitle || "Message Sent Successfully!"}
              </h3>
              
              <p className="text-gray-600 mb-6">
                {t.pages?.contact?.successMessage || "We'll get back to you soon."}
              </p>
              
              <button
                onClick={() => setSuccess(false)}
                className="w-full bg-[#00C48C] hover:bg-[#00b37d] text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                {t.common.ok || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            {t.pages?.contact?.title || "Contact Us"}
          </h1>
          <p className="text-gray-600 mt-2">
            {t.pages?.contact?.subtitle || "Have a question or feedback? We'd love to hear from you."}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="bg-gradient-to-br from-[#00C48C] to-[#007BFF] text-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold mb-6">
              {t.pages?.contact?.getInTouch || "Get in Touch"}
            </h2>
            <p className="mb-8 opacity-90">
              {t.pages?.contact?.getInTouchDesc || "We're here to help and answer any questions you might have. We look forward to hearing from you!"}
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">
                    {t.pages?.contact?.emailUs || "Email Us"}
                  </h3>
                  <p className="opacity-90 text-sm">
                    {t.pages?.contact?.emailDesc || "Send us an email anytime"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">
                    {t.pages?.contact?.support || "Support"}
                  </h3>
                  <p className="opacity-90 text-sm">
                    {t.pages?.contact?.supportDesc || "We typically respond within 24 hours"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/20">
              <h3 className="font-semibold mb-3">
                {t.pages?.contact?.followUs || "Follow Us"}
              </h3>
              <p className="opacity-90 text-sm">
                {t.pages?.contact?.followUsDesc || "Stay updated with our latest news and updates"}
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {t.pages?.contact?.sendMessage || "Send us a Message"}
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-semibold">
                  ❌ {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.pages?.contact?.yourName || "Your Name"} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900"
                    placeholder={t.pages?.contact?.namePlaceholder || "John Doe"}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.pages?.contact?.yourEmail || "Your Email"} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900"
                    placeholder={t.pages?.contact?.emailPlaceholder || "you@example.com"}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.pages?.contact?.subject || "Subject"} *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900"
                  placeholder={t.pages?.contact?.subjectPlaceholder || "How can we help?"}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.pages?.contact?.message || "Message"} *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900 resize-none"
                  placeholder={t.pages?.contact?.messagePlaceholder || "Tell us more about your inquiry..."}
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t.pages?.contact?.sending || "Sending..."}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {t.pages?.contact?.sendButton || "Send Message"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
