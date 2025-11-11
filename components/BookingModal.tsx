'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { ParkingSpot, supabase } from '@/lib/supabase';
import { useTimezone } from './TimezoneHandler';
import { useLanguage } from '@/contexts/LanguageContext';

interface BookingModalProps {
  spot: ParkingSpot;
  onClose: () => void;
  onSubmit: (bookingData: BookingData) => void;
  loading?: boolean;
  currentUserId?: string | undefined;
}

export interface BookingData {
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  message?: string;
  userTimezone?: string;
}

const BookingModal: React.FC<BookingModalProps> = ({ spot, onClose, onSubmit, loading = false, currentUserId }) => {
  const { convertToUTCTime, getCurrentLocalTime, formatLocalTime, userTimezone } = useTimezone();
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [isSelectingCheckOut, setIsSelectingCheckOut] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'date' | 'time' | 'confirm'>('date');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityDetails, setAvailabilityDetails] = useState<{ available: boolean; reason?: string } | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [spotSchedule, setSpotSchedule] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  const isDateSelected = (date: Date) => {
    if (checkInDate && date.toDateString() === checkInDate.toDateString()) return true;
    if (checkOutDate && date.toDateString() === checkOutDate.toDateString()) return true;
    return false;
  };

  const isDateInRange = (date: Date) => {
    if (!checkInDate || !checkOutDate) return false;
    return date >= checkInDate && date <= checkOutDate;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0); // Set to start of selected date
    return checkDate < today;
  };

  const selectDate = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (!checkInDate || (checkInDate && checkOutDate)) {
      // Start new selection - set check-in date
      setCheckInDate(date);
      setCheckOutDate(null);
      setIsSelectingCheckOut(false);
    } else if (checkInDate && !checkOutDate) {
      // Selecting check-out date
      if (date.getTime() === checkInDate.getTime()) {
        // Same day selected - set as check-out for single day booking
        setCheckOutDate(date);
        setIsSelectingCheckOut(true);
      } else if (date < checkInDate) {
        // If selected date is before check-in, make it the new check-in
        setCheckInDate(date);
      } else {
        // Set as check-out date for multi-day booking
        setCheckOutDate(date);
        setIsSelectingCheckOut(true);
      }
    }
  };

  const clearSelection = () => {
    setCheckInDate(null);
    setCheckOutDate(null);
    setIsSelectingCheckOut(false);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const formatTimeRange = () => {
    if (!checkInDate || !checkOutDate) return '';
    if (checkInDate.toDateString() === checkOutDate.toDateString()) {
      return `${checkInDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })} ${startTime} - ${endTime}`;
    } else {
      return `${checkInDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} - ${checkOutDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })} ${startTime} - ${endTime}`;
    }
  };

  const handleSubmit = () => {
    if (!checkInDate || !checkOutDate) {
      alert('Please select check-in and check-out dates.');
      return;
    }

    // Validate that booking is not in the past (using local timezone)
    const now = getCurrentLocalTime();
    const bookingStartDateTime = new Date(`${checkInDate.toDateString()} ${startTime}`);
    const bookingEndDateTime = new Date(`${checkOutDate.toDateString()} ${endTime}`);

    if (bookingStartDateTime <= now) {
      alert(`Cannot book for past times. Current local time (${userTimezone}): ${formatLocalTime(now, { hour: '2-digit', minute: '2-digit' })}. Please select a future date and time.`);
      return;
    }

    // Validate time range for same-day bookings
    if (checkInDate.toDateString() === checkOutDate.toDateString()) {
      if (startTime >= endTime) {
        alert('End time must be after start time for same-day bookings.');
        return;
      }
    }

    // Check for balance error
    if (balanceError) {
      alert('Cannot proceed with booking due to insufficient wallet balance. Please add funds to your wallet.');
      return;
    }

    const bookingData: BookingData = {
      startDate: checkInDate,
      endDate: checkOutDate,
      startTime,
      endTime,
      message: message.trim() || undefined,
      userTimezone,
    };

    onSubmit(bookingData);
  };

  const canProceedToTime = () => checkInDate !== null;

  // Helper function to determine if this is a single day booking
  const isSingleDayBooking = () => {
    return checkInDate && checkOutDate && checkInDate.toDateString() === checkOutDate.toDateString();
  };

  // Get the appropriate labels based on booking type
  const getTimeLabels = () => {
    if (isSingleDayBooking()) {
      return { start: t.modals.booking.parkIn, end: t.modals.booking.parkOut };
    }
    return { start: t.modals.booking.checkIn, end: t.modals.booking.checkOut };
  };
  const canProceedToConfirm = () => startTime && endTime && startTime < endTime && !availabilityError;

  // Check availability of selected time slot
  const checkAvailability = async () => {
    if (!checkInDate || !checkOutDate || !startTime || !endTime) return;

    setCheckingAvailability(true);
    setAvailabilityError(null);
    setAvailabilityDetails(null);

    try {
      const startDateStr = checkInDate.toISOString().split('T')[0];
      const endDateStr = checkOutDate.toISOString().split('T')[0];

      // First check if spot has a schedule set
      const { data: spotInfo, error: spotInfoError } = await supabase
        .from('spots')
        .select('has_availability_schedule, default_available')
        .eq('id', spot.id)
        .single();

      if (spotInfoError) {
        console.error('Error fetching spot info:', spotInfoError);
        throw spotInfoError;
      }

      console.log('Spot schedule info:', spotInfo);

      // Only check schedule if spot has one set
      if (spotInfo?.has_availability_schedule) {
        console.log('Checking owner schedule for:', {
          spot_id: spot.id,
          start_date: startDateStr,
          end_date: endDateStr,
          start_time: startTime,
          end_time: endTime
        });

        const { data: scheduleAvailable, error: scheduleError } = await supabase.rpc('check_spot_availability', {
          p_spot_id: spot.id,
          p_start_date: startDateStr,
          p_end_date: endDateStr,
          p_start_time: startTime,
          p_end_time: endTime
        });

        console.log('Schedule check result:', scheduleAvailable);

        if (scheduleError) {
          console.error('Schedule check error:', scheduleError);
          throw scheduleError;
        }

        // If not available per owner's schedule
        if (scheduleAvailable === false) {
          const timeRange = `${startTime} - ${endTime}`;
          const dateRange = checkInDate.toDateString() === checkOutDate.toDateString() ?
            checkInDate.toLocaleDateString('ro-RO', { weekday: 'long', month: 'short', day: 'numeric' }) :
            `${checkInDate.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' })} - ${checkOutDate.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' })}`;

          setAvailabilityError(`⚠️ Acest loc nu este disponibil în intervalul ${timeRange} pe ${dateRange} conform programului setat de proprietar.`);
          setAvailabilityDetails({ available: false, reason: 'owner_schedule' });
          return; // Stop here, don't check bookings if schedule doesn't allow it
        }
      } else if (spotInfo?.default_available === false) {
        // Spot has no schedule and is not available by default
        setAvailabilityError(`⚠️ Acest loc nu este disponibil pentru rezervare. Vă rugăm să contactați proprietarul.`);
        setAvailabilityDetails({ available: false, reason: 'not_available' });
        return;
      }
      // If no schedule is set and default_available is true, continue to check bookings

      // Now check for existing bookings
      const { data: existingBookings, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('spot_id', spot.id)
        .eq('status', 'accepted')
        .gte('end_date', startDateStr)
        .lte('start_date', endDateStr);

      if (bookingError) {
        console.error('Booking check error:', bookingError);
        throw bookingError;
      }

      // Check for time overlap with existing bookings
      let hasConflict = false;
      let conflictDetails = '';

      if (existingBookings && existingBookings.length > 0) {
        for (const booking of existingBookings) {
          // Check if there's a time overlap
          const bookingStartDate = new Date(booking.start_date);
          const bookingEndDate = new Date(booking.end_date);
          const requestStartDate = checkInDate;
          const requestEndDate = checkOutDate;

          // Check date overlap
          if (!(requestEndDate < bookingStartDate || requestStartDate > bookingEndDate)) {
            // Dates overlap, now check time
            const bookingStartTime = booking.start_time;
            const bookingEndTime = booking.end_time;

            // For same day bookings
            if (requestStartDate.toDateString() === requestEndDate.toDateString() &&
                bookingStartDate.toDateString() === bookingEndDate.toDateString() &&
                requestStartDate.toDateString() === bookingStartDate.toDateString()) {
              // Check time overlap
              if (!(endTime <= bookingStartTime || startTime >= bookingEndTime)) {
                hasConflict = true;
                conflictDetails = `Rezervat: ${bookingStartTime} - ${bookingEndTime}`;
                break;
              }
            } else {
              // Multi-day booking overlap
              hasConflict = true;
              conflictDetails = `Rezervat: ${bookingStartDate.toLocaleDateString('ro-RO')} - ${bookingEndDate.toLocaleDateString('ro-RO')}`;
              break;
            }
          }
        }
      }

      if (hasConflict) {
        setAvailabilityError(`❌ Acest interval este deja rezervat. ${conflictDetails}`);
        setAvailabilityDetails({ available: false, reason: 'already_booked' });
      } else {
        // Spot is available!
        setAvailabilityDetails({ available: true });
        setAvailabilityError(null);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityError('Nu s-a putut verifica disponibilitatea. Vă rugăm să încercați din nou.');
      setAvailabilityDetails(null);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Check user's wallet balance
  const checkUserBalance = async () => {
    if (!currentUserId || !spot.price || !checkInDate || !checkOutDate || !startTime || !endTime) return;

    setCheckingBalance(true);
    setBalanceError(null);

    try {
      // Calculate total price
      const totalPrice = calculateTotalPrice(spot.price, startTime, endTime);

      // Get user's current balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', currentUserId)
        .single();

      if (profileError) throw profileError;

      const currentBalance = profile?.wallet_balance || 0;
      setUserBalance(currentBalance);

      // Check if balance is sufficient
      if (currentBalance < totalPrice) {
        setBalanceError(`❌ Sold insuficient în portofel. Aveți nevoie de ${totalPrice.toFixed(2)} RON dar aveți doar ${currentBalance.toFixed(2)} RON. Vă rugăm să adăugați fonduri.`);
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      setBalanceError('Unable to check wallet balance. Please try again.');
    } finally {
      setCheckingBalance(false);
    }
  };

  // Check availability when time selection changes
  useEffect(() => {
    if (checkInDate && checkOutDate && startTime && endTime && startTime < endTime) {
      checkAvailability();
    } else {
      setAvailabilityError(null);
    }
  }, [checkInDate, checkOutDate, startTime, endTime]);

  // Check balance when confirmation step is reached
  useEffect(() => {
    if (step === 'confirm' && spot.price && currentUserId && checkInDate && checkOutDate && startTime && endTime) {
      checkUserBalance();
    }
  }, [step, spot.price, currentUserId, checkInDate, checkOutDate, startTime, endTime]);

  // Fetch spot's availability schedule when modal opens
  useEffect(() => {
    const fetchSpotSchedule = async () => {
      if (!spot.id) return;

      setLoadingSchedule(true);
      try {
        // Check if spot has availability schedule
        const { data: spotData, error: spotError } = await supabase
          .from('spots')
          .select('has_availability_schedule, default_available')
          .eq('id', spot.id)
          .single();

        if (spotError) throw spotError;

        if (spotData?.has_availability_schedule) {
          // Fetch the schedule
          const { data: scheduleData, error: scheduleError } = await supabase
            .from('availability_schedules')
            .select('*')
            .eq('spot_id', spot.id)
            .eq('is_available', true)
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });

          if (scheduleError) throw scheduleError;
          setSpotSchedule(scheduleData || []);
        } else {
          // No schedule set, use default availability
          if (spotData?.default_available) {
            // Available 24/7 by default
            setSpotSchedule([{ message: 'Disponibil 24/7 (fără restricții de program)' }]);
          } else {
            setSpotSchedule([{ message: 'Indisponibil (contactați proprietarul)' }]);
          }
        }
      } catch (error) {
        console.error('Error fetching spot schedule:', error);
        setSpotSchedule([]);
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchSpotSchedule();
  }, [spot.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300" style={{ paddingTop: '80px' }}>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-4 border-[#00C48C] rounded-3xl p-4 sm:p-8 max-w-2xl w-full shadow-2xl transform scale-100 animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white hover:bg-gray-100 p-2 rounded-full shadow-lg transition-colors"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#00C48C] to-[#00b37d] p-4 rounded-2xl shadow-lg">
            <Calendar className="w-12 h-12 text-white fill-current" />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">{t.modals.booking.bookParkingSpot}</h2>
            <p className="text-lg text-gray-600">{spot.name}</p>
          </div>
        </div>

        {/* Low Balance Notice - Prominent Alert */}
        {balanceError && step === 'confirm' && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-2xl p-4 shadow-lg animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">⚠️</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-800 mb-2">{t.modals.booking.lowWalletBalance}</h3>
                <p className="text-red-700 font-medium mb-3">{balanceError}</p>
                <div className="bg-white rounded-xl p-3 border border-red-200">
                  <p className="text-sm text-red-700 mb-2">
                    <strong>{t.modals.booking.whatYouCanDo}</strong>
                  </p>
                  <ul className="text-sm text-red-700 space-y-1 font-medium">
                    <li>• {t.modals.booking.addFundsToWallet}</li>
                    <li>• {t.modals.booking.chooseDifferentTimeSlot}</li>
                    <li>• {t.modals.booking.contactSupport}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Balance Display */}
        {userBalance !== null && !balanceError && step === 'confirm' && spot.price && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">💰</span>
              </div>
              <div>
                <p className="text-blue-800 font-semibold">{t.modals.booking.currentWalletBalance}</p>
                <p className="text-blue-700 text-lg font-bold">{userBalance.toFixed(2)} RON</p>
              </div>
            </div>
          </div>
        )}


        {/* Step Navigation */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'date' ? 'bg-[#00C48C] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'time' ? 'bg-[#00C48C] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'confirm' ? 'bg-[#00C48C] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Date Selection Step */}
        {step === 'date' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{t.modals.booking.selectDates}</h3>
            <p className="text-sm text-gray-600 mb-6">
              {t.modals.booking.selectDatesDesc}
            </p>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h4 className="text-lg font-semibold text-gray-900">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h4>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Owner's Availability Schedule */}
            {spotSchedule.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <h5 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Program disponibilitate (setat de proprietar)
                </h5>
                {spotSchedule[0].message ? (
                  <p className="text-sm text-blue-800">{spotSchedule[0].message}</p>
                ) : (
                  <div className="space-y-1">
                    {['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'].map((dayName, dayIndex) => {
                      const daySchedules = spotSchedule.filter(s => s.day_of_week === dayIndex);
                      if (daySchedules.length === 0) return null;
                      return (
                        <div key={dayIndex} className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-blue-900 w-20">{dayName}:</span>
                          <span className="text-blue-700">
                            {daySchedules.map(s => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`).join(', ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected Dates Display */}
            {checkInDate && (
              <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${!checkOutDate ? 'bg-blue-500' : 'bg-[#00C48C]'}`}></div>
                    <span className="text-sm font-medium text-gray-900">
                      {!checkOutDate ? t.modals.booking.selectedDate : t.modals.booking.checkIn}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {checkInDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {checkOutDate && checkInDate.toDateString() !== checkOutDate.toDateString() && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-900">{t.modals.booking.checkOut}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {checkOutDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {checkInDate && checkOutDate && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-center">
                      <span className="text-xs text-gray-700 bg-gray-100 px-3 py-1 rounded-full font-medium">
                        {checkInDate.toDateString() === checkOutDate.toDateString()
                          ? t.modals.booking.sameDayParkingSelectTimes
                          : `${Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))} night${Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) > 1 ? 's' : ''} - select check-in/out times`
                        }
                      </span>
                    </div>
                  </div>
                )}
                {!checkOutDate && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <span className="text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full font-medium">
                        {t.modals.booking.selectSameDateHint}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-6">
              {[t.modals.booking.sun, t.modals.booking.mon, t.modals.booking.tue, t.modals.booking.wed, t.modals.booking.thu, t.modals.booking.fri, t.modals.booking.sat].map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 py-2 text-sm">
                  {day}
                </div>
              ))}

              {days.map((date, index) => (
                <div key={index} className="text-center">
                  {date ? (
                    <button
                      onClick={() => selectDate(date)}
                      disabled={isDateDisabled(date)}
                      className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg font-semibold transition-all text-sm relative touch-manipulation ${
                        isDateSelected(date) && checkInDate && date.toDateString() === checkInDate.toDateString()
                          ? 'bg-[#00C48C] text-white shadow-lg ring-2 ring-[#00C48C] ring-opacity-50'
                          : isDateSelected(date) && checkOutDate && date.toDateString() === checkOutDate.toDateString()
                          ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-500 ring-opacity-50'
                          : isDateInRange(date)
                          ? 'bg-green-100 text-[#00C48C] font-bold'
                          : isDateDisabled(date)
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'hover:bg-gray-100 text-gray-700 active:bg-gray-200'
                      }`}
                    >
                      {date.getDate()}
                      {isDateSelected(date) && checkInDate && date.toDateString() === checkInDate.toDateString() && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"></div>
                      )}
                      {isDateSelected(date) && checkOutDate && date.toDateString() === checkOutDate.toDateString() && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </button>
                  ) : (
                    <div className="w-11 h-11 sm:w-10 sm:h-10"></div>
                  )}
                </div>
              ))}
            </div>


            <button
              onClick={() => {
                // If only check-in date is selected, set check-out to same date for single-day booking
                if (checkInDate && !checkOutDate) {
                  setCheckOutDate(checkInDate);
                }
                setStep('time');
              }}
              disabled={!canProceedToTime()}
              className="w-full bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              {t.modals.booking.nextSelectTimes}
            </button>
          </div>
        )}

        {/* Time Selection Step */}
        {step === 'time' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {t.modals.booking.selectParkTimes}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {t.modals.booking.chooseWhen}
            </p>

            {/* Selected Dates Summary */}
            <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isSingleDayBooking() ? 'bg-blue-500' : 'bg-[#00C48C]'}`}></div>
                  <span className="text-sm font-medium text-gray-900">{getTimeLabels().start}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {checkInDate?.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: checkInDate?.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                  })}
                </span>
              </div>
              {checkOutDate && checkInDate?.toDateString() !== checkOutDate.toDateString() && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-900">{getTimeLabels().end}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {checkOutDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      year: checkOutDate.getFullYear() !== checkInDate?.getFullYear() ? 'numeric' : undefined
                    })}
                  </span>
                </div>
              )}
              {checkInDate && checkOutDate && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-center">
                    <span className="text-xs text-gray-700 bg-gray-100 px-3 py-1 rounded-full font-medium">
                      {isSingleDayBooking()
                        ? t.modals.booking.sameDayParking
                        : `${Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))} night${Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) > 1 ? 's' : ''}`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white bg-opacity-50 rounded-2xl p-4 mb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${isSingleDayBooking() ? 'text-blue-500' : 'text-[#00C48C]'}`} />
                    {getTimeLabels().start}
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent text-base text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${isSingleDayBooking() ? 'text-blue-500' : 'text-red-500'}`} />
                    {getTimeLabels().end}
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent text-base text-gray-900"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm text-gray-900">
                  <strong className="text-blue-800">{t.modals.booking.duration}:</strong> {calculateDuration(startTime, endTime)}
                </p>
                {spot.price && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-sm text-gray-900">
                      <strong className="text-blue-800">{t.modals.booking.costEstimate}:</strong> {calculateTotalPrice(spot.price, startTime, endTime).toFixed(2)} RON
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      💡 {t.modals.booking.finalCostCalculated}
                    </p>
                  </div>
                )}
              </div>

              {/* Availability Status */}
              {checkingAvailability && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                    {t.modals.booking.checkingAvailability}
                  </div>
                </div>
              )}

              {availabilityError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-800">
                    <strong>⚠️ {t.modals.booking.availabilityIssue}</strong> {availabilityError}
                  </p>
                </div>
              )}

              {!checkingAvailability && availabilityDetails?.available && checkInDate && checkOutDate && startTime && endTime && startTime < endTime && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 animate-in fade-in duration-300">
                  <p className="text-sm text-green-800 font-medium">
                    <strong>✅ {t.modals.booking.timeSlotAvailable}</strong>
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    📅 Acest interval de timp este liber pentru rezervare!
                  </p>
                </div>
              )}

              {/* Balance Status */}
              {spot.price && (
                <>
                  {checkingBalance && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        Checking wallet balance...
                      </div>
                    </div>
                  )}

                  {balanceError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-sm text-red-800">
                        {balanceError}
                      </p>
                    </div>
                  )}

                  {!checkingBalance && !balanceError && userBalance !== null && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <p className="text-sm text-green-800">
                        <strong>✅ Sold suficient!</strong> Portofelul dvs. are {userBalance.toFixed(2)} RON disponibili.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('date')}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                {t.common.back}
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!canProceedToConfirm()}
                className="flex-1 bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                {t.modals.booking.nextConfirm}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Step */}
        {step === 'confirm' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{t.modals.booking.confirmBooking}</h3>

            <div className="bg-white bg-opacity-50 rounded-2xl p-4 mb-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Car className="w-8 h-8 text-[#00C48C]" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{spot.name}</h4>
                  <p className="text-sm text-gray-600">{spot.owner_name}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700 font-medium">{getTimeLabels().start}:</span>
                  <span className="font-semibold text-gray-900">
                    {checkInDate?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })} at {startTime}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700 font-medium">{getTimeLabels().end}:</span>
                  <span className="font-semibold text-gray-900">
                    {checkOutDate?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })} at {endTime}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700 font-medium">{t.modals.booking.duration}:</span>
                  <span className="font-semibold text-gray-900">{calculateDuration(startTime, endTime)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700 font-medium">{t.modals.booking.type}</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {isSingleDayBooking() ? t.modals.booking.hourlyParking : 'Multi-day Parking'}
                  </span>
                </div>
                {spot.price && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700 font-medium">{t.modals.booking.hourlyRate}</span>
                      <span className="font-semibold text-green-600">
                        {formatPrice(spot.price)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700 font-medium">{t.modals.booking.totalHours}</span>
                      <span className="font-semibold text-gray-900">
                        {calculateTotalHours(startTime, endTime).toFixed(2)} {t.common.hours}
                      </span>
                    </div>
                    <div className={`flex justify-between items-center py-3 px-3 rounded-lg border ${
                      balanceError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                    }`}>
                      <span className={`font-bold ${balanceError ? 'text-red-800' : 'text-green-800'}`}>
                        {balanceError && <span className="mr-1">⚠️</span>}
                        {t.modals.booking.totalPrice}
                      </span>
                      <span className={`font-bold text-lg ${balanceError ? 'text-red-800' : 'text-green-800'}`}>
                        {formatPrice(calculateTotalPrice(spot.price, startTime, endTime))}
                        {balanceError && <span className="text-sm ml-2">({t.modals.booking.insufficientBalance})</span>}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t.modals.booking.messageOptional}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.modals.booking.addMessageForOwner}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('time')}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                {t.common.back}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || checkingBalance || !!balanceError}
                className="flex-1 bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t.modals.booking.sendingRequest}
                  </>
                ) : (
                  <>
                    <Car className="w-5 h-5" />
                    {t.modals.booking.sendBookingRequest}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to calculate duration
function calculateDuration(startTime: string, endTime: string): string {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  const durationMinutes = endMinutes - startMinutes;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes} minutes`;
  } else if (minutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  }
}

// Helper function to calculate total hours (decimal)
function calculateTotalHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  const durationMinutes = endMinutes - startMinutes;
  return durationMinutes / 60;
}

// Helper function to calculate total price
function calculateTotalPrice(hourlyPrice: number, startTime: string, endTime: string): number {
  const totalHours = calculateTotalHours(startTime, endTime);
  return hourlyPrice * totalHours;
}

// Helper function to format price
function formatPrice(amount: number): string {
  return `${amount.toFixed(2)} RON`;
}

export default BookingModal;
