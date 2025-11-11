-- Create table to track processed Stripe payments
-- This prevents double-processing of payments

CREATE TABLE IF NOT EXISTS processed_payments (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_processed_payments_session_id ON processed_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_processed_payments_user_id ON processed_payments(user_id);

-- Enable RLS
ALTER TABLE processed_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own processed payments
CREATE POLICY "Users can view own processed payments"
  ON processed_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON processed_payments TO authenticated;
GRANT INSERT ON processed_payments TO service_role;

-- Add comment
COMMENT ON TABLE processed_payments IS 'Tracks processed Stripe payments to prevent double-processing';
COMMENT ON COLUMN processed_payments.session_id IS 'Stripe checkout session ID (unique)';
COMMENT ON COLUMN processed_payments.amount IS 'Amount added to wallet in RON';

