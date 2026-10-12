import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FormMessage } from '../components/FormMessage';
import { DateTimeField } from '../components/DateTimeField';
import { validateDateRange } from '../lib/dates';
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
      const startsAt = formText(form, 'startsAt');
      const endsAt = formText(form, 'endsAt');
      const dateError = validateDateRange(startsAt, endsAt);
      if (dateError) throw new Error(dateError);
      if (new Date(startsAt) < new Date())
        throw new Error('La actividad debe iniciar en el futuro.');
      const eventId = await createEvent({
        title: formText(form, 'title'),
        activityTitle: formText(form, 'activityTitle'),
        startsAt,
        endsAt,
        capacity: Number(form.get('capacity')),
        venueName: formText(form, 'venueName'),
        address: formText(form, 'address'),
        description: formText(form, 'description'),
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
      <p>El evento comienza con su primera actividad dentro de una sola línea de tiempo.</p>
      <form className="panel-form" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="title">Nombre del evento</label>
        <input id="title" name="title" required maxLength={160} placeholder="Boda de Ana y Luis" />
        <label htmlFor="activityTitle">Actividad principal</label>
        <input
          id="activityTitle"
          name="activityTitle"
          required
          maxLength={160}
          placeholder="Gathering, ceremonia o fiesta"
        />
        <DateTimeField name="startsAt" label="Inicio" required />
        <DateTimeField name="endsAt" label="Fin opcional" />
        <label htmlFor="venueName">Lugar</label>
        <input
          id="venueName"
          name="venueName"
          maxLength={200}
          placeholder="Puede definirse después"
        />
        <label htmlFor="address">Dirección</label>
        <input id="address" name="address" maxLength={500} />
        <label htmlFor="description">Descripción opcional</label>
        <textarea id="description" name="description" maxLength={2000} />
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
