import { createClient } from '@supabase/supabase-js';

// Database migrations to fix timezone and booking status issues
// Run these SQL commands in your Supabase SQL editor:

/*
// 1. Add user_timezone column to booking_requests table
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS user_timezone TEXT;

// 2. Update the update_booking_statuses_full_cycle function to use user timezone
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_booking_statuses_full_cycle();

-- Create updated function that uses user timezone
CREATE OR REPLACE FUNCTION update_booking_statuses_full_cycle()
RETURNS INTEGER AS $$
DECLARE
    status_updates INTEGER := 0;
    booking_record RECORD;
    current_time_utc TIMESTAMP WITH TIME ZONE;
    booking_start_time TIMESTAMP WITH TIME ZONE;
    booking_end_time TIMESTAMP WITH TIME ZONE;
    user_tz TEXT;
    debug_msg TEXT;
    total_bookings_found INTEGER := 0;
BEGIN
    -- Get current UTC time
    current_time_utc := NOW() AT TIME ZONE 'UTC';

    -- Debug: Log current time (use WARNING level to ensure visibility)
    RAISE WARNING '🔄 STARTING MAINTENANCE: Current UTC time: %', current_time_utc;

    -- Debug: Count total accepted bookings
    SELECT COUNT(*) INTO total_bookings_found
    FROM booking_requests
    WHERE status = 'accepted';

    RAISE WARNING '📊 Found % total accepted bookings', total_bookings_found;

    -- Process accepted bookings that should become reserved AT THEIR START TIME ONLY
    FOR booking_record IN
        SELECT br.*, sp.status as spot_status
        FROM booking_requests br
        JOIN spots sp ON br.spot_id = sp.id
        WHERE br.status = 'accepted'
        AND sp.status = 'available'
    LOOP
        total_bookings_found := total_bookings_found + 1;

        -- Use user's timezone if available, otherwise default to UTC
        user_tz := COALESCE(booking_record.user_timezone, 'UTC');

        -- Debug: Show raw data
        RAISE WARNING '🎯 Processing accepted booking %s: date=%s, time=%s, timezone=%s',
                    booking_record.id, booking_record.start_date, booking_record.start_time, user_tz;

        -- Convert booking start time to UTC using user's timezone
        BEGIN
            -- Cast as timestamp WITHOUT timezone first, then convert from user's timezone to UTC
            booking_start_time := ((booking_record.start_date || ' ' || booking_record.start_time)::timestamp AT TIME ZONE user_tz);
            
            RAISE WARNING 'Booking %s: start_time=%s (UTC), current_time=%s (UTC), comparison: %s',
                         booking_record.id, booking_start_time, current_time_utc,
                         CASE WHEN current_time_utc >= booking_start_time THEN 'TRUE (mark as reserved)' ELSE 'FALSE (keep available)' END;

            -- ONLY mark as reserved if current time has reached the booking start time
            IF current_time_utc >= booking_start_time THEN
                RAISE WARNING '✅ EXECUTING: Marking spot % as RESERVED (start time reached)', booking_record.spot_id;
                UPDATE spots SET status = 'reserved', updated_at = NOW() WHERE id = booking_record.spot_id;
                status_updates := status_updates + 1;
            ELSE
                RAISE WARNING '⏳ WAITING: NOT marking spot % as reserved yet - %s hours until booking starts',
                           booking_record.spot_id,
                           EXTRACT(EPOCH FROM (booking_start_time - current_time_utc))/3600;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ ERROR parsing time for booking %s: %s', booking_record.id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RAISE WARNING '📈 Phase 1 complete - processed available->reserved bookings';

    -- Skip the reserved->occupied phase - user will manually manage occupied status if needed

    -- Process completed bookings that should become available (at end time)
    FOR booking_record IN
        SELECT br.*, sp.status as spot_status
        FROM booking_requests br
        JOIN spots sp ON br.spot_id = sp.id
        WHERE br.status = 'accepted'
        AND sp.status IN ('reserved', 'occupied')
    LOOP
        -- Use user's timezone if available, otherwise default to UTC
        user_tz := COALESCE(booking_record.user_timezone, 'UTC');

        -- Debug: Show raw data first
        RAISE WARNING 'Processing booking %s (completion): end_date=%s, end_time=%s, timezone=%s',
                    booking_record.id, booking_record.end_date, booking_record.end_time, user_tz;

        -- Convert booking end time to UTC using user's timezone
        BEGIN
            -- Cast as timestamp WITHOUT timezone first, then convert from user's timezone to UTC
            booking_end_time := ((booking_record.end_date || ' ' || booking_record.end_time)::timestamp AT TIME ZONE user_tz);
            
            RAISE WARNING 'Booking %s (completion check): end_time=%s (UTC), current_time=%s (UTC), comparison: %s',
                         booking_record.id, booking_end_time, current_time_utc,
                         CASE WHEN current_time_utc > booking_end_time THEN 'TRUE (mark as available)' ELSE 'FALSE (keep reserved/occupied)' END;

            -- If current time is past the booking end time, mark spot as available and booking as completed
            IF current_time_utc > booking_end_time THEN
                RAISE WARNING '✅ EXECUTING: Marking spot % as AVAILABLE (booking ended)', booking_record.spot_id;
                UPDATE spots SET status = 'available', updated_at = NOW() WHERE id = booking_record.spot_id;
                UPDATE booking_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = booking_record.id;
                status_updates := status_updates + 1;
            ELSE
                RAISE WARNING '⏳ WAITING: Not completing booking % yet - %s hours until end',
                           booking_record.id,
                           EXTRACT(EPOCH FROM (booking_end_time - current_time_utc))/3600;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ ERROR parsing time for booking %s: %s', booking_record.id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RAISE WARNING '🎉 MAINTENANCE COMPLETE: Total status updates: %, Total bookings processed: %', status_updates, total_bookings_found;
    RETURN status_updates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

// Use placeholder values during build if env vars not set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ParkingSpot = {
  id: string;
  name: string;
  status: 'available' | 'reserved' | 'occupied';
  owner_id: string;
  owner_name?: string; // Owner name for display
  owner_email?: string; // Owner email for display
  latitude?: number; // GPS latitude
  longitude?: number; // GPS longitude
  price?: number; // Hourly price in USD (e.g., 2.00 for $2/hour)
  created_at: string;
  updated_at: string;
  map_x?: number; // X position on map (0-100%) - legacy
  map_y?: number; // Y position on map (0-100%) - legacy
  has_availability_schedule?: boolean; // Whether spot has custom availability schedule
  default_available?: boolean; // Default availability when no schedule (defaults to true)
};

export type Profile = {
  id: string;
  email: string;
  full_name?: string;
  wallet_balance?: number;
  created_at: string;
};

export type BookingRequest = {
  id: string;
  spot_id: string;
  requester_id: string;
  owner_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  message?: string;
  start_date?: string; // Date string (YYYY-MM-DD)
  end_date?: string; // Date string (YYYY-MM-DD)
  start_time?: string; // Time string (HH:MM:SS)
  end_time?: string; // Time string (HH:MM:SS)
  booking_type?: 'hourly' | 'daily'; // Default to 'hourly'
  total_hours?: number; // Calculated total hours for booking
  total_price?: number; // Calculated total price for booking
  accepted_at?: string; // When the booking was accepted
  payment_amount?: number; // Amount that was paid
  payment_processed?: boolean; // Whether payment was successfully processed
  completed_at?: string; // When the booking was automatically completed
  user_timezone?: string; // User's timezone (e.g., 'Asia/Karachi', 'America/New_York')
  created_at: string;
  updated_at: string;
};

