import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function AppShell() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

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
          <button className="text-button" type="button" onClick={() => void handleSignOut()}>
            Salir
          </button>
        </nav>
      </header>
      <main className="app-main">
        <p className="account-label">{user?.email}</p>
        <Outlet />
      </main>
    </div>
  );
}
