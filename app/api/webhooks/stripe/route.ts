// Stripe Webhook - Process payment events
// Replaces: Payment Confirmed Text, Second Payment

import { NextRequest, NextResponse } from 'next/server';
import {
  updateJob,
  getJobById,
  getCustomerByPhone,
  logAutomationEvent,
  createMessage,
  getActiveCleaners,
  createCleanerAssignment,
} from '@/lib/supabase';
import { verifyWebhookSignature, centsToDollars } from '@/lib/integrations/stripe';
import { sendSMS, normalizePhoneNumber } from '@/lib/integrations/openphone';
import { notifyCleanerOfJob } from '@/lib/integrations/telegram';
import type { StripeCheckoutCompletedPayload, StripePaymentIntentPayload } from '@/lib/types/webhooks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`💳 Stripe webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event as unknown as StripeCheckoutCompletedPayload);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event as unknown as StripePaymentIntentPayload);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event as unknown as StripePaymentIntentPayload);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);

    await logAutomationEvent({
      event_type: 'stripe_webhook',
      source: 'stripe',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(event: StripeCheckoutCompletedPayload) {
  const session = event.data.object;

  // Get job ID from metadata
  const jobId = session.metadata?.job_id;
  if (!jobId) {
    console.log('No job_id in checkout session metadata');
    return;
  }

  const job = await getJobById(parseInt(jobId, 10));
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    return;
  }

  // Update job as paid
  await updateJob(job.id, {
    paid: true,
    booked: true,
    status: 'confirmed',
    stripe_payment_id: session.payment_intent as string,
  });

  // Get customer info
  const customer = job.customers as { phone_number: string; name: string; email?: string } | undefined;
  if (!customer) {
    console.error('No customer found for job');
    return;
  }

  const amount = centsToDollars(session.amount_total || 0);

  // Send confirmation SMS to customer
  const formattedDate = job.scheduled_at
    ? new Date(job.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : job.date;

  const formattedTime = job.scheduled_at
    ? new Date(job.scheduled_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'morning';

  try {
    await sendSMS({
      to: customer.phone_number,
      body: `🎉 Payment received! Thank you ${customer.name}! Your ${job.cleaning_type || 'cleaning'} is confirmed for ${formattedDate} at ${formattedTime}. We'll send cleaner details soon!`,
    });

    // Store message
    const customerRecord = await getCustomerByPhone(customer.phone_number);
    if (customerRecord) {
      await createMessage({
        customer_id: customerRecord.id,
        role: 'bot',
        content: `Payment confirmation sent - $${amount.toFixed(2)} received`,
        timestamp: new Date().toISOString(),
        direction: 'outbound',
      });
    }
  } catch (smsError) {
    console.error('Failed to send payment confirmation SMS:', smsError);
  }

  // Dispatch to cleaners
  await dispatchJobToCleaners(job);

  // Log event
  await logAutomationEvent({
    event_type: 'payment_received',
    source: 'stripe',
    customer_id: (job.customers as { id?: number } | undefined)?.id,
    job_id: job.id,
    payload: {
      sessionId: session.id,
      amount: session.amount_total,
      paymentIntent: session.payment_intent,
    },
    result: {
      jobStatus: 'confirmed',
      smsSent: true,
    },
    success: true,
  });
}

async function handlePaymentSucceeded(event: StripePaymentIntentPayload) {
  const paymentIntent = event.data.object;

  // Check if this is associated with a job
  const jobId = paymentIntent.metadata?.job_id;
  if (!jobId) {
    console.log('No job_id in payment intent metadata');
    return;
  }

  const job = await getJobById(parseInt(jobId, 10));
  if (!job || job.paid) {
    // Already processed or doesn't exist
    return;
  }

  // This is a fallback if checkout.session.completed wasn't received
  await updateJob(job.id, {
    paid: true,
    booked: true,
    status: 'confirmed',
    stripe_payment_id: paymentIntent.id,
  });

  await logAutomationEvent({
    event_type: 'payment_intent_succeeded',
    source: 'stripe',
    job_id: job.id,
    payload: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    },
    success: true,
  });
}

async function handlePaymentFailed(event: StripePaymentIntentPayload) {
  const paymentIntent = event.data.object;

  const jobId = paymentIntent.metadata?.job_id;
  if (!jobId) return;

  const job = await getJobById(parseInt(jobId, 10));
  if (!job) return;

  // Notify customer of failed payment
  const customer = job.customers as { phone_number: string; name: string } | undefined;
  if (customer) {
    try {
      await sendSMS({
        to: customer.phone_number,
        body: `Hi ${customer.name}, your payment couldn't be processed. Please try again or contact us for help. We're holding your appointment!`,
      });
    } catch (smsError) {
      console.error('Failed to send payment failed SMS:', smsError);
    }
  }

  await logAutomationEvent({
    event_type: 'payment_failed',
    source: 'stripe',
    job_id: job.id,
    payload: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    },
    success: false,
    error_message: 'Payment failed',
  });
}

async function dispatchJobToCleaners(job: {
  id: number;
  title: string;
  date: string;
  scheduled_at: string | null;
  cleaning_type: string | null;
  price: number | null;
  hours: number | null;
  special_instructions: string | null;
  customers?: { name: string; phone_number: string; address?: string | null } | null;
}) {
  try {
    // Get available cleaners
    const cleaners = await getActiveCleaners();

    if (cleaners.length === 0) {
      console.log('No cleaners available to dispatch');
      return;
    }

    const customer = job.customers;
    const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at) : new Date(job.date);

    const jobDetails = {
      id: job.id,
      title: job.title,
      date: scheduledAt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      time: scheduledAt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      address: customer?.address || 'Address TBD',
      customerName: customer?.name || 'Customer',
      price: job.price || 0,
      estimatedHours: job.hours || 3,
      cleaningType: job.cleaning_type || 'Standard',
      specialInstructions: job.special_instructions || undefined,
    };

    // Notify first available cleaner via Telegram
    for (const cleaner of cleaners) {
      if (cleaner.telegram_id) {
        try {
          await notifyCleanerOfJob(cleaner.telegram_id, jobDetails);

          // Create assignment record
          await createCleanerAssignment({
            cleaner_id: cleaner.id,
            job_id: job.id,
            status: 'pending',
            notified_at: new Date().toISOString(),
          });

          console.log(`📤 Job ${job.id} dispatched to cleaner ${cleaner.name}`);

          // For now, just notify the first cleaner
          // In production, you might want to notify multiple or use a rotation system
          break;
        } catch (telegramError) {
          console.error(`Failed to notify cleaner ${cleaner.name}:`, telegramError);
        }
      }
    }
  } catch (error) {
    console.error('Failed to dispatch job to cleaners:', error);
  }
}

// Verify webhook endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'stripe-webhook' });
}
