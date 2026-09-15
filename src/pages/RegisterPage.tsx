import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { FormMessage } from '../components/FormMessage';
import { formText } from '../lib/forms';

export function RegisterPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const form = new FormData(event.currentTarget);
    const password = formText(form, 'password');
    if (password.length < 8) {
      setError('Usa al menos 8 caracteres.');
      setBusy(false);
      return;
    }
    try {
      const hasSession = await signUp(
        formText(form, 'fullName'),
        formText(form, 'email'),
        password,
      );
      if (hasSession) void navigate('/app', { replace: true });
      else setSuccess('Revisa tu correo para confirmar la cuenta.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="register-title">
        <Link className="brand" to="/">
          Invitame
        </Link>
        <h1 id="register-title">Crea tu cuenta</h1>
        <p>Al registrarte se crea un espacio personal aislado para tus eventos.</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="fullName">Nombre</label>
          <input id="fullName" name="fullName" autoComplete="name" required maxLength={120} />
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <FormMessage error={error} success={success} />
          <button type="submit" disabled={busy}>
            {busy ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Ya tengo cuenta</Link>
        </div>
      </section>
    </main>
  );
}
