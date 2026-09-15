import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { FormMessage } from '../components/FormMessage';
import { formText } from '../lib/forms';

export function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await signIn(formText(form, 'email'), formText(form, 'password'));
      const state = location.state as { from?: string } | null;
      void navigate(state?.from || '/app', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="brand" to="/">
          Invitame
        </Link>
        <h1 id="login-title">Inicia sesión</h1>
        <p>Administra eventos, lugares y respuestas desde un solo espacio.</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <FormMessage error={error} />
          <button type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/recuperar">Olvidé mi contraseña</Link>
          <Link to="/registro">Crear cuenta</Link>
        </div>
      </section>
    </main>
  );
}
