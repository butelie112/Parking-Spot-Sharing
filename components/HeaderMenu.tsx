'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, ChevronDown, Settings, LogOut, User, Bell, Map, Grid3x3, Plus, X, MapPin, CheckCircle, Wallet, CreditCard, Calendar, Info, Mail } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { SpotAvailabilitySchedule } from './SpotAvailabilitySchedule';
import { createCheckoutSession, verifyPayment } from '@/lib/stripe';

interface HeaderMenuProps {
  userName: string;
  pendingRequestsCount: number;
  onRequestsClick: () => void;
  onAddSpotClick: () => void;
  onLocationSelected: (location: { lat: number; lng: number }) => void;
  onEnablePinPlacement: () => void;
  viewMode: 'map' | 'grid';
  onViewModeChange: (mode: 'map' | 'grid') => void;
}

export function HeaderMenu({
  userName,
  pendingRequestsCount,
  onRequestsClick,
  onAddSpotClick,
  onLocationSelected,
  onEnablePinPlacement,
  viewMode,
  onViewModeChange
}: HeaderMenuProps) {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [settingsName, setSettingsName] = useState(userName || user?.email?.split('@')[0] || '');
  const [saving, setSaving] = useState(false);

  // Add spot modal states
  const [showAddSpotModal, setShowAddSpotModal] = useState(false);
  const [addSpotStep, setAddSpotStep] = useState<'select_location' | 'enter_name' | 'set_availability'>('select_location');
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotPrice, setNewSpotPrice] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addingSpot, setAddingSpot] = useState(false);
  const [spotAdded, setSpotAdded] = useState(false);
  const [spotScheduleData, setSpotScheduleData] = useState<any>(null);

  // Wallet states
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching wallet balance:', error);
      } else {
        setWalletBalance(data?.wallet_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  // Fetch wallet balance on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
    }
  }, [user]);

  // Listen for wallet balance changes
  useEffect(() => {
    const handleWalletBalanceChanged = () => {
      if (user) {
        fetchWalletBalance();
      }
    };

    window.addEventListener('walletBalanceChanged', handleWalletBalanceChanged);

    return () => {
      window.removeEventListener('walletBalanceChanged', handleWalletBalanceChanged);
    };
  }, [user]);

  // Listen for open wallet modal events
  useEffect(() => {
    const handleOpenWalletModal = () => {
      setShowWalletModal(true);
    };

    window.addEventListener('openWalletModal', handleOpenWalletModal);

    return () => {
      window.removeEventListener('openWalletModal', handleOpenWalletModal);
    };
  }, []);

  // Handle adding balance via Stripe
  const handleAddBalance = async (amount: number) => {
    if (!user) {
      alert('Please login to add balance');
      return;
    }

    if (amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setProcessingPayment(true);

    try {
      // Create Stripe Checkout Session
      const { url } = await createCheckoutSession(amount, user.id);
      
      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to initiate payment. Please try again.');
      setProcessingPayment(false);
    }
  };

  // Check for payment success on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const sessionId = urlParams.get('session_id');

    if (paymentSuccess === 'true' && sessionId) {
      // Clean up URL immediately for faster perceived performance
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Verify payment in background
      verifyPayment(sessionId).then((data) => {
        if (data.success) {
          // Refresh balance
          fetchWalletBalance();
          
          // Show success message
          if (!data.alreadyProcessed) {
            const walletAmount = data.walletAmount || data.amount || 0;
            alert(`✅ Payment successful! Added ${walletAmount.toFixed(2)} RON to your wallet.`);
          } else {
            // Payment was already processed (probably by webhook)
            alert(`✅ Payment confirmed! Your wallet has been updated.`);
          }
        }
      }).catch((error) => {
        console.error('Error verifying payment:', error);
        // Still show success since Stripe confirmed payment
        alert(`✅ Payment successful! Your balance will be updated shortly.`);
        // Try to refresh balance anyway
        setTimeout(() => fetchWalletBalance(), 2000);
      });
    } else if (urlParams.get('payment_canceled') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      alert('Payment was canceled.');
    }
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setShowViewMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  // Handle add spot modal
  const handleAddSpotClick = () => {
    setShowAddSpotModal(true);
    setAddSpotStep('select_location');
    setNewSpotName('');
    setSelectedLocation(null);
    setSpotAdded(false);
  };

  // Handle pin placement
  const handleAddPinClick = () => {
    // Enable pin placement mode BEFORE closing modal
    onEnablePinPlacement();
    // Switch to map view if not already
    onViewModeChange('map');
    // Close modal
    setShowAddSpotModal(false);
    // Scroll to map
    setTimeout(() => {
      const mapElement = document.querySelector('.leaflet-container');
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  };

  // Handle location selected (called by parent component)
  const handleLocationSelected = (location: { lat: number; lng: number }) => {
    console.log('Pin placement: Opening name entry modal for location', location);
    setSelectedLocation(location);
    setAddSpotStep('enter_name');
    setShowAddSpotModal(true); // Ensure modal is open for name entry
    onLocationSelected(location); // Notify parent component
  };

  // Handle spot creation
  const handleCreateSpot = async () => {
    if (!selectedLocation || !newSpotName.trim() || !user) return;

    setAddingSpot(true);
    try {
      // Get schedule data if available
      const scheduleData = (window as any).getSpotScheduleData ? (window as any).getSpotScheduleData() : null;

      // Create the spot
      const { data: spotData, error } = await supabase
        .from('spots')
        .insert({
          name: newSpotName.trim(),
          price: newSpotPrice ? parseFloat(newSpotPrice) : 0,
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          owner_id: user.id,
          status: 'available',
          has_availability_schedule: scheduleData?.has_availability_schedule || false,
          default_available: scheduleData?.default_available !== false
        })
        .select()
        .single();

      if (error) throw error;

      // If schedule data exists, save it
      if (scheduleData && scheduleData.has_availability_schedule && spotData) {
        // Save availability schedules
        if (scheduleData.schedules && scheduleData.schedules.length > 0) {
          const schedulesToInsert = scheduleData.schedules.map((schedule: any) => ({
            spot_id: spotData.id,
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
            spot_id: spotData.id,
            blocked_date: blocked.blocked_date,
            reason: blocked.reason
          }));

          const { error: blockedError } = await supabase
            .from('blocked_dates')
            .insert(blockedToInsert);

          if (blockedError) console.error('Error saving blocked dates:', blockedError);
        }
      }

      // Call the original onAddSpotClick to refresh spots
      onAddSpotClick();

      // Show success message
      setSpotAdded(true);
      setTimeout(() => {
        setShowAddSpotModal(false);
        setSpotAdded(false);
      }, 2000);

    } catch (error) {
      console.error('Error creating spot:', error);
      alert('Failed to add spot. Please try again.');
    } finally {
      setAddingSpot(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) {
      alert('No user logged in');
      return;
    }

    setSaving(true);
    try {
      console.log('Attempting to update profile for user:', user.id);
      console.log('New name:', settingsName.trim());

      // First check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      console.log('Existing profile:', existingProfile);
      console.log('Fetch error:', fetchError);

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      // Update or insert profile
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: settingsName.trim(),
        }, {
          onConflict: 'id'
        })
        .select();

      console.log('Upsert result:', data);
      console.log('Upsert error:', error);

      if (error) {
        console.error('Full error object:', JSON.stringify(error, null, 2));
        throw new Error(`Update failed: ${error.message} (${error.code})`);
      }

      // Update local state
      setShowSettings(false);
      // Show success message
      alert('Success! Settings saved successfully.');
      // Refresh to update the displayed name
      window.location.reload();
    } catch (error: any) {
      console.error('Caught error:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      alert('Failed to update profile: ' + (error?.message || JSON.stringify(error) || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Mobile Header */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Top Row: Logo + Menus */}
        <div className="flex items-center justify-between">
          <img
            src="/logo-header.png"
            alt="Parkezz Logo"
            className="h-10 w-auto object-contain"
          />

          <div className="flex items-center gap-2">
            {/* Requests Bell */}
            <button
              onClick={onRequestsClick}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl shadow-sm transition-all relative"
              title="Requests"
            >
              <Bell className="w-5 h-5" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </span>
              )}
            </button>

            {/* View Menu */}
            <div className="relative" ref={viewMenuRef}>
              <button
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 p-2.5 rounded-xl shadow-sm border border-gray-200 transition-all flex items-center gap-1"
                title="View Options"
              >
                {viewMode === 'map' ? <Map className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showViewMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-32 bg-white border border-gray-200 rounded-xl shadow-xl"
                  style={{ 
                    zIndex: 9999,
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewModeChange('map');
                      setShowViewMenu(false);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewModeChange('map');
                      setShowViewMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Map className="w-4 h-4" />
                    {t.parking.grid.viewMode.map}
                  </button>
                  <button
                    type="button"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewModeChange('grid');
                      setShowViewMenu(false);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewModeChange('grid');
                      setShowViewMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    {t.parking.grid.viewMode.grid}
                  </button>
                </div>
              )}
            </div>

            {/* Main Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="bg-white hover:bg-gray-100 text-gray-800 p-2.5 rounded-xl shadow-sm border border-gray-200 transition-all flex items-center gap-1"
                title="Menu"
              >
                <Menu className="w-5 h-5" />
                <ChevronDown className="w-3 h-3" />
              </button>

              {showMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl"
                  style={{ 
                    zIndex: 9999,
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  {/* User Info */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#00C48C] to-[#007BFF] rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-white text-sm font-bold">
                          {getUserInitials(userName, user?.email || '')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {userName || user?.email?.split('@')[0] || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      type="button"
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        setTimeout(() => router.push('/how-it-works'), 100);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        setTimeout(() => router.push('/how-it-works'), 100);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <Info className="w-4 h-4" />
                      {t.footer.howItWorks}
                    </button>
                    <button
                      type="button"
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        setTimeout(() => router.push('/contact'), 100);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        setTimeout(() => router.push('/contact'), 100);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <Mail className="w-4 h-4" />
                      {t.footer.contact}
                    </button>
                    <button
                      type="button"
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSettings(true);
                        setShowMenu(false);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSettings(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      {t.header.settings}
                    </button>
                    <button
                      type="button"
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowWalletModal(true);
                        setShowMenu(false);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowWalletModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <Wallet className="w-4 h-4" />
                      {t.header.wallet}
                    </button>
                    <button
                      type="button"
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        signOut();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        signOut();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <LogOut className="w-4 h-4" />
                      {t.auth.logout.button}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Action Buttons */}
        <div className="flex gap-2">
          {/* Wallet Balance */}
          <button
            onClick={() => setShowWalletModal(true)}
            className="flex-1 bg-white hover:bg-gray-50 text-gray-800 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md border border-gray-200 font-semibold text-sm"
            title="Wallet Balance"
          >
            <Wallet className="w-5 h-5" />
{walletBalance.toFixed(2)} RON
          </button>

          <button
            onClick={handleAddSpotClick}
            className="flex-1 bg-[#00C48C] hover:bg-[#00b37d] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md font-semibold text-sm"
          >
            <Plus className="w-5 h-5" />
            {t.header.addSpot}
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/logo-header.png"
            alt="Parkezz Logo"
            className="h-12 md:h-16 w-auto object-contain transform hover:scale-105 transition-transform"
          />

          {/* View Menu */}
          <div className="relative" ref={viewMenuRef}>
            <button
              onClick={() => setShowViewMenu(!showViewMenu)}
              className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2.5 rounded-xl shadow-md border border-gray-200 flex items-center gap-2 transition-all"
            >
              {viewMode === 'map' ? <Map className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
              <span className="font-semibold">{t.header.view}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showViewMenu && (
              <div className="absolute left-0 top-full mt-2 w-36 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
                <button
                  onClick={() => {
                    onViewModeChange('map');
                    setShowViewMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                >
                  <Map className="w-4 h-4" />
                  {t.parking.grid.viewMode.map}
                </button>
                <button
                  onClick={() => {
                    onViewModeChange('grid');
                    setShowViewMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                >
                  <Grid3x3 className="w-4 h-4" />
                  {t.parking.grid.viewMode.grid}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Requests Bell */}
          <button
            onClick={onRequestsClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl relative"
            title="Requests"
          >
            <Bell className="w-5 h-5" />
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Main Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2.5 rounded-xl shadow-md border border-gray-200 flex items-center gap-2 transition-all"
            >
              <Menu className="w-5 h-5" />
              <span className="font-semibold">{t.header.menu}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {/* User Info */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#00C48C] to-[#007BFF] rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm font-bold">
                        {getUserInitials(userName, user?.email || '')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {userName || user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    type="button"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      setTimeout(() => router.push('/how-it-works'), 100);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      setTimeout(() => router.push('/how-it-works'), 100);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Info className="w-4 h-4" />
                    {t.footer.howItWorks}
                  </button>
                  <button
                    type="button"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      setTimeout(() => router.push('/contact'), 100);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      setTimeout(() => router.push('/contact'), 100);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Mail className="w-4 h-4" />
                    {t.footer.contact}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSettings(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Settings className="w-4 h-4" />
                    {t.header.settings}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowWalletModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Wallet className="w-4 h-4" />
                    {t.header.wallet}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.auth.logout.button}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Wallet Balance */}
          <button
            onClick={() => setShowWalletModal(true)}
            className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl border border-gray-200 transform hover:scale-105"
            title="Wallet Balance"
          >
            <Wallet className="w-5 h-5" />
            <span className="font-semibold">{walletBalance.toFixed(2)} RON</span>
          </button>

          <button
            onClick={handleAddSpotClick}
            className="bg-[#00C48C] hover:bg-[#00b37d] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span>{t.header.addSpot}</span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998
            }}
            onClick={() => {
              setShowSettings(false);
            }}
          />
          <div
            className="fixed top-[250%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md p-4"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
              ref={settingsRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">{t.modals.settings.title}</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.modals.settings.name}
                  </label>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900"
                    placeholder={t.modals.settings.name}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.modals.settings.email}
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-gray-600 bg-gray-50 cursor-not-allowed"
                    placeholder={t.modals.settings.email}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200 mt-4">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="flex-1 bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      t.modals.settings.save
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Spot Modal */}
      {showAddSpotModal && (
        <div>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998
            }}
            onClick={() => setShowAddSpotModal(false)}
          />
          <div
            className="fixed top-[200%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md p-4"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">{t.modals.addSpot.title}</h3>
                <button
                  onClick={() => setShowAddSpotModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-6">
                {addSpotStep === 'select_location' && (
                  <div className="text-center">
                    <MapPin className="w-16 h-16 text-[#00C48C] mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{t.modals.addSpot.selectLocation}</h4>
                    <p className="text-gray-600 mb-6">
                      {t.modals.addSpot.clickMap}
                    </p>
                    <button
                      onClick={handleAddPinClick}
                      className="w-full bg-[#00C48C] hover:bg-[#00b37d] text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-5 h-5" />
                      {t.modals.addSpot.selectLocation}
                    </button>
                  </div>
                )}

                {addSpotStep === 'enter_name' && (
                  <div>
                    <div className="text-center mb-6">
                      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">{t.modals.addSpot.enterDetails}</h4>
                      <p className="text-gray-600">
                        {t.modals.addSpot.enterDetailsDesc}
                      </p>
                    </div>

                    <div className="space-y-4">
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

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t.modals.addSpot.pricePerHour} - Optional
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
                            <span className="text-gray-500 text-sm">{t.common.perHour}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => {
                            setAddSpotStep('select_location');
                            setSelectedLocation(null);
                          }}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all"
                        >
                          {t.common.back}
                        </button>
                        <button
                          onClick={() => setAddSpotStep('set_availability')}
                          disabled={!newSpotName.trim()}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {t.parking.spot.setAvailability}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {addSpotStep === 'set_availability' && (
                  <div>
                    <div className="text-center mb-6">
                      <Calendar className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">{t.parking.availability.setScheduleOptional}</h4>
                      <p className="text-gray-600">
                        {t.parking.availability.defineAvailability}
                      </p>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                      <SpotAvailabilitySchedule 
                        isNewSpot={true}
                        onSave={(hasSchedule) => console.log('Schedule set:', hasSchedule)}
                      />
                    </div>

                    <div className="flex gap-3 pt-4 mt-4 border-t">
                      <button
                        onClick={() => setAddSpotStep('enter_name')}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all"
                      >
                        {t.common.back}
                      </button>
                      <button
                        onClick={handleCreateSpot}
                        disabled={!newSpotName.trim() || addingSpot}
                        className="flex-1 bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {addingSpot ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            {t.modals.addSpot.create}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {spotAdded && (
                  <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{t.modals.addSpot.created}</h4>
                    <p className="text-gray-600">
                      {t.modals.addSpot.spotCreatedDesc}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998
            }}
            onClick={() => setShowWalletModal(false)}
          />
          <div
            className="fixed top-[320%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md p-4"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">{t.modals.wallet.title}</h3>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close wallet"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Current Balance */}
                <div className="text-center">
                  <Wallet className="w-16 h-16 text-[#00C48C] mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{t.modals.wallet.balance}</h4>
                  <p className="text-3xl font-bold text-[#00C48C]">{walletBalance.toFixed(2)} RON</p>
                </div>

                {/* Add Balance Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.modals.wallet.topUp}</h4>

                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        💳 {t.modals.wallet.securePayment} <strong>Stripe</strong>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {t.modals.wallet.securePaymentInfo}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleAddBalance(50)}
                        disabled={processingPayment}
                        className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-800 font-semibold py-3 px-2 rounded-xl transition-all flex flex-col items-center justify-center"
                      >
                        <span className="text-sm">50 RON</span>
                      </button>
                      <button
                        onClick={() => handleAddBalance(100)}
                        disabled={processingPayment}
                        className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-800 font-semibold py-3 px-2 rounded-xl transition-all flex flex-col items-center justify-center"
                      >
                        <span className="text-sm">100 RON</span>
                      </button>
                      <button
                        onClick={() => handleAddBalance(200)}
                        disabled={processingPayment}
                        className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-800 font-semibold py-3 px-2 rounded-xl transition-all flex flex-col items-center justify-center"
                      >
                        <span className="text-sm">200 RON</span>
                      </button>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t.modals.wallet.customAmount}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-semibold">RON</span>
                        </div>
                        <input
                          type="number"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="0.00"
                          min="10"
                          step="10"
                          disabled={processingPayment}
                          className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00C48C] focus:border-transparent outline-none text-gray-900 disabled:bg-gray-100"
                        />
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          {t.modals.wallet.minimumAmount}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const amount = parseFloat(customAmount);
                        if (amount >= 10) {
                          handleAddBalance(amount);
                        } else {
                          alert('Please enter an amount of at least 10 RON');
                        }
                      }}
                      disabled={processingPayment || !customAmount || parseFloat(customAmount) < 10}
                      className="w-full bg-[#00C48C] hover:bg-[#00b37d] disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {processingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          {t.modals.wallet.processing}
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          {t.modals.wallet.addFunds}
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowWalletModal(false)}
                      className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all"
                    >
                      {t.common.close}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
