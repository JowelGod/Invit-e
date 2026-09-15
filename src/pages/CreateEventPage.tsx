import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FormMessage } from '../components/FormMessage';
import { formText } from '../lib/forms';
import { createEvent } from '../services/api';

export function CreateEventPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const eventId = await createEvent({
        title: formText(form, 'title'),
        startsAt: formText(form, 'startsAt'),
        capacity: Number(form.get('capacity')),
        locationName: formText(form, 'locationName'),
      });
      void navigate(`/app/eventos/${eventId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear el evento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-page" aria-labelledby="new-event-title">
      <Link className="back-link" to="/app">
        ← Volver
      </Link>
      <p className="eyebrow">Nuevo evento</p>
      <h1 id="new-event-title">Datos esenciales</h1>
      <p>La invitación visual se definirá después. Por ahora establecemos capacidad y fecha.</p>
      <form className="panel-form" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="title">Nombre del evento</label>
        <input id="title" name="title" required maxLength={160} placeholder="Boda de Ana y Luis" />
        <label htmlFor="startsAt">Fecha y hora</label>
        <input id="startsAt" name="startsAt" type="datetime-local" required />
        <label htmlFor="locationName">Lugar</label>
        <input
          id="locationName"
          name="locationName"
          maxLength={200}
          placeholder="Puede definirse después"
        />
        <label htmlFor="capacity">Capacidad total</label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          min="1"
          max="10000"
          inputMode="numeric"
          required
        />
        <FormMessage error={error} />
        <div className="button-row">
          <button type="submit" disabled={busy}>
            {busy ? 'Creando…' : 'Crear evento'}
          </button>
          <Link className="button button--secondary" to="/app">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
