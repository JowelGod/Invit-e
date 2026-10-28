import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { FormMessage } from '../components/FormMessage';
import { formText } from '../lib/forms';

export function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = formText(form, 'password');
    if (password !== formText(form, 'confirmPassword')) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('Usa al menos 8 caracteres.');
      return;
    }
    try {
      await updatePassword(password);
      await signOut();
      void navigate('/login', {
        replace: true,
        state: { message: 'Contraseña actualizada. Inicia sesión de nuevo.' },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizarla.');
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="reset-title">
        <Link className="brand" to="/">
          Invitara
        </Link>
        <h1 id="reset-title">Define una contraseña nueva</h1>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <label htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FormMessage error={error} />
          <button type="submit">Guardar contraseña</button>
        </form>
        <div className="auth-links">
          <Link to="/app">Continuar</Link>
        </div>
      </section>
    </main>
  );
}
