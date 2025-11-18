import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// IMPORTANT: We MUST use service role key for server-side operations
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY is not set! Payments will NOT be recorded!');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // For local testing without webhook, skip signature verification
    if (process.env.NODE_ENV === 'development' && !process.env.STRIPE_WEBHOOK_SECRET) {
      event = JSON.parse(body);
    } else {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    }
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const totalAmount = parseFloat(session.metadata?.totalAmount || '0');
    const walletAmount = parseFloat(session.metadata?.walletAmount || '0');
    const sessionId = session.id;

    if (userId && totalAmount > 0 && walletAmount > 0) {
      try {
        // Check if this payment was already processed
        const { data: existingPayment } = await supabase
          .from('processed_payments')
          .select('session_id')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (existingPayment) {
          console.log(`Webhook: Payment ${sessionId} already processed, skipping...`);
          return NextResponse.json({ received: true, alreadyProcessed: true });
        }

        // Add full amount to user's wallet (no platform fee on deposits)
        const { data, error } = await supabase.rpc('add_to_wallet', {
          p_user_id: userId,
          p_amount: walletAmount,
        });

        if (error) {
          console.error('Error updating wallet balance:', error);
          return NextResponse.json(
            { error: 'Failed to update wallet balance' },
            { status: 500 }
          );
        }

        // Get user profile information
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single();

        console.log('User profile fetched:', profile);

        // Record the transaction
        const paymentData = {
          session_id: sessionId,
          user_id: userId,
          amount: walletAmount, // Full amount added to wallet
          transaction_type: 'stripe_deposit',
          email: profile?.email || null,
          full_name: profile?.full_name || null,
        };

        console.log('Attempting to insert payment record:', paymentData);

        const { data: paymentRecord, error: insertError } = await supabase
          .from('processed_payments')
          .insert(paymentData)
          .select();

        if (insertError) {
          console.error('❌ ERROR inserting payment record:', insertError);
          console.error('Full error details:', JSON.stringify(insertError, null, 2));
        } else {
          console.log('✅ Payment record inserted successfully:', paymentRecord);
        }

        console.log(`Webhook: Successfully processed payment - Added ${walletAmount} RON to wallet for user ${userId}`);
      } catch (error) {
        console.error('Error processing payment:', error);
        return NextResponse.json(
          { error: 'Failed to process payment' },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}

