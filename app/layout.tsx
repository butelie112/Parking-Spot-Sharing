import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { TimezoneProvider } from "@/components/TimezoneHandler";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parkezz - Find & Share Parking Spots",
  description: "A mobile-first PWA for sharing parking spots. Find available parking or share your own spots easily.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Parkezz",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4F46E5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          <TimezoneProvider>
            <AuthProvider>
              <div className="min-h-screen pb-16">
                {children}
              </div>
              <Footer />
            </AuthProvider>
          </TimezoneProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
