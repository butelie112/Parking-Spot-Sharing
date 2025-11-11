'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface TimezoneContextType {
  userTimezone: string;
  dbTimezone: string;
  convertToLocalTime: (utcTime: string | Date) => Date;
  convertToUTCTime: (localTime: string | Date) => Date;
  formatLocalTime: (utcTime: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatLocalDate: (utcDate: string | Date) => string;
  getCurrentLocalTime: () => Date;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};

interface TimezoneProviderProps {
  children: ReactNode;
}

export const TimezoneProvider = ({ children }: TimezoneProviderProps) => {
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const dbTimezone = 'UTC'; // Database always stores in UTC

  useEffect(() => {
    // Detect user's timezone
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detectedTimezone);
    console.log('🌍 User timezone detected:', detectedTimezone);
  }, []);

  const convertToLocalTime = (utcTime: string | Date): Date => {
    const utcDate = typeof utcTime === 'string' ? new Date(utcTime + 'Z') : new Date(utcTime);
    return new Date(utcDate.toLocaleString('en-US', { timeZone: userTimezone }));
  };

  const convertToUTCTime = (localTime: string | Date): Date => {
    const localDate = typeof localTime === 'string' ? new Date(localTime) : localTime;
    return new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  };

  const formatLocalTime = (utcTime: string | Date, options?: Intl.DateTimeFormatOptions): string => {
    const localDate = convertToLocalTime(utcTime);
    return localDate.toLocaleString('en-US', {
      timeZone: userTimezone,
      ...options
    });
  };

  const formatLocalDate = (utcDate: string | Date): string => {
    return formatLocalTime(utcDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCurrentLocalTime = (): Date => {
    return new Date();
  };

  const value: TimezoneContextType = {
    userTimezone,
    dbTimezone,
    convertToLocalTime,
    convertToUTCTime,
    formatLocalTime,
    formatLocalDate,
    getCurrentLocalTime
  };

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};
