import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResetPasswordPage } from './ResetPasswordPage';

const updatePassword = vi.fn();
const signOut = vi.fn();
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ updatePassword, signOut }),
}));

function LoginResult() {
  const location = useLocation();
  return <p>{(location.state as { message?: string } | null)?.message}</p>;
}

function renderFlow() {
  render(
    <MemoryRouter initialEntries={['/restablecer']}>
      <Routes>
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginResult />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('cambio y recuperación de contraseña', () => {
  beforeEach(() => {
    updatePassword.mockReset();
    signOut.mockReset();
    updatePassword.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
  });

  it('exige confirmación antes de enviar y mantiene los campos ante un fallo', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByLabelText('Contraseña', { exact: true }), 'Prueba2026!');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'Distinta2026!');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(updatePassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');

    updatePassword.mockRejectedValueOnce(new Error('Error de red'));
    await user.clear(screen.getByLabelText('Confirmar contraseña'));
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'Prueba2026!');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Error de red');
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveValue('Prueba2026!');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('cierra la sesión y regresa al login sólo después del cambio correcto', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByLabelText('Contraseña', { exact: true }), 'Prueba2026!');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'Prueba2026!');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(
      await screen.findByText('Contraseña actualizada. Inicia sesión de nuevo.'),
    ).toBeInTheDocument();
    expect(updatePassword).toHaveBeenCalledWith('Prueba2026!');
    expect(signOut).toHaveBeenCalledOnce();
  });
});
