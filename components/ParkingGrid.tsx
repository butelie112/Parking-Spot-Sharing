'use client';

import { useEffect, useState } from 'react';
import { supabase, ParkingSpot } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { Car, Plus, Square, CheckSquare, XSquare, Map, Grid3x3, LogOut, MapPin, Clock, CheckCircle, XCircle, Bell, X, User, Calendar, ArrowUp, Menu } from 'lucide-react';
import { BookingRequestsManager } from './BookingRequestsManager';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { HeaderMenu } from './HeaderMenu';
import { SpotAvailabilitySchedule } from './SpotAvailabilitySchedule';
import dynamic from 'next/dynamic';

// Dynamically import LeafletMapView to avoid SSR issues
const LeafletMapView = dynamic(() => import('./LeafletMapView').then(mod => mod.LeafletMapView), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[700px] bg-gray-100 rounded-3xl">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00C48C] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

export function ParkingGrid() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotPrice, setNewSpotPrice] = useState('');
  const [addingSpot, setAddingSpot] = useState(false);
  const [pinModalStep, setPinModalStep] = useState<'enter_details' | 'set_availability'>('enter_details');
  const [userName, setUserName] = useState<string>('');
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map'); // Default to map view
  const [pendingMapLocation, setPendingMapLocation] = useState<{ lat?: number; lng?: number; x?: number; y?: number } | null>(null);
  const [selectingLocation, setSelectingLocation] = useState(false);
  const [showBookingManager, setShowBookingManager] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [spotBookingStatus, setSpotBookingStatus] = useState<Record<string, {
    requesterName?: string;
    isMyBooking?: boolean;
  }>>({});

  // Pin placement mode for adding spots
  const [pinPlacementMode, setPinPlacementMode] = useState(false);
  const [selectedLocationForPin, setSelectedLocationForPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinPlacementMarker, setPinPlacementMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [showPinPlacementModal, setShowPinPlacementModal] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollbarVisible, setScrollbarVisible] = useState(false); // Toggle scrollbar visibility on mobile
  const [scrollPercentage, setScrollPercentage] = useState(0);

  // Debug pin placement mode changes
  useEffect(() => {
    console.log('pinPlacementMode changed to:', pinPlacementMode);
  }, [pinPlacementMode]);

  // Scroll to top button visibility and scroll percentage
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      setShowScrollTop(window.scrollY > 300);
      
      // Calculate scroll percentage
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollableHeight = documentHeight - windowHeight;
      const percentage = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
      setScrollPercentage(Math.min(100, Math.max(0, percentage)));
    };

    handleScroll(); // Initial calculation
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };


  // Handle location selected for adding spot
  const handleLocationSelected = (location: { lat: number; lng: number }) => {
    // This will be passed to HeaderMenu and called when pin is placed
    console.log('Pin placement: HeaderMenu notified of location', location);
    // When pin placement mode is active and location is selected, show marker and open the pin placement modal
    if (pinPlacementMode) {
      console.log('Pin placement: Showing marker and opening pin placement modal for selected location');
      setPinPlacementMarker(location); // Show marker on map
      setSelectedLocationForPin(location);
      setPinPlacementMode(false); // Exit pin placement mode
      setShowPinPlacementModal(true); // Open the pin placement modal
      setSelectingLocation(false);
    }
  };

  // Enable pin placement mode
  const handleEnablePinPlacement = () => {
    setPinPlacementMode(true);
  };

  // Get user initials for avatar
  const getUserInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    fetchSpots();
    fetchUserProfile();
    fetchPendingRequestsCount();

    // Set immediate fallback name from email while profile loads
    if (user?.email && !userName) {
      setUserName(user.email.split('@')[0]);
    }

    // Subscribe to realtime changes
    const spotsChannel = supabase
      .channel('spots_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spots' },
        (payload) => {
          console.log('Spot changed:', payload);
          fetchSpots();
        }
      )
      .subscribe();

    // Subscribe to booking request changes
    const bookingChannel = supabase
      .channel('booking_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_requests' },
        (payload) => {
          console.log('Booking request changed:', payload);
          // Update pending requests count and spot booking status when booking requests change
          fetchPendingRequestsCount();
          fetchSpotBookingStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(spotsChannel);
      supabase.removeChannel(bookingChannel);
    };
  }, []);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) {
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating one...');
          const created = await createUserProfile();
          if (created) {
            // Profile was created, set the name immediately
            const name = user.email?.split('@')[0] || 'User';
            setUserName(name);
          }
        } else {
          console.error('Error fetching user profile:', error);
          // Set fallback name even on error
          setUserName(user.email?.split('@')[0] || 'User');
        }
      } else {
        // Profile exists, set the name (or fallback if empty)
        const name = data?.full_name || user.email?.split('@')[0] || 'User';
        setUserName(name);
      }
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      // Set fallback name on exception
      setUserName(user.email?.split('@')[0] || 'User');
    }
  };

  const createUserProfile = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          email: user.email,
          full_name: user.email?.split('@')[0] || 'User'
        }]);

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error('Error creating user profile:', error);
        return false;
      } else {
        console.log('User profile created successfully');
        return true;
      }
    } catch (error) {
      console.error('Exception creating user profile:', error);
      return false;
    }
  };

  const fetchPendingRequestsCount = async () => {
    if (!user) return;

    try {
      console.log('Testing booking_requests access for user:', user.id);

      // First test basic access
      const { data: testData, error: testError } = await supabase
        .from('booking_requests')
        .select('id')
        .limit(1);

      console.log('Basic booking_requests access test:', { data: testData, error: testError });

      // Now get the actual count
      const { count, error } = await supabase
        .from('booking_requests')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('status', 'pending');

      console.log('Pending requests count query:', { count, error });

      if (error) throw error;
      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending requests count:', error);
      setPendingRequestsCount(0);
    }
  };

  const fetchSpotBookingStatus = async () => {
    if (!user || !spots.length) return;

    try {
      const statusMap: Record<string, { requesterName?: string; isMyBooking?: boolean }> = {};

      // Get all accepted bookings for current user's spots or user's bookings
      const { data: bookings, error } = await supabase
        .from('booking_requests')
        .select(`
          spot_id,
          requester_id,
          status,
          requester:profiles!booking_requests_requester_id_fkey(*)
        `)
        .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

        // Process the bookings
        bookings?.forEach(booking => {
          const isOwner = spots.find(s => s.id === booking.spot_id)?.owner_id === user.id;
          const isRequester = booking.requester_id === user.id;

          // Handle requester data (might be array or object due to Supabase join)
          const requesterData = Array.isArray(booking.requester)
            ? booking.requester[0]
            : booking.requester;

          if (isOwner && requesterData) {
            // Owner sees who booked their spot
            statusMap[booking.spot_id] = {
              requesterName: requesterData.full_name || requesterData.email?.split('@')[0] || 'Unknown User'
            };
          } else if (isRequester) {
            // Requester sees their own booking
            statusMap[booking.spot_id] = {
              isMyBooking: true
            };
          }
        });

      setSpotBookingStatus(statusMap);
    } catch (error) {
      console.error('Error fetching spot booking status:', error);
      setSpotBookingStatus({});
    }
  };

  const fetchSpots = async () => {
    try {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSpots(data || []);
      // Fetch booking status for the spots
      if (data && data.length > 0) {
        setTimeout(() => fetchSpotBookingStatus(), 100); // Small delay to ensure spots state is set
      }
    } catch (error) {
      console.error('Error fetching spots:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSpot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSpotName.trim() || !newSpotPrice.trim() || !user) return;

    // Validate that location is selected (either from click selection or pin placement)
    const selectedLocation = pendingMapLocation || selectedLocationForPin;
    if (!selectedLocation) {
      alert('📍 Please select a location on the map first!');
      return;
    }

    setAddingSpot(true);
    try {
      // Ensure user has a profile first
      await ensureUserProfile();

      // Get user profile information
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile after creation:', profileError);
        // Continue with basic info if profile fetch fails
      }

      // Get schedule data if available
      const scheduleData = (window as any).getSpotScheduleData ? (window as any).getSpotScheduleData() : null;

      const spotData: any = {
        name: newSpotName,
        status: 'available',
        owner_id: user.id,
        owner_name: profileData?.full_name || user.email?.split('@')[0] || 'Unknown',
        owner_email: profileData?.email || user.email || '',
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        price: parseFloat(newSpotPrice),
        // Keep legacy coordinates for backward compatibility (use defaults since pin placement doesn't have x/y)
        map_x: 50,
        map_y: 50,
        has_availability_schedule: scheduleData?.has_availability_schedule || false,
        default_available: scheduleData?.default_available !== false
      };

      const { data: createdSpot, error } = await supabase.from('spots').insert([spotData]).select().single();

      if (error) throw error;

      // If schedule data exists and spot was created, save the schedules
      if (scheduleData && scheduleData.has_availability_schedule && createdSpot) {
        // Save availability schedules
        if (scheduleData.schedules && scheduleData.schedules.length > 0) {
          const schedulesToInsert = scheduleData.schedules.map((schedule: any) => ({
            spot_id: createdSpot.id,
            day_of_week: schedule.day_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            is_available: schedule.is_available
          }));

          const { error: schedError } = await supabase
            .from('availability_schedules')
            .insert(schedulesToInsert);

          if (schedError) console.error('Error saving schedules:', schedError);
        }

        // Save blocked dates
        if (scheduleData.blocked_dates && scheduleData.blocked_dates.length > 0) {
          const blockedToInsert = scheduleData.blocked_dates.map((blocked: any) => ({
            spot_id: createdSpot.id,
            blocked_date: blocked.blocked_date,
            reason: blocked.reason
          }));

          const { error: blockedError } = await supabase
            .from('blocked_dates')
            .insert(blockedToInsert);

          if (blockedError) console.error('Error saving blocked dates:', blockedError);
        }
      }

      setNewSpotName('');
      setNewSpotPrice('');
      setPinModalStep('enter_details'); // Reset modal step
      setShowAddForm(false);
      setShowPinPlacementModal(false);
      setPendingMapLocation(null);
      setSelectedLocationForPin(null);
      setPinPlacementMarker(null);
      setSelectingLocation(false);
      fetchSpots();
    } catch (error) {
      console.error('Error adding spot:', error);
      alert('Failed to add parking spot');
    } finally {
      setAddingSpot(false);
    }
  };

  const ensureUserProfile = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if profile exists
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Creating missing user profile...');
        const { error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] || 'User'
          }]);

        if (createError && createError.code !== '23505') { // Ignore duplicate key errors
          console.error('Error creating user profile:', createError);
          return false;
        } else {
          console.log('User profile created successfully');
          return true;
        }
      }
      return true; // Profile already exists
    } catch (error) {
      console.error('Exception ensuring user profile:', error);
      return false;
    }
  };

  const handleAddSpotAtLocation = (lat: number, lng: number) => {
    if (pinPlacementMode) {
      console.log('Pin placement: Location selected', { lat, lng });
      // In pin placement mode, call the header menu's location selected handler
      handleLocationSelected({ lat, lng });
      setPinPlacementMode(false);
    } else {
      // Legacy behavior for the old add spot form
      setPendingMapLocation({ lat, lng, x: 50, y: 50 }); // Keep x,y for backward compatibility
      setSelectingLocation(false);
    }
  };

  const handleCancelLocationSelect = () => {
    setSelectingLocation(false);
    setPendingMapLocation(null);
  };

  const updateSpotStatus = async (spotId: string, newStatus: ParkingSpot['status']) => {
    try {
      console.log(`🎭 Manual status update: Spot ${spotId} -> ${newStatus} (by owner)`);
      const { error } = await supabase
        .from('spots')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', spotId)
        .eq('owner_id', user?.id);

      if (error) throw error;
      fetchSpots();
    } catch (error) {
      console.error('Error updating spot:', error);
      alert('Failed to update spot status');
    }
  };

  const deleteSpot = async (spotId: string) => {
    if (!confirm('Are you sure you want to delete this parking spot?')) return;

    try {
      const { error } = await supabase
        .from('spots')
        .delete()
        .eq('id', spotId)
        .eq('owner_id', user?.id);

      if (error) throw error;
      fetchSpots();
    } catch (error) {
      console.error('Error deleting spot:', error);
      alert('Failed to delete parking spot');
    }
  };

  const getStatusColor = (status: ParkingSpot['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-500 text-green-900';
      case 'reserved':
        return 'bg-amber-100 border-amber-500 text-amber-900';
      case 'occupied':
        return 'bg-red-100 border-red-500 text-red-900';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-900';
    }
  };

  const getStatusIcon = (status: ParkingSpot['status']) => {
    switch (status) {
      case 'available':
        return <CheckSquare className="w-5 h-5" />;
      case 'reserved':
        return <Square className="w-5 h-5" />;
      case 'occupied':
        return <XSquare className="w-5 h-5" />;
      default:
        return <Square className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg bg-opacity-95">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <HeaderMenu
            userName={userName}
            pendingRequestsCount={pendingRequestsCount}
            onRequestsClick={() => {
              setShowBookingManager(true);
              setPendingRequestsCount(0);
            }}
            onAddSpotClick={() => setShowAddForm(!showAddForm)}
            onLocationSelected={handleLocationSelected}
            onEnablePinPlacement={handleEnablePinPlacement}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Add Spot Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100 animate-in fade-in slide-in-from-top duration-300">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              {t.modals.addSpot.title}
            </h2>

            {/* Location Selection Prompt */}
            {viewMode === 'map' && !pendingMapLocation && !selectedLocationForPin && !selectingLocation && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border-2 border-[#007BFF]">
                <p className="text-sm font-bold text-[#2E2E2E] mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#007BFF]" />
                  📍 {t.modals.addSpot.locationRequired}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectingLocation(true)}
                  className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md font-semibold"
                >
                  <MapPin className="w-5 h-5" />
                  Click to Select Location on Map
                </button>
              </div>
            )}

            {selectingLocation && (
            <div className="mb-4 p-4 bg-[#007BFF] bg-opacity-10 rounded-xl border-2 border-[#007BFF] animate-pulse">
              <p className="text-[#007BFF] font-bold text-center text-lg">
                👆 Click anywhere on the map below to place your parking spot
              </p>
              <button
                type="button"
                onClick={handleCancelLocationSelect}
                className="mt-3 w-full bg-white hover:bg-gray-50 text-[#2E2E2E] px-4 py-2 rounded-lg border-2 border-gray-300 transition-all font-semibold"
              >
                Cancel Selection
              </button>
            </div>
            )}

            {(pendingMapLocation || selectedLocationForPin) && (
            <div className="mb-4 p-4 bg-white rounded-xl border-2 border-[#00C48C] flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <div className="bg-[#00C48C] rounded-full p-1.5">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm text-[#2E2E2E] font-bold">
                  ✓ {t.modals.addSpot.locationSelectedReady}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingMapLocation(null);
                  setSelectedLocationForPin(null);
                  setSelectingLocation(false);
                }}
                className="text-xs text-red-600 hover:text-red-700 underline font-semibold"
              >
                Change
              </button>
            </div>
            )}

            <form onSubmit={addSpot} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={newSpotName}
                  onChange={(e) => setNewSpotName(e.target.value)}
                  placeholder="e.g., Spot A1, Garage Level 2, etc."
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400 bg-white"
                  required
                />
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-semibold">RON</span>
                  </div>
                  <input
                    type="number"
                    value={newSpotPrice}
                    onChange={(e) => setNewSpotPrice(e.target.value)}
                    placeholder="10.00"
                    min="0"
                    step="0.50"
                    className="w-full pl-14 pr-16 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400 bg-white"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm">/oră</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 sm:flex-none bg-[#00C48C] hover:bg-[#00b37d] text-white px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSpotName('');
                    setNewSpotPrice('');
                    setPendingMapLocation(null);
                    setSelectedLocationForPin(null);
                    setPinPlacementMarker(null);
                    setSelectingLocation(false);
                  }}
                  className="flex-1 sm:flex-none bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-xl transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats - Compact on mobile, full on desktop */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {/* Available */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg sm:rounded-2xl shadow-md sm:shadow-lg p-2 sm:p-5 border border-green-100 hover:shadow-xl transition-shadow">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left w-full">
                <p className="text-xs sm:text-sm font-medium text-green-700 mb-0.5 sm:mb-1">{t.parking.spot.availableNow}</p>
                <p className="text-xl sm:text-3xl font-bold text-green-600">
                  {spots.filter((s) => s.status === 'available').length}
                </p>
              </div>
              <div className="hidden sm:block bg-green-500 p-3 rounded-xl shadow-lg">
                <CheckSquare className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          
          {/* Reserved */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg sm:rounded-2xl shadow-md sm:shadow-lg p-2 sm:p-5 border border-amber-100 hover:shadow-xl transition-shadow">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left w-full">
                <p className="text-xs sm:text-sm font-medium text-amber-700 mb-0.5 sm:mb-1">{t.parking.booking.approved}</p>
                <p className="text-xl sm:text-3xl font-bold text-amber-600">
                  {spots.filter((s) => s.status === 'reserved').length}
                </p>
              </div>
              <div className="hidden sm:block bg-amber-500 p-3 rounded-xl shadow-lg">
                <Square className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          
          {/* Occupied */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg sm:rounded-2xl shadow-md sm:shadow-lg p-2 sm:p-5 border border-red-100 hover:shadow-xl transition-shadow">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 sm:gap-0">
              <div className="text-center sm:text-left w-full">
                <p className="text-xs sm:text-sm font-medium text-red-700 mb-0.5 sm:mb-1">{t.parking.spot.occupied}</p>
                <p className="text-xl sm:text-3xl font-bold text-red-600">
                  {spots.filter((s) => s.status === 'occupied').length}
                </p>
              </div>
              <div className="hidden sm:block bg-red-500 p-3 rounded-xl shadow-lg">
                <XSquare className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* View Selector: Map or Grid */}
        {console.log('Current viewMode:', viewMode)}
        {viewMode === 'map' ? (
        <div className="relative">
          <LeafletMapView
            spots={spots}
            currentUserId={user?.id}
            onUpdateStatus={updateSpotStatus}
            onDeleteSpot={deleteSpot}
            onAddSpotAtLocation={handleAddSpotAtLocation}
            selectingLocation={pinPlacementMode}
            pendingLocation={pendingMapLocation && pendingMapLocation.lat && pendingMapLocation.lng ? {
              lat: pendingMapLocation.lat,
              lng: pendingMapLocation.lng
            } : null}
            pinPlacementMarker={pinPlacementMarker}
          />
          
          {/* Mobile Scrollbar Indicator - Positioned on right side of map */}
          <div className="md:hidden absolute right-2 top-48 z-30">
            {/* Toggle Button */}
            <button
              onClick={() => setScrollbarVisible(!scrollbarVisible)}
              className="bg-white hover:bg-gray-100 text-gray-700 px-2 py-3 rounded-t-xl shadow-lg border border-gray-300 transition-all w-full"
              title={scrollbarVisible ? "Hide scroll indicator" : "Show scroll indicator"}
            >
              <Menu className={`w-4 h-4 transition-transform mx-auto ${scrollbarVisible ? 'rotate-0' : 'rotate-90'}`} />
            </button>
            
            {/* Visual Scrollbar */}
            {scrollbarVisible && (
              <div className="bg-white border border-gray-300 border-t-0 rounded-b-xl shadow-lg p-2 w-12">
                <div className="relative h-40 bg-gray-100 rounded-lg overflow-hidden">
                  {/* Scroll track */}
                  <div 
                    className="absolute left-0 right-0 bg-[#00C48C] rounded-lg transition-all duration-100"
                    style={{ 
                      top: `${scrollPercentage}%`,
                      height: '20%',
                      transform: 'translateY(-50%)'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        ) : (
          <>
            {/* Original Grid View */}
            {spots.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-gray-100">
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Car className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{t.parking.spot.noSpotsFound}</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t.parking.spot.addFirstSpot}
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-[#00C48C] hover:bg-[#00b37d] text-white px-8 py-3 rounded-xl inline-flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            >
              <Plus className="w-5 h-5" />
              {t.parking.spot.addNew}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {spots.map((spot) => {
              const isOwner = spot.owner_id === user?.id;
              return (
                <div
                  key={spot.id}
                  className={`${getStatusColor(
                    spot.status
                  )} border-2 rounded-2xl p-6 transition-all hover:shadow-2xl transform hover:-translate-y-1 relative overflow-hidden`}
                >
                  {/* Background decoration */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
                  
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-white bg-opacity-30 rounded-lg">
                          {getStatusIcon(spot.status)}
                        </div>
                        <h3 className="font-bold text-lg">{spot.name}</h3>
                      </div>
                      {isOwner && (
                        <span className="text-xs font-semibold bg-white bg-opacity-40 backdrop-blur-sm px-3 py-1 rounded-full shadow">
                          You
                        </span>
                      )}
                    </div>

                    <div className="mb-4 space-y-2">
                      <span className="text-sm font-bold uppercase tracking-wider px-3 py-1 bg-white bg-opacity-30 rounded-full">
                        {spot.status}
                      </span>

                      {/* Booking Status */}
                      {spot.status === 'reserved' && spotBookingStatus[spot.id] && (
                        <div className="bg-blue-100 bg-opacity-50 rounded-lg px-2 py-1">
                          {spotBookingStatus[spot.id].isMyBooking ? (
                            <span className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {t.parking.spot.reservedByYou}
                            </span>
                          ) : isOwner && spotBookingStatus[spot.id].requesterName ? (
                            <span className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {t.parking.spot.reservedFor} {spotBookingStatus[spot.id].requesterName}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {isOwner && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => updateSpotStatus(spot.id, 'available')}
                            disabled={spot.status === 'available'}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md hover:shadow-lg"
                          >
                            {t.parking.spot.availableNow}
                          </button>
                          <button
                            onClick={() => updateSpotStatus(spot.id, 'reserved')}
                            disabled={spot.status === 'reserved'}
                            className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md hover:shadow-lg"
                          >
                            {t.parking.spot.booked}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => updateSpotStatus(spot.id, 'occupied')}
                            disabled={spot.status === 'occupied'}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md hover:shadow-lg"
                          >
                            {t.parking.spot.occupied}
                          </button>
                          <button
                            onClick={() => deleteSpot(spot.id)}
                            className="bg-gray-700 hover:bg-gray-900 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md hover:shadow-lg"
                          >
                            {t.common.delete}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isOwner && (
                      <div className="mt-3 space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {spot.status === 'available' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600">{t.parking.spot.availableToBook}</span>
                            </>
                          ) : spot.status === 'reserved' ? (
                            <>
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="text-blue-600">{t.parking.spot.booked}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-600">{t.parking.spot.occupied}</span>
                            </>
                          )}
                        </div>

                        {spot.status === 'available' && (
                          <button
                            onClick={() => {
                              // For grid view, switch to map view to show detailed booking modal
                              setViewMode('map');
                              // Note: The map view will handle the booking logic
                            }}
                            className="w-full bg-[#00C48C] hover:bg-[#00b37d] text-white text-xs font-semibold py-2 px-3 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1"
                          >
                            <Car className="w-3 h-3" />
                            Book Spot
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}

        {/* Pin Placement Modal */}
        {showPinPlacementModal && selectedLocationForPin && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#00C48C]" />
                  {t.modals.addSpot.title}
                </h3>
                <button
                  onClick={() => {
                    setShowPinPlacementModal(false);
                    setSelectedLocationForPin(null);
                    setPinPlacementMarker(null);
                    setNewSpotName('');
                    setNewSpotPrice('');
                    setPinModalStep('enter_details');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {pinModalStep === 'enter_details' && (
                <div className="space-y-4">
                  {/* Location confirmation */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">{t.modals.addSpot.locationSelected}</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      {t.modals.addSpot.locationSelectedDesc}
                    </p>
                  </div>

                  {/* Spot name input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.modals.addSpot.spotName}
                    </label>
                    <input
                      type="text"
                      value={newSpotName}
                      onChange={(e) => setNewSpotName(e.target.value)}
                      placeholder={t.modals.addSpot.spotNamePlaceholder}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900"
                      autoFocus
                    />
                  </div>

                  {/* Spot price input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.modals.addSpot.pricePerHour}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-semibold">RON</span>
                      </div>
                      <input
                        type="number"
                        value={newSpotPrice}
                        onChange={(e) => setNewSpotPrice(e.target.value)}
                        placeholder="10.00"
                        min="0"
                        step="0.50"
                        className="w-full pl-14 pr-16 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900"
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-sm">{t.modals.spotDetails.perHour}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowPinPlacementModal(false);
                        setSelectedLocationForPin(null);
                        setPinPlacementMarker(null);
                        setNewSpotName('');
                        setNewSpotPrice('');
                        setPinModalStep('enter_details');
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      onClick={() => setPinModalStep('set_availability')}
                      disabled={!newSpotName.trim() || !newSpotPrice.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      {t.parking.spot.setAvailability}
                    </button>
                  </div>
                </div>
              )}

              {pinModalStep === 'set_availability' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <Calendar className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                    <h4 className="text-lg font-semibold text-gray-900">{t.parking.availability.setScheduleOptional}</h4>
                    <p className="text-sm text-gray-600">
                      {t.parking.availability.defineAvailability}
                    </p>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    <SpotAvailabilitySchedule 
                      isNewSpot={true}
                      onSave={(hasSchedule) => console.log('Schedule set:', hasSchedule)}
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => setPinModalStep('enter_details')}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all"
                    >
                      {t.common.back}
                    </button>
                    <button
                      onClick={() => addSpot()}
                      disabled={!newSpotName.trim() || !newSpotPrice.trim() || addingSpot}
                      className="flex-1 bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {addingSpot ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          {t.modals.addSpot.create}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking Requests Manager Modal */}
        {showBookingManager && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex justify-end p-4">
                <button
                  onClick={() => setShowBookingManager(false)}
                  className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                <BookingRequestsManager />
              </div>
            </div>
          </div>
        )}

        {/* PWA Install Prompt */}
        <PWAInstallPrompt />

        {/* Scroll to Top Button - Bottom right corner */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-20 right-6 z-50 bg-[#00C48C] hover:bg-[#00b37d] text-white p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 animate-in fade-in slide-in-from-bottom"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
}

