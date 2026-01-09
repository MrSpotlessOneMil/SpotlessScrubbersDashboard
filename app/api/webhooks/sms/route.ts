// SMS Webhook - Process incoming text messages with AI responses
// Replaces: Customer Text Bot, Email Bot

import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByPhone,
  upsertCustomer,
  createMessage,
  getCustomerContext,
  getMessageByOpenPhoneId,
  logAutomationEvent,
} from '@/lib/supabase';
import { sendSMS, normalizePhoneNumber } from '@/lib/integrations/openphone';
import {
  generateResponse,
  detectBookingIntent,
  getSmsSystemPrompt,
  buildCustomerContext,
} from '@/lib/integrations/ai';
import {
  calculateQuote,
  createBooking,
  parseScheduleRequest,
  formatQuoteMessage,
} from '@/lib/automation/booking-engine';
import type { OpenPhoneMessagePayload } from '@/lib/types/webhooks';

export async function POST(request: NextRequest) {
  try {
    const payload: OpenPhoneMessagePayload = await request.json();

    // Only process incoming messages
    if (payload.type !== 'message.received') {
      return NextResponse.json({ status: 'ignored', reason: 'Not an incoming message' });
    }

    const message = payload.data.object;

    // Check if we've already processed this message
    const existingMessage = await getMessageByOpenPhoneId(message.id);
    if (existingMessage) {
      return NextResponse.json({ status: 'ignored', reason: 'Message already processed' });
    }

    const customerPhone = normalizePhoneNumber(message.from);
    const messageContent = message.body;

    console.log(`📱 Incoming SMS from ${customerPhone}: ${messageContent.substring(0, 50)}...`);

    // Get or create customer
    let customer = await getCustomerByPhone(customerPhone);

    if (!customer) {
      customer = await upsertCustomer({
        phone_number: customerPhone,
        name: 'SMS Customer',
        source: 'sms',
      });
    }

    // Store incoming message
    await createMessage({
      customer_id: customer.id,
      openphone_id: message.id,
      role: 'client',
      content: messageContent,
      timestamp: message.createdAt,
      direction: 'inbound',
    });

    // Get customer context for AI
    const context = await getCustomerContext(customer.id);

    // Detect intent
    const intent = await detectBookingIntent(messageContent);
    console.log('🎯 Detected intent:', intent);

    let responseText: string;
    let action = 'ai_response';

    // Handle booking intent
    if (intent.hasIntent && intent.confidence > 0.7) {
      if (intent.suggestedAction === 'book') {
        // Try to parse scheduling info from message
        const scheduleInfo = parseScheduleRequest(messageContent);

        if (scheduleInfo.date && scheduleInfo.cleaningType) {
          try {
            // Create booking
            const booking = await createBooking({
              customerPhone,
              customerName: customer.name,
              customerEmail: customer.email || undefined,
              cleaningType: scheduleInfo.cleaningType,
              preferredDate: scheduleInfo.date,
              preferredTime: scheduleInfo.time || '09:00',
              address: customer.address || undefined,
              squareFootage: customer.square_footage || undefined,
              bedrooms: customer.bedrooms || undefined,
              bathrooms: customer.bathrooms || undefined,
            });

            responseText = `Perfect ${customer.name}! I've scheduled your ${scheduleInfo.cleaningType} cleaning for ${scheduleInfo.date}. Total: $${booking.quote.totalPrice.toFixed(2)}\n\nPay here to confirm: ${booking.paymentLink}`;
            action = 'booking_created';
          } catch (bookingError) {
            console.error('Booking creation failed:', bookingError);
            responseText = await generateAIResponse(context, messageContent);
          }
        } else if (scheduleInfo.cleaningType) {
          // We have cleaning type but not date - send quote and ask for date
          const quote = await calculateQuote({
            cleaningType: scheduleInfo.cleaningType,
            squareFootage: customer.square_footage || undefined,
            bedrooms: customer.bedrooms || undefined,
            bathrooms: customer.bathrooms || undefined,
          });

          responseText = `Great choice! ${scheduleInfo.cleaningType} cleaning would be $${quote.totalPrice.toFixed(2)} (${quote.estimatedHours} hrs).\n\nWhen works best for you? Reply with your preferred date!`;
          action = 'quote_provided';
        } else {
          // General booking intent - ask what they need
          responseText = `Hi ${customer.name}! I'd love to help you book. What type of cleaning do you need?\n\n• Standard cleaning\n• Deep cleaning\n• Move-in/out\n• Post-construction`;
          action = 'booking_inquiry';
        }
      } else if (intent.suggestedAction === 'quote') {
        // Parse any home details from message
        const sqftMatch = messageContent.match(/(\d{3,5})\s*(?:sq|square)/i);
        const bedMatch = messageContent.match(/(\d+)\s*(?:bed|br)/i);
        const bathMatch = messageContent.match(/(\d+\.?\d*)\s*(?:bath|ba)/i);

        const squareFootage = sqftMatch ? parseInt(sqftMatch[1], 10) : customer.square_footage;
        const bedrooms = bedMatch ? parseInt(bedMatch[1], 10) : customer.bedrooms;
        const bathrooms = bathMatch ? parseFloat(bathMatch[1]) : customer.bathrooms;

        // Update customer with any new info
        if (sqftMatch || bedMatch || bathMatch) {
          await upsertCustomer({
            phone_number: customerPhone,
            name: customer.name,
            square_footage: squareFootage || undefined,
            bedrooms: bedrooms || undefined,
            bathrooms: bathrooms || undefined,
          });
        }

        if (squareFootage || bedrooms) {
          const quote = await calculateQuote({
            cleaningType: 'standard',
            squareFootage: squareFootage || undefined,
            bedrooms: bedrooms || undefined,
            bathrooms: bathrooms || undefined,
          });

          responseText = formatQuoteMessage(quote, customer.name);
          action = 'quote_provided';
        } else {
          responseText = `Hi ${customer.name}! I'd be happy to give you a quote. Could you tell me:\n\n• Square footage\n• Number of bedrooms\n• Number of bathrooms\n\nOr call us and we'll walk you through it!`;
          action = 'quote_inquiry';
        }
      } else {
        // General question - use AI
        responseText = await generateAIResponse(context, messageContent);
      }
    } else {
      // No clear intent - use AI for contextual response
      responseText = await generateAIResponse(context, messageContent);
    }

    // Send response
    await sendSMS({
      to: customerPhone,
      body: responseText,
    });

    // Store outbound message
    await createMessage({
      customer_id: customer.id,
      role: 'bot',
      content: responseText,
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      ai_generated: true,
    });

    // Log event
    await logAutomationEvent({
      event_type: 'sms_response',
      source: 'openphone',
      customer_id: customer.id,
      payload: {
        incomingMessage: messageContent,
        intent,
      },
      result: {
        response: responseText,
        action,
      },
      success: true,
    });

    return NextResponse.json({
      status: 'success',
      customerId: customer.id,
      action,
      intent,
    });
  } catch (error) {
    console.error('SMS webhook error:', error);

    await logAutomationEvent({
      event_type: 'sms_response',
      source: 'openphone',
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

async function generateAIResponse(
  context: Awaited<ReturnType<typeof getCustomerContext>>,
  userMessage: string
): Promise<string> {
  if (!context.customer) {
    return "Hi! Thanks for reaching out to Spotless Scrubbers. How can I help you today?";
  }

  const contextString = buildCustomerContext({
    customer: {
      name: context.customer.name,
      address: context.customer.address,
      frequency: context.customer.frequency,
    },
    jobs: context.jobs.map(j => ({
      title: j.title,
      date: j.date,
      status: j.status,
      cleaning_type: j.cleaning_type,
      price: j.price,
      paid: j.paid,
      booked: j.booked,
    })),
    calls: context.calls.map(c => ({
      summary: c.summary,
    })),
    messages: context.messages.slice(0, 10).map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
  });

  const response = await generateResponse({
    systemPrompt: getSmsSystemPrompt(),
    context: contextString,
    userMessage,
    maxTokens: 250,
    temperature: 0.7,
  });

  // Ensure response isn't too long for SMS
  if (response.length > 320) {
    return response.substring(0, 317) + '...';
  }

  return response;
}

// Verify webhook is active
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'sms-webhook' });
}
