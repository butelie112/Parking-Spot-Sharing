import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
      const amount = parseFloat(session.metadata?.amount || '0');

      if (userId && amount > 0) {
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
            amount,
            paymentStatus: session.payment_status,
            alreadyProcessed: true,
          });
        }

        // Add balance to user's wallet
        const { data, error } = await supabase.rpc('add_to_wallet', {
          p_user_id: userId,
          p_amount: amount,
        });

        if (error) {
          console.error('Error updating wallet balance:', error);
          return NextResponse.json(
            { error: 'Failed to update wallet balance' },
            { status: 500 }
          );
        }

        // Mark this payment as processed
        await supabase
          .from('processed_payments')
          .insert({
            session_id: sessionId,
            user_id: userId,
            amount: amount,
            processed_at: new Date().toISOString(),
          });

        console.log(`Successfully added ${amount} RON to user ${userId}'s wallet`);

        return NextResponse.json({
          success: true,
          amount,
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

