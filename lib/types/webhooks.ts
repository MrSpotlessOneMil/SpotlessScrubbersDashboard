// Webhook payload types for external services

// ============================================
// VAPI WEBHOOKS
// ============================================

export interface VapiCallEndedPayload {
  message: {
    type: 'end-of-call-report';
    call: {
      id: string;
      orgId: string;
      type: 'inboundPhoneCall' | 'outboundPhoneCall';
      status: 'ended' | 'failed';
      endedReason: string;
      startedAt: string;
      endedAt: string;
      cost: number;
      customer: {
        number: string;
        name?: string;
      };
      phoneNumber?: {
        id: string;
        number: string;
      };
    };
    transcript: string;
    summary?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    analysis?: {
      summary?: string;
      structuredData?: Record<string, unknown>;
      successEvaluation?: string;
    };
  };
}

export interface VapiExtractedData {
  customerName?: string;
  address?: string;
  zipCode?: string;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  pets?: string;
  cleaningType?: string;
  preferredDate?: string;
  preferredTime?: string;
  urgency?: string;
  specialRequests?: string;
  bookingIntent?: boolean;
}

// ============================================
// OPENPHONE WEBHOOKS
// ============================================

export interface OpenPhoneMessagePayload {
  data: {
    object: {
      id: string;
      conversationId: string;
      createdAt: string;
      direction: 'incoming' | 'outgoing';
      from: string;
      to: string;
      body: string;
      media?: Array<{
        url: string;
        contentType: string;
      }>;
      status: 'received' | 'sent' | 'delivered' | 'failed';
      userId?: string;
      phoneNumberId: string;
    };
  };
  type: 'message.received' | 'message.sent' | 'message.delivered';
  apiVersion: string;
}

export interface OpenPhoneCallPayload {
  data: {
    object: {
      id: string;
      conversationId: string;
      createdAt: string;
      direction: 'incoming' | 'outgoing';
      from: string;
      to: string;
      duration?: number;
      status: 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy';
      userId?: string;
      phoneNumberId: string;
      recordingUrl?: string;
      voicemailUrl?: string;
    };
  };
  type: 'call.ringing' | 'call.completed' | 'call.recording.completed';
  apiVersion: string;
}

// ============================================
// STRIPE WEBHOOKS
// ============================================

export interface StripeCheckoutCompletedPayload {
  id: string;
  object: 'event';
  type: 'checkout.session.completed';
  data: {
    object: {
      id: string;
      object: 'checkout.session';
      amount_total: number;
      currency: string;
      customer: string | null;
      customer_details: {
        email: string | null;
        name: string | null;
        phone: string | null;
      } | null;
      metadata: Record<string, string>;
      payment_intent: string;
      payment_status: 'paid' | 'unpaid' | 'no_payment_required';
      status: 'complete' | 'expired' | 'open';
    };
  };
}

export interface StripePaymentIntentPayload {
  id: string;
  object: 'event';
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed';
  data: {
    object: {
      id: string;
      object: 'payment_intent';
      amount: number;
      amount_received: number;
      currency: string;
      customer: string | null;
      metadata: Record<string, string>;
      receipt_email: string | null;
      status: 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled';
    };
  };
}

// ============================================
// WAVE WEBHOOKS
// ============================================

export interface WaveInvoicePayload {
  eventType: 'invoiceCreated' | 'invoiceSent' | 'invoicePaid' | 'invoiceViewed';
  businessId: string;
  data: {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'OVERDUE';
    total: {
      value: number;
      currency: string;
    };
    amountDue: {
      value: number;
      currency: string;
    };
    amountPaid: {
      value: number;
      currency: string;
    };
    pdfUrl?: string;
    viewUrl?: string;
  };
}

// ============================================
// TELEGRAM WEBHOOKS
// ============================================

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
}

// ============================================
// INTERNAL AUTOMATION TYPES
// ============================================

export interface CustomerContext {
  customer: {
    id: number;
    phone_number: string;
    name: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    zip_code?: string | null;
    square_footage?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    pets?: string | null;
    frequency?: string | null;
    source?: string | null;
  };
  jobs: Array<{
    id: number;
    title: string;
    date: string;
    status: string;
    cleaning_type?: string | null;
    price?: number | null;
    paid: boolean;
    booked: boolean;
  }>;
  calls: Array<{
    id: number;
    date: string;
    transcript?: string | null;
    summary?: string | null;
    outcome?: string | null;
  }>;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
}

export interface QuoteCalculation {
  cleaningType: string;
  basePrice: number;
  sqftCharge: number;
  bedroomCharge: number;
  bathroomCharge: number;
  totalPrice: number;
  estimatedHours: number;
  breakdown: string;
}

export interface BookingRequest {
  customerId: number;
  cleaningType: string;
  preferredDate: string;
  preferredTime: string;
  price: number;
  specialInstructions?: string;
}
