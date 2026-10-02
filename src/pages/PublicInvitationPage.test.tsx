import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicInvitation, RsvpResponse } from '../lib/types';
import { PublicInvitationPage } from './PublicInvitationPage';

const mocks = vi.hoisted(() => ({
  getPublicInvitation: vi.fn<(token: string) => Promise<PublicInvitation | null>>(),
  submitRsvp:
    vi.fn<
      (
        token: string,
        responses: RsvpResponse[],
        idempotencyKey: string,
      ) => Promise<PublicInvitation | null>
    >(),
}));

vi.mock('../services/api', () => mocks);

const invitation: PublicInvitation = {
  event: {
    title: 'Boda de Ana y Luis',
    starts_at: '2027-06-12T18:00:00-06:00',
    timezone: 'America/Mexico_City',
    location_name: 'Jardín Central',
    content: {},
    template_id: 'basic',
    schedule: [],
  },
  party: { name: 'Familia García' },
  places: [
    {
      key: 'a0000000-0000-4000-8000-000000000001',
      name: 'Ana',
      status: 'pending',
      type: 'named_guest',
      companion_label: null,
      companion_of_key: null,
    },
    {
      key: 'a0000000-0000-4000-8000-000000000002',
      name: null,
      status: 'pending',
      type: 'named_guest',
      companion_label: null,
      companion_of_key: null,
    },
  ],
};

describe('PublicInvitationPage', () => {
  beforeEach(() => {
    mocks.getPublicInvitation.mockReset().mockResolvedValue(invitation);
    mocks.submitRsvp.mockReset().mockResolvedValue({
      ...invitation,
      places: [{ ...invitation.places[0], status: 'confirmed' }, invitation.places[1]],
    });
  });

  it('abre una invitación pública y envía sólo campos RSVP permitidos', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/i/token-seguro']}>
        <Routes>
          <Route path="/i/:token" element={<PublicInvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Familia García' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('radio', { name: 'Asistirá' })[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }));

    await waitFor(() => expect(mocks.submitRsvp).toHaveBeenCalledTimes(1));
    expect(mocks.submitRsvp.mock.calls[0][0]).toBe('token-seguro');
    expect(mocks.submitRsvp.mock.calls[0][1]).toEqual([
      {
        invitee_key: 'a0000000-0000-4000-8000-000000000001',
        status: 'confirmed',
      },
    ]);
    expect(mocks.submitRsvp.mock.calls[0][2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByRole('status')).toHaveTextContent('Tu respuesta quedó guardada');
  });

  it('muestra un estado neutro para token inválido o revocado', async () => {
    mocks.getPublicInvitation.mockResolvedValue(null);
    render(
      <MemoryRouter initialEntries={['/i/invalido']}>
        <Routes>
          <Route path="/i/:token" element={<PublicInvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Este enlace no está disponible' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Boda de Ana y Luis')).not.toBeInTheDocument();
  });
});
