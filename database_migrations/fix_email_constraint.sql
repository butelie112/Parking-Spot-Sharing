-- Fix email column constraint in profiles table
-- This makes the email column nullable since users might not have it initially

-- Option 1: Make email nullable (RECOMMENDED)
-- This allows profiles to exist without email temporarily
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- Option 2: If you want to keep NOT NULL but update existing records
-- Uncomment the following lines if you prefer this approach:
-- UPDATE profiles SET email = (
--   SELECT email FROM auth.users WHERE auth.users.id = profiles.id
-- ) WHERE email IS NULL;

-- Verify the change
DO $$
BEGIN
  RAISE NOTICE 'Email column constraint updated!';
  RAISE NOTICE 'Email is now nullable in profiles table';
END $$;

-- Check profiles table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

