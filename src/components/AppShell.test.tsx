import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { AppShell } from './AppShell';

function renderShell() {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const auth = {
    user: { email: 'maya@example.test' },
    session: null,
    loading: false,
    signOut,
  } as unknown as AuthContextValue;
  render(
    <MemoryRouter initialEntries={['/app']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<p>Contenido</p>} />
            <Route path="cuenta" element={<p>Página de cuenta</p>} />
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { signOut };
}

describe('cabecera y menú de perfil', () => {
  it('expone las opciones y cierra el menú con Escape devolviendo el foco', async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Abrir menú de perfil' });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.getByText('Cartera')).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('cierra el menú al navegar a Cuenta', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Abrir menú de perfil' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cuenta' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText('Página de cuenta')).toBeInTheDocument();
  });
});
