// OpenPhone SMS Integration
// https://www.openphone.com/docs/api

const OPENPHONE_API_URL = 'https://api.openphone.com/v1';

interface SendSmsOptions {
  to: string;
  body: string;
  from?: string; // Your OpenPhone number, defaults to env var
}

interface OpenPhoneMessage {
  id: string;
  conversationId: string;
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  from: string;
  to: string;
  body: string;
  status: string;
}

interface OpenPhoneConversation {
  id: string;
  createdAt: string;
  participants: string[];
  phoneNumberId: string;
}

function getHeaders() {
  const apiKey = process.env.OPENPHONE_API_KEY;
  if (!apiKey) {
    throw new Error('OPENPHONE_API_KEY environment variable is not set');
  }
  return {
    'Authorization': apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Send an SMS message via OpenPhone
 */
export async function sendSMS(options: SendSmsOptions): Promise<OpenPhoneMessage> {
  const fromNumber = options.from || process.env.OPENPHONE_PHONE_NUMBER;

  if (!fromNumber) {
    throw new Error('OpenPhone phone number not configured');
  }

  // Normalize phone number to E.164 format
  const toNumber = normalizePhoneNumber(options.to);

  const response = await fetch(`${OPENPHONE_API_URL}/messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      from: fromNumber,
      to: [toNumber],
      content: options.body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenPhone API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0];
}

/**
 * Get conversation history with a phone number
 */
export async function getConversation(phoneNumber: string): Promise<OpenPhoneMessage[]> {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);

  // First, find the conversation
  const conversationsResponse = await fetch(
    `${OPENPHONE_API_URL}/conversations?participants=${encodeURIComponent(normalizedNumber)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!conversationsResponse.ok) {
    throw new Error(`Failed to fetch conversations: ${conversationsResponse.status}`);
  }

  const conversationsData = await conversationsResponse.json();
  const conversations: OpenPhoneConversation[] = conversationsData.data || [];

  if (conversations.length === 0) {
    return [];
  }

  // Get messages from the first (most recent) conversation
  const conversationId = conversations[0].id;

  const messagesResponse = await fetch(
    `${OPENPHONE_API_URL}/messages?conversationId=${conversationId}&maxResults=50`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!messagesResponse.ok) {
    throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
  }

  const messagesData = await messagesResponse.json();
  return messagesData.data || [];
}

/**
 * Get phone number info
 */
export async function getPhoneNumbers(): Promise<Array<{ id: string; number: string; name: string }>> {
  const response = await fetch(`${OPENPHONE_API_URL}/phone-numbers`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch phone numbers: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already has the right format, just ensure + prefix
  if (digits.length > 10) {
    return `+${digits}`;
  }

  // Return as-is if we can't determine format
  return phone;
}

/**
 * Format phone number for display
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

/**
 * Verify webhook signature from OpenPhone
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
