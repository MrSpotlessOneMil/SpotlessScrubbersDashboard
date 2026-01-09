// POST /api/webhooks/job-change - Receive job change notifications
// Replaces: Jobs-sheet change listener webhook from Google Sheets

import { NextRequest, NextResponse } from 'next/server';
import {
  getCleanersByNames,
  getJobById,
  logAutomationEvent,
  supabase,
  upsertCleanerAssignment,
} from '@/lib/supabase';
import { sendSMS } from '@/lib/integrations/openphone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📋 Job change webhook received:', body);

    // Validate payload
    if (!body.jobId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: jobId',
        },
        { status: 400 }
      );
    }

    const jobId = parseInt(body.jobId, 10);

    // Get the full job details with customer info
    const job = await getJobById(jobId);

    if (!job) {
      console.error('Job not found:', jobId);
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    // Determine what changed based on the payload
    const changeType = body.changeType || 'unknown';
    const changedFields = body.changedFields || [];

    // Log the change event
    await logAutomationEvent({
      event_type: 'job_changed',
      source: 'webhook',
      customer_id: job.customer_id,
      job_id: jobId,
      payload: {
        changeType,
        changedFields,
        previousValues: body.previousValues,
        newValues: body.newValues,
      },
      success: true,
    });

    const notifications: string[] = [];

    // Handle specific types of changes
    if (changedFields.includes('address') || changedFields.includes('scheduled_at')) {
      // Address or time changed - notify customer and cleaners
      if (job.customers?.phone_number) {
        try {
          const scheduledDate = job.scheduled_at
            ? new Date(job.scheduled_at)
            : new Date(job.date);

          const formattedDate = scheduledDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
          const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          let message = `Hi ${job.customers.name}! Update for your ${job.title}:\n`;

          if (changedFields.includes('address')) {
            message += `\n📍 New address: ${job.customers.address || 'Updated'}`;
          }

          if (changedFields.includes('scheduled_at')) {
            message += `\n🕐 New time: ${formattedDate} at ${formattedTime}`;
          }

          message += `\n\nQuestions? Just reply or call us!`;

          await sendSMS({
            to: job.customers.phone_number,
            body: message,
          });

          notifications.push('customer_notified');
        } catch (error) {
          console.error('Failed to notify customer:', error);
        }
      }

      // Notify assigned cleaners
      if (job.cleaning_team && job.cleaning_team.length > 0) {
        try {
          // In a real implementation, notify via Telegram
          notifications.push('cleaners_notified');
          console.log('Would notify cleaners:', job.cleaning_team);
        } catch (error) {
          console.error('Failed to notify cleaners:', error);
        }
      }
    }

    if (changedFields.includes('cleaning_team')) {
      // Team assignment changed
      if (job.cleaning_team && job.cleaning_team.length > 0) {
        try {
          // Look up cleaners and notify them
          const cleaners = await getCleanersByNames(job.cleaning_team);

          for (const cleaner of cleaners) {
            if (cleaner.telegram_id) {
              // Create assignment record
              await upsertCleanerAssignment({
                cleaner_id: cleaner.id,
                job_id: jobId,
                status: 'pending',
                notified_at: new Date().toISOString(),
              });

              // Send Telegram notification (implement in telegram.ts)
              console.log(`Would notify ${cleaner.name} via Telegram`);
              notifications.push(`cleaner_${cleaner.id}_notified`);
            }
          }
        } catch (error) {
          console.error('Failed to process cleaner assignments:', error);
        }
      }
    }

    if (changedFields.includes('status')) {
      // Status changed
      const newStatus = body.newValues?.status || job.status;

      if (newStatus === 'cancelled' && job.customers?.phone_number) {
        try {
          await sendSMS({
            to: job.customers.phone_number,
            body: `Hi ${job.customers.name}, your cleaning scheduled for ${job.date} has been cancelled. Please contact us if you have any questions or would like to reschedule.`,
          });

          notifications.push('customer_notified_cancellation');
        } catch (error) {
          console.error('Failed to notify cancellation:', error);
        }
      }

      if (newStatus === 'completed' && job.customers?.phone_number) {
        try {
          await sendSMS({
            to: job.customers.phone_number,
            body: `Hi ${job.customers.name}! Your cleaning is complete. We hope everything looks spotless! 🧹✨ Would you mind leaving us a review? We'd greatly appreciate it!`,
          });

          notifications.push('customer_notified_completion');
        } catch (error) {
          console.error('Failed to notify completion:', error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      changeType,
      changedFields,
      notifications,
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        date: job.date,
        customer: job.customers?.name,
      },
    });
  } catch (error) {
    console.error('Job change webhook error:', error);

    await logAutomationEvent({
      event_type: 'job_changed',
      source: 'webhook',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process job change',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'job-change-webhook' });
}
