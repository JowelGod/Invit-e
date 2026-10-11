import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function AppShell() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initial = (user?.email?.trim().charAt(0) || 'U').toUpperCase();

  async function handleSignOut() {
    await signOut();
    void navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" to="/app">
          Invitame
        </Link>
        <nav aria-label="Navegación principal">
          <NavLink to="/app" end>
            Eventos
          </NavLink>
          <div className="account-menu">
            <button
              className="avatar-button"
              type="button"
              aria-label="Abrir menú de cuenta"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {initial}
            </button>
            {open && (
              <div className="account-popover">
                <p>Cuenta</p>
                <small>{user?.email}</small>
                <button className="text-button" type="button" onClick={() => void handleSignOut()}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
