// GET /api/data/cleaners - Retrieve all cleaners and their availability
// Replaces: Lindy requests for cleaner availability

import { NextRequest, NextResponse } from 'next/server';
import { supabase, getActiveCleaners, getCleanerBlockedDates } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Get cleaners based on active status
    const query = supabase
      .from('cleaners')
      .select('*')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query.eq('active', true);
    }

    const { data: cleaners, error } = await query;

    if (error) {
      throw error;
    }

    // If date range provided, get blocked dates and assignments for each cleaner
    if (startDate && endDate && cleaners && cleaners.length > 0) {
      const cleanersWithAvailability = await Promise.all(
        cleaners.map(async (cleaner: any) => {
          // Get blocked dates
          const blockedDates: any[] = await getCleanerBlockedDates(
            cleaner.id,
            startDate,
            endDate
          );

          // Get existing job assignments in date range
          const { data: assignments } = await supabase
            .from('cleaner_assignments')
            .select(`
              *,
              jobs (
                id,
                date,
                scheduled_at,
                end_time,
                status,
                title
              )
            `)
            .eq('cleaner_id', cleaner.id)
            .gte('jobs.date', startDate)
            .lte('jobs.date', endDate)
            .in('status', ['accepted', 'confirmed']);

          return {
            ...cleaner,
            blockedDates: blockedDates.map((bd: any) => bd.date),
            assignments: assignments || [],
            availableDates: calculateAvailableDates(
              startDate,
              endDate,
              blockedDates.map((bd: any) => bd.date),
              assignments || []
            ),
          };
        })
      );

      return NextResponse.json({
        success: true,
        count: cleanersWithAvailability.length,
        dateRange: { startDate, endDate },
        cleaners: cleanersWithAvailability,
      });
    }

    // Return basic cleaner list without availability
    return NextResponse.json({
      success: true,
      count: cleaners?.length || 0,
      cleaners: cleaners || [],
    });
  } catch (error) {
    console.error('Error fetching cleaners:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cleaners',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate available dates for a cleaner
function calculateAvailableDates(
  startDate: string,
  endDate: string,
  blockedDates: string[],
  assignments: any[]
): string[] {
  const available: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];

    // Check if date is blocked
    if (blockedDates.includes(dateStr)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Check if cleaner has assignments on this date
    const hasAssignment = assignments.some(
      (a) => a.jobs?.date === dateStr
    );

    if (!hasAssignment) {
      available.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return available;
}

// POST /api/data/cleaners - Create or update cleaner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('cleaners')
      .upsert({
        name: body.name,
        phone: body.phone,
        email: body.email,
        telegram_id: body.telegram_id,
        telegram_username: body.telegram_username,
        active: body.active ?? true,
        skills: body.skills || [],
        hourly_rate: body.hourly_rate,
        max_hours_per_day: body.max_hours_per_day || 8,
        preferred_areas: body.preferred_areas || [],
        notes: body.notes,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      cleaner: data,
    });
  } catch (error) {
    console.error('Error creating/updating cleaner:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create/update cleaner',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
