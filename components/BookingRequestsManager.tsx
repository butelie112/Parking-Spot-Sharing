'use client';

import { useEffect, useState } from 'react';
import { supabase, BookingRequest, ParkingSpot, Profile } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { useTimezone } from './TimezoneHandler';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clock, CheckCircle, XCircle, Car, User as UserIcon, Mail, MapPin, X, Check, X as RejectIcon, Bell } from 'lucide-react';

interface BookingRequestWithDetails extends BookingRequest {
  spot: ParkingSpot;
  requester: Profile;
}

type TabType = 'incoming' | 'outgoing';

export function BookingRequestsManager() {
  const { user } = useAuth();
  const { formatLocalTime, formatLocalDate, userTimezone } = useTimezone();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<BookingRequestWithDetails[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<BookingRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<string[]>([]);
  const [newRequests, setNewRequests] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  // Real-time subscription for booking requests
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('booking_requests_manager')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `owner_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Incoming booking request changed:', payload);

          // Handle new booking requests (INSERT events)
          if (payload.eventType === 'INSERT') {
            const newRequest = payload.new;
            // Add to new requests for visual highlighting
            setNewRequests(prev => [...prev, newRequest.id]);

            // Get spot information for the notification
            const spotInfo = incomingRequests.find(r => r.spot_id === newRequest.spot_id)?.spot;
            const spotName = spotInfo?.name || 'Unknown Spot';

            setToastMessage(`🔔 New booking request received for ${spotName}!`);
            setTimeout(() => setToastMessage(null), 5000);

            // Clear new request highlight after 30 seconds
            setTimeout(() => {
              setNewRequests(prev => prev.filter(id => id !== newRequest.id));
            }, 30000);

            fetchRequests();
            return;
          }

          // Handle status updates
          if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old.status) {
            // Status changed - show notification and highlight
            setRecentlyUpdated(prev => [...prev, payload.new.id]);

            // Get spot information for better notification
            const requestInfo = incomingRequests.find(r => r.id === payload.new.id);
            const spotName = requestInfo?.spot?.name || 'Spot';

            if (payload.new.status === 'accepted') {
              setToastMessage(`✅ ${t.modals.requests.bookingAcceptedNotification.replace('{{spotName}}', spotName)}`);
            } else if (payload.new.status === 'rejected') {
              setToastMessage(`❌ ${t.modals.requests.bookingRejectedNotification.replace('{{spotName}}', spotName)}`);
            } else if (payload.new.status === 'completed') {
              setToastMessage(`🏁 ${t.modals.requests.bookingCompletedNotification.replace('{{spotName}}', spotName)}`);
            }
            // Clear toast after 4 seconds
            setTimeout(() => setToastMessage(null), 4000);
            // Clear highlight after 5 seconds
            setTimeout(() => {
              setRecentlyUpdated(prev => prev.filter(id => id !== payload.new.id));
            }, 5000);
          }
          fetchRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `requester_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Outgoing booking request changed:', payload);

          // Handle status updates for user's own requests
          if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old.status) {
            // My request status changed - show notification and highlight
            setRecentlyUpdated(prev => [...prev, payload.new.id]);

            // Get spot information for better notification
            const requestInfo = outgoingRequests.find(r => r.id === payload.new.id);
            const spotName = requestInfo?.spot?.name || 'a spot';

            if (payload.new.status === 'accepted') {
              setToastMessage(`🎉 ${t.modals.requests.yourBookingAcceptedNotification.replace('{{spotName}}', spotName)}`);
              // Trigger wallet balance update event
              window.dispatchEvent(new CustomEvent('walletBalanceChanged'));
            } else if (payload.new.status === 'rejected') {
              setToastMessage(`😞 ${t.modals.requests.yourBookingRejectedNotification.replace('{{spotName}}', spotName)}`);
            } else if (payload.new.status === 'completed') {
              setToastMessage(`🏁 ${t.modals.requests.yourBookingCompletedNotification.replace('{{spotName}}', spotName)}`);
            }

            // Clear toast after 4 seconds
            setTimeout(() => setToastMessage(null), 4000);
            // Clear highlight after 5 seconds
            setTimeout(() => {
              setRecentlyUpdated(prev => prev.filter(id => id !== payload.new.id));
            }, 5000);
          }
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('Fetching requests for user:', user.id);

      // Get all spot IDs and user IDs that we'll need
      const { data: allRequests, error: requestsError } = await supabase
        .from('booking_requests')
        .select('*')
        .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (!allRequests || allRequests.length === 0) {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        return;
      }

      // Extract unique spot IDs and user IDs
      const spotIds = [...new Set(allRequests.map(r => r.spot_id))];
      const userIds = [...new Set([
        ...allRequests.map(r => r.requester_id),
        ...allRequests.map(r => r.owner_id)
      ])];

      // Batch fetch all spots
      const { data: spots, error: spotsError } = await supabase
        .from('spots')
        .select('*')
        .in('id', spotIds);

      if (spotsError) {
        console.warn('Error fetching spots:', spotsError);
      }

      // Batch fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.warn('Error fetching profiles:', profilesError);
      }

      // Create lookup maps for fast access
      const spotsMap = new Map(spots?.map(spot => [spot.id, spot]) || []);
      const profilesMap = new Map(profiles?.map(profile => [profile.id, profile]) || []);

      // Process requests with batched data
      const incomingData = [];
      const outgoingData = [];

      for (const request of allRequests) {
        const spot = spotsMap.get(request.spot_id) || { name: 'Unknown Spot', id: request.spot_id };

        if (request.owner_id === user.id) {
          // Incoming request (user is owner)
          const requester = profilesMap.get(request.requester_id) || {
            id: request.requester_id,
            full_name: 'Unknown User',
            email: 'unknown@example.com'
          };

          incomingData.push({
            ...request,
            spot,
            requester
          });
        } else {
          // Outgoing request (user is requester)
          const owner = profilesMap.get(request.owner_id) || {
            id: request.owner_id,
            full_name: 'Unknown User',
            email: 'unknown@example.com'
          };

          outgoingData.push({
            ...request,
            spot,
            requester: owner // In outgoing requests, requester field holds owner info
          });
        }
      }

      console.log('=== PERFORMANCE OPTIMIZED FETCH ===');
      console.log('Total requests:', allRequests.length);
      console.log('Unique spots fetched:', spots?.length || 0);
      console.log('Unique profiles fetched:', profiles?.length || 0);
      console.log('Incoming requests:', incomingData.length);
      console.log('Outgoing requests:', outgoingData.length);

      setIncomingRequests(incomingData);
      setOutgoingRequests(outgoingData);

    } catch (error) {
      console.error('Error fetching booking requests:', error);
      // Set empty arrays on error to prevent crashes
      setIncomingRequests([]);
      setOutgoingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    setActionLoading(requestId);

    try {
      let totalPrice: number | null = null;
      let request: BookingRequestWithDetails | undefined;

      // If accepting, process payment first
      if (action === 'accepted') {
        // Get the request details to process payment
        request = incomingRequests.find(r => r.id === requestId);
        if (!request) {
          throw new Error('Request details not found');
        }

        // Calculate booking amount (what owner receives)
        let bookingAmount = request.total_price || null;
        if (!bookingAmount && request.spot?.price && request.start_date && request.end_date && request.start_time && request.end_time) {
          const startDateTime = new Date(`${request.start_date}T${request.start_time}`);
          const endDateTime = new Date(`${request.end_date}T${request.end_time}`);
          const hours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
          bookingAmount = hours * request.spot.price;
        }

        if (!bookingAmount || bookingAmount <= 0) {
          throw new Error('Cannot calculate pricing information for this booking');
        }

        // Calculate platform fee (10%) and total charged to user
        const platformFee = bookingAmount * 0.10;
        const totalCharged = bookingAmount + platformFee;

        // Process the payment using the database function
        // Deduct total (booking + fee) from user, transfer booking amount to owner
        const { data: paymentResult, error: paymentError } = await supabase.rpc('process_booking_payment', {
          p_from_user_id: request.requester_id,
          p_to_user_id: request.owner_id,
          p_amount: totalCharged
        });

        if (paymentError) {
          console.error('Payment processing error:', paymentError);
          throw new Error(`Payment failed: ${paymentError.message}`);
        }

        if (!paymentResult || !paymentResult.success) {
          throw new Error(paymentResult?.message || 'Payment processing failed - insufficient funds or other error');
        }

        // Get owner profile (current user who is accepting)
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', request.owner_id)
          .single();

        // Record platform fee in the new platform_fees table
        const platformFeeRecord = {
          booking_request_id: requestId,
          user_id: request.requester_id,
          user_email: request.requester?.email || null,
          user_name: request.requester?.full_name || null,
          owner_id: request.owner_id,
          owner_email: ownerProfile?.email || null,
          owner_name: ownerProfile?.full_name || null,
          spot_id: request.spot_id,
          spot_name: request.spot?.name || null,
          booking_amount: bookingAmount,
          platform_fee: platformFee,
          total_charged: totalCharged
        };

        const { error: feeError } = await supabase
          .from('platform_fees')
          .insert(platformFeeRecord);

        if (feeError) {
          console.error('Error recording platform fee:', feeError);
          // Don't throw error here - payment already processed, just log the issue
        } else {
          console.log('✅ Platform fee recorded successfully:', platformFeeRecord);
        }

        // Store for later use
        totalPrice = totalCharged;
      }

      // Update the request status (core fields that should always exist)
      const { error } = await supabase
        .from('booking_requests')
        .update({
          status: action,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Separately update payment tracking fields if they exist (for accepted requests)
      if (action === 'accepted' && totalPrice) {
        try {
          // Try to update payment tracking columns (may not exist in older schemas)
          await supabase
            .from('booking_requests')
            .update({
              accepted_at: new Date().toISOString(),
              payment_amount: totalPrice,
              payment_processed: true
            })
            .eq('id', requestId);
          // Don't throw error if this fails - columns might not exist yet
        } catch (paymentError) {
          console.warn('Payment tracking update failed (columns may not exist):', paymentError);
          // This is okay - the payment still processed successfully
        }
      }

      // Show success message
      if (action === 'accepted') {
        setToastMessage(`✅ ${t.modals.requests.requestAccepted}`);
        // Notify other components that wallet balance has changed
        window.dispatchEvent(new CustomEvent('walletBalanceChanged'));
      } else {
        setToastMessage(`❌ ${t.modals.requests.requestRejected}`);
      }
      setTimeout(() => setToastMessage(null), 3000);

      fetchRequests();
    } catch (error: any) {
      console.error('Error updating booking request:', error);
      if (error.message && error.message.includes('insufficient funds')) {
        alert('Cannot accept request: Requester has insufficient wallet balance.');
      } else {
        alert(`Failed to ${action === 'accepted' ? 'accept' : 'reject'} request: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: BookingRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'accepted':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'rejected':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'completed':
        return 'bg-purple-100 border-purple-300 text-purple-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getStatusIcon = (status: BookingRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-[#00C48C] to-[#00b37d] text-white p-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded"></div>
            <div className="h-6 bg-white/20 rounded w-48"></div>
          </div>
          <div className="h-4 bg-white/20 rounded w-64 mt-1"></div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex border-b border-gray-200">
          <div className="flex-1 py-3 px-4">
            <div className="h-5 bg-gray-200 rounded w-20 mx-auto animate-pulse"></div>
          </div>
          <div className="flex-1 py-3 px-4">
            <div className="h-5 bg-gray-200 rounded w-24 mx-auto animate-pulse"></div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-32 mb-1 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse"></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="h-3 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-300 max-w-md ${
          toastMessage.includes('New booking request') ? 'bg-blue-600 text-white' :
          toastMessage.includes('accepted') ? 'bg-green-600 text-white' :
          toastMessage.includes('rejected') ? 'bg-red-600 text-white' :
          'bg-gray-900 text-white'
        }`}>
          <Bell className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-300 hover:text-white flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#00C48C] to-[#00b37d] text-white p-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Car className="w-6 h-6" />
          {t.modals.requests.bookingRequests}
        </h2>
        <p className="text-white/80 mt-1">{t.modals.requests.manageBookings}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex-1 py-3 px-4 font-semibold transition-colors ${
            activeTab === 'incoming'
              ? 'bg-[#00C48C] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {t.modals.requests.incoming} ({incomingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex-1 py-3 px-4 font-semibold transition-colors ${
            activeTab === 'outgoing'
              ? 'bg-[#00C48C] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {t.modals.requests.myRequests} ({outgoingRequests.length})
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'incoming' ? (
          <div className="space-y-4">
            {incomingRequests.length === 0 ? (
              <div className="text-center py-8">
                <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">{t.modals.requests.noIncomingRequests}</h3>
                <p className="text-gray-500">{t.modals.requests.whenSomeoneWantsToBook}</p>
              </div>
            ) : (
              incomingRequests.map((request) => (
                <div
                  key={request.id}
                  className={`border rounded-xl p-4 hover:shadow-md transition-all duration-500 relative ${
                    recentlyUpdated.includes(request.id)
                      ? 'border-green-300 bg-green-50 shadow-lg ring-2 ring-green-200'
                      : newRequests.includes(request.id)
                      ? 'border-blue-300 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                      : 'border-gray-200'
                  }`}
                >
                  {/* NEW Badge for new requests */}
                  {newRequests.includes(request.id) && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10">
                      NEW
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#00C48C] p-2 rounded-lg">
                        <Car className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{request.spot?.name || 'Unknown Spot'}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {t.modals.requests.requestedBy} {request.requester?.full_name || request.requester?.email || 'Unknown User'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status === 'pending' ? t.modals.requests.pending :
                       request.status === 'accepted' ? t.modals.requests.accepted :
                       request.status === 'rejected' ? t.modals.requests.rejected :
                       t.modals.requests.completed}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <UserIcon className="w-4 h-4" />
                      <span>{request.requester?.full_name || 'Unknown User'}</span>
                      <span>•</span>
                      <Mail className="w-4 h-4" />
                      <span>{request.requester?.email || 'No email'}</span>
                    </div>

                    {/* Date/Time Information */}
                    {request.start_date && request.start_time && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Clock className="w-4 h-4" />
                          <span>{t.modals.requests.requestedTimeSlot}</span>
                        </div>
                        <div className="bg-white rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t.modals.requests.date}</span>
                            <span className="font-semibold text-gray-900">
                              {request.start_date && request.end_date && request.start_date === request.end_date
                                ? new Date(request.start_date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })
                                : request.start_date && request.end_date
                                ? `${new Date(request.start_date).toLocaleDateString()} - ${new Date(request.end_date).toLocaleDateString()}`
                                : t.modals.requests.dateNotSpecified
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t.modals.requests.time}</span>
                            <span className="font-semibold text-gray-900">
                              {request.start_time && request.end_time
                                ? `${request.start_time} - ${request.end_time}`
                                : t.modals.requests.timeNotSpecified
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t.modals.requests.type}</span>
                            <span className="font-semibold text-gray-900 capitalize">
                              {request.booking_type === 'hourly' || !request.booking_type ? t.modals.requests.hourly : request.booking_type}
                            </span>
                          </div>

                          {/* Message from requester */}
                          {request.message && (
                            <div className="pt-2 border-t border-gray-200 mt-2">
                              <span className="text-sm text-gray-600 block mb-1">{t.modals.requests.message}</span>
                              <p className="text-sm text-gray-800 italic bg-gray-50 p-2 rounded">
                                "{request.message}"
                              </p>
                            </div>
                          )}

                          {/* Pricing Information */}
                          {(() => {
                            // Calculate pricing information if not stored in database
                            const spotPrice = request.spot?.price;
                            let calculatedHours = request.total_hours;
                            let calculatedPrice = request.total_price;

                            // If pricing info not stored, calculate from dates/times
                            if (!calculatedHours && request.start_date && request.end_date && request.start_time && request.end_time && spotPrice) {
                              const startDateTime = new Date(`${request.start_date}T${request.start_time}`);
                              const endDateTime = new Date(`${request.end_date}T${request.end_time}`);
                              calculatedHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
                              calculatedPrice = calculatedHours * spotPrice;
                            }

                            return (calculatedHours && calculatedPrice) ? (
                              <>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                  <span className="text-sm text-gray-600">{t.modals.requests.duration}</span>
                                  <span className="font-semibold text-gray-900">
                                    {calculatedHours.toFixed(2)} {t.modals.requests.hours}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                                  <span className="text-sm text-green-800 font-semibold">{t.modals.requests.totalPrice}</span>
                                  <span className="font-bold text-green-800 text-lg">
                                    {calculatedPrice.toFixed(2)} RON
                                    {!request.total_price && request.total_hours && (
                                      <span className="text-xs text-green-600 ml-1">(calculated)</span>
                                    )}
                                  </span>
                                </div>
                              </>
                            ) : spotPrice ? (
                              <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                <span className="text-sm text-gray-600">{t.modals.requests.hourlyRate}</span>
                                <span className="font-semibold text-gray-900">
                                  {spotPrice.toFixed(2)} RON{t.modals.requests.perHour}
                                </span>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      {t.modals.requests.requestedOn} {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                    </p>
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequestAction(request.id, 'accepted')}
                        disabled={actionLoading === request.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {actionLoading === request.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {t.modals.requests.accept}
                      </button>
                      <button
                        onClick={() => handleRequestAction(request.id, 'rejected')}
                        disabled={actionLoading === request.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {actionLoading === request.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <RejectIcon className="w-4 h-4" />
                        )}
                        {t.modals.requests.reject}
                      </button>
                    </div>
                  )}

                  {request.status !== 'pending' && (
                    <div className="text-sm text-gray-600 text-center py-2">
                      <p>
                        {request.status === 'accepted'
                          ? t.modals.requests.youAcceptedThis
                          : request.status === 'completed'
                          ? t.modals.requests.bookingCompleted
                          : t.modals.requests.youRejectedThis}
                      </p>
                      {request.status === 'accepted' && (request.payment_processed || request.payment_amount) && (
                        <p className="text-green-600 font-semibold mt-1">
                          💰 {t.modals.requests.paymentProcessed.replace('{{amount}}', request.payment_amount ? request.payment_amount.toFixed(2) : 'amount')}
                        </p>
                      )}
                      {request.status === 'accepted' && request.accepted_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          {t.modals.requests.acceptedOn} {formatLocalDate(request.accepted_at)} at {formatLocalTime(request.accepted_at, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {outgoingRequests.length === 0 ? (
              <div className="text-center py-8">
                <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">{t.modals.requests.noOutgoingRequests}</h3>
                <p className="text-gray-500">{t.modals.requests.whenYouRequestToBook}</p>
              </div>
            ) : (
              outgoingRequests.map((request) => (
                <div
                  key={request.id}
                  className={`border rounded-xl p-4 hover:shadow-md transition-all duration-500 ${
                    recentlyUpdated.includes(request.id)
                      ? 'border-green-300 bg-green-50 shadow-lg ring-2 ring-green-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#00C48C] p-2 rounded-lg">
                        <Car className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{request.spot?.name || 'Unknown Spot'}</h3>
                        <p className="text-sm text-gray-600">
                          Owned by {request.requester?.full_name || request.requester?.email || 'Unknown User'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status === 'pending' ? t.modals.requests.pending :
                       request.status === 'accepted' ? t.modals.requests.accepted :
                       request.status === 'rejected' ? t.modals.requests.rejected :
                       t.modals.requests.completed}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">
                      {t.modals.requests.requestedOn} {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                    </p>
                    {request.status !== 'pending' && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500">
                          {request.status === 'accepted' ? t.modals.requests.acceptedOn :
                           request.status === 'completed' ? t.modals.requests.completedOn :
                           t.modals.requests.rejectedOn} {new Date(request.updated_at).toLocaleDateString()}
                        </p>
                        {request.status === 'accepted' && (request.payment_processed || request.payment_amount) && (
                          <p className="text-xs text-red-600 font-semibold">
                            💸 {t.modals.requests.paymentDeducted.replace('{{amount}}', request.payment_amount ? request.payment_amount.toFixed(2) : 'amount')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

