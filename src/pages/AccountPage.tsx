import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function AccountPage() {
  const { user } = useAuth();
  const fullName = String(user?.user_metadata?.full_name || 'Sin nombre configurado');
  return (
    <section className="form-page" aria-labelledby="account-title">
      <Link className="back-link" to="/app">
        ← Mis eventos
      </Link>
      <p className="eyebrow">Perfil</p>
      <h1 id="account-title">Cuenta</h1>
      <dl className="account-details">
        <div>
          <dt>Nombre</dt>
          <dd>{fullName}</dd>
        </div>
        <div>
          <dt>Correo de acceso</dt>
          <dd>{user?.email || 'No disponible'}</dd>
        </div>
      </dl>
      <p className="form-hint">La información se muestra sólo dentro de esta página protegida.</p>
    </section>
  );
}
