// Vapi Webhook - Process incoming call data
// Replaces: Vapi Call to Lindy Bot

import { NextRequest, NextResponse } from 'next/server';
import {
  upsertCustomer,
  createCall,
  getCustomerByPhone,
  logAutomationEvent,
} from '@/lib/supabase';
import { extractDataFromTranscript } from '@/lib/integrations/ai';
import { sendSMS, normalizePhoneNumber } from '@/lib/integrations/openphone';
import { calculateQuote, createBooking, formatQuoteMessage } from '@/lib/automation/booking-engine';
import type { Json } from '@/lib/types/database';
import type { VapiCallEndedPayload, VapiExtractedData } from '@/lib/types/webhooks';

export async function POST(request: NextRequest) {
  try {
    const payload: VapiCallEndedPayload = await request.json();

    // Only process end-of-call reports
    if (payload.message?.type !== 'end-of-call-report') {
      return NextResponse.json({ status: 'ignored', reason: 'Not an end-of-call report' });
    }

    const call = payload.message.call;
    const customerPhone = normalizePhoneNumber(call.customer.number);

    console.log(`📞 Processing Vapi call from ${customerPhone}`);

    // Extract data from transcript using AI
    const extractedData = await extractDataFromTranscript({
      transcript: payload.message.transcript || '',
      schema: {
        customerName: 'Full name of the caller',
        address: 'Street address mentioned',
        zipCode: 'ZIP code or postal code',
        squareFootage: 'Square footage of the home (number only)',
        bedrooms: 'Number of bedrooms (number only)',
        bathrooms: 'Number of bathrooms (number only)',
        pets: 'Any pets mentioned (type and number)',
        cleaningType: 'Type of cleaning requested (standard, deep, move-in, move-out, post-construction)',
        preferredDate: 'Preferred date mentioned (YYYY-MM-DD format if possible)',
        preferredTime: 'Preferred time mentioned (HH:MM format if possible)',
        urgency: 'How urgent (asap, flexible, specific date)',
        specialRequests: 'Any special requests or notes',
        bookingIntent: 'Does the caller want to book a cleaning? (true/false)',
      },
    }) as VapiExtractedData;

    console.log('🔍 Extracted data:', extractedData);

    // Get or create customer
    let customer = await getCustomerByPhone(customerPhone);

    const customerData = {
      phone_number: customerPhone,
      name: extractedData.customerName || call.customer.name || 'Unknown Caller',
      address: extractedData.address || undefined,
      zip_code: extractedData.zipCode || undefined,
      square_footage: extractedData.squareFootage || undefined,
      bedrooms: extractedData.bedrooms || undefined,
      bathrooms: extractedData.bathrooms || undefined,
      pets: extractedData.pets || undefined,
      source: 'vapi_call',
    };

    if (customer) {
      // Update with new info if provided
      customer = await upsertCustomer({
        ...customerData,
        name: customer.name || customerData.name,
        address: extractedData.address || customer.address || undefined,
        zip_code: extractedData.zipCode || customer.zip_code || undefined,
        square_footage: extractedData.squareFootage || customer.square_footage || undefined,
        bedrooms: extractedData.bedrooms || customer.bedrooms || undefined,
        bathrooms: extractedData.bathrooms || customer.bathrooms || undefined,
      });
    } else {
      customer = await upsertCustomer(customerData);
    }

    // Determine call outcome
    let outcome = 'follow_up';
    if (extractedData.bookingIntent === true) {
      outcome = 'booked';
    } else if (!payload.message.transcript || payload.message.transcript.length < 100) {
      outcome = 'voicemail';
    }

    // Create call record
    const callRecord = await createCall({
      customer_id: customer.id,
      vapi_call_id: call.id,
      date: call.startedAt,
      duration_seconds: Math.round(
        (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
      ),
      transcript: payload.message.transcript,
      summary: payload.message.analysis?.summary || payload.message.summary,
      audio_url: payload.message.recordingUrl || payload.message.stereoRecordingUrl,
      outcome,
      sentiment: 'neutral',
      booking_intent: extractedData.bookingIntent === true,
      extracted_data: extractedData as Json,
    });

    // Log automation event
    await logAutomationEvent({
      event_type: 'vapi_call',
      source: 'vapi',
      customer_id: customer.id,
      payload: {
        callId: call.id,
        duration: callRecord.duration_seconds,
        outcome,
      },
      result: { extractedData } as unknown as Json,
      success: true,
    });

    // Handle booking intent
    if (extractedData.bookingIntent && extractedData.cleaningType) {
      try {
        // If we have enough info, create a booking
        if (extractedData.preferredDate) {
          const booking = await createBooking({
            customerPhone,
            customerName: customer.name,
            customerEmail: customer.email || undefined,
            cleaningType: extractedData.cleaningType,
            preferredDate: extractedData.preferredDate,
            preferredTime: extractedData.preferredTime || '09:00',
            address: customer.address || undefined,
            squareFootage: customer.square_footage || undefined,
            bedrooms: customer.bedrooms || undefined,
            bathrooms: customer.bathrooms || undefined,
            specialInstructions: extractedData.specialRequests,
          });

          // Send booking confirmation SMS
          const message = `Hi ${customer.name}! Thanks for calling. Your ${extractedData.cleaningType} cleaning is scheduled for ${extractedData.preferredDate}. Total: $${booking.quote.totalPrice.toFixed(2)}\n\nPay here to confirm: ${booking.paymentLink}`;

          await sendSMS({
            to: customerPhone,
            body: message,
          });

          return NextResponse.json({
            status: 'success',
            action: 'booking_created',
            jobId: booking.job.id,
            paymentLink: booking.paymentLink,
          });
        } else {
          // Send quote without specific date
          const quote = await calculateQuote({
            cleaningType: extractedData.cleaningType,
            squareFootage: customer.square_footage || undefined,
            bedrooms: customer.bedrooms || undefined,
            bathrooms: customer.bathrooms || undefined,
          });

          const quoteMessage = formatQuoteMessage(quote, customer.name);
          await sendSMS({
            to: customerPhone,
            body: quoteMessage,
          });

          return NextResponse.json({
            status: 'success',
            action: 'quote_sent',
            quote,
          });
        }
      } catch (bookingError) {
        console.error('Failed to process booking:', bookingError);
        // Fall through to generic follow-up
      }
    }

    // Send follow-up SMS for non-booking calls
    if (outcome === 'follow_up' && customer.name !== 'Unknown Caller') {
      try {
        await sendSMS({
          to: customerPhone,
          body: `Hi ${customer.name}, thanks for calling Spotless Scrubbers! Would you like a free quote? Just reply with your home size (sq ft, beds, baths) and we'll get right back to you.`,
        });
      } catch (smsError) {
        console.error('Failed to send follow-up SMS:', smsError);
      }
    }

    return NextResponse.json({
      status: 'success',
      customerId: customer.id,
      callId: callRecord.id,
      outcome,
      extractedData,
    });
  } catch (error) {
    console.error('Vapi webhook error:', error);

    // Log the error
    await logAutomationEvent({
      event_type: 'vapi_call',
      source: 'vapi',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle Vapi verification requests
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'vapi-webhook' });
}
