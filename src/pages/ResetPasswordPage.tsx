import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { FormMessage } from '../components/FormMessage';
import { formText } from '../lib/forms';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = formText(form, 'password');
    if (password.length < 8) {
      setError('Usa al menos 8 caracteres.');
      return;
    }
    try {
      await updatePassword(password);
      setError('');
      setSuccess('Contraseña actualizada. Ya puedes continuar.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizarla.');
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="reset-title">
        <Link className="brand" to="/">
          Invitame
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
          <FormMessage error={error} success={success} />
          <button type="submit">Guardar contraseña</button>
        </form>
        <div className="auth-links">
          <Link to="/app">Continuar</Link>
        </div>
      </section>
    </main>
  );
}
