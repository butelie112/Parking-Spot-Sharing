'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ParkingSpot, supabase, BookingRequest } from '@/lib/supabase';
import { MapPin, X, Calendar, User as UserIcon, Mail, Car, Clock, CheckCircle, XCircle, Plus, Navigation, Crosshair, Search, MapPin as MapPinIcon } from 'lucide-react';
import BookingModal, { BookingData } from './BookingModal';
import { useTimezone } from './TimezoneHandler';
import { useLanguage } from '@/contexts/LanguageContext';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const ScaleControl = dynamic(() => import('react-leaflet').then(mod => mod.ScaleControl), { ssr: false });

// Client-only components that use Leaflet hooks
const MapClickHandler = dynamic(() => import('./MapClickHandler'), { ssr: false });
const MapController = dynamic(() => import('./MapClickHandler').then(mod => mod.MapController), { ssr: false });

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Custom CSS for map improvements - will be injected in useEffect
const mapStyles = `
  .leaflet-container {
    font-family: inherit;
  }
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    border: 1px solid rgba(255,255,255,0.8);
  }
  .leaflet-popup-tip {
    background-color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .leaflet-popup-content {
    margin: 0;
    font-family: inherit;
  }
  .custom-marker {
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.25));
    transition: all 0.2s ease;
  }
  .custom-marker:hover {
    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));
  }
  .custom-marker:hover > div:first-child > div:nth-child(2) {
    transform: scale(1.15);
  }
  .cursor-crosshair .leaflet-container {
    cursor: crosshair !important;
  }
  .user-location-marker {
    filter: drop-shadow(0 3px 8px rgba(66, 133, 244, 0.4));
  }
  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
    display: none !important; /* Hide default zoom controls since we disabled them */
  }
  .leaflet-control-zoom a {
    background-color: white !important;
    color: #374151 !important;
    border: none !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
  }
  .leaflet-control-zoom a:hover {
    background-color: #f9fafb !important;
    color: #111827 !important;
  }
  .leaflet-control-scale {
    background-color: rgba(255, 255, 255, 0.9) !important;
    border: 1px solid rgba(0, 0, 0, 0.1) !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    color: #374151 !important;
  }
  .leaflet-control-scale-line {
    background-color: #374151 !important;
  }
  /* Ensure map container stays behind UI elements */
  .leaflet-container {
    z-index: 10 !important;
  }
  .leaflet-tile-pane {
    z-index: 10 !important;
  }
  .leaflet-overlay-pane {
    z-index: 15 !important;
  }
  .leaflet-control-container {
    z-index: 30 !important;
  }
`;

// Fix for default markers in react-leaflet and add custom controls
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type LeafletMapViewProps = {
  spots: ParkingSpot[];
  currentUserId: string | undefined;
  onUpdateStatus: (spotId: string, newStatus: ParkingSpot['status']) => void;
  onDeleteSpot: (spotId: string) => void;
  onAddSpotAtLocation?: (lat: number, lng: number) => void;
  selectingLocation?: boolean;
  pendingLocation?: { lat: number; lng: number } | null;
  pinPlacementMarker?: { lat: number; lng: number } | null;
};


export function LeafletMapView({
  spots,
  currentUserId,
  onUpdateStatus,
  onDeleteSpot,
  onAddSpotAtLocation,
  selectingLocation = false,
  pendingLocation = null,
  pinPlacementMarker = null
}: LeafletMapViewProps) {
  const { t } = useLanguage();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const { formatLocalDate, convertToUTCTime } = useTimezone();
  const [existingBookings, setExistingBookings] = useState<BookingRequest[]>([]);
  const [existingBooking, setExistingBooking] = useState<BookingRequest | null>(null); // Latest pending booking
  const [bookingDetails, setBookingDetails] = useState<{
    requesterName?: string;
    requesterEmail?: string;
    isMyBooking?: boolean;
    startTime?: string;
    endTime?: string;
    startDate?: string;
    endDate?: string;
  } | null>(null);
  const [spotAvailability, setSpotAvailability] = useState<{
    hasSchedule: boolean;
    defaultAvailable: boolean;
    schedules?: any[];
    blockedDates?: any[];
  } | null>(null);
  const [allSpotsSchedules, setAllSpotsSchedules] = useState<Map<string, any[]>>(new Map());

  // Helper function to translate status values
  const getTranslatedStatus = (status: string) => {
    switch (status) {
      case 'available':
        return t.parking.map.legend.available;
      case 'reserved':
        return t.parking.map.legend.reserved;
      case 'occupied':
        return t.parking.map.legend.occupied;
      default:
        return status;
    }
  };
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.0060]); // Start with New York as neutral location
  const [mapZoom, setMapZoom] = useState(10); // Start with lower zoom to show broader area
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
    address: string;
  } | null>(null);
  const mapRef = useRef<any>(null);
  const [mapKey, setMapKey] = useState(0); // Force map remount when needed

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (error) {
          console.log('Map cleanup:', error);
        }
      }
    };
  }, []);

  // Fetch all spot schedules when spots change
  useEffect(() => {
    const fetchAllSchedules = async () => {
      if (!spots || spots.length === 0) return;

      try {
        // Get all spot IDs that have schedules
        const spotsWithSchedules = spots.filter(s => s.has_availability_schedule);
        if (spotsWithSchedules.length === 0) return;

        const spotIds = spotsWithSchedules.map(s => s.id);

        // Fetch all schedules in one query
        const { data: schedules, error } = await supabase
          .from('availability_schedules')
          .select('*')
          .in('spot_id', spotIds)
          .eq('is_available', true);

        if (error) throw error;

        // Group schedules by spot_id
        const schedulesMap = new Map<string, any[]>();
        schedules?.forEach(schedule => {
          const existing = schedulesMap.get(schedule.spot_id) || [];
          existing.push(schedule);
          schedulesMap.set(schedule.spot_id, existing);
        });

        setAllSpotsSchedules(schedulesMap);
      } catch (error) {
        console.error('Error fetching all schedules:', error);
      }
    };

    fetchAllSchedules();
  }, [spots]);

  // Check existing bookings when a spot is selected
  useEffect(() => {
    if (selectedSpot) {
      checkExistingBooking(selectedSpot.id);
      fetchSpotAvailability(selectedSpot.id);
      setBookingMessage('');
    } else {
      setExistingBooking(null);
      setBookingMessage('');
      setBookingDetails(null);
      setSpotAvailability(null);
    }
  }, [selectedSpot, currentUserId]);

  // Subscribe to booking request changes for real-time updates
  useEffect(() => {
    if (!currentUserId || !selectedSpot) return;

    const channel = supabase
      .channel('booking_requests_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `spot_id=eq.${selectedSpot.id}`
        },
        (payload) => {
          console.log('Booking request changed:', payload);
          checkExistingBooking(selectedSpot.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSpot, currentUserId]);

  const checkExistingBooking = async (spotId: string) => {
    if (!currentUserId || !selectedSpot) return;

    try {
      // Get ALL bookings for the current user on this spot (pending, accepted, completed)
      const { data: myBookings, error: myBookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('spot_id', spotId)
        .eq('requester_id', currentUserId)
        .in('status', ['pending', 'accepted', 'completed'])
        .order('start_date', { ascending: true });

      if (myBookingsError) throw myBookingsError;

      setExistingBookings(myBookings || []);

      // Check if there's a pending booking (for the booking button logic)
      const pendingBooking = myBookings?.find(booking => booking.status === 'pending') || null;
      setExistingBooking(pendingBooking);

      // Check for accepted bookings to show booking status
      const { data: acceptedBookings, error: acceptedError } = await supabase
        .from('booking_requests')
        .select(`
          *,
          requester:profiles!booking_requests_requester_id_fkey(*)
        `)
        .eq('spot_id', spotId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false }); // Get most recent first

      if (acceptedError) {
        console.warn('Error fetching accepted bookings:', acceptedError);
      }

      // Set booking details for display (use the most recent accepted booking)
      if (acceptedBookings && acceptedBookings.length > 0) {
        const acceptedBooking = acceptedBookings[0]; // Most recent
        const isOwner = selectedSpot.owner_id === currentUserId;
        const isRequester = acceptedBooking.requester_id === currentUserId;

        // Handle requester data (might be array or object due to Supabase join)
        const requesterData = Array.isArray(acceptedBooking.requester)
          ? acceptedBooking.requester[0]
          : acceptedBooking.requester;

        const bookingInfo = {
          startTime: acceptedBooking.start_time,
          endTime: acceptedBooking.end_time,
          startDate: acceptedBooking.start_date,
          endDate: acceptedBooking.end_date
        };

        if (requesterData) {
          setBookingDetails({
            ...bookingInfo,
            requesterName: requesterData.full_name || requesterData.email?.split('@')[0] || 'Unknown User',
            requesterEmail: requesterData.email || '',
            isMyBooking: isRequester
          });
        } else if (isRequester) {
          setBookingDetails({
            ...bookingInfo,
            isMyBooking: true
          });
        } else {
          // For other users, just show the time
          setBookingDetails(bookingInfo);
        }
      } else {
        setBookingDetails(null);
      }
    } catch (error) {
      console.error('Error checking existing booking:', error);
      setExistingBooking(null);
      setBookingDetails(null);
    }
  };

  // Fetch spot availability schedule
  const fetchSpotAvailability = async (spotId: string) => {
    try {
      // Get spot's availability settings
      const { data: spot, error: spotError } = await supabase
        .from('spots')
        .select('has_availability_schedule, default_available')
        .eq('id', spotId)
        .single();

      if (spotError) throw spotError;

      if (!spot) return;

      // If spot has a schedule, fetch it
      if (spot.has_availability_schedule) {
        const { data: schedules, error: schedError } = await supabase
          .from('availability_schedules')
          .select('*')
          .eq('spot_id', spotId)
          .eq('is_available', true)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true });

        if (schedError) throw schedError;

        // Fetch blocked dates
        const { data: blocked, error: blockedError } = await supabase
          .from('blocked_dates')
          .select('*')
          .eq('spot_id', spotId)
          .order('blocked_date', { ascending: true });

        if (blockedError) throw blockedError;

        setSpotAvailability({
          hasSchedule: true,
          defaultAvailable: spot.default_available,
          schedules: schedules || [],
          blockedDates: blocked || []
        });
      } else {
        setSpotAvailability({
          hasSchedule: false,
          defaultAvailable: spot.default_available,
          schedules: [],
          blockedDates: []
        });
      }
    } catch (error) {
      console.error('Error fetching spot availability:', error);
      setSpotAvailability(null);
    }
  };

  // Check if a specific time slot is available for booking
  const checkTimeSlotAvailability = async (spotId: string, startDate: Date, endDate: Date, startTime: string, endTime: string) => {
    try {
      // First check if spot has availability schedule
      const { data: spot, error: spotError } = await supabase
        .from('spots')
        .select('has_availability_schedule')
        .eq('id', spotId)
        .single();

      if (spotError) throw spotError;

      // If spot has availability schedule, check it using the database function
      if (spot?.has_availability_schedule) {
        const { data: isAvailable, error: availError } = await supabase
          .rpc('check_spot_availability', {
            p_spot_id: spotId,
            p_start_date: startDate.toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
            p_end_date: endDate.toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
            p_start_time: startTime,
            p_end_time: endTime
          });

        if (availError) {
          console.error('Error checking availability schedule:', availError);
          return { available: false, reason: 'error' };
        }

        if (!isAvailable) {
          return { available: false, reason: 'outside_schedule' };
        }
      }

      // Get all accepted bookings for this spot
      const { data: bookings, error } = await supabase
        .from('booking_requests')
        .select('start_date, end_date, start_time, end_time')
        .eq('spot_id', spotId)
        .eq('status', 'accepted');

      if (error) throw error;

      if (!bookings || bookings.length === 0) return { available: true }; // No bookings, slot is available

      // Check for conflicts
      const requestedStart = new Date(`${startDate.toLocaleDateString('en-CA')}T${startTime}`);
      const requestedEnd = new Date(`${endDate.toLocaleDateString('en-CA')}T${endTime}`);

      for (const booking of bookings) {
        const bookingStart = new Date(`${booking.start_date}T${booking.start_time}`);
        const bookingEnd = new Date(`${booking.end_date}T${booking.end_time}`);

        // Check if there's an overlap
        if (!(requestedEnd <= bookingStart || requestedStart >= bookingEnd)) {
          return { available: false, reason: 'booking_conflict' }; // Time slot conflicts with existing booking
        }
      }

      return { available: true }; // No conflicts found
    } catch (error) {
      console.error('Error checking time slot availability:', error);
      return { available: false, reason: 'error' };
    }
  };

  // Create a booking request with date/time data
  const createBookingRequest = async (bookingData: BookingData) => {
    if (!currentUserId || !selectedSpot) return;

    setBookingLoading(true);
    setBookingMessage('');
    setShowBookingModal(false);

    try {
      // Check if the requested time slot is available
      const availability = await checkTimeSlotAvailability(
        selectedSpot.id,
        bookingData.startDate,
        bookingData.endDate,
        bookingData.startTime,
        bookingData.endTime
      );

      if (!availability.available) {
        let message = '⚠️ ';
        if (availability.reason === 'outside_schedule') {
          message += 'This time slot is outside the available schedule for this parking spot. Please check the available hours.';
        } else if (availability.reason === 'booking_conflict') {
          message += 'This time slot conflicts with an existing booking. Please choose a different time.';
        } else {
          message += 'This time slot is not available. Please try a different time.';
        }
        setBookingMessage(message);
        setBookingLoading(false);
        setShowBookingModal(true); // Re-open the modal to let user pick different time
        return;
      }

      // Ensure user has a profile before creating booking request
      await ensureUserProfile();

      // Calculate total price for validation
      const durationHours = (bookingData.endDate.getTime() - bookingData.startDate.getTime()) / (1000 * 60 * 60);
      const totalPrice = selectedSpot.price ? selectedSpot.price * durationHours : 0;

      // Check wallet balance if spot has pricing
      if (selectedSpot.price && totalPrice > 0) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', currentUserId)
          .single();

        if (profileError) throw profileError;

        const currentBalance = profile?.wallet_balance || 0;

        if (currentBalance < totalPrice) {
          setBookingMessage(`❌ Sold insuficient în portofel. Aveți nevoie de ${totalPrice.toFixed(2)} RON dar aveți doar ${currentBalance.toFixed(2)} RON. Vă rugăm să adăugați fonduri.`);
          setBookingLoading(false);
          return;
        }
      }

      // Format dates for database (use local date to avoid timezone issues)
      const startDateStr = formatLocalDate(bookingData.startDate);
      const endDateStr = formatLocalDate(bookingData.endDate);

      // Booking type was already calculated above for validation
      const bookingType = durationHours <= 24 ? 'hourly' : 'daily';

      // totalPrice was already calculated above for validation

      // Try to insert with pricing info, fallback to basic insert if columns don't exist
      let insertData = {
        spot_id: selectedSpot.id,
        requester_id: currentUserId,
        owner_id: selectedSpot.owner_id,
        status: 'pending',
        message: bookingData.message || 'Request to book this parking spot',
        start_date: startDateStr,
        end_date: endDateStr,
        start_time: bookingData.startTime,
        end_time: bookingData.endTime,
        booking_type: bookingType,
        user_timezone: bookingData.userTimezone
      };

      // Add pricing info if spot has pricing
      if (selectedSpot.price && totalPrice > 0) {
        (insertData as any).total_hours = durationHours;
        (insertData as any).total_price = totalPrice;
      }

      const { data, error } = await supabase
        .from('booking_requests')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        // If the error is about missing columns, try again without pricing info
        if (error.message && error.message.includes('total_hours') || error.message.includes('total_price')) {
          console.warn('Database missing pricing columns, creating request without pricing info');
          const basicInsertData = {
            spot_id: selectedSpot.id,
            requester_id: currentUserId,
            owner_id: selectedSpot.owner_id,
            status: 'pending',
            message: bookingData.message || 'Request to book this parking spot',
            start_date: startDateStr,
            end_date: endDateStr,
            start_time: bookingData.startTime,
            end_time: bookingData.endTime,
            booking_type: bookingType,
            user_timezone: bookingData.userTimezone
          };

          const { data: fallbackData, error: fallbackError } = await supabase
            .from('booking_requests')
            .insert([basicInsertData])
            .select()
            .single();

          if (fallbackError) throw fallbackError;

          // Store the calculated pricing info in the response for display
          fallbackData.total_hours = durationHours;
          fallbackData.total_price = totalPrice;
        } else {
          throw error;
        }
      }

      setExistingBooking(data);

      // Show success notification
      setBookingMessage('✅ Booking request sent successfully! The owner will be notified.');

      // Trigger real-time notification for the owner
      // The real-time subscription in BookingRequestsManager will handle showing notifications to owners

      setShowBookingModal(false); // Close the modal on success
    } catch (error: any) {
      console.error('Error creating booking request:', error);
      if (error.code === '23505') {
        setBookingMessage('⚠️ You already have a pending request for this spot.');
      } else if (error.code === '23503') {
        setBookingMessage('❌ Profile issue. Please refresh and try again.');
      } else if (error.code === '42501') {
        setBookingMessage('❌ Booking validation failed. Please check your dates and times.');
      } else if (error.message?.includes('violates row-level security policy')) {
        setBookingMessage('❌ Booking not allowed. Please check your booking details.');
      } else {
        setBookingMessage('❌ Failed to send booking request. Please try again.');
      }
    } finally {
      setBookingLoading(false);
    }
  };


  const ensureUserProfile = async (): Promise<boolean> => {
    if (!currentUserId) return false;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentUserId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: currentUserId,
            email: 'user@example.com',
            full_name: 'User'
          }]);

        if (createError && createError.code !== '23505') {
          console.error('Error creating user profile:', createError);
          return false;
        }
        console.log('User profile created successfully for booking');
        return true;
      }
      return true;
    } catch (error) {
      console.error('Exception ensuring user profile for booking:', error);
      return false;
    }
  };

  const getStatusColor = (status: ParkingSpot['status']) => {
    switch (status) {
      case 'available':
        return '#00C48C'; // Green
      case 'reserved':
        return '#007BFF'; // Blue
      case 'occupied':
        return '#2E2E2E'; // Dark gray
      default:
        return '#6B7280'; // Gray
    }
  };

  const getStatusIcon = (status: ParkingSpot['status']) => {
    switch (status) {
      case 'available':
        return '🅿️';
      case 'reserved':
        return '🚗';
      case 'occupied':
        return '🚫';
      default:
        return '📍';
    }
  };

  const isOwner = (spot: ParkingSpot) => spot.owner_id === currentUserId;

  // Search for locations using Nominatim (OpenStreetMap geocoding)
  const searchLocations = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle location selection from search results
  const selectLocation = (location: any) => {
    const lat = parseFloat(location.lat);
    const lng = parseFloat(location.lon);

    setMapCenter([lat, lng]);
    setMapZoom(16);
    setSearchQuery(location.display_name.split(',')[0]); // Show just the main part of the address
    setShowSearchResults(false);

    // Store searched location for marker display
    setSearchedLocation({
      lat,
      lng,
      name: location.display_name.split(',')[0],
      address: location.display_name.split(',').slice(1, 3).join(', ')
    });
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchLocations(searchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-locate user on component mount
  useEffect(() => {
    console.log('LeafletMapView: Component mounted, attempting to get user location');

    // Immediate attempt to get location
    getCurrentLocation();

    // Backup attempt after 8 seconds in case the first one fails or takes too long
    const backupTimer = setTimeout(() => {
      if (!userLocation) {
        console.log('LeafletMapView: Backup location attempt');
        getCurrentLocation();
      }
    }, 8000);

    return () => clearTimeout(backupTimer);
  }, []);

  // Get user's current location
  const getCurrentLocation = () => {
    console.log('getCurrentLocation called');
    setLocationLoading(true);
    setMapError(null); // Clear any previous errors

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      setLocationLoading(false);
      setMapError('Geolocation is not supported by this browser.');
      return;
    }

    console.log('Requesting geolocation...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log('Location obtained:', { latitude, longitude, accuracy });

        const newLocation: [number, number] = [latitude, longitude];
        setUserLocation(newLocation);
        setMapCenter(newLocation); // Update map center to user location
        setMapZoom(16); // Zoom in closer when we have accurate location
        setLocationLoading(false);
        setMapError(null); // Clear any previous errors

        console.log('Location found and map centered on:', newLocation);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationLoading(false);

        let errorMessage = 'Unable to get your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your GPS settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = 'An unknown error occurred while retrieving location.';
            break;
        }

        setMapError(errorMessage);
        console.warn('Geolocation failed, keeping current map center');
      },
      {
        enableHighAccuracy: true, // Enable high accuracy for better location
        timeout: 20000, // Increase timeout to 20 seconds
        maximumAge: 600000 // 10 minutes - cache location for longer
      }
    );
  };

  // Check if spot is currently within available hours
  const isSpotCurrentlyAvailable = (spot: ParkingSpot): boolean => {
    // If spot doesn't have a schedule, use default availability
    if (!spot.has_availability_schedule) {
      return spot.default_available !== false;
    }

    // Get schedules for this spot
    const spotSchedules = allSpotsSchedules.get(spot.id);
    if (!spotSchedules || spotSchedules.length === 0) {
      // No schedules found, default to unavailable if schedule is set
      return false;
    }

    // Get current day and time in user's timezone
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS format

    // Check if current time falls within any available slot for today
    const todaySchedules = spotSchedules.filter(s => s.day_of_week === dayOfWeek);
    
    for (const schedule of todaySchedules) {
      if (currentTime >= schedule.start_time && currentTime <= schedule.end_time) {
        return true; // Currently within an available time slot
      }
    }

    // Not within any available time slot
    return false;
  };

  // Get effective status based on availability schedule
  const getEffectiveStatus = (spot: ParkingSpot): ParkingSpot['status'] => {
    // If manually set to occupied, keep it
    if (spot.status === 'occupied') return 'occupied';
    
    // If reserved by a booking, keep it
    if (spot.status === 'reserved') return 'reserved';

    // If spot has availability schedule and is outside available hours, show as occupied
    if (spot.has_availability_schedule && !isSpotCurrentlyAvailable(spot)) {
      return 'occupied';
    }

    // Otherwise, show actual status
    return spot.status;
  };

  // Create custom marker icon
  const createCustomIcon = (status: ParkingSpot['status'], isOwned: boolean, spot?: ParkingSpot) => {
    // Use effective status that considers availability schedule
    const effectiveStatus = spot ? getEffectiveStatus(spot) : status;
    const color = getStatusColor(effectiveStatus);
    const icon = getStatusIcon(effectiveStatus);
    const isAvailable = effectiveStatus === 'available';
    const isReserved = effectiveStatus === 'reserved';
    const hasActiveBooking = isReserved;

    return L.divIcon({
      html: `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
        ">
          <!-- Outer glow ring for available spots -->
          ${isAvailable ? `
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 36px;
              height: 36px;
              border: 2px solid ${color};
              border-radius: 50%;
              animation: parking-glow 2s infinite ease-in-out;
              opacity: 0.6;
            "></div>
          ` : ''}

          <!-- Main marker body -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) ${isAvailable ? 'rotate(-45deg)' : 'rotate(0deg)'};
            width: 28px;
            height: 28px;
            background: linear-gradient(135deg, ${color}, ${color}dd);
            border: 3px solid white;
            border-radius: 50% 50% 50% ${isAvailable ? '0' : '50%'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            ${isAvailable ? 'animation: parking-bounce 2s infinite;' : ''}
            transition: all 0.3s ease;
          ">
            <div style="${isAvailable ? 'transform: rotate(45deg);' : ''}">${icon}</div>
          </div>

          <!-- Owner indicator -->
          ${isOwned ? `
            <div style="
              position: absolute;
              top: 2px;
              right: 2px;
              width: 10px;
              height: 10px;
              background: linear-gradient(135deg, #FFD700, #FFA500);
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              animation: owner-star 3s infinite;
            "></div>
          ` : ''}

          <!-- Pin pointer -->
          <div style="
            position: absolute;
            bottom: ${isAvailable ? '-6px' : '-4px'};
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: ${isAvailable ? '6px' : '4px'} solid transparent;
            border-right: ${isAvailable ? '6px' : '4px'} solid transparent;
            border-top: ${isAvailable ? '8px' : '6px'} solid ${color};
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
            ${isAvailable ? 'animation: pointer-pulse 2s infinite;' : ''}
          "></div>

          <!-- Time-based booking indicator for reserved spots -->
          ${hasActiveBooking ? `
            <div style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 16px;
              height: 16px;
              background: #007BFF;
              border: 2px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              animation: pointer-pulse 2s infinite;
            ">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/>
              </svg>
            </div>
          ` : ''}

          <style>
            @keyframes parking-glow {
              0%, 100% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 0.6;
              }
              50% {
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 0.3;
              }
            }
            @keyframes parking-bounce {
              0%, 100% {
                transform: translate(-50%, -50%) rotate(-45deg) scale(1);
              }
              50% {
                transform: translate(-50%, -50%) rotate(-45deg) scale(1.1);
              }
            }
            @keyframes owner-star {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              }
              50% {
                transform: scale(1.2);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              }
            }
            @keyframes pointer-pulse {
              0%, 100% {
                border-top-color: ${color};
              }
              50% {
                border-top-color: ${color}dd;
              }
            }
          </style>
        </div>
      `,
      className: 'custom-marker',
      iconSize: isAvailable ? [36, 44] : [28, 34],
      iconAnchor: isAvailable ? [18, 44] : [14, 34],
    });
  };

  // If Leaflet is not loaded yet, show loading
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    // Inject custom CSS on client side - only if not already present
    if (typeof document !== 'undefined') {
      const existingStyle = document.querySelector('style[data-map-styles]');
      if (!existingStyle) {
        const styleSheet = document.createElement('style');
        styleSheet.setAttribute('data-map-styles', 'true');
        styleSheet.textContent = mapStyles;
        document.head.appendChild(styleSheet);
      }
    }

    console.log('LeafletMapView initialized with center:', mapCenter, 'zoom:', mapZoom);
  }, []);

  // Log state changes
  useEffect(() => {
    console.log('Map center changed to:', mapCenter);
  }, [mapCenter]);

  useEffect(() => {
    console.log('Map zoom changed to:', mapZoom);
  }, [mapZoom]);

  useEffect(() => {
    console.log('User location changed to:', userLocation);
  }, [userLocation]);

  // Periodic cleanup of expired bookings and status updates
  useEffect(() => {
    const performMaintenanceTasks = async () => {
      try {
        const now = new Date();
        console.log('🔄 Running maintenance tasks at:', now.toISOString(), '- checking for expired bookings...');

        // Update spot statuses based on current time (bookings starting/ending)
        console.log('🔄 Calling update_booking_statuses_full_cycle function...');
        const { data: statusUpdates, error: statusError } = await supabase.rpc('update_booking_statuses_full_cycle');
        console.log('🔄 Function call result:', { statusUpdates, error: statusError });

        if (statusError) {
          console.error('❌ Maintenance error:', statusError);
          throw statusError;
        }

        console.log(`✅ Maintenance completed. Spots updated: ${statusUpdates || 0}`);

        if (statusUpdates && statusUpdates > 0) {
          console.log(`🎯 Updated ${statusUpdates} spot statuses based on current time`);
          // Trigger spot data refresh
          window.dispatchEvent(new CustomEvent('spotsDataChanged'));
        } else {
          console.log('ℹ️ No spot status updates needed at this time');
        }
      } catch (error) {
        console.error('💥 Error performing maintenance tasks:', error);
      }
    };

    // Run maintenance immediately and then every 2 minutes
    console.log('🚀 Starting maintenance tasks...');
    performMaintenanceTasks();
    const interval = setInterval(() => {
      console.log('⏰ Running scheduled maintenance...');
      performMaintenanceTasks();
    }, 2 * 60 * 1000); // 2 minutes

    return () => {
      console.log('🛑 Stopping maintenance tasks...');
      clearInterval(interval);
    };
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-[700px] bg-gray-100 rounded-3xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00C48C] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Search Bar */}
      <div className="mb-4 relative z-30 px-4">
        <div className="w-full max-w-none search-container">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.parking.map.searchPlaceholder}
              className="block w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl bg-white shadow-lg focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                  setSearchedLocation(null); // Clear searched location marker
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00C48C]"></div>
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => selectLocation(result)}
                  className="w-full px-3 sm:px-6 py-2 sm:py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-start gap-2 sm:gap-3 transition-colors"
                >
                  <MapPinIcon className="h-5 w-5 text-[#00C48C] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {result.display_name.split(',')[0]}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {result.display_name.split(',').slice(1, 4).join(', ')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {showSearchResults && searchResults.length === 0 && !isSearching && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-center z-50">
              <MapPinIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No places found</p>
              <p className="text-sm text-gray-400">Try searching for cities, addresses, or landmarks worldwide</p>
            </div>
          )}
        </div>
      </div>


      {/* Real Leaflet Map */}
      <div 
        id="leaflet-map-wrapper"
        className={`rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-300 relative z-10 ${selectingLocation ? 'cursor-crosshair' : ''}`}
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
          {/* Location Button */}
          <button
            onClick={getCurrentLocation}
            disabled={locationLoading}
            className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-xl shadow-lg border border-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Find my location"
          >
            {locationLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
            ) : (
              <Crosshair className="w-5 h-5" />
            )}
          </button>


          {/* Auto-location Loading Indicator */}
          {locationLoading && !userLocation && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg shadow-md text-xs max-w-xs">
              <div className="flex items-center gap-1">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 flex-shrink-0"></div>
                <span>Finding your location...</span>
              </div>
            </div>
          )}


          {/* Location Error Display */}
          {mapError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg shadow-md text-xs max-w-xs">
              <div className="flex items-center gap-1">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{mapError}</span>
              </div>
            </div>
          )}

          {/* Recenter Button */}
          {userLocation && (
            <button
              onClick={() => {
                console.log('Recenter button clicked, centering on:', userLocation);

                // Use state-based centering for more reliable behavior
                setMapCenter(userLocation);
                setMapZoom(16);

                // Also try direct map ref if available for immediate effect
                if (mapRef.current) {
                  try {
                    mapRef.current.setView(userLocation, 16, {
                      animate: true,
                      duration: 1.0
                    });
                    console.log('Map recentered successfully');
                  } catch (error) {
                    console.error('Direct map recentering failed:', error);
                  }
                }
              }}
              className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-xl shadow-lg border border-gray-200 transition-all"
              title="Center on my location"
            >
              <Navigation className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Map Error Overlay */}
        {mapError && (
          <div className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md mx-4 text-center">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Temporarily Unavailable</h3>
              <p className="text-gray-600 mb-4">{mapError}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setMapError(null);
                    // Force map to reload tiles
                    window.location.reload();
                  }}
                  className="bg-[#00C48C] hover:bg-[#00b37d] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Reload Map
                </button>
                <button
                  onClick={() => setMapError(null)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        <MapContainer
          key={`leaflet-map-${mapKey}`}
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '700px', width: '100%' }}
          className={selectingLocation ? 'cursor-crosshair' : 'cursor-default'}
          zoomControl={false}
          attributionControl={false}
          whenReady={() => console.log('Map ready')}
        >
          {/* Primary Map Layer - Mapbox Streets (Ultra-High Detail) */}
          {/* Tiles are now proxied through our backend to keep the access token secure */}
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={`/api/mapbox-tiles/streets-v12/{z}/{x}/{y}`}
            maxZoom={22}
            tileSize={512}
            zoomOffset={-1}
            eventHandlers={{
              tileerror: () => {
                console.warn('Mapbox tiles failed to load');
                setMapError('Map tiles temporarily unavailable. Please try again later.');
              },
              tileload: () => {
                setMapError(null);
              }
            }}
          />

          {/* Optional: Satellite Imagery Layer (can be toggled) */}
          {/*
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={`/api/mapbox-tiles/satellite-v9/{z}/{x}/{y}`}
            maxZoom={22}
            tileSize={512}
            zoomOffset={-1}
            opacity={0.8}
          />
          */}

          {/* Map controller for programmatic center/zoom changes */}
          {mapCenter && <MapController center={mapCenter} zoom={mapZoom} mapInstance={mapRef.current} />}

          {/* Click handler for adding spots */}
          <MapClickHandler
            onAddSpotAtLocation={onAddSpotAtLocation}
            selectingLocation={selectingLocation}
          />

          {/* Scale control for distance measurement */}
          <ScaleControl
            position="bottomleft"
            imperial={true}
            metric={true}
          />

          {/* Pin placement mode indicator */}
          {selectingLocation && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#00C48C] text-white px-6 py-3 rounded-full shadow-lg z-[1000] animate-pulse">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span className="font-semibold">Click on the map to place your pin</span>
              </div>
            </div>
          )}

          {/* Parking Spot Markers */}
          {spots.map((spot) => {
            // Use actual GPS coordinates if available, otherwise convert legacy percentage coordinates
            let lat: number, lng: number;

            if (spot.latitude && spot.longitude) {
              // Use actual GPS coordinates
              lat = spot.latitude;
              lng = spot.longitude;
            } else {
              // Fallback to legacy percentage-based coordinates
              // Convert percentages (0-100) to small offsets around map center
              let centerLat = 40.7128; // Default to NYC
              let centerLng = -74.0060;

              if (mapCenter && mapCenter[0] !== null && mapCenter[1] !== null) {
                centerLat = mapCenter[0];
                centerLng = mapCenter[1];
              }

              lat = centerLat + (spot.map_y ? (spot.map_y - 50) * 0.01 : Math.random() * 0.1 - 0.05);
              lng = centerLng + (spot.map_x ? (spot.map_x - 50) * 0.01 : Math.random() * 0.1 - 0.05);
            }

            return (
              <Marker
                key={spot.id}
                position={[lat, lng]}
                icon={createCustomIcon(spot.status, isOwner(spot), spot)}
                eventHandlers={{
                  click: () => setSelectedSpot(spot),
                }}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-bold text-lg">{spot.name}</h3>
                    <p className="text-sm text-gray-600">
                      {spot.status === 'available' ? t.parking.spot.availableNow :
                       spot.status === 'reserved' ? t.parking.spot.booked :
                       t.parking.spot.occupied}
                    </p>
                    {isOwner(spot) && (
                      <span className="text-xs bg-[#00C48C] text-white px-2 py-1 rounded-full">{t.modals.spotDetails.yourSpot}</span>
                    )}
                    <div className="mt-2 space-y-1">
                      <button
                        onClick={() => setSelectedSpot(spot)}
                        className="w-full bg-[#00C48C] text-white text-sm py-1 px-3 rounded hover:bg-[#00b37d] transition-colors"
                      >
                        {t.modals.spotDetails.viewDetails}
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={L.divIcon({
                html: `
                  <div style="
                    position: relative;
                    width: 24px;
                    height: 24px;
                  ">
                    <!-- Outer ripple rings -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 24px;
                      height: 24px;
                      border: 2px solid #4285F4;
                      border-radius: 50%;
                      animation: location-ripple 2s infinite ease-out;
                    "></div>
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 16px;
                      height: 16px;
                      border: 2px solid #4285F4;
                      border-radius: 50%;
                      animation: location-ripple 2s infinite ease-out 0.5s;
                      opacity: 0.6;
                    "></div>

                    <!-- Main location dot -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 12px;
                      height: 12px;
                      background: linear-gradient(135deg, #4285F4, #1a73e8);
                      border: 2px solid white;
                      border-radius: 50%;
                      box-shadow: 0 2px 8px rgba(66, 133, 244, 0.4);
                      animation: location-pulse 2s infinite;
                    "></div>

                    <!-- Location pin pointer -->
                    <div style="
                      position: absolute;
                      top: 6px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 4px solid transparent;
                      border-right: 4px solid transparent;
                      border-top: 6px solid white;
                      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
                    "></div>

                    <style>
                      @keyframes location-ripple {
                        0% {
                          transform: translate(-50%, -50%) scale(1);
                          opacity: 1;
                        }
                        100% {
                          transform: translate(-50%, -50%) scale(2);
                          opacity: 0;
                        }
                      }
                      @keyframes location-pulse {
                        0%, 100% {
                          transform: translate(-50%, -50%) scale(1);
                          box-shadow: 0 2px 8px rgba(66, 133, 244, 0.4);
                        }
                        50% {
                          transform: translate(-50%, -50%) scale(1.1);
                          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.6);
                        }
                      }
                    </style>
                  </div>
                `,
                className: 'user-location-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            >
              <Popup>
                <div className="text-center">
                  <strong>📍 {t.parking.map.legend.yourLocation}</strong>
                  <br />
                  <span className="text-sm text-gray-600">
                    {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Searched location marker */}
          {searchedLocation && (
            <Marker
              position={[searchedLocation.lat, searchedLocation.lng]}
              icon={L.divIcon({
                html: `
                  <div style="
                    position: relative;
                    width: 32px;
                    height: 32px;
                  ">
                    <!-- Outer search indicator ring -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 32px;
                      height: 32px;
                      border: 2px solid #FF6B35;
                      border-radius: 50%;
                      animation: search-glow 2s infinite ease-in-out;
                      opacity: 0.7;
                    "></div>

                    <!-- Main search marker -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 24px;
                      height: 24px;
                      background: linear-gradient(135deg, #FF6B35, #F7931E);
                      border: 3px solid white;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 12px;
                      color: white;
                      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
                      animation: search-bounce 2s infinite;
                    ">
                      🔍
                    </div>

                    <!-- Search pin pointer -->
                    <div style="
                      position: absolute;
                      bottom: -2px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 5px solid transparent;
                      border-right: 5px solid transparent;
                      border-top: 8px solid #FF6B35;
                      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                    "></div>

                    <!-- White pointer tip -->
                    <div style="
                      position: absolute;
                      bottom: -1px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 3px solid transparent;
                      border-right: 3px solid transparent;
                      border-top: 4px solid white;
                    "></div>

                    <style>
                      @keyframes search-glow {
                        0%, 100% {
                          transform: translate(-50%, -50%) scale(1);
                          opacity: 0.7;
                        }
                        50% {
                          transform: translate(-50%, -50%) scale(1.3);
                          opacity: 0.4;
                        }
                      }
                      @keyframes search-bounce {
                        0%, 100% {
                          transform: translate(-50%, -50%) scale(1);
                        }
                        50% {
                          transform: translate(-50%, -50%) scale(1.1);
                        }
                      }
                    </style>
                  </div>
                `,
                className: 'searched-location-marker',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
              })}
            >
              <Popup>
                <div className="text-center">
                  <strong>🔍 {searchedLocation.name}</strong>
                  <br />
                  <span className="text-sm text-gray-600">
                    {searchedLocation.address}
                  </span>
                  <br />
                  <span className="text-xs text-gray-500">
                    {searchedLocation.lat.toFixed(6)}, {searchedLocation.lng.toFixed(6)}
                  </span>
                  <br />
                  <button
                    onClick={() => setSearchedLocation(null)}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Remove marker
                  </button>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Pending location marker */}
          {pendingLocation && (
            <Marker
              position={[pendingLocation.lat, pendingLocation.lng]}
              icon={L.divIcon({
                html: `
                  <div style="
                    position: relative;
                    width: 32px;
                    height: 32px;
                  ">
                    <!-- Pulsing ring -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 32px;
                      height: 32px;
                      border: 2px solid #10B981;
                      border-radius: 50%;
                      animation: pending-ring 1.5s infinite ease-out;
                    "></div>

                    <!-- Main pending marker -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 24px;
                      height: 24px;
                      background: linear-gradient(135deg, #10B981, #059669);
                      border: 3px solid white;
                      border-radius: 50% 50% 50% 0;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 12px;
                      color: white;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                      transform: translate(-50%, -50%) rotate(-45deg);
                      animation: pending-bounce 1.5s infinite;
                    ">
                      <div style="transform: rotate(45deg);">📍</div>
                    </div>

                    <!-- Pin pointer -->
                    <div style="
                      position: absolute;
                      bottom: -4px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 5px solid transparent;
                      border-right: 5px solid transparent;
                      border-top: 6px solid #10B981;
                      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
                    "></div>

                    <style>
                      @keyframes pending-ring {
                        0% {
                          transform: translate(-50%, -50%) scale(1);
                          opacity: 1;
                        }
                        100% {
                          transform: translate(-50%, -50%) scale(1.5);
                          opacity: 0;
                        }
                      }
                      @keyframes pending-bounce {
                        0%, 100% {
                          transform: translate(-50%, -50%) rotate(-45deg) scale(1);
                        }
                        50% {
                          transform: translate(-50%, -50%) rotate(-45deg) scale(1.15);
                        }
                      }
                    </style>
                  </div>
                `,
                className: 'custom-marker',
                iconSize: [32, 36],
                iconAnchor: [16, 36],
              })}
            />
          )}

          {/* Pin placement marker */}
          {pinPlacementMarker && (
            <Marker
              position={[pinPlacementMarker.lat, pinPlacementMarker.lng]}
              icon={L.divIcon({
                html: `
                  <div style="
                    position: relative;
                    width: 40px;
                    height: 40px;
                  ">
                    <!-- Pulsing outer ring -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 40px;
                      height: 40px;
                      border: 3px solid #FF6B35;
                      border-radius: 50%;
                      animation: pin-placement-pulse 2s infinite ease-out;
                      opacity: 0.8;
                    "></div>

                    <!-- Inner pulsing ring -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 24px;
                      height: 24px;
                      border: 2px solid #FF6B35;
                      border-radius: 50%;
                      animation: pin-placement-pulse 2s infinite ease-out 0.5s;
                      opacity: 0.6;
                    "></div>

                    <!-- Main pin marker -->
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: 28px;
                      height: 28px;
                      background: linear-gradient(135deg, #FF6B35, #F7931E);
                      border: 3px solid white;
                      border-radius: 50% 50% 50% 0;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 14px;
                      color: white;
                      box-shadow: 0 4px 16px rgba(255, 107, 53, 0.4);
                      transform: translate(-50%, -50%) rotate(-45deg);
                      animation: pin-placement-bounce 2s infinite;
                    ">
                      <div style="transform: rotate(45deg);">📍</div>
                    </div>

                    <!-- Pin pointer -->
                    <div style="
                      position: absolute;
                      bottom: -6px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 6px solid transparent;
                      border-right: 6px solid transparent;
                      border-top: 8px solid #FF6B35;
                      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                    "></div>

                    <style>
                      @keyframes pin-placement-pulse {
                        0% {
                          transform: translate(-50%, -50%) scale(1);
                          opacity: 0.8;
                        }
                        100% {
                          transform: translate(-50%, -50%) scale(1.4);
                          opacity: 0;
                        }
                      }
                      @keyframes pin-placement-bounce {
                        0%, 100% {
                          transform: translate(-50%, -50%) rotate(-45deg) scale(1);
                        }
                        50% {
                          transform: translate(-50%, -50%) rotate(-45deg) scale(1.1);
                        }
                      }
                    </style>
                  </div>
                `,
                className: 'pin-placement-marker',
                iconSize: [40, 46],
                iconAnchor: [20, 46],
              })}
            >
              <Popup>
                <div className="text-center">
                  <strong>📍 {t.parking.map.legend.selectedLocation}</strong>
                  <br />
                  <span className="text-sm text-gray-600">
                    {t.parking.map.clickAddSpotToName}
                  </span>
                  <br />
                  <span className="text-xs text-gray-500">
                    {pinPlacementMarker.lat.toFixed(6)}, {pinPlacementMarker.lng.toFixed(6)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>


      {/* Status Legend */}
      <div className="mt-4 flex items-center gap-6 justify-center flex-wrap bg-white p-4 rounded-2xl shadow-lg">
        <div key="available-status" className="flex items-center gap-3">
          <div className="relative">
            {/* Animated glow ring for available */}
            <div className="absolute inset-0 w-7 h-7 border-2 border-[#00C48C] rounded-full animate-ping opacity-30"></div>
            <div className="relative w-5 h-5 bg-gradient-to-br from-[#00C48C] to-[#00b37d] rounded-full border-2 border-white shadow-md transform rotate-45 animate-pulse">
              <div className="absolute inset-0 flex items-center justify-center transform rotate-45">
                <span className="text-xs transform -rotate-45">🅿️</span>
              </div>
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-[#00C48C]"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.available}</span>
        </div>
        <div key="reserved-status" className="flex items-center gap-3">
          <div className="relative">
            <div className="w-5 h-5 bg-gradient-to-br from-[#007BFF] to-[#0056b3] rounded-full border-2 border-white shadow-md"></div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#007BFF] border border-white rounded-full flex items-center justify-center animate-pulse">
              <span className="text-xs">✓</span>
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-[#007BFF]"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.reserved}</span>
        </div>
        <div key="occupied-status" className="flex items-center gap-3">
          <div className="relative">
            <div className="w-5 h-5 bg-gradient-to-br from-[#2E2E2E] to-[#1a1a1a] rounded-full border-2 border-white shadow-md"></div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-[#2E2E2E]"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.occupied}</span>
        </div>
        <div key="your-spot-status" className="flex items-center gap-3">
          <div className="relative">
            <div className="w-5 h-5 bg-gradient-to-br from-[#00C48C] to-[#00b37d] rounded-full border-2 border-white shadow-md transform rotate-45"></div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-[#FFD700] to-[#FFA500] border border-white rounded-full shadow-sm animate-pulse"></div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-[#00C48C]"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.yourSpot}</span>
        </div>
        <div key="your-location-status" className="flex items-center gap-3">
          <div className="relative">
            {/* Ripple effect for location */}
            <div className="absolute inset-0 w-7 h-7 border-2 border-[#4285F4] rounded-full animate-ping opacity-30"></div>
            <div className="relative w-4 h-4 bg-gradient-to-br from-[#4285F4] to-[#1a73e8] border-2 border-white rounded-full shadow-md animate-pulse"></div>
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-1 border-r-1 border-b-1 border-transparent border-b-white"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.yourLocation}</span>
        </div>
        <div key="searched-place-status" className="flex items-center gap-3">
          <div className="relative">
            {/* Search marker effect */}
            <div className="absolute inset-0 w-7 h-7 border-2 border-[#FF6B35] rounded-full animate-ping opacity-30"></div>
            <div className="relative w-5 h-5 bg-gradient-to-br from-[#FF6B35] to-[#F7931E] border-2 border-white rounded-full shadow-md animate-pulse flex items-center justify-center text-xs">
              🔍
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-[#FF6B35]"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.searchedPlace}</span>
        </div>
        <div key="selected-spot-status" className="flex items-center gap-3">
          <div className="relative">
            {/* Pin placement marker effect */}
            <div className="absolute inset-0 w-8 h-8 border-2 border-[#FF6B35] rounded-full animate-ping opacity-30"></div>
            <div className="relative w-6 h-6 bg-gradient-to-br from-[#FF6B35] to-[#F7931E] border-2 border-white rounded-full shadow-md animate-pulse flex items-center justify-center transform rotate-45 text-xs">
              📍
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-[#FF6B35]"></div>
          </div>
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.selectedLocation}</span>
        </div>
      </div>

      {/* Spot Detail Modal */}
      {selectedSpot && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ paddingTop: '80px' }}>
          <div className={`bg-gradient-to-br border-4 rounded-3xl shadow-2xl transform scale-100 animate-in zoom-in duration-300 relative max-h-[90vh] w-full max-w-sm sm:max-w-md lg:max-w-lg overflow-hidden ${
            selectedSpot.status === 'available'
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-[#00C48C]'
              : selectedSpot.status === 'reserved'
              ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-[#007BFF]'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 border-[#2E2E2E]'
          }`}>
            {/* Scrollable Content */}
            <div className="max-h-[85vh] overflow-y-auto p-3 sm:p-4 lg:p-6">
            {/* Close Button */}
            <button
              onClick={() => setSelectedSpot(null)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white hover:bg-gray-100 p-1.5 sm:p-2 rounded-full shadow-lg transition-colors z-10"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>

            {/* Spot Header */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className={`bg-gradient-to-br p-3 sm:p-4 rounded-2xl shadow-lg flex-shrink-0 ${
                selectedSpot.status === 'available' ? 'from-[#00C48C] to-[#00b37d]' :
                selectedSpot.status === 'reserved' ? 'from-[#007BFF] to-[#0056b3]' :
                'from-gray-400 to-gray-600'
              }`}>
                <MapPin className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white fill-current" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{selectedSpot.name}</h3>
                {isOwner(selectedSpot) && (
                  <span className="inline-block bg-[#00C48C] text-white text-xs sm:text-sm font-semibold px-2 py-1 sm:px-3 sm:py-1 rounded-full">
                    <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                    {t.modals.spotDetails.yourSpot}
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-4 sm:mb-6 flex justify-center sm:justify-start">
              <div className={`inline-block bg-gradient-to-br text-white px-4 py-2 sm:px-6 sm:py-2 rounded-full font-bold text-base sm:text-lg uppercase tracking-wider shadow-lg ${
                selectedSpot.status === 'available' ? 'from-[#00C48C] to-[#00b37d]' :
                selectedSpot.status === 'reserved' ? 'from-[#007BFF] to-[#0056b3]' :
                'from-gray-400 to-gray-600'
              }`}>
                {getTranslatedStatus(selectedSpot.status)}
              </div>
            </div>

            {/* Spot Details */}
            <div className="bg-white bg-opacity-50 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-3">
              {/* Owner Information */}
              <div className="bg-white bg-opacity-80 rounded-xl p-3 mb-2">
                <p className="text-xs font-semibold text-gray-700 uppercase mb-2">{t.modals.spotDetails.spotOwner}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-800">
                    <UserIcon className="w-4 h-4 text-[#00C48C]" />
                    <span className="text-sm font-semibold">
                      {selectedSpot.owner_name || t.modals.spotDetails.owner}
                    </span>
                    {isOwner(selectedSpot) && (
                      <span className="text-xs bg-[#00C48C] text-white px-2 py-0.5 rounded-full">{t.modals.spotDetails.you}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-xs">{selectedSpot.owner_email || t.modals.spotDetails.contactViaBooking}</span>
                  </div>
                  {!isOwner(selectedSpot) && (
                    <p className="text-xs text-gray-500 mt-2">
                      {t.modals.spotDetails.sendBookingRequest}
                    </p>
                  )}
                </div>
              </div>

              {/* Pricing Information */}
              {selectedSpot.price && (
                <div className="bg-white bg-opacity-80 rounded-xl p-3 mb-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">{t.modals.spotDetails.pricing}</p>
                  <div className="flex items-center gap-2 text-gray-800">
                    <span className="text-green-600 font-bold text-lg">{selectedSpot.price.toFixed(2)} RON</span>
                    <span className="text-sm text-gray-600">{t.modals.spotDetails.perHour}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isOwner(selectedSpot)
                      ? t.modals.spotDetails.hourlyRate
                      : t.modals.spotDetails.hourlyRateToBook
                    }
                  </p>
                  {!isOwner(selectedSpot) && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <strong>💰 {t.modals.spotDetails.walletRequired}</strong> {t.modals.spotDetails.ensureSufficientBalance}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* User's Existing Bookings */}
              {existingBookings.length > 0 && (
                <div className="bg-white bg-opacity-80 rounded-xl p-3 mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Your Bookings</p>
                  <div className="space-y-2">
                    {existingBookings.map((booking, index) => (
                      <div key={booking.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              booking.status === 'accepted' ? 'bg-green-500' :
                              booking.status === 'pending' ? 'bg-blue-500' :
                              'bg-gray-500'
                            }`}></div>
                            <span className="text-sm font-semibold capitalize text-gray-900">
                              {booking.status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {booking.booking_type === 'daily' ? 'Daily' : 'Hourly'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Date:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {booking.start_date && booking.end_date && (
                                booking.start_date === booking.end_date
                                  ? new Date(booking.start_date).toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      month: 'short',
                                      day: 'numeric',
                                      year: new Date(booking.start_date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                    })
                                  : `${new Date(booking.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(booking.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(booking.end_date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Time:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {booking.start_time && booking.end_time && `${booking.start_time} - ${booking.end_time}`}
                            </span>
                          </div>
                        </div>

                        {booking.message && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-600 italic">"{booking.message}"</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Status Information */}
              {bookingDetails && selectedSpot.status === 'reserved' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-800 uppercase mb-2">{t.modals.booking.currentBooking}</p>
                  {bookingDetails.isMyBooking ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-800">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">{t.parking.spot.reservedByYou}</span>
                      </div>
                      {bookingDetails.startTime && bookingDetails.endTime && (
                        <div className="text-xs text-blue-600">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {bookingDetails.startTime} - {bookingDetails.endTime}
                        </div>
                      )}
                    </div>
                  ) : isOwner(selectedSpot) && bookingDetails.requesterName ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-800">
                        <UserIcon className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                          {t.parking.spot.reservedFor} {bookingDetails.requesterName}
                        </span>
                      </div>
                      {bookingDetails.requesterEmail && (
                        <span className="text-xs text-blue-600">
                          ({bookingDetails.requesterEmail})
                        </span>
                      )}
                      {bookingDetails.startTime && bookingDetails.endTime && (
                        <div className="text-xs text-blue-600">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {bookingDetails.startTime} - {bookingDetails.endTime}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-800">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-semibold">{t.modals.booking.currentlyReserved}</span>
                      </div>
                      {bookingDetails.startTime && bookingDetails.endTime && (
                        <div className="text-xs text-blue-600">
                          {t.parking.availability.untilToday} {bookingDetails.endTime} {t.parking.availability.today}
                        </div>
                      )}
                      <div className="text-xs text-green-700 font-medium mt-2">
                        {t.parking.spot.canStillBookOtherSlots}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Availability Schedule Display */}
              {spotAvailability && spotAvailability.hasSchedule && spotAvailability.schedules && spotAvailability.schedules.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-800 uppercase mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {t.parking.availability.availableHours}
                  </p>
                  <div className="space-y-3">
                    {/* Upcoming Available Dates */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">Următoarele date disponibile</p>
                      {(() => {
                        const upcomingDates: Array<{date: string; timeRange: string; fullDate: Date}> = [];
                        const today = new Date();
                        const blockedDatesSet = new Set(spotAvailability.blockedDates?.map((b: any) => b.blocked_date) || []);

                        // Get upcoming week availability (current week onwards)
                        for (let weekOffset = 0; weekOffset < 1; weekOffset++) {
                          [
                            t.modals.booking.sun,
                            t.modals.booking.mon,
                            t.modals.booking.tue,
                            t.modals.booking.wed,
                            t.modals.booking.thu,
                            t.modals.booking.fri,
                            t.modals.booking.sat
                          ].forEach((dayName, dayIndex) => {
                            const daySchedules = spotAvailability.schedules?.filter((s: any) => s.day_of_week === dayIndex);
                            if (!daySchedules || daySchedules.length === 0) return;

                            // Calculate the date for this day in the current week offset
                            const targetDate = new Date(today);
                            const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
                            const daysToAdd = (dayIndex - currentDayOfWeek + 7) % 7 + (weekOffset * 7);

                            targetDate.setDate(today.getDate() + daysToAdd);

                            // Skip dates in the past (but allow today)
                            if (targetDate < today && targetDate.toDateString() !== today.toDateString()) {
                              return;
                            }

                            // Skip if this date is blocked
                            const dateString = targetDate.toLocaleDateString('en-CA');
                            if (blockedDatesSet.has(dateString)) return;

                            // Format the date
                            const formattedDate = targetDate.toLocaleDateString('ro-RO', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });

                            daySchedules.forEach((schedule: any) => {
                              upcomingDates.push({
                                date: formattedDate,
                                timeRange: `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`,
                                fullDate: new Date(targetDate) // Clone the date
                              });
                            });
                          });
                        }

                        // Sort by date and show next week's available slots
                        return upcomingDates
                          .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
                          .slice(0, 6)
                          .map((dateInfo, index) => (
                            <div key={index} className="text-xs text-green-700 bg-green-100 bg-opacity-50 rounded px-2 py-1">
                              <span className="font-medium capitalize">{dateInfo.date}</span>
                              <span className="mx-1">•</span>
                              <span>{dateInfo.timeRange}</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {spotAvailability && !spotAvailability.hasSchedule && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {spotAvailability.defaultAvailable ? t.modals.spotDetails.available247 : t.parking.availability.notAvailable}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">
                  <strong>{t.modals.spotDetails.created}</strong> {new Date(selectedSpot.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">
                  <strong>{t.modals.spotDetails.updated}</strong> {new Date(selectedSpot.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions - Only for Owners */}
            {isOwner(selectedSpot) && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">{t.modals.spotDetails.changeStatus}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedSpot.id, 'available');
                      setSelectedSpot(null);
                    }}
                    disabled={selectedSpot.status === 'available'}
                    className="bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    {t.parking.spot.availableNow}
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedSpot.id, 'reserved');
                      setSelectedSpot(null);
                    }}
                    disabled={selectedSpot.status === 'reserved'}
                    className="bg-[#007BFF] hover:bg-[#0056b3] disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    {t.parking.spot.booked}
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedSpot.id, 'occupied');
                      setSelectedSpot(null);
                    }}
                    disabled={selectedSpot.status === 'occupied'}
                    className="bg-[#2E2E2E] hover:bg-[#1a1a1a] disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    {t.parking.spot.occupied}
                  </button>
                </div>

                <button
                  onClick={() => {
                    // TODO: Open edit availability modal
                    alert(t.modals.spotDetails.editAvailabilityComingSoon);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl mt-2 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  {t.modals.spotDetails.editAvailability}
                </button>

                <button
                  onClick={() => {
                    if (confirm(t.parking.spot.confirmDelete)) {
                      onDeleteSpot(selectedSpot.id);
                      setSelectedSpot(null);
                    }
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl mt-2"
                >
                  {t.modals.spotDetails.deleteSpot}
                </button>
              </div>
            )}

            {/* Booking Section for Non-Owners */}
            {!isOwner(selectedSpot) && (
              <div className="bg-white bg-opacity-50 rounded-2xl p-3 sm:p-4 space-y-4">
                {/* Status Display */}
                <div className="text-center">
                  <p className="text-gray-700 font-medium">
                    {selectedSpot.status === 'available' ? (
                      <>
                        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <span className="text-lg font-semibold text-green-600">{t.parking.spot.availableNow}</span>
                        <br />
                        <span className="text-sm text-gray-600">{t.modals.spotDetails.spotAvailableForBooking}</span>
                      </>
                    ) : selectedSpot.status === 'reserved' ? (
                      <>
                        <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <span className="text-lg font-semibold text-blue-600">{t.parking.spot.booked}</span>
                        <br />
                        <span className="text-sm text-gray-600">
                          {bookingDetails?.isMyBooking 
                            ? t.parking.spot.youHaveActiveBooking
                            : t.parking.spot.spotReservedButCanBook}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <span className="text-lg font-semibold text-red-600">{t.parking.spot.occupied}</span>
                        <br />
                        <span className="text-sm text-gray-600">{t.parking.spot.spotCurrentlyOccupied}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Latest Booking Status */}
                {existingBooking && (
                  <div className={`p-3 rounded-xl ${
                    existingBooking.status === 'pending'
                      ? 'bg-blue-50 border border-blue-200'
                      : existingBooking.status === 'accepted'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {existingBooking.status === 'pending' ? (
                        <Clock className="w-5 h-5 text-blue-500" />
                      ) : existingBooking.status === 'accepted' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${
                          existingBooking.status === 'pending'
                            ? 'text-blue-700'
                            : existingBooking.status === 'accepted'
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}>
                          {t.modals.booking.latestRequest} {existingBooking.status === 'pending'
                            ? t.modals.booking.pendingApproval
                            : existingBooking.status === 'accepted'
                            ? t.modals.booking.accepted
                            : t.modals.booking.rejected}
                        </p>
                        <p className="text-xs text-gray-600">
                          {existingBooking.start_date && existingBooking.end_date && existingBooking.start_time && existingBooking.end_time && (
                            existingBooking.start_date === existingBooking.end_date
                              ? `${new Date(existingBooking.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${existingBooking.start_time} - ${existingBooking.end_time}`
                              : `${new Date(existingBooking.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(existingBooking.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Get Directions Button */}
                <button
                  onClick={() => {
                    const lat = selectedSpot.latitude;
                    const lng = selectedSpot.longitude;
                    if (lat && lng) {
                      // Open Google Maps with directions to the spot location
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                      window.open(url, '_blank');
                    } else {
                      alert(t.parking.availability.locationNotAvailable);
                    }
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mb-3"
                >
                  <Navigation className="w-5 h-5" />
                  {t.modals.spotDetails.getDirections}
                </button>

                {/* Booking Button - Allow booking for available spots AND reserved spots (for different times) */}
                {(selectedSpot.status === 'available' || 
                  (selectedSpot.status === 'reserved' && !bookingDetails?.isMyBooking)) && (
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className={`w-full font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 ${
                      selectedSpot.status === 'available' 
                        ? 'bg-[#00C48C] hover:bg-[#00b37d] text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                    {selectedSpot.status === 'reserved' 
                      ? t.modals.spotDetails.bookForDifferentTime
                      : existingBookings.length > 0 
                        ? t.modals.spotDetails.bookAdditionalTime
                        : t.modals.spotDetails.bookThisSpot}
                  </button>
                )}

                {/* Booking Message */}
                {bookingMessage && (
                  <div className={`p-3 rounded-xl text-center ${
                    bookingMessage.includes('✅')
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : bookingMessage.includes('⚠️')
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <p className="text-sm font-medium">{bookingMessage}</p>
                  </div>
                )}

                {/* Can't Book Message - Only show for occupied spots or your own reserved spots */}
                {(selectedSpot.status === 'occupied' ||
                  (selectedSpot.status === 'reserved' && bookingDetails?.isMyBooking)) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                    <p className="text-sm text-gray-600">
                      {t.modals.spotDetails.spotNotAvailableForBooking}
                    </p>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedSpot && (
        <BookingModal
          spot={selectedSpot}
          onClose={() => setShowBookingModal(false)}
          onSubmit={createBookingRequest}
          loading={bookingLoading}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
