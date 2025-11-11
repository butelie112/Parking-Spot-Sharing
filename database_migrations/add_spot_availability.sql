-- ============================================
-- SPOT AVAILABILITY SCHEDULE FEATURE
-- ============================================
-- This migration adds support for owners to define when their
-- parking spots are available for booking.

-- Step 1: Create availability_schedules table
-- This stores recurring weekly schedules for spots
CREATE TABLE IF NOT EXISTS availability_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true, -- true = available for booking, false = blocked/occupied
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  UNIQUE(spot_id, day_of_week, start_time, end_time) -- Prevent duplicate schedules
);

-- Step 2: Create blocked_dates table
-- This stores specific dates when spots are unavailable (overrides weekly schedule)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT, -- Optional reason for blocking (e.g., "Personal use", "Maintenance")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(spot_id, blocked_date) -- One entry per spot per date
);

-- Step 3: Add default availability flag to spots table
ALTER TABLE spots
ADD COLUMN IF NOT EXISTS has_availability_schedule BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_available BOOLEAN DEFAULT true; -- If no schedule set, is it available by default?

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_availability_schedules_spot_id ON availability_schedules(spot_id);
CREATE INDEX IF NOT EXISTS idx_availability_schedules_day_of_week ON availability_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_spot_id ON blocked_dates(spot_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(blocked_date);

-- Step 5: Create a function to check if a spot is available at a specific time
CREATE OR REPLACE FUNCTION check_spot_availability(
  p_spot_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_start_time TIME,
  p_end_time TIME
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_schedule BOOLEAN;
  v_default_available BOOLEAN;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_available BOOLEAN;
BEGIN
  -- Get spot's schedule settings
  SELECT has_availability_schedule, default_available
  INTO v_has_schedule, v_default_available
  FROM spots
  WHERE id = p_spot_id;

  -- If spot doesn't have a schedule, use default availability
  IF NOT v_has_schedule THEN
    RETURN v_default_available;
  END IF;

  -- Check each day in the requested range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- Check if this specific date is blocked
    IF EXISTS (
      SELECT 1 FROM blocked_dates
      WHERE spot_id = p_spot_id
      AND blocked_date = v_current_date
    ) THEN
      RETURN false; -- Date is blocked
    END IF;

    -- Get day of week (0=Sunday, 6=Saturday)
    v_day_of_week := EXTRACT(DOW FROM v_current_date);

    -- Check if there's an availability schedule for this day and time
    -- For simplicity, we check if ANY part of the requested time overlaps with available time
    IF NOT EXISTS (
      SELECT 1 FROM availability_schedules
      WHERE spot_id = p_spot_id
      AND day_of_week = v_day_of_week
      AND is_available = true
      AND NOT (
        -- No overlap if requested time ends before schedule starts
        p_end_time <= start_time
        OR
        -- No overlap if requested time starts after schedule ends
        p_start_time >= end_time
      )
    ) THEN
      -- No available schedule found for this day/time
      RETURN false;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN true; -- All days in range are available
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a function to get available time slots for a spot on a specific date
CREATE OR REPLACE FUNCTION get_available_slots(
  p_spot_id UUID,
  p_date DATE
) RETURNS TABLE (
  start_time TIME,
  end_time TIME
) AS $$
DECLARE
  v_has_schedule BOOLEAN;
  v_default_available BOOLEAN;
  v_day_of_week INTEGER;
BEGIN
  -- Get spot's schedule settings
  SELECT has_availability_schedule, default_available
  INTO v_has_schedule, v_default_available
  FROM spots
  WHERE id = p_spot_id;

  -- Check if date is blocked
  IF EXISTS (
    SELECT 1 FROM blocked_dates
    WHERE spot_id = p_spot_id
    AND blocked_date = p_date
  ) THEN
    RETURN; -- Return empty set if date is blocked
  END IF;

  -- If no schedule, return full day if default available
  IF NOT v_has_schedule THEN
    IF v_default_available THEN
      RETURN QUERY SELECT '00:00:00'::TIME, '23:59:59'::TIME;
    END IF;
    RETURN; -- Return empty set if not available by default
  END IF;

  -- Get day of week
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Return available time slots for this day
  RETURN QUERY
  SELECT a.start_time, a.end_time
  FROM availability_schedules a
  WHERE a.spot_id = p_spot_id
  AND a.day_of_week = v_day_of_week
  AND a.is_available = true
  ORDER BY a.start_time;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Update the booking validation to check availability
-- This modifies the existing booking creation to validate against availability schedule
CREATE OR REPLACE FUNCTION validate_booking_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate for new bookings or status changes to accepted
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted')) THEN
    -- Check if the requested time slot is available
    IF NOT check_spot_availability(
      NEW.spot_id,
      NEW.start_date::DATE,
      NEW.end_date::DATE,
      NEW.start_time::TIME,
      NEW.end_time::TIME
    ) THEN
      RAISE EXCEPTION 'The requested time slot is not available for this parking spot';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking validation
DROP TRIGGER IF EXISTS validate_booking_availability_trigger ON booking_requests;
CREATE TRIGGER validate_booking_availability_trigger
  BEFORE INSERT OR UPDATE ON booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_availability();

-- Step 8: Sample data for testing (optional - remove in production)
-- Example: Set a spot to be available only on weekdays 9 AM - 5 PM
/*
-- Get a spot ID first
WITH sample_spot AS (
  SELECT id FROM spots LIMIT 1
)
-- Set it has a schedule
UPDATE spots SET 
  has_availability_schedule = true,
  default_available = false
WHERE id = (SELECT id FROM sample_spot);

-- Add weekday availability (Monday-Friday, 9 AM - 5 PM)
WITH sample_spot AS (
  SELECT id FROM spots LIMIT 1
)
INSERT INTO availability_schedules (spot_id, day_of_week, start_time, end_time, is_available)
SELECT 
  (SELECT id FROM sample_spot),
  day_num,
  '09:00:00'::TIME,
  '17:00:00'::TIME,
  true
FROM generate_series(1, 5) AS day_num; -- 1=Monday through 5=Friday
*/

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================
/*
DROP TRIGGER IF EXISTS validate_booking_availability_trigger ON booking_requests;
DROP FUNCTION IF EXISTS validate_booking_availability();
DROP FUNCTION IF EXISTS get_available_slots(UUID, DATE);
DROP FUNCTION IF EXISTS check_spot_availability(UUID, DATE, DATE, TIME, TIME);
DROP TABLE IF EXISTS blocked_dates;
DROP TABLE IF EXISTS availability_schedules;
ALTER TABLE spots 
  DROP COLUMN IF EXISTS has_availability_schedule,
  DROP COLUMN IF EXISTS default_available;
*/
