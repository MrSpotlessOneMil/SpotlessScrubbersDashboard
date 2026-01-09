// Telegram Bot Integration for Cleaner Notifications
// https://core.telegram.org/bots/api

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

interface TelegramSendMessageOptions {
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: TelegramInlineKeyboard | TelegramReplyKeyboard;
}

interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
}

interface TelegramReplyKeyboard {
  keyboard: Array<Array<{
    text: string;
  }>>;
  one_time_keyboard?: boolean;
  resize_keyboard?: boolean;
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  }
  return token;
}

/**
 * Send a message to a Telegram chat
 */
export async function sendMessage(options: TelegramSendMessageOptions): Promise<TelegramMessage> {
  const token = getBotToken();

  const response = await fetch(`${TELEGRAM_API_URL}${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: options.chatId,
      text: options.text,
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data.result;
}

/**
 * Send job assignment notification to a cleaner
 */
export async function notifyCleanerOfJob(
  telegramId: string,
  job: {
    id: number;
    title: string;
    date: string;
    time: string;
    address: string;
    customerName: string;
    price: number;
    estimatedHours: number;
    cleaningType: string;
    specialInstructions?: string;
  }
): Promise<TelegramMessage> {
  const message = `
🧹 <b>New Job Available!</b>

📅 <b>Date:</b> ${job.date}
⏰ <b>Time:</b> ${job.time}
📍 <b>Address:</b> ${job.address}
👤 <b>Client:</b> ${job.customerName}
🏠 <b>Type:</b> ${job.cleaningType}
⏱ <b>Est. Duration:</b> ${job.estimatedHours} hours
💰 <b>Pay:</b> $${job.price.toFixed(2)}

${job.specialInstructions ? `📝 <b>Notes:</b> ${job.specialInstructions}` : ''}

Can you take this job?
  `.trim();

  return sendMessage({
    chatId: telegramId,
    text: message,
    parseMode: 'HTML',
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '✅ Accept', callback_data: `accept_job_${job.id}` },
          { text: '❌ Decline', callback_data: `decline_job_${job.id}` },
        ],
        [
          { text: '📅 Suggest Different Time', callback_data: `reschedule_job_${job.id}` },
        ],
      ],
    },
  });
}

/**
 * Send job confirmation to cleaner
 */
export async function sendJobConfirmation(
  telegramId: string,
  job: {
    date: string;
    time: string;
    address: string;
    customerName: string;
    customerPhone: string;
  }
): Promise<TelegramMessage> {
  const message = `
✅ <b>Job Confirmed!</b>

You're all set for:

📅 <b>Date:</b> ${job.date}
⏰ <b>Time:</b> ${job.time}
📍 <b>Address:</b> ${job.address}
👤 <b>Client:</b> ${job.customerName}
📞 <b>Contact:</b> ${job.customerPhone}

The client has been notified. See you there!
  `.trim();

  return sendMessage({
    chatId: telegramId,
    text: message,
    parseMode: 'HTML',
  });
}

/**
 * Send reminder to cleaner
 */
export async function sendJobReminder(
  telegramId: string,
  job: {
    date: string;
    time: string;
    address: string;
    customerName: string;
  }
): Promise<TelegramMessage> {
  const message = `
⏰ <b>Reminder: Job Tomorrow!</b>

📅 <b>Date:</b> ${job.date}
⏰ <b>Time:</b> ${job.time}
📍 <b>Address:</b> ${job.address}
👤 <b>Client:</b> ${job.customerName}

Don't forget to bring all supplies!
  `.trim();

  return sendMessage({
    chatId: telegramId,
    text: message,
    parseMode: 'HTML',
  });
}

/**
 * Answer a callback query (acknowledge button press)
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  const token = getBotToken();

  const response = await fetch(`${TELEGRAM_API_URL}${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.ok;
}

/**
 * Set webhook URL for the bot
 */
export async function setWebhook(url: string): Promise<boolean> {
  const token = getBotToken();

  const response = await fetch(`${TELEGRAM_API_URL}${token}/setWebhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      allowed_updates: ['message', 'callback_query'],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.ok;
}

/**
 * Get webhook info
 */
export async function getWebhookInfo(): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
}> {
  const token = getBotToken();

  const response = await fetch(`${TELEGRAM_API_URL}${token}/getWebhookInfo`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to get webhook info: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Parse callback data from job-related buttons
 */
export function parseJobCallbackData(data: string): {
  action: 'accept' | 'decline' | 'reschedule';
  jobId: number;
} | null {
  const acceptMatch = data.match(/^accept_job_(\d+)$/);
  if (acceptMatch) {
    return { action: 'accept', jobId: parseInt(acceptMatch[1], 10) };
  }

  const declineMatch = data.match(/^decline_job_(\d+)$/);
  if (declineMatch) {
    return { action: 'decline', jobId: parseInt(declineMatch[1], 10) };
  }

  const rescheduleMatch = data.match(/^reschedule_job_(\d+)$/);
  if (rescheduleMatch) {
    return { action: 'reschedule', jobId: parseInt(rescheduleMatch[1], 10) };
  }

  return null;
}
