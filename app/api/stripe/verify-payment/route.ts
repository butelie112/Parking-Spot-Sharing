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
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const userId = session.metadata?.userId;
      const totalAmount = parseFloat(session.metadata?.totalAmount || '0');
      const walletAmount = parseFloat(session.metadata?.walletAmount || '0');

      if (userId && totalAmount > 0 && walletAmount > 0) {
        // Check if this payment was already processed
        // We use the session ID as a unique identifier
        const { data: existingPayment, error: checkError } = await supabase
          .from('processed_payments')
          .select('session_id')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (existingPayment) {
          // Payment already processed, don't add balance again
          console.log(`Payment ${sessionId} already processed, skipping...`);
          return NextResponse.json({
            success: true,
            walletAmount,
            totalAmount,
            paymentStatus: session.payment_status,
            alreadyProcessed: true,
          });
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

        console.log(`Successfully processed payment - Added ${walletAmount} RON to wallet for user ${userId}`);

        return NextResponse.json({
          success: true,
          walletAmount,
          totalAmount,
          paymentStatus: session.payment_status,
          alreadyProcessed: false,
        });
      }
    }

    return NextResponse.json({
      success: false,
      paymentStatus: session.payment_status,
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

