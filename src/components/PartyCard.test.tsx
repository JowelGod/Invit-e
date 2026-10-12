import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GuestPartyRecord } from '../lib/types';
import { PartyCard } from './PartyCard';

const party: GuestPartyRecord = {
  id: 'party-1',
  name: 'Amigos cercanos',
  primary_contact_name: '',
  contact_email: null,
  contact_phone: null,
  assigned_capacity: 1,
  created_at: '2026-10-12T00:00:00Z',
  has_active_link: true,
  recipients: [
    {
      id: 'contact-1',
      invitee_id: 'invitee-1',
      kind: 'email',
      value: 'maya@example.test',
    },
  ],
  invitees: [
    {
      id: 'invitee-1',
      public_key: 'public-1',
      display_name: 'Maya',
      response: 'pending',
      responded_at: null,
      invitee_type: 'named_guest',
      companion_of_invitee_id: null,
      companion_label: null,
      display_order: 0,
      retired_at: null,
      created_at: '2026-10-12T00:00:00Z',
    },
  ],
};

describe('tarjeta de invitación', () => {
  it('oculta controles de edición hasta pulsar Editar y permite cancelar', async () => {
    const user = userEvent.setup();
    render(
      <PartyCard
        eventId="event-1"
        party={party}
        disabled={false}
        onChanged={vi.fn().mockResolvedValue(undefined)}
        onError={vi.fn()}
        onSuccess={vi.fn()}
        eventPreview={{ title: 'Evento', timezone: 'America/Mexico_City', schedule: [] }}
      />,
    );
    await user.click(screen.getByText('Amigos cercanos'));
    expect(screen.queryByLabelText('Título de la invitación')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contactos' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Título de la invitación')).toHaveValue('Amigos cercanos');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Título de la invitación')).not.toBeInTheDocument();
  });
});
