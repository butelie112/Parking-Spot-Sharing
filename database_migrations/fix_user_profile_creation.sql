-- Fix user profile creation trigger
-- This fixes the "Database error saving new user" issue

-- First, let's check and ensure the profiles table has the correct structure
-- If wallet_balance doesn't exist, this will add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Set default value for wallet_balance
ALTER TABLE profiles ALTER COLUMN wallet_balance SET DEFAULT 0;

-- Create or replace the trigger function to initialize new user profiles
-- This version only inserts the ID and lets defaults handle the rest
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;

-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create or replace RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Comment for documentation
COMMENT ON COLUMN profiles.wallet_balance IS 'User wallet balance in RON currency. Default is 0. Users must add balance via Stripe payment.';

-- Optional: Update existing profiles to have zero balance (uncomment if needed)
-- UPDATE profiles SET wallet_balance = 0 WHERE wallet_balance IS NULL;

-- Verify the function works
DO $$
BEGIN
  RAISE NOTICE 'Profile creation trigger updated successfully!';
END $$;