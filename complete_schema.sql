


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_to_wallet"("p_user_id" "uuid", "p_amount" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Add amount
  UPDATE profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."add_to_wallet"("p_user_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_spot_availability"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
    -- Check that the requested time is FULLY WITHIN the available time window
    IF NOT EXISTS (
      SELECT 1 FROM availability_schedules
      WHERE spot_id = p_spot_id
      AND day_of_week = v_day_of_week
      AND is_available = true
      AND start_time <= p_start_time  -- Available window starts before or at requested start
      AND end_time >= p_end_time       -- Available window ends after or at requested end
    ) THEN
      -- No available schedule found for this day/time
      RETURN false;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN true; -- All days in range are available
END;
$$;


ALTER FUNCTION "public"."check_spot_availability"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_bookings"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Mark bookings as completed if end time has passed
  UPDATE booking_requests
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'accepted'
    AND (
      -- End date has passed
      end_date < CURRENT_DATE
      OR
      -- Same day and end time has passed
      (end_date = CURRENT_DATE AND end_time < CURRENT_TIME)
    );

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_from_wallet"("p_user_id" "uuid", "p_amount" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_balance DECIMAL(10,2);
BEGIN
  -- Get current balance
  SELECT wallet_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Check if user exists
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Check if sufficient balance
  IF current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct amount
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."deduct_from_wallet"("p_user_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_slots"("p_spot_id" "uuid", "p_date" "date") RETURNS TABLE("start_time" time without time zone, "end_time" time without time zone)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_available_slots"("p_spot_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert minimal profile with just the ID
  -- Other columns will use their default values
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth signup
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_spot_available_for_time"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if there are any overlapping accepted bookings for this spot
  RETURN NOT EXISTS (
    SELECT 1 FROM booking_requests
    WHERE spot_id = p_spot_id
      AND status = 'accepted'
      AND (
        -- Case 1: Same-day booking - check time overlap
        (start_date = p_start_date AND end_date = p_end_date AND
         ((start_time <= p_start_time AND end_time > p_start_time) OR
          (start_time < p_end_time AND end_time >= p_end_time) OR
          (start_time >= p_start_time AND end_time <= p_end_time)))

        OR

        -- Case 2: Multi-day existing booking overlaps with single-day request
        (start_date < end_date AND p_start_date = p_end_date AND
         start_date <= p_start_date AND end_date >= p_start_date)

        OR

        -- Case 3: Single-day existing booking overlaps with multi-day request
        (start_date = end_date AND p_start_date < p_end_date AND
         start_date >= p_start_date AND start_date <= p_end_date)

        OR

        -- Case 4: Multi-day bookings overlap
        (start_date < end_date AND p_start_date < p_end_date AND
         ((start_date <= p_start_date AND end_date >= p_end_date) OR
          (start_date <= p_end_date AND end_date >= p_start_date) OR
          (start_date <= p_start_date AND end_date > p_start_date) OR
          (start_date < p_end_date AND end_date >= p_end_date)))
      )
  );
END;
$$;


ALTER FUNCTION "public"."is_spot_available_for_time"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_booking_payment"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_from_balance DECIMAL(10,2);
  v_to_balance DECIMAL(10,2);
BEGIN
  -- Input validation
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Invalid payment parameters');
  END IF;

  -- Check if sender and receiver are different users
  IF p_from_user_id = p_to_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Cannot transfer money to yourself');
  END IF;

  -- Check sender's current balance
  SELECT wallet_balance INTO v_from_balance
  FROM profiles
  WHERE id = p_from_user_id;

  IF v_from_balance IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Sender account not found');
  END IF;

  -- Check if sender has sufficient balance
  IF v_from_balance < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient wallet balance');
  END IF;

  -- Check if receiver account exists
  SELECT wallet_balance INTO v_to_balance
  FROM profiles
  WHERE id = p_to_user_id;

  IF v_to_balance IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Receiver account not found');
  END IF;

  -- Perform the payment transaction
  BEGIN
    -- Deduct from sender
    UPDATE profiles
    SET wallet_balance = wallet_balance - p_amount,
        updated_at = NOW()
    WHERE id = p_from_user_id;

    -- Add to receiver
    UPDATE profiles
    SET wallet_balance = wallet_balance + p_amount,
        updated_at = NOW()
    WHERE id = p_to_user_id;

    -- Return success with balance details
    RETURN json_build_object(
      'success', true,
      'message', 'Payment processed successfully',
      'amount', p_amount,
      'from_user_id', p_from_user_id,
      'to_user_id', p_to_user_id,
      'from_balance_after', v_from_balance - p_amount,
      'to_balance_after', v_to_balance + p_amount
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- If anything goes wrong, return error
      RETURN json_build_object(
        'success', false,
        'message', 'Payment processing failed: ' || SQLERRM
      );
  END;

END;
$$;


ALTER FUNCTION "public"."process_booking_payment"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_booking_statuses_full_cycle"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
    current_time_utc := NOW() AT TIME ZONE 'UTC';
    RAISE WARNING '🔄 STARTING MAINTENANCE: Current UTC time: %', current_time_utc;

    SELECT COUNT(*) INTO total_bookings_found FROM booking_requests WHERE status = 'accepted';
    RAISE WARNING '📊 Found % total accepted bookings', total_bookings_found;

    FOR booking_record IN
        SELECT br.*, sp.status as spot_status
        FROM booking_requests br
        JOIN spots sp ON br.spot_id = sp.id
        WHERE br.status = 'accepted'
        AND sp.status = 'available'
    LOOP
        total_bookings_found := total_bookings_found + 1;
        user_tz := COALESCE(booking_record.user_timezone, 'UTC');
        
        RAISE WARNING '🎯 Processing accepted booking %s: date=%s, time=%s, timezone=%s',
                    booking_record.id, booking_record.start_date, booking_record.start_time, user_tz;

        BEGIN
            booking_start_time := ((booking_record.start_date || ' ' || booking_record.start_time)::timestamp AT TIME ZONE user_tz);
            
            RAISE WARNING 'Booking %s: start_time=%s (UTC), current_time=%s (UTC), comparison: %s',
                         booking_record.id, booking_start_time, current_time_utc,
                         CASE WHEN current_time_utc >= booking_start_time THEN 'TRUE (mark as reserved)' ELSE 'FALSE (keep available)' END;

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

    FOR booking_record IN
        SELECT br.*, sp.status as spot_status
        FROM booking_requests br
        JOIN spots sp ON br.spot_id = sp.id
        WHERE br.status = 'accepted'
        AND sp.status IN ('reserved', 'occupied')
    LOOP
        user_tz := COALESCE(booking_record.user_timezone, 'UTC');
        
        RAISE WARNING 'Processing booking %s (completion): end_date=%s, end_time=%s, timezone=%s',
                    booking_record.id, booking_record.end_date, booking_record.end_time, user_tz;

        BEGIN
            booking_end_time := ((booking_record.end_date || ' ' || booking_record.end_time)::timestamp AT TIME ZONE user_tz);
            
            RAISE WARNING 'Booking %s (completion check): end_time=%s (UTC), current_time=%s (UTC), comparison: %s',
                         booking_record.id, booking_end_time, current_time_utc,
                         CASE WHEN current_time_utc > booking_end_time THEN 'TRUE (mark as available)' ELSE 'FALSE (keep reserved/occupied)' END;

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
$$;


ALTER FUNCTION "public"."update_booking_statuses_full_cycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_spot_owner_info"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update spots when profile is updated
  IF TG_OP = 'UPDATE' THEN
    UPDATE spots SET
      owner_name = NEW.full_name,
      owner_email = NEW.email
    WHERE owner_id = NEW.id;
  END IF;

  -- Update spots when profile is inserted
  IF TG_OP = 'INSERT' THEN
    UPDATE spots SET
      owner_name = NEW.full_name,
      owner_email = NEW.email
    WHERE owner_id = NEW.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_spot_owner_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_spot_statuses_for_current_time"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_time TIMESTAMP WITH TIME ZONE := NOW();
  total_updated INTEGER := 0;
BEGIN
  -- Handle same-day bookings (where start_date = end_date)
  UPDATE public.spots
  SET status = 'available',
      updated_at = current_time
  WHERE status IN ('reserved', 'occupied')
    AND id IN (
      SELECT DISTINCT br.spot_id
      FROM public.booking_requests br
      WHERE br.spot_id = spots.id
        AND br.status = 'accepted'
        AND br.start_date = br.end_date
        AND (
          br.start_date::date < current_time::date
          OR (br.start_date::date = current_time::date
              AND br.end_time <= current_time::time)
        )
    );

  total_updated := total_updated + FOUND;

  -- Handle multi-day bookings (where start_date < end_date)
  UPDATE public.spots
  SET status = 'available',
      updated_at = current_time
  WHERE status IN ('reserved', 'occupied')
    AND id IN (
      SELECT DISTINCT br.spot_id
      FROM public.booking_requests br
      WHERE br.spot_id = spots.id
        AND br.status = 'accepted'
        AND br.start_date < br.end_date
        AND br.end_date::date < current_time::date
    );

  total_updated := total_updated + FOUND;

  -- Mark expired bookings as completed
  UPDATE public.booking_requests
  SET status = 'completed',
      updated_at = current_time,
      completed_at = current_time
  WHERE status = 'accepted'
    AND (
      (start_date = end_date
       AND (start_date::date < current_time::date
            OR (start_date::date = current_time::date
                AND end_time <= current_time::time)))
      OR (start_date < end_date
          AND end_date::date < current_time::date)
    );

  RETURN total_updated;
END;
$$;


ALTER FUNCTION "public"."update_spot_statuses_for_current_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_spots_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_spots_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_booking_availability"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."availability_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "availability_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "valid_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."availability_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "blocked_date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocked_dates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "booking_type" character varying(20) DEFAULT 'hourly'::character varying,
    "accepted_at" timestamp with time zone,
    "payment_amount" numeric(10,2),
    "payment_processed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "user_timezone" "text",
    CONSTRAINT "booking_requests_booking_type_check" CHECK ((("booking_type")::"text" = ANY ((ARRAY['hourly'::character varying, 'daily'::character varying])::"text"[]))),
    CONSTRAINT "booking_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'completed'::character varying])::"text"[]))),
    CONSTRAINT "prevent_self_booking" CHECK (("requester_id" <> "owner_id"))
);


ALTER TABLE "public"."booking_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processed_payments" (
    "id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."processed_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."processed_payments" IS 'Tracks processed Stripe payments to prevent double-processing';



COMMENT ON COLUMN "public"."processed_payments"."session_id" IS 'Stripe checkout session ID (unique)';



COMMENT ON COLUMN "public"."processed_payments"."amount" IS 'Amount added to wallet in RON';



CREATE SEQUENCE IF NOT EXISTS "public"."processed_payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."processed_payments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."processed_payments_id_seq" OWNED BY "public"."processed_payments"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "wallet_balance" numeric(10,2) DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."wallet_balance" IS 'User wallet balance in RON currency. Default is 0. Users must add balance via Stripe payment.';



CREATE TABLE IF NOT EXISTS "public"."spots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "map_x" double precision,
    "map_y" double precision,
    "owner_name" "text",
    "owner_email" "text",
    "latitude" double precision,
    "longitude" double precision,
    "price" numeric(10,2),
    "has_availability_schedule" boolean DEFAULT false,
    "default_available" boolean DEFAULT true
);


ALTER TABLE "public"."spots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."spots"."map_x" IS 'X coordinate on map (0-100%)';



COMMENT ON COLUMN "public"."spots"."map_y" IS 'Y coordinate on map (0-100%)';



COMMENT ON COLUMN "public"."spots"."price" IS 'Hourly price for parking spot in USD (e.g., 2.00 for $2/hour)';



ALTER TABLE ONLY "public"."processed_payments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."processed_payments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."availability_schedules"
    DROP CONSTRAINT IF EXISTS "availability_schedules_pkey";

ALTER TABLE ONLY "public"."availability_schedules"
    ADD CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_schedules"
    DROP CONSTRAINT IF EXISTS "availability_schedules_spot_id_day_of_week_start_time_end_t_key";

ALTER TABLE ONLY "public"."availability_schedules"
    ADD CONSTRAINT "availability_schedules_spot_id_day_of_week_start_time_end_t_key" UNIQUE ("spot_id", "day_of_week", "start_time", "end_time");



ALTER TABLE ONLY "public"."blocked_dates"
    DROP CONSTRAINT IF EXISTS "blocked_dates_pkey";

ALTER TABLE ONLY "public"."blocked_dates"
    ADD CONSTRAINT "blocked_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_dates"
    DROP CONSTRAINT IF EXISTS "blocked_dates_spot_id_blocked_date_key";

ALTER TABLE ONLY "public"."blocked_dates"
    ADD CONSTRAINT "blocked_dates_spot_id_blocked_date_key" UNIQUE ("spot_id", "blocked_date");



ALTER TABLE ONLY "public"."booking_requests"
    DROP CONSTRAINT IF EXISTS "booking_requests_pkey";

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_payments"
    DROP CONSTRAINT IF EXISTS "processed_payments_pkey";

ALTER TABLE ONLY "public"."processed_payments"
    ADD CONSTRAINT "processed_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_payments"
    DROP CONSTRAINT IF EXISTS "processed_payments_session_id_key";

ALTER TABLE ONLY "public"."processed_payments"
    ADD CONSTRAINT "processed_payments_session_id_key" UNIQUE ("session_id");



-- Add primary keys only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_pkey'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE ONLY "public"."profiles"
            ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'spots_pkey'
        AND conrelid = 'public.spots'::regclass
    ) THEN
        ALTER TABLE ONLY "public"."spots"
            ADD CONSTRAINT "spots_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_availability_schedules_day_of_week" ON "public"."availability_schedules" USING "btree" ("day_of_week");



CREATE INDEX IF NOT EXISTS "idx_availability_schedules_spot_id" ON "public"."availability_schedules" USING "btree" ("spot_id");



CREATE INDEX IF NOT EXISTS "idx_blocked_dates_date" ON "public"."blocked_dates" USING "btree" ("blocked_date");



CREATE INDEX IF NOT EXISTS "idx_blocked_dates_spot_id" ON "public"."blocked_dates" USING "btree" ("spot_id");



CREATE INDEX IF NOT EXISTS "idx_booking_requests_dates" ON "public"."booking_requests" USING "btree" ("start_date", "end_date");



CREATE INDEX IF NOT EXISTS "idx_booking_requests_owner_id" ON "public"."booking_requests" USING "btree" ("owner_id");



CREATE INDEX IF NOT EXISTS "idx_booking_requests_requester_id" ON "public"."booking_requests" USING "btree" ("requester_id");



CREATE INDEX IF NOT EXISTS "idx_booking_requests_spot_id" ON "public"."booking_requests" USING "btree" ("spot_id");



CREATE INDEX IF NOT EXISTS "idx_booking_requests_status" ON "public"."booking_requests" USING "btree" ("status");



CREATE INDEX IF NOT EXISTS "idx_booking_requests_times" ON "public"."booking_requests" USING "btree" ("start_time", "end_time");



CREATE INDEX IF NOT EXISTS "idx_processed_payments_session_id" ON "public"."processed_payments" USING "btree" ("session_id");



CREATE INDEX IF NOT EXISTS "idx_processed_payments_user_id" ON "public"."processed_payments" USING "btree" ("user_id");



CREATE INDEX IF NOT EXISTS "idx_spots_owner" ON "public"."spots" USING "btree" ("owner_id");



CREATE INDEX IF NOT EXISTS "idx_spots_status" ON "public"."spots" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "update_booking_requests_updated_at" BEFORE UPDATE ON "public"."booking_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_spot_owner_on_profile_change" AFTER INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_spot_owner_info"();



CREATE OR REPLACE TRIGGER "update_spots_updated_at_trigger" BEFORE UPDATE ON "public"."spots" FOR EACH ROW EXECUTE FUNCTION "public"."update_spots_updated_at"();



CREATE OR REPLACE TRIGGER "validate_booking_availability_trigger" BEFORE INSERT OR UPDATE ON "public"."booking_requests" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_availability"();



ALTER TABLE ONLY "public"."availability_schedules"
    DROP CONSTRAINT IF EXISTS "availability_schedules_spot_id_fkey";

ALTER TABLE ONLY "public"."availability_schedules"
    ADD CONSTRAINT "availability_schedules_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_dates"
    DROP CONSTRAINT IF EXISTS "blocked_dates_spot_id_fkey";

ALTER TABLE ONLY "public"."blocked_dates"
    ADD CONSTRAINT "blocked_dates_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_requests"
    DROP CONSTRAINT IF EXISTS "booking_requests_owner_id_fkey";

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_requests"
    DROP CONSTRAINT IF EXISTS "booking_requests_requester_id_fkey";

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_requests"
    DROP CONSTRAINT IF EXISTS "booking_requests_spot_id_fkey";

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."processed_payments"
    DROP CONSTRAINT IF EXISTS "processed_payments_user_id_fkey";

ALTER TABLE ONLY "public"."processed_payments"
    ADD CONSTRAINT "processed_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    DROP CONSTRAINT IF EXISTS "profiles_id_fkey";

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spots"
    DROP CONSTRAINT IF EXISTS "spots_owner_id_fkey";

ALTER TABLE ONLY "public"."spots"
    ADD CONSTRAINT "spots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



DROP POLICY IF EXISTS "Anyone can view spots" ON "public"."spots";
CREATE POLICY "Anyone can view spots" ON "public"."spots" FOR SELECT TO "authenticated" USING (true);



DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."profiles";
CREATE POLICY "Enable insert for authenticated users only" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



DROP POLICY IF EXISTS "Owners can update booking requests" ON "public"."booking_requests";
CREATE POLICY "Owners can update booking requests" ON "public"."booking_requests" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



DROP POLICY IF EXISTS "Users can create booking requests" ON "public"."booking_requests";
CREATE POLICY "Users can create booking requests" ON "public"."booking_requests" FOR INSERT WITH CHECK ((("auth"."uid"() = "requester_id") AND ("requester_id" <> "owner_id")));



DROP POLICY IF EXISTS "Users can create their own spots" ON "public"."spots";
CREATE POLICY "Users can create their own spots" ON "public"."spots" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



DROP POLICY IF EXISTS "Users can delete their own spots" ON "public"."spots";
CREATE POLICY "Users can delete their own spots" ON "public"."spots" FOR DELETE USING (("auth"."uid"() = "owner_id"));



DROP POLICY IF EXISTS "Users can insert own profile" ON "public"."profiles";
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."profiles";
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



DROP POLICY IF EXISTS "Users can update their own spots" ON "public"."spots";
CREATE POLICY "Users can update their own spots" ON "public"."spots" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



DROP POLICY IF EXISTS "Users can view own processed payments" ON "public"."processed_payments";
CREATE POLICY "Users can view own processed payments" ON "public"."processed_payments" FOR SELECT USING (("auth"."uid"() = "user_id"));



DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



DROP POLICY IF EXISTS "Users can view profiles for booking requests" ON "public"."profiles";
CREATE POLICY "Users can view profiles for booking requests" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("id" IN ( SELECT "booking_requests"."requester_id"
   FROM "public"."booking_requests"
  WHERE ("booking_requests"."owner_id" = "auth"."uid"()))) OR ("id" IN ( SELECT "booking_requests"."owner_id"
   FROM "public"."booking_requests"
  WHERE ("booking_requests"."requester_id" = "auth"."uid"())))));



DROP POLICY IF EXISTS "Users can view their own profile" ON "public"."profiles";
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



DROP POLICY IF EXISTS "Users can view their own requests" ON "public"."booking_requests";
CREATE POLICY "Users can view their own requests" ON "public"."booking_requests" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "owner_id")));



ALTER TABLE "public"."booking_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spots" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_to_wallet"("p_user_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."add_to_wallet"("p_user_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_to_wallet"("p_user_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_spot_availability"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."check_spot_availability"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_spot_availability"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_from_wallet"("p_user_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_from_wallet"("p_user_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_from_wallet"("p_user_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_slots"("p_spot_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_spot_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_spot_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_spot_available_for_time"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_spot_available_for_time"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_spot_available_for_time"("p_spot_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_booking_payment"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."process_booking_payment"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_booking_payment"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_statuses_full_cycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_statuses_full_cycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_statuses_full_cycle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_spot_owner_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_spot_owner_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_spot_owner_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_spot_statuses_for_current_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_spot_statuses_for_current_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_spot_statuses_for_current_time"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_spots_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_spots_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_spots_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_availability"() TO "service_role";



GRANT ALL ON TABLE "public"."availability_schedules" TO "anon";
GRANT ALL ON TABLE "public"."availability_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_dates" TO "anon";
GRANT ALL ON TABLE "public"."blocked_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_dates" TO "service_role";



GRANT ALL ON TABLE "public"."booking_requests" TO "anon";
GRANT ALL ON TABLE "public"."booking_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_requests" TO "service_role";



GRANT ALL ON TABLE "public"."processed_payments" TO "anon";
GRANT ALL ON TABLE "public"."processed_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."processed_payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."processed_payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."processed_payments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."spots" TO "anon";
GRANT ALL ON TABLE "public"."spots" TO "authenticated";
GRANT ALL ON TABLE "public"."spots" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







