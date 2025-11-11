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
    const amount = parseFloat(session.metadata?.amount || '0');
    const sessionId = session.id;

    if (userId && amount > 0) {
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

        // Add balance to user's wallet using the database function
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

        console.log(`Webhook: Successfully added ${amount} RON to user ${userId}'s wallet`);
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

