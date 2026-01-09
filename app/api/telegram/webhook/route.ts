// Telegram Bot Webhook - Handle cleaner responses
// Replaces: Cleaner Bot

import { NextRequest, NextResponse } from 'next/server';
import {
  getCleanerByTelegramId,
  getJobById,
  updateJob,
  updateCleanerAssignment,
  getActiveCleaners,
  createCleanerAssignment,
  logAutomationEvent,
  getCustomerByPhone,
  createMessage,
} from '@/lib/supabase';
import {
  answerCallbackQuery,
  sendMessage,
  parseJobCallbackData,
  sendJobConfirmation,
  notifyCleanerOfJob,
} from '@/lib/integrations/telegram';
import { sendSMS } from '@/lib/integrations/openphone';
import type { TelegramUpdate } from '@/lib/types/webhooks';

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    console.log('📱 Telegram update received:', update.update_id);

    // Handle callback queries (button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Handle text messages
    if (update.message?.text) {
      await handleTextMessage(update.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);

    await logAutomationEvent({
      event_type: 'telegram_webhook',
      source: 'telegram',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json({ ok: false, error: 'Webhook processing failed' });
  }
}

async function handleCallbackQuery(query: TelegramUpdate['callback_query']) {
  if (!query || !query.data) return;

  const telegramId = query.from.id.toString();
  const callbackData = query.data;

  // Parse the callback data
  const parsed = parseJobCallbackData(callbackData);
  if (!parsed) {
    await answerCallbackQuery(query.id, 'Unknown action');
    return;
  }

  // Get cleaner by Telegram ID
  const cleaner = await getCleanerByTelegramId(telegramId);
  if (!cleaner) {
    await answerCallbackQuery(query.id, 'Cleaner not found. Please contact admin.');
    return;
  }

  // Get job
  const job = await getJobById(parsed.jobId);
  if (!job) {
    await answerCallbackQuery(query.id, 'Job not found.');
    return;
  }

  const customer = job.customers as { name: string; phone_number: string; address?: string | null } | undefined;

  switch (parsed.action) {
    case 'accept':
      await handleJobAccepted(cleaner, job, query.id, customer);
      break;

    case 'decline':
      await handleJobDeclined(cleaner, job, query.id, customer);
      break;

    case 'reschedule':
      await answerCallbackQuery(query.id, 'Please reply with your preferred time.');
      await sendMessage({
        chatId: telegramId,
        text: 'Please reply with your preferred date/time for this job, and we\'ll check with the customer.',
      });
      break;
  }
}

async function handleJobAccepted(
  cleaner: { id: number; name: string; telegram_id: string | null },
  job: { id: number; title: string; date: string; scheduled_at: string | null; cleaning_team: string[] | null },
  callbackQueryId: string,
  customer?: { name: string; phone_number: string; address?: string | null } | null
) {
  // Acknowledge button press
  await answerCallbackQuery(callbackQueryId, '✅ Job accepted!');

  // Update assignment status
  await updateCleanerAssignment(cleaner.id, job.id, {
    status: 'accepted',
    responded_at: new Date().toISOString(),
  });

  // Update job with cleaner assignment
  const currentTeam = job.cleaning_team || [];
  await updateJob(job.id, {
    cleaning_team: [...currentTeam, cleaner.name],
    status: 'confirmed',
  });

  // Send confirmation to cleaner
  const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at) : new Date(job.date);
  await sendJobConfirmation(cleaner.telegram_id!, {
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
    customerPhone: customer?.phone_number || '',
  });

  // Notify customer
  if (customer) {
    try {
      await sendSMS({
        to: customer.phone_number,
        body: `Great news ${customer.name}! ${cleaner.name} has been assigned to your cleaning on ${scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. See you soon! 🧹`,
      });

      // Store message
      const customerRecord = await getCustomerByPhone(customer.phone_number);
      if (customerRecord) {
        await createMessage({
          customer_id: customerRecord.id,
          role: 'bot',
          content: `Cleaner assigned: ${cleaner.name}`,
          timestamp: new Date().toISOString(),
          direction: 'outbound',
        });
      }
    } catch (smsError) {
      console.error('Failed to send cleaner assignment SMS:', smsError);
    }
  }

  // Log event
  await logAutomationEvent({
    event_type: 'cleaner_accepted',
    source: 'telegram',
    job_id: job.id,
    payload: {
      cleanerId: cleaner.id,
      cleanerName: cleaner.name,
    },
    result: {
      customerNotified: !!customer,
    },
    success: true,
  });
}

async function handleJobDeclined(
  cleaner: { id: number; name: string; telegram_id: string | null },
  job: { id: number; title: string; date: string; scheduled_at: string | null; hours: number | null; price: number | null; cleaning_type: string | null; special_instructions: string | null },
  callbackQueryId: string,
  customer?: { name: string; phone_number: string; address?: string | null } | null
) {
  // Acknowledge button press
  await answerCallbackQuery(callbackQueryId, '❌ Job declined. Finding another cleaner...');

  // Update assignment status
  await updateCleanerAssignment(cleaner.id, job.id, {
    status: 'declined',
    responded_at: new Date().toISOString(),
  });

  // Send confirmation to cleaner
  await sendMessage({
    chatId: cleaner.telegram_id!,
    text: 'No problem! We\'ll find another cleaner for this job.',
  });

  // Try to find another cleaner
  const availableCleaners = await getActiveCleaners();
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

  // Find next available cleaner (excluding the one who declined)
  for (const nextCleaner of availableCleaners) {
    if (nextCleaner.id === cleaner.id) continue;
    if (!nextCleaner.telegram_id) continue;

    try {
      await notifyCleanerOfJob(nextCleaner.telegram_id, jobDetails);

      await createCleanerAssignment({
        cleaner_id: nextCleaner.id,
        job_id: job.id,
        status: 'pending',
        notified_at: new Date().toISOString(),
      });

      console.log(`📤 Job ${job.id} re-dispatched to cleaner ${nextCleaner.name}`);
      break;
    } catch (telegramError) {
      console.error(`Failed to notify cleaner ${nextCleaner.name}:`, telegramError);
    }
  }

  // Log event
  await logAutomationEvent({
    event_type: 'cleaner_declined',
    source: 'telegram',
    job_id: job.id,
    payload: {
      cleanerId: cleaner.id,
      cleanerName: cleaner.name,
    },
    result: {
      reassignmentAttempted: true,
    },
    success: true,
  });
}

async function handleTextMessage(message: TelegramUpdate['message']) {
  if (!message?.from || !message.text) return;

  const telegramId = message.from.id.toString();
  const text = message.text.trim();

  // Get cleaner
  const cleaner = await getCleanerByTelegramId(telegramId);

  if (!cleaner) {
    // Unknown user - send info message
    await sendMessage({
      chatId: message.chat.id,
      text: '👋 Hi! This is the Spotless Scrubbers cleaner bot. If you\'re a cleaner and should have access, please contact your manager to get set up.',
    });
    return;
  }

  // Handle different commands
  if (text === '/start') {
    await sendMessage({
      chatId: message.chat.id,
      text: `Welcome back, ${cleaner.name}! 🧹\n\nYou'll receive job notifications here. When a job comes in, you can:\n✅ Accept - Take the job\n❌ Decline - Pass to another cleaner\n📅 Suggest time - Propose a different time\n\nReply /help for more commands.`,
    });
    return;
  }

  if (text === '/help') {
    await sendMessage({
      chatId: message.chat.id,
      text: `Available commands:\n\n/start - Welcome message\n/status - Check your assigned jobs\n/help - Show this help\n\nWhen you receive a job notification, use the buttons to respond quickly!`,
    });
    return;
  }

  if (text === '/status') {
    await sendMessage({
      chatId: message.chat.id,
      text: `📊 Your upcoming jobs will appear here.\n\nWe're working on adding a job dashboard - stay tuned!`,
    });
    return;
  }

  // Generic response
  await sendMessage({
    chatId: message.chat.id,
    text: `Thanks for your message! If you need help, reply /help. For urgent matters, please call the office.`,
  });
}

// Verify webhook endpoint is active
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'telegram-webhook' });
}
