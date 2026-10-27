import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../lib/database.types';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: createClient<Database>('http://127.0.0.1:54321', 'local-test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: request },
  }),
}));

import { getEventDetail } from './api';

afterEach(() => vi.resetAllMocks());

describe('getEventDetail PostgREST queries', () => {
  it('loads guests in manual order and activities chronologically using their own columns', async () => {
    const urls: URL[] = [];
    request.mockImplementation((input: string) => {
      const url = new URL(input);
      urls.push(url);
      const table = url.pathname.split('/').at(-1);
      const rows: Record<string, unknown> = {
        events: { id: 'event-1', title: 'Local event' },
        guest_parties: [{ id: 'party-1', name: 'Family' }],
        invitees: [{ id: 'guest-1', guest_party_id: 'party-1', display_order: 0 }],
        event_schedule_items: [{ id: 'activity-1', starts_at: '2027-01-01T12:00:00Z' }],
        event_capacity_summary: { capacity: 10 },
        get_event_delivery_state: [],
      };
      if (table === 'invitees' && url.searchParams.get('order')?.includes('starts_at')) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'column invitees.starts_at does not exist' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(rows[table!]), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const detail = await getEventDetail('event-1');
    const query = (table: string) => urls.find((url) => url.pathname.endsWith(`/${table}`))!;
    expect(query('invitees').searchParams.get('order')).toBe('display_order.asc');
    expect(query('event_schedule_items').searchParams.get('order')).toBe('starts_at.asc');
    expect(query('invitees').searchParams.get('retired_at')).toBe('is.null');
    expect(query('event_schedule_items').searchParams.get('removed_at')).toBe('is.null');
    expect(detail.parties[0].invitees[0].id).toBe('guest-1');
    expect(detail.schedule[0].id).toBe('activity-1');
  });

  it('surfaces database errors instead of presenting an empty editor', async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ message: 'database unavailable' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(getEventDetail('event-1')).rejects.toThrow('database unavailable');
  });
});
