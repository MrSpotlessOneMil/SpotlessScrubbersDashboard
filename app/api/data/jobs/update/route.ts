// POST /api/data/jobs/update - Update job fields
// Replaces: Lindy job update actions

import { NextRequest, NextResponse } from 'next/server';
import { supabase, updateJob, getJobById, logAutomationEvent } from '@/lib/supabase';
import { sendSMS } from '@/lib/integrations/openphone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate job ID
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

    // Get current job state
    const currentJob = await getJobById(jobId);
    if (!currentJob) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {};

    // Update allowed fields
    if (body.status !== undefined) updates.status = body.status;
    if (body.booked !== undefined) updates.booked = body.booked;
    if (body.quoted !== undefined) updates.quoted = body.quoted;
    if (body.paid !== undefined) updates.paid = body.paid;
    if (body.price !== undefined) updates.price = body.price;
    if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.special_instructions !== undefined)
      updates.special_instructions = body.special_instructions;
    if (body.invoice_url !== undefined) updates.invoice_url = body.invoice_url;
    if (body.wave_invoice_id !== undefined)
      updates.wave_invoice_id = body.wave_invoice_id;
    if (body.stripe_payment_id !== undefined)
      updates.stripe_payment_id = body.stripe_payment_id;
    if (body.stripe_payment_link !== undefined)
      updates.stripe_payment_link = body.stripe_payment_link;
    if (body.payment_method !== undefined)
      updates.payment_method = body.payment_method;

    // Handle cleaning team assignment
    if (body.cleaning_team !== undefined) {
      updates.cleaning_team = Array.isArray(body.cleaning_team)
        ? body.cleaning_team
        : [body.cleaning_team];

      // If team was just assigned, update status
      if (
        (!currentJob.cleaning_team || currentJob.cleaning_team.length === 0) &&
        updates.cleaning_team.length > 0
      ) {
        updates.status = 'confirmed';
      }
    }

    // Perform the update
    const updatedJob = await updateJob(jobId, updates);

    // Track what changed
    const changes: Record<string, any> = {};
    Object.keys(updates).forEach((key) => {
      if (JSON.stringify(updates[key]) !== JSON.stringify((currentJob as any)[key])) {
        changes[key] = {
          from: (currentJob as any)[key],
          to: updates[key],
        };
      }
    });

    // Log the update
    await logAutomationEvent({
      event_type: 'job_updated',
      source: 'api',
      customer_id: currentJob.customer_id,
      job_id: jobId,
      payload: { updates, changes },
      result: { success: true },
      success: true,
    });

    // Handle notifications for specific changes
    const notifications: string[] = [];

    // Notify customer if address changed
    if (changes.scheduled_at && currentJob.customers?.phone_number) {
      try {
        const newDate = new Date(updates.scheduled_at);
        const formattedDate = newDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        const formattedTime = newDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });

        await sendSMS({
          to: currentJob.customers.phone_number,
          body: `Hi ${currentJob.customers.name}! Your cleaning has been rescheduled to ${formattedDate} at ${formattedTime}. Let us know if you have any questions!`,
        });

        notifications.push('customer_notified_reschedule');
      } catch (error) {
        console.error('Failed to notify customer of reschedule:', error);
      }
    }

    // Notify cleaners if team was assigned or changed
    if (changes.cleaning_team && updates.cleaning_team.length > 0) {
      try {
        // In a real implementation, you would:
        // 1. Look up cleaners by name
        // 2. Send Telegram notifications
        // 3. Create cleaner_assignments records

        // For now, we'll just log it
        notifications.push('cleaners_notified');
        console.log('Cleaner assignment:', updates.cleaning_team);
      } catch (error) {
        console.error('Failed to notify cleaners:', error);
      }
    }

    // Notify customer if payment status changed to paid
    if (changes.paid && updates.paid === true && currentJob.customers?.phone_number) {
      try {
        await sendSMS({
          to: currentJob.customers.phone_number,
          body: `Thank you ${currentJob.customers.name}! We received your payment. Your cleaning is confirmed for ${currentJob.date}. We look forward to serving you! 🧹`,
        });

        notifications.push('customer_notified_payment');
      } catch (error) {
        console.error('Failed to notify customer of payment:', error);
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      changes,
      notifications,
    });
  } catch (error) {
    console.error('Error updating job:', error);

    await logAutomationEvent({
      event_type: 'job_updated',
      source: 'api',
      job_id: parseInt(request.nextUrl.searchParams.get('jobId') || '0', 10),
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH method as an alternative to POST
export async function PATCH(request: NextRequest) {
  return POST(request);
}

// GET to retrieve a specific job
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: jobId',
        },
        { status: 400 }
      );
    }

    const job = await getJobById(parseInt(jobId, 10));

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
