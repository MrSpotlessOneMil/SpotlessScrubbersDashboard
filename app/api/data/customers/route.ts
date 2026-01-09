// GET /api/data/customers - Retrieve customer data with full context
// POST /api/data/customers - Create or update customer
// Replaces: Lindy customer data queries

import { NextRequest, NextResponse } from 'next/server';
import {
  supabase,
  getCustomerByPhone,
  upsertCustomer,
  getCustomerContext,
  logAutomationEvent,
} from '@/lib/supabase';
import { normalizePhoneNumber } from '@/lib/integrations/openphone';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get specific customer by ID with full context
    const customerId = searchParams.get('id');
    if (customerId) {
      const context = await getCustomerContext(parseInt(customerId, 10));

      if (!context.customer) {
        return NextResponse.json(
          {
            success: false,
            error: 'Customer not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        customer: context.customer,
        jobs: context.jobs,
        calls: context.calls,
        messages: context.messages,
        messageHistory: formatMessageHistory(context.messages),
      });
    }

    // Get customer by phone number with full context
    const phone = searchParams.get('phone');
    if (phone) {
      const normalizedPhone = normalizePhoneNumber(phone);
      const customer = await getCustomerByPhone(normalizedPhone);

      if (!customer) {
        return NextResponse.json(
          {
            success: false,
            error: 'Customer not found',
          },
          { status: 404 }
        );
      }

      const context = await getCustomerContext(customer.id);

      return NextResponse.json({
        success: true,
        customer: context.customer,
        jobs: context.jobs,
        calls: context.calls,
        messages: context.messages,
        messageHistory: formatMessageHistory(context.messages),
      });
    }

    // List all customers with optional filters
    let query = supabase.from('customers').select('*');

    // Filter by source
    const source = searchParams.get('source');
    if (source) {
      query = query.eq('source', source);
    }

    // Search by name or phone
    const search = searchParams.get('search');
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    // Filter by frequency
    const frequency = searchParams.get('frequency');
    if (frequency) {
      query = query.eq('frequency', frequency);
    }

    // Limit results
    const limit = searchParams.get('limit');
    if (limit) {
      query = query.limit(parseInt(limit, 10));
    } else {
      query = query.limit(100); // Default limit
    }

    // Sort order
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data: customers, error } = await query;

    if (error) {
      throw error;
    }

    // Optionally include job counts
    const includeStats = searchParams.get('includeStats') === 'true';
    if (includeStats && customers) {
      const customersWithStats = await Promise.all(
        customers.map(async (customer) => {
          const { data: jobs } = await supabase
            .from('jobs')
            .select('id, status, paid')
            .eq('customer_id', customer.id);

          return {
            ...customer,
            totalJobs: jobs?.length || 0,
            completedJobs: jobs?.filter((j) => j.status === 'completed').length || 0,
            paidJobs: jobs?.filter((j) => j.paid).length || 0,
          };
        })
      );

      return NextResponse.json({
        success: true,
        count: customersWithStats.length,
        customers: customersWithStats,
      });
    }

    return NextResponse.json({
      success: true,
      count: customers?.length || 0,
      customers: customers || [],
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customers',
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
    if (!body.phone_number || !body.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: phone_number, name',
        },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(body.phone_number);

    // Create or update customer
    const customer = await upsertCustomer({
      phone_number: normalizedPhone,
      name: body.name,
      email: body.email,
      address: body.address,
      city: body.city,
      state: body.state,
      zip_code: body.zip_code,
      square_footage: body.square_footage,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      pets: body.pets,
      frequency: body.frequency,
      source: body.source || 'api',
      notes: body.notes,
    });

    // Log the creation/update
    await logAutomationEvent({
      event_type: 'customer_updated',
      source: 'api',
      customer_id: customer.id,
      payload: body,
      result: { customerId: customer.id },
      success: true,
    });

    return NextResponse.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error('Error creating/updating customer:', error);

    await logAutomationEvent({
      event_type: 'customer_updated',
      source: 'api',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create/update customer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to format message history as conversation
function formatMessageHistory(
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    direction?: string | null;
  }>
): string {
  if (!messages || messages.length === 0) {
    return 'No previous messages';
  }

  // Sort by timestamp (oldest first for conversation flow)
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sorted
    .map((msg) => {
      const date = new Date(msg.timestamp).toLocaleString();
      const sender =
        msg.role === 'client'
          ? 'Customer'
          : msg.role === 'business'
          ? 'Business'
          : 'Bot';
      return `[${date}] ${sender}: ${msg.content}`;
    })
    .join('\n');
}
