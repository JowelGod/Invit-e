import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventDetail, GuestPartyRecord } from '../lib/types';
import type { SaveGuestPartyInput } from '../services/api';
import { EventDetailPage } from './EventDetailPage';

const { getEventDetail, saveGuestParty } = vi.hoisted(() => ({
  getEventDetail: vi.fn<() => Promise<EventDetail>>(),
  saveGuestParty:
    vi.fn<(input: SaveGuestPartyInput) => Promise<{ partyId: string; link: string }>>(),
}));
vi.mock('../services/api', () => ({
  getEventDetail,
  saveGuestParty,
  subscribeToEvent: () => ({}),
}));
vi.mock('../lib/supabase', () => ({ supabase: { removeChannel: vi.fn() } }));

const detail: EventDetail = {
  event: {
    id: 'event-1',
    title: 'Evento de prueba',
    starts_at: '2027-06-12T19:30:00Z',
    timezone: 'UTC',
    location_name: null,
    capacity: 10,
    status: 'draft',
    template_id: 'default',
    published_at: null,
    archived_at: null,
    deleted_at: null,
  },
  parties: [],
  schedule: [],
  summary: {
    capacity: 10,
    assigned: 0,
    unassigned: 10,
    pending: 0,
    confirmed: 0,
    rejected: 0,
    available_to_reassign: 10,
    response_percentage: 0,
  },
};

describe('creación consecutiva de invitaciones', () => {
  beforeEach(() => {
    detail.parties = [];
    getEventDetail
      .mockReset()
      .mockImplementation(() => Promise.resolve({ ...detail, parties: [...detail.parties] }));
    saveGuestParty.mockReset().mockImplementation(({ name, invitees }) => {
      const id = `party-${detail.parties.length + 1}`;
      const party: GuestPartyRecord = {
        id,
        name,
        primary_contact_name: '',
        contact_email: null,
        contact_phone: null,
        assigned_capacity: invitees.length,
        created_at: '2026-10-28T00:00:00Z',
        has_active_link: true,
        recipients: invitees.flatMap((invitee) =>
          invitee.contacts.map((contact, index) => ({
            id: `${id}-contact-${index}`,
            invitee_id: `${id}-invitee`,
            ...contact,
          })),
        ),
        invitees: invitees.map((invitee, index) => ({
          id: `${id}-invitee`,
          public_key: `${id}-key-${index}`,
          display_name: invitee.display_name,
          response: 'pending' as const,
          responded_at: null,
          invitee_type: 'named_guest' as const,
          companion_of_invitee_id: null,
          companion_label: null,
          display_order: index,
          retired_at: null,
          created_at: '2026-10-28T00:00:00Z',
        })),
      };
      detail.parties.push(party);
      return Promise.resolve({ partyId: id, link: `http://localhost:5173/i/token-${id}` });
    });
  });

  it('limpia el borrador y conserva un enlace distinto en cada tarjeta guardada', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/app/eventos/event-1']}>
        <Routes>
          <Route path="/app/eventos/:eventId" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Evento de prueba', level: 1 });
    await user.click(screen.getByText('Agregar invitados'));

    for (const number of [1, 2, 3]) {
      await user.type(
        screen.getByRole('textbox', { name: 'Título de la invitación' }),
        `Grupo ${number}`,
      );
      await user.type(screen.getByRole('textbox', { name: 'Invitado 1' }), `Persona ${number}`);
      await user.click(screen.getByRole('button', { name: '+ Email' }));
      await user.type(
        screen.getByRole('textbox', { name: `Email de Persona ${number}` }),
        `persona${number}@example.test`,
      );
      await user.click(screen.getByRole('button', { name: 'Guardar invitación' }));
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Título de la invitación' })).toHaveValue(''),
      );
      expect(container.querySelector('.new-party-panel .generated-link')).toBeNull();
    }

    expect(saveGuestParty).toHaveBeenCalledTimes(3);
    expect(saveGuestParty.mock.calls.every(([value]) => value.partyId === null)).toBe(true);
    for (const number of [1, 2, 3]) {
      const card = screen
        .getByText(`Grupo ${number}`, { selector: '.party-card summary strong' })
        .closest<HTMLElement>('.party-card')!;
      await user.click(within(card).getByText(`Grupo ${number}`));
      expect(within(card).getByText(`Persona ${number}`)).toBeInTheDocument();
      expect(within(card).getByRole('textbox', { name: 'Enlace nuevo' })).toHaveValue(
        `http://localhost:5173/i/token-party-${number}`,
      );
    }
  });
});
