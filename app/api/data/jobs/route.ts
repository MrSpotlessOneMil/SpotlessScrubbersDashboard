// GET /api/data/jobs - Retrieve jobs with filtering
// POST /api/data/jobs - Create a new job
// Replaces: Lindy "Add to Jobs" action and job queries

import { NextRequest, NextResponse } from 'next/server';
import { supabase, createJob, logAutomationEvent } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Build query based on filters
    let query: any = (supabase
      .from('jobs') as any)
      .select(`
        *,
        customers (
          id,
          name,
          phone_number,
          email,
          address,
          city,
          state,
          zip_code,
          square_footage,
          bedrooms,
          bathrooms
        )
      `);

    // Filter by status
    const status = searchParams.get('status');
    if (status) {
      const statuses = status.split(',');
      query = query.in('status', statuses);
    }

    // Filter by date range
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Filter by specific date
    const date = searchParams.get('date');
    if (date) {
      query = query.eq('date', date);
    }

    // Filter by customer
    const customerId = searchParams.get('customerId');
    if (customerId) {
      query = query.eq('customer_id', parseInt(customerId, 10));
    }

    // Filter by payment status
    const paid = searchParams.get('paid');
    if (paid !== null) {
      query = query.eq('paid', paid === 'true');
    }

    // Filter by booking status
    const booked = searchParams.get('booked');
    if (booked !== null) {
      query = query.eq('booked', booked === 'true');
    }

    // Filter by cleaning type
    const cleaningType = searchParams.get('cleaningType');
    if (cleaningType) {
      query = query.eq('cleaning_type', cleaningType);
    }

    // Filter for unassigned jobs (no cleaning team)
    const unassigned = searchParams.get('unassigned');
    if (unassigned === 'true') {
      query = query.or('cleaning_team.is.null,cleaning_team.eq.{}');
    }

    // Filter for jobs needing assignment (paid but no team)
    const needsAssignment = searchParams.get('needsAssignment');
    if (needsAssignment === 'true') {
      query = query.eq('paid', true).or('cleaning_team.is.null,cleaning_team.eq.{}');
    }

    // Limit results
    const limit = searchParams.get('limit');
    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }

    // Sort order
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data: jobs, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      count: jobs?.length || 0,
      filters: {
        status,
        startDate,
        endDate,
        date,
        customerId,
        paid,
        booked,
        cleaningType,
        unassigned,
        needsAssignment,
      },
      jobs: jobs || [],
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.customer_id || !body.title || !body.date) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: customer_id, title, date',
        },
        { status: 400 }
      );
    }

    // Create the job
    const job = await createJob({
      customer_id: body.customer_id,
      title: body.title,
      date: body.date,
      scheduled_at: body.scheduled_at,
      cleaning_type: body.cleaning_type,
      status: body.status || 'lead',
      price: body.price,
      quote_amount: body.quote_amount,
      hours: body.hours,
      notes: body.notes,
      special_instructions: body.special_instructions,
    });

    // Log the creation
    await logAutomationEvent({
      event_type: 'job_created',
      source: 'api',
      customer_id: body.customer_id,
      job_id: job.id,
      payload: body,
      result: { jobId: job.id },
      success: true,
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Error creating job:', error);

    await logAutomationEvent({
      event_type: 'job_created',
      source: 'api',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
