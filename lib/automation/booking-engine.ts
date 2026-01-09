// Booking Engine - Quote Calculation, Invoice Generation, Job Scheduling
// Replaces: Booking Bot, Spotless Control Bot

import {
  getQuoteTemplate,
  getAllQuoteTemplates,
  createJob,
  updateJob,
  getCustomerByPhone,
  upsertCustomer,
  logAutomationEvent,
} from '../supabase';
import { createPaymentLink, dollarsToCents } from '../integrations/stripe';
import { sendSMS } from '../integrations/openphone';
import type { QuoteCalculation, BookingRequest } from '../types/webhooks';
import type { Customer, Job, QuoteTemplate } from '../types/database';

/**
 * Calculate quote based on customer info and cleaning type
 */
export async function calculateQuote(params: {
  cleaningType: string;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
}): Promise<QuoteCalculation> {
  const template = await getQuoteTemplate(params.cleaningType);

  if (!template) {
    // Fallback to standard pricing if no template found
    return calculateFallbackQuote(params);
  }

  const sqftCharge = (params.squareFootage || 0) * (template.price_per_sqft || 0);
  const bedroomCharge = (params.bedrooms || 0) * (template.price_per_bedroom || 0);
  const bathroomCharge = (params.bathrooms || 0) * (template.price_per_bathroom || 0);

  let totalPrice = template.base_price + sqftCharge + bedroomCharge + bathroomCharge;

  // Apply min/max constraints
  if (template.min_price && totalPrice < template.min_price) {
    totalPrice = template.min_price;
  }
  if (template.max_price && totalPrice > template.max_price) {
    totalPrice = template.max_price;
  }

  // Round to nearest $5
  totalPrice = Math.round(totalPrice / 5) * 5;

  const breakdown = [
    `Base: $${template.base_price.toFixed(2)}`,
    params.squareFootage ? `Sq ft (${params.squareFootage}): $${sqftCharge.toFixed(2)}` : null,
    params.bedrooms ? `Bedrooms (${params.bedrooms}): $${bedroomCharge.toFixed(2)}` : null,
    params.bathrooms ? `Bathrooms (${params.bathrooms}): $${bathroomCharge.toFixed(2)}` : null,
  ].filter(Boolean).join(' + ');

  return {
    cleaningType: params.cleaningType,
    basePrice: template.base_price,
    sqftCharge,
    bedroomCharge,
    bathroomCharge,
    totalPrice,
    estimatedHours: template.estimated_hours || 3,
    breakdown,
  };
}

function calculateFallbackQuote(params: {
  cleaningType: string;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
}): QuoteCalculation {
  // Default pricing
  const baseRates: Record<string, number> = {
    standard: 100,
    deep: 200,
    'move-in': 250,
    'move-out': 250,
    'post-construction': 350,
  };

  const basePrice = baseRates[params.cleaningType] || 150;
  const sqftCharge = (params.squareFootage || 0) * 0.05;
  const bedroomCharge = (params.bedrooms || 0) * 15;
  const bathroomCharge = (params.bathrooms || 0) * 20;

  const totalPrice = Math.round((basePrice + sqftCharge + bedroomCharge + bathroomCharge) / 5) * 5;

  return {
    cleaningType: params.cleaningType,
    basePrice,
    sqftCharge,
    bedroomCharge,
    bathroomCharge,
    totalPrice: Math.max(totalPrice, 100),
    estimatedHours: 3,
    breakdown: 'Standard pricing applied',
  };
}

/**
 * Create a new booking with payment link
 */
export async function createBooking(params: {
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  cleaningType: string;
  preferredDate: string;
  preferredTime: string;
  address?: string;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  specialInstructions?: string;
}): Promise<{
  job: Job;
  paymentLink: string;
  quote: QuoteCalculation;
}> {
  // Get or create customer
  let customer = await getCustomerByPhone(params.customerPhone);

  if (!customer) {
    customer = await upsertCustomer({
      phone_number: params.customerPhone,
      name: params.customerName,
      email: params.customerEmail,
      address: params.address,
      square_footage: params.squareFootage,
      bedrooms: params.bedrooms,
      bathrooms: params.bathrooms,
      source: 'booking_bot',
    });
  }

  // Calculate quote
  const quote = await calculateQuote({
    cleaningType: params.cleaningType,
    squareFootage: params.squareFootage || customer.square_footage || undefined,
    bedrooms: params.bedrooms || customer.bedrooms || undefined,
    bathrooms: params.bathrooms || customer.bathrooms || undefined,
  });

  // Create scheduled timestamp
  const scheduledAt = new Date(`${params.preferredDate}T${params.preferredTime}`);

  // Create job record
  const job = await createJob({
    customer_id: customer.id,
    title: `${params.cleaningType.charAt(0).toUpperCase() + params.cleaningType.slice(1)} Cleaning`,
    date: params.preferredDate,
    scheduled_at: scheduledAt.toISOString(),
    cleaning_type: params.cleaningType,
    status: 'quoted',
    quoted: true,
    quote_amount: quote.totalPrice,
    price: quote.totalPrice,
    hours: quote.estimatedHours,
    special_instructions: params.specialInstructions,
    notes: `Quote breakdown: ${quote.breakdown}`,
  });

  // Create Stripe payment link
  const paymentLink = await createPaymentLink({
    amount: dollarsToCents(quote.totalPrice),
    description: `Spotless Scrubbers - ${job.title} on ${params.preferredDate}`,
    customerEmail: params.customerEmail || customer.email || undefined,
    customerPhone: params.customerPhone,
    metadata: {
      job_id: job.id.toString(),
      customer_id: customer.id.toString(),
      cleaning_type: params.cleaningType,
    },
  });

  // Update job with payment link
  await updateJob(job.id, {
    stripe_payment_link: paymentLink,
  });

  // Log the event
  await logAutomationEvent({
    event_type: 'booking_created',
    source: 'booking_engine',
    customer_id: customer.id,
    job_id: job.id,
    payload: { params, quote },
    result: { paymentLink },
    success: true,
  });

  return {
    job: { ...job, stripe_payment_link: paymentLink },
    paymentLink,
    quote,
  };
}

/**
 * Send booking confirmation SMS with payment link
 */
export async function sendBookingConfirmation(params: {
  customerPhone: string;
  customerName: string;
  date: string;
  time: string;
  price: number;
  paymentLink: string;
}): Promise<void> {
  const formattedDate = new Date(`${params.date}T${params.time}`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(`${params.date}T${params.time}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const message = `Hi ${params.customerName}! Your cleaning is scheduled for ${formattedDate} at ${formattedTime}. Total: $${params.price.toFixed(2)}\n\nPay here to confirm: ${params.paymentLink}`;

  await sendSMS({
    to: params.customerPhone,
    body: message,
  });
}

/**
 * Get available time slots for a date
 */
export function getAvailableTimeSlots(date: string): string[] {
  // Default available slots (9 AM to 5 PM)
  const slots = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
  ];

  // In a real implementation, you would check against existing bookings
  // and cleaner availability

  return slots;
}

/**
 * Parse a natural language date/time into structured format
 */
export function parseScheduleRequest(text: string): {
  date?: string;
  time?: string;
  cleaningType?: string;
} {
  const result: { date?: string; time?: string; cleaningType?: string } = {};

  // Detect cleaning type
  const typePatterns: Record<string, RegExp> = {
    'deep': /deep\s*clean/i,
    'move-in': /move[\s-]?in/i,
    'move-out': /move[\s-]?out/i,
    'post-construction': /post[\s-]?construction|after\s*construction/i,
    'standard': /standard|regular|basic/i,
  };

  for (const [type, pattern] of Object.entries(typePatterns)) {
    if (pattern.test(text)) {
      result.cleaningType = type;
      break;
    }
  }

  // Detect relative dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (/tomorrow/i.test(text)) {
    result.date = tomorrow.toISOString().split('T')[0];
  } else if (/today/i.test(text)) {
    result.date = today.toISOString().split('T')[0];
  } else if (/next\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(text)) {
    const dayMatch = text.match(/next\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysUntil);
      result.date = targetDate.toISOString().split('T')[0];
    }
  }

  // Detect time
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] || '00';
    const period = timeMatch[3]?.toLowerCase();

    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;

    result.time = `${hour.toString().padStart(2, '0')}:${minute}`;
  }

  return result;
}

/**
 * Format quote as a readable message
 */
export function formatQuoteMessage(quote: QuoteCalculation, customerName: string): string {
  return `Hi ${customerName}! Here's your quote for ${quote.cleaningType} cleaning:

💰 Total: $${quote.totalPrice.toFixed(2)}
⏱ Estimated time: ${quote.estimatedHours} hours

${quote.breakdown}

Would you like to book this cleaning? Reply with your preferred date and time!`;
}

/**
 * Get all available cleaning types
 */
export async function getCleaningTypes(): Promise<QuoteTemplate[]> {
  return getAllQuoteTemplates();
}
