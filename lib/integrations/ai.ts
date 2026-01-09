// AI Integration for Smart Responses
// Supports both OpenAI and Anthropic Claude

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

type AIProvider = 'openai' | 'anthropic';

interface GenerateResponseOptions {
  systemPrompt: string;
  context: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

interface ExtractDataOptions {
  transcript: string;
  schema: Record<string, string>;
}

/**
 * Determine which AI provider to use based on available API keys
 */
function getProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  throw new Error('No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
}

/**
 * Generate an AI response using the configured provider
 */
export async function generateResponse(options: GenerateResponseOptions): Promise<string> {
  const provider = getProvider();

  if (provider === 'anthropic') {
    return generateAnthropicResponse(options);
  } else {
    return generateOpenAIResponse(options);
  }
}

/**
 * Generate response using OpenAI
 */
async function generateOpenAIResponse(options: GenerateResponseOptions): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: `Context:\n${options.context}\n\nCustomer message: ${options.userMessage}` },
    ],
    max_tokens: options.maxTokens || 300,
    temperature: options.temperature || 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate response using Anthropic Claude
 */
async function generateAnthropicResponse(options: GenerateResponseOptions): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: options.maxTokens || 300,
    system: options.systemPrompt,
    messages: [
      { role: 'user', content: `Context:\n${options.context}\n\nCustomer message: ${options.userMessage}` },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  return textContent ? textContent.text : '';
}

/**
 * Extract structured data from a call transcript
 */
export async function extractDataFromTranscript(options: ExtractDataOptions): Promise<Record<string, unknown>> {
  const provider = getProvider();

  const systemPrompt = `You are a data extraction assistant for a cleaning service company.
Extract the following information from the call transcript if mentioned.
Return a JSON object with these fields (use null for missing info):

${Object.entries(options.schema).map(([key, desc]) => `- ${key}: ${desc}`).join('\n')}

Only return valid JSON, no other text.`;

  const userPrompt = `Extract data from this transcript:\n\n${options.transcript}`;

  let response: string;

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = result.content.find(c => c.type === 'text');
    response = textContent ? textContent.text : '{}';
  } else {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    response = result.choices[0]?.message?.content || '{}';
  }

  // Parse the JSON response
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
    const jsonStr = jsonMatch[1]?.trim() || response.trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI response as JSON:', response);
    return {};
  }
}

/**
 * Detect booking intent from a message
 */
export async function detectBookingIntent(message: string): Promise<{
  hasIntent: boolean;
  confidence: number;
  suggestedAction: 'book' | 'quote' | 'question' | 'other';
}> {
  const provider = getProvider();

  const systemPrompt = `You are an intent classifier for a cleaning service.
Analyze the customer message and determine:
1. If they want to book a cleaning
2. If they're asking for a quote/pricing
3. If they have a question
4. Other (complaint, thank you, etc.)

Return JSON only:
{
  "hasIntent": boolean (true if they want to book or get a quote),
  "confidence": number (0-1),
  "suggestedAction": "book" | "quote" | "question" | "other"
}`;

  let response: string;

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const textContent = result.content.find(c => c.type === 'text');
    response = textContent ? textContent.text : '{}';
  } else {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    response = result.choices[0]?.message?.content || '{}';
  }

  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
    const jsonStr = jsonMatch[1]?.trim() || response.trim();
    return JSON.parse(jsonStr);
  } catch {
    return { hasIntent: false, confidence: 0, suggestedAction: 'other' };
  }
}

/**
 * Get the SMS response system prompt for Spotless Scrubbers
 */
export function getSmsSystemPrompt(): string {
  return `You are a friendly AI assistant for Spotless Scrubbers, a professional cleaning service.

Your role is to:
1. Answer questions about cleaning services
2. Help schedule appointments
3. Provide quotes based on home size
4. Handle rescheduling requests
5. Address concerns professionally

Guidelines:
- Keep responses concise (under 160 characters when possible, max 320)
- Be warm, professional, and helpful
- Use the customer's name when available
- If you can't help, offer to have someone call them
- Never make up information about pricing or availability

Services offered:
- Standard cleaning: Regular maintenance cleaning
- Deep cleaning: Thorough top-to-bottom cleaning
- Move-in/Move-out: Preparing homes for new occupants
- Post-construction: Debris and dust removal after renovation

Pricing is based on home size (sq ft, bedrooms, bathrooms) and cleaning type.`;
}

/**
 * Build context string from customer history
 */
export function buildCustomerContext(context: {
  customer: { name: string; address?: string | null; frequency?: string | null };
  jobs: Array<{ title: string; date: string; status: string }>;
  calls: Array<{ summary?: string | null }>;
  messages: Array<{ role: string; content: string; timestamp: string }>;
}): string {
  const parts: string[] = [];

  parts.push(`Customer: ${context.customer.name}`);

  if (context.customer.address) {
    parts.push(`Address: ${context.customer.address}`);
  }

  if (context.customer.frequency) {
    parts.push(`Service frequency: ${context.customer.frequency}`);
  }

  if (context.jobs.length > 0) {
    const recentJobs = context.jobs.slice(0, 3).map(j =>
      `${j.title} on ${new Date(j.date).toLocaleDateString()} (${j.status})`
    );
    parts.push(`Recent jobs: ${recentJobs.join(', ')}`);
  }

  if (context.calls.length > 0 && context.calls[0].summary) {
    parts.push(`Last call summary: ${context.calls[0].summary}`);
  }

  if (context.messages.length > 0) {
    const recentMessages = context.messages
      .slice(0, 5)
      .reverse()
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    parts.push(`Recent conversation:\n${recentMessages}`);
  }

  return parts.join('\n');
}
