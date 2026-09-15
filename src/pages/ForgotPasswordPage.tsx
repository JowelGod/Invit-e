import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { FormMessage } from '../components/FormMessage';
import { formText } from '../lib/forms';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      await requestPasswordReset(formText(form, 'email'));
      setSuccess('Si existe una cuenta, recibirás instrucciones para restablecerla.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="forgot-title">
        <Link className="brand" to="/">
          Invitame
        </Link>
        <h1 id="forgot-title">Recupera tu acceso</h1>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <FormMessage error={error} success={success} />
          <button type="submit" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Volver al inicio de sesión</Link>
        </div>
      </section>
    </main>
  );
}
