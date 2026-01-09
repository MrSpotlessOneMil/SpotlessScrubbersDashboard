// Stripe Payment Integration
// https://stripe.com/docs/api

import Stripe from 'stripe';

// Initialize Stripe client
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
}

interface CreatePaymentLinkOptions {
  amount: number; // in cents
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

interface CreateCheckoutOptions {
  amount: number; // in cents
  description: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe payment link for a job
 */
export async function createPaymentLink(options: CreatePaymentLinkOptions): Promise<string> {
  const stripe = getStripeClient();

  // Create a price for this specific job
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: options.amount,
    product_data: {
      name: options.description,
    },
  });

  // Create the payment link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata: options.metadata || {},
    after_completion: {
      type: 'redirect',
      redirect: {
        url: options.successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://spotless-dashboard.vercel.app'}/payment-success`,
      },
    },
  });

  return paymentLink.url;
}

/**
 * Create a Stripe checkout session
 */
export async function createCheckoutSession(options: CreateCheckoutOptions): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: options.amount,
          product_data: {
            name: options.description,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: options.customerEmail,
    metadata: options.metadata || {},
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Retrieve a payment intent
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Retrieve a checkout session
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Create a Stripe customer
 */
export async function createCustomer(options: {
  email?: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripeClient();

  return stripe.customers.create({
    email: options.email,
    name: options.name,
    phone: options.phone,
    metadata: options.metadata || {},
  });
}

/**
 * Get or create a Stripe customer by phone number
 */
export async function getOrCreateCustomerByPhone(phone: string, name?: string, email?: string): Promise<Stripe.Customer> {
  const stripe = getStripeClient();

  // Search for existing customer by phone
  const existingCustomers = await stripe.customers.search({
    query: `phone:'${phone}'`,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return createCustomer({
    phone,
    name,
    email,
    metadata: { source: 'spotless_dashboard' },
  });
}

/**
 * Format amount from dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format amount from cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}
