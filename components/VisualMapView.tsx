'use client';

import { useState, useRef, useEffect } from 'react';
import { ParkingSpot, supabase, BookingRequest } from '@/lib/supabase';
import { MapPin, X, Calendar, User as UserIcon, Mail, Car, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type VisualMapViewProps = {
  spots: ParkingSpot[];
  currentUserId: string | undefined;
  onUpdateStatus: (spotId: string, newStatus: ParkingSpot['status']) => void;
  onDeleteSpot: (spotId: string) => void;
  onAddSpotAtLocation?: (x: number, y: number) => void;
  selectingLocation?: boolean;
  pendingLocation?: { x: number; y: number } | null;
};

export function VisualMapView({ 
  spots, 
  currentUserId, 
  onUpdateStatus, 
  onDeleteSpot,
  onAddSpotAtLocation,
  selectingLocation = false,
  pendingLocation = null
}: VisualMapViewProps) {
  const { t } = useLanguage();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [tempMarker, setTempMarker] = useState<{ x: number; y: number } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [existingBooking, setExistingBooking] = useState<BookingRequest | null>(null);
  const [bookingDetails, setBookingDetails] = useState<{
    requesterName?: string;
    requesterEmail?: string;
    isMyBooking?: boolean;
  } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

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

  // Check existing bookings when a spot is selected
  useEffect(() => {
    if (selectedSpot) {
      checkExistingBooking(selectedSpot.id);
      setBookingMessage(''); // Clear any previous messages
    } else {
      setExistingBooking(null);
      setBookingMessage('');
      setBookingDetails(null);
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
          // Re-check existing booking when there's a change
          checkExistingBooking(selectedSpot.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSpot, currentUserId]);


  // Check for existing booking requests when a spot is selected
  const checkExistingBooking = async (spotId: string) => {
    if (!currentUserId || !selectedSpot) return;

    try {
      // Check if current user has a pending booking for this spot
      const { data: myBooking, error: myBookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('spot_id', spotId)
        .eq('requester_id', currentUserId)
        .eq('status', 'pending')
        .single();

      if (myBookingError && myBookingError.code !== 'PGRST116') {
        throw myBookingError;
      }

      setExistingBooking(myBooking || null);

      // Check for accepted bookings to show booking status
      const { data: acceptedBooking, error: acceptedError } = await supabase
        .from('booking_requests')
        .select(`
          *,
          requester:profiles!booking_requests_requester_id_fkey(*)
        `)
        .eq('spot_id', spotId)
        .eq('status', 'accepted')
        .single();

      if (acceptedError && acceptedError.code !== 'PGRST116') {
        console.warn('Error fetching accepted booking:', acceptedError);
      }

      // Set booking details for display
      if (acceptedBooking && acceptedBooking.requester) {
        const isOwner = selectedSpot.owner_id === currentUserId;
        const isRequester = acceptedBooking.requester_id === currentUserId;

        setBookingDetails({
          requesterName: acceptedBooking.requester.full_name || acceptedBooking.requester.email?.split('@')[0] || 'Unknown User',
          requesterEmail: acceptedBooking.requester.email || '',
          isMyBooking: isRequester
        });
      } else if (myBooking && myBooking.status === 'accepted') {
        // If current user has an accepted booking, show it
        setBookingDetails({
          isMyBooking: true
        });
      } else {
        setBookingDetails(null);
      }
    } catch (error) {
      console.error('Error checking existing booking:', error);
      setExistingBooking(null);
      setBookingDetails(null);
    }
  };

  // Create a booking request
  const createBookingRequest = async (spotId: string, ownerId: string) => {
    if (!currentUserId) return;

    setBookingLoading(true);
    setBookingMessage('');

    try {
      // Ensure user has a profile before creating booking request
      await ensureUserProfile();

      const { data, error } = await supabase
        .from('booking_requests')
        .insert([{
          spot_id: spotId,
          requester_id: currentUserId,
          owner_id: ownerId,
          status: 'pending',
          message: 'Request to book this parking spot'
        }])
        .select()
        .single();

      if (error) throw error;

      setExistingBooking(data);
      setBookingMessage('✅ Booking request sent successfully! The owner will be notified.');

      // Show toast notification as well
      setTimeout(() => {
        // You could emit a global toast here, or just rely on the message
        console.log('Booking request created successfully');
      }, 1000);
    } catch (error: any) {
      console.error('Error creating booking request:', error);
      if (error.code === '23505') { // Unique constraint violation
        setBookingMessage('⚠️ You already have a pending request for this spot.');
      } else if (error.code === '23503') { // Foreign key constraint violation
        setBookingMessage('❌ Profile issue. Please refresh and try again.');
      } else {
        setBookingMessage('❌ Failed to send booking request. Please try again.');
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const ensureUserProfile = async () => {
    if (!currentUserId) return;

    try {
      // Check if profile exists
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentUserId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Creating missing user profile for booking...');
        const { error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: currentUserId,
            email: 'user@example.com', // This will be updated from auth
            full_name: 'User'
          }]);

        if (createError && createError.code !== '23505') { // Ignore duplicate key errors
          console.error('Error creating user profile:', createError);
        } else {
          console.log('User profile created successfully for booking');
        }
      }
    } catch (error) {
      console.error('Exception ensuring user profile for booking:', error);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onAddSpotAtLocation || !selectingLocation) return;
    
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Show temporary marker immediately
    setTempMarker({ x, y });
    
    // Notify parent component
    onAddSpotAtLocation(x, y);
  };

  // Sync temp marker with pending location from parent
  useEffect(() => {
    if (pendingLocation) {
      setTempMarker(pendingLocation);
    } else {
      setTempMarker(null);
    }
  }, [pendingLocation]);

  const getStatusColor = (status: ParkingSpot['status']) => {
    switch (status) {
      case 'available':
        return 'from-[#00C48C] to-[#00b37d]';
      case 'reserved':
        return 'from-[#007BFF] to-[#0056b3]';
      case 'occupied':
        return 'from-[#2E2E2E] to-[#1a1a1a]';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getSpotPosition = (spot: ParkingSpot) => {
    // If spot has saved position, use it; otherwise random
    const x = spot.map_x ?? Math.random() * 80 + 10;
    const y = spot.map_y ?? Math.random() * 80 + 10;
    return { x, y };
  };

  const isOwner = (spot: ParkingSpot) => spot.owner_id === currentUserId;

  return (
    <div className="relative">
      {/* Visual Map - Parking Lot */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        className={`relative bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 rounded-3xl shadow-2xl border-4 ${
          selectingLocation ? 'border-[#007BFF] border-dashed' : 'border-gray-300'
        } overflow-hidden ${
          selectingLocation ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={{ height: '700px' }}
      >
        {/* Map Background - Roads/Lanes */}
        <svg className="absolute inset-0 w-full h-full opacity-30">
          {/* Horizontal Roads */}
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#9CA3AF" strokeWidth="8" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#9CA3AF" strokeWidth="12" strokeDasharray="20,10" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#9CA3AF" strokeWidth="8" />
          
          {/* Vertical Roads */}
          <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#9CA3AF" strokeWidth="8" />
          <line x1="66%" y1="0" x2="66%" y2="100%" stroke="#9CA3AF" strokeWidth="8" />
        </svg>

        {/* Zones/Sections Labels */}
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#00C48C]" />
            <span className="font-bold text-[#2E2E2E]">Parking Zones</span>
          </div>
        </div>

        {/* Zone Labels */}
        <div className="absolute top-12 left-6 text-2xl font-bold text-gray-400 opacity-50">Zone A</div>
        <div className="absolute top-12 left-1/3 ml-6 text-2xl font-bold text-gray-400 opacity-50">Zone B</div>
        <div className="absolute top-12 right-1/3 mr-6 text-2xl font-bold text-gray-400 opacity-50">Zone C</div>

        {/* Parking Spots as Pins */}
        {spots.map((spot) => {
          const { x, y } = getSpotPosition(spot);
          return (
            <button
              key={spot.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSpot(spot);
              }}
              className="absolute transform -translate-x-1/2 -translate-y-full transition-all hover:scale-125 hover:z-50 group"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* Pin Shadow */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-2 bg-black opacity-20 rounded-full blur-sm" />
              
              {/* Pin */}
              <div className={`relative bg-gradient-to-br ${getStatusColor(spot.status)} rounded-full p-3 shadow-2xl border-3 border-white group-hover:shadow-3xl transition-all`}>
                <MapPin className="w-6 h-6 text-white fill-current" />
              </div>

              {/* Spot Name Label */}
              <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <div className="bg-white bg-opacity-95 px-3 py-1 rounded-lg shadow-lg text-sm font-bold text-gray-900 group-hover:bg-opacity-100 border border-gray-200">
                  {spot.name}
                  {isOwner(spot) && (
                    <span className="ml-2 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">You</span>
                  )}
                </div>
              </div>

              {/* Pulse Effect for Available Spots */}
              {spot.status === 'available' && (
                <div className="absolute inset-0 rounded-full bg-[#00C48C] animate-ping opacity-30" />
              )}
            </button>
          );
        })}

        {/* Temporary Marker for Pending Location */}
        {tempMarker && (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 animate-in zoom-in-90 duration-300"
            style={{ left: `${tempMarker.x}%`, top: `${tempMarker.y}%` }}
          >
            {/* Pulsing Ring */}
            <div className="absolute inset-0 bg-[#007BFF] rounded-full w-16 h-16 -ml-8 -mt-8 animate-ping opacity-30" />
            
            {/* Pin Marker */}
            <div className="relative bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white rounded-full w-14 h-14 -ml-7 -mt-7 flex items-center justify-center shadow-2xl border-4 border-white">
              <MapPin className="w-7 h-7 drop-shadow-lg" />
            </div>
            
            {/* Label */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#007BFF] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
              New Spot Location
            </div>
          </div>
        )}

        {/* Empty State */}
        {spots.length === 0 && !selectingLocation && !tempMarker && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white bg-opacity-90 p-8 rounded-2xl shadow-xl">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No parking spots on map</h3>
              <p className="text-gray-600">Click "Add Spot" to place your first spot on the map</p>
            </div>
          </div>
        )}

        {/* Grid Reference Lines (subtle) */}
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <div className="grid grid-cols-10 grid-rows-10 h-full w-full">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="border border-gray-400" />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 justify-center flex-wrap bg-white p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#00C48C]" />
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.available}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#007BFF]" />
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.reserved}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#2E2E2E]" />
          <span className="text-sm font-medium text-[#2E2E2E]">{t.parking.map.legend.occupied}</span>
        </div>
      </div>

      {/* Detailed Spot Modal (Same as before) */}
      {selectedSpot && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedSpot(null)}
        >
          <div
            className={`
              ${
                selectedSpot.status === 'available'
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-[#00C48C]'
                  : selectedSpot.status === 'reserved'
                  ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-[#007BFF]'
                  : 'bg-gradient-to-br from-gray-50 to-gray-100 border-[#2E2E2E]'
              }
              border-4
              rounded-3xl
              p-8
              max-w-lg
              w-full
              shadow-2xl
              transform
              scale-100
              animate-in
              zoom-in
              duration-300
              relative
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedSpot(null)}
              className="absolute top-4 right-4 bg-white hover:bg-gray-100 p-2 rounded-full shadow-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>

            {/* Spot Header */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className={`
                bg-gradient-to-br
                ${getStatusColor(selectedSpot.status)}
                p-4
                rounded-2xl
                shadow-lg
              `}
              >
                <MapPin className="w-12 h-12 text-white fill-current" />
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{selectedSpot.name}</h3>
                {isOwner(selectedSpot) && (
                  <span className="inline-block bg-[#00C48C] text-white text-sm font-semibold px-3 py-1 rounded-full">
                    <UserIcon className="w-4 h-4 inline mr-1" />
                    Your Spot
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
              <div
                className={`
                inline-block
                bg-gradient-to-br
                ${getStatusColor(selectedSpot.status)}
                text-white
                px-6
                py-2
                rounded-full
                font-bold
                text-lg
                uppercase
                tracking-wider
                shadow-lg
              `}
              >
                {getTranslatedStatus(selectedSpot.status)}
              </div>
            </div>

            {/* Spot Details */}
            <div className="bg-white bg-opacity-50 rounded-2xl p-4 mb-6 space-y-3">
              {/* Owner Information */}
              <div className="bg-white bg-opacity-80 rounded-xl p-3 mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Spot Owner</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-800">
                    <UserIcon className="w-4 h-4 text-[#00C48C]" />
                    <span className="text-sm font-semibold">
                      {selectedSpot.owner_name || 'Spot Owner'}
                    </span>
                    {isOwner(selectedSpot) && (
                      <span className="text-xs bg-[#00C48C] text-white px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-xs">{selectedSpot.owner_email || 'Contact via booking request'}</span>
                  </div>
                  {!isOwner(selectedSpot) && (
                    <p className="text-xs text-gray-500 mt-2">
                      Send a booking request to connect with the owner.
                    </p>
                  )}
                </div>
              </div>

              {/* Booking Status Information */}
              {bookingDetails && selectedSpot.status === 'reserved' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-800 uppercase mb-2">{t.parking.booking.bookingStatus}</p>
                  {bookingDetails.isMyBooking ? (
                    <div className="flex items-center gap-2 text-blue-800">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">{t.parking.spot.reservedByYou}</span>
                    </div>
                  ) : isOwner(selectedSpot) && bookingDetails.requesterName ? (
                    <div className="flex items-center gap-2 text-blue-800">
                      <UserIcon className="w-4 h-4" />
                      <span className="text-sm font-semibold">
                        {t.parking.spot.reservedFor} {bookingDetails.requesterName}
                      </span>
                      {bookingDetails.requesterEmail && (
                        <span className="text-xs text-blue-600">
                          ({bookingDetails.requesterEmail})
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">
                  <strong>Created:</strong> {new Date(selectedSpot.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">
                  <strong>Updated:</strong> {new Date(selectedSpot.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions - Only for Owners */}
            {isOwner(selectedSpot) && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Change Status:</p>
                <div className="grid grid-cols-3 gap-3">
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
                    if (confirm('Are you sure you want to delete this spot?')) {
                      onDeleteSpot(selectedSpot.id);
                      setSelectedSpot(null);
                    }
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl mt-2"
                >
                  Delete Spot
                </button>
              </div>
            )}

            {/* Booking Section for Non-Owners */}
            {!isOwner(selectedSpot) && (
              <div className="bg-white bg-opacity-50 rounded-2xl p-4 space-y-4">
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
                        <span className="text-sm text-gray-600">{t.parking.spot.spotCurrentlyReserved}</span>
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

                {/* Booking Request Status */}
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
                          {existingBooking.status === 'pending'
                            ? 'Request Pending'
                            : existingBooking.status === 'accepted'
                            ? 'Request Accepted!'
                            : 'Request Rejected'}
                        </p>
                        <p className="text-xs text-gray-600">
                          Requested on {new Date(existingBooking.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Booking Button */}
                {selectedSpot.status === 'available' && !existingBooking && (
                  <button
                    onClick={() => createBookingRequest(selectedSpot.id, selectedSpot.owner_id)}
                    disabled={bookingLoading}
                    className="w-full bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    {bookingLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        {t.parking.booking.sendingRequest}
                      </>
                    ) : (
                      <>
                        <Car className="w-5 h-5" />
                        {t.modals.spotDetails.bookThisSpot}
                      </>
                    )}
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

                {/* Can't Book Message */}
                {selectedSpot.status !== 'available' && !existingBooking && (
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
      )}
    </div>
  );
}

