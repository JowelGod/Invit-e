import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GuestPartyForm, type PartyFormValue } from './GuestPartyForm';

describe('formulario de invitados y contactos', () => {
  it('permite escribir, editar y borrar contactos sin perderlos al agregar boletos', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GuestPartyForm busy={false} submitLabel="Guardar invitación" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Título de la invitación'), 'Amigos');
    await user.type(screen.getByLabelText(/Invitado 1/), 'Maya');
    await user.click(screen.getByRole('button', { name: '+ Email' }));
    const email = screen.getByLabelText('Email de Maya');
    await user.type(email, 'maya@example.test');
    await user.clear(email);
    await user.type(email, 'maya.nueva@example.test');
    await user.click(screen.getByRole('button', { name: '+ Teléfono' }));
    const phone = screen.getByLabelText('Teléfono de Maya');
    await user.type(phone, '+52 55 1234 5678');
    await user.click(screen.getByRole('button', { name: 'Agregar invitado' }));
    expect(email).toHaveValue('maya.nueva@example.test');
    expect(phone).toHaveValue('+52 55 1234 5678');
    await user.click(screen.getByRole('button', { name: 'Agregar boleto extra' }));
    expect(screen.getByText('Invitado adicional 1')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Email de Invitado adicional/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Invitado 2/), 'Ivanna');
    await user.click(screen.getByRole('button', { name: 'Guardar invitación' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const submitted = onSubmit.mock.calls[0][0] as PartyFormValue;
    expect(submitted.name).toBe('Amigos');
    expect(submitted.invitees[0]).toMatchObject({
      display_name: 'Maya',
      contacts: [
        { kind: 'email', value: 'maya.nueva@example.test' },
        { kind: 'phone', value: '+52 55 1234 5678' },
      ],
    });
  });

  it('muestra validación real y no anuncia éxito cuando falla el guardado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('RPC falló'));
    render(<GuestPartyForm busy={false} submitLabel="Guardar invitación" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Título de la invitación'), 'Individual');
    await user.type(screen.getByLabelText(/Invitado 1/), 'Maya');
    await user.click(screen.getByRole('button', { name: '+ Email' }));
    await user.type(screen.getByLabelText('Email de Maya'), 'maya@example.test');
    await user.click(screen.getByRole('button', { name: 'Guardar invitación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('RPC falló');
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
