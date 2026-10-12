import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function AppShell() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = (user?.email?.trim().charAt(0) || 'U').toUpperCase();

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    void navigate('/login');
  }

  const context = location.pathname.includes('/papelera')
    ? 'Papelera'
    : location.pathname.includes('/cuenta')
      ? 'Cuenta'
      : location.pathname.includes('/eventos/nuevo')
        ? 'Nuevo evento'
        : location.pathname.includes('/eventos/')
          ? 'Editor del evento'
          : 'Mis eventos';

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" to="/app" aria-label="Invitame, ir al inicio">
          Invitame
        </Link>
        <strong className="header-context">{context}</strong>
        <nav aria-label="Navegación principal">
          <NavLink className="desktop-only" to="/app" end>
            Eventos
          </NavLink>
          <div className="account-menu" ref={menuRef}>
            <button
              className="avatar-button"
              type="button"
              aria-label="Abrir menú de perfil"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {initial}
            </button>
            {open && (
              <div className="account-popover" role="menu">
                <NavLink role="menuitem" to="/app/cuenta" onClick={() => setOpen(false)}>
                  Cuenta
                </NavLink>
                <NavLink role="menuitem" to="/app" end onClick={() => setOpen(false)}>
                  Mis eventos
                </NavLink>
                <span role="menuitem" aria-disabled="true">
                  Cartera <small>Próximamente</small>
                </span>
                <span role="menuitem" aria-disabled="true">
                  Métodos de pago <small>Próximamente</small>
                </span>
                <button
                  className="text-button"
                  role="menuitem"
                  type="button"
                  onClick={() => void handleSignOut()}
                >
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
