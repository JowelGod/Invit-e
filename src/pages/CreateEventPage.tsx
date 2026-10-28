import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { InvitationTemplate } from '../components/InvitationTemplate';
import { FormMessage } from '../components/FormMessage';
import { DateTimeField } from '../components/DateTimeField';
import { validateDateRange } from '../lib/dates';
import { formText } from '../lib/forms';
import { createEvent } from '../services/api';

export function CreateEventPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState({
    title: '',
    activity: '',
    startsAt: '',
    address: '',
    description: '',
  });

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
        venueName: '',
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
      <div className="event-create-layout">
        <aside className="editor-preview" aria-label="Vista previa general del evento">
          <InvitationTemplate
            title={preview.title || 'Nombre del evento'}
            timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
            partyTitle="Vista previa del evento"
            places={[]}
            schedule={
              preview.startsAt && !Number.isNaN(new Date(preview.startsAt).getTime())
                ? [
                    {
                      title: preview.activity || 'Actividad principal',
                      description: preview.description || null,
                      starts_at: new Date(preview.startsAt).toISOString(),
                      ends_at: null,
                      venue_name: null,
                      address: preview.address || null,
                      place_id: null,
                      latitude: null,
                      longitude: null,
                    },
                  ]
                : []
            }
          />
        </aside>
        <form className="panel-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="title">Nombre del evento</label>
          <input
            id="title"
            name="title"
            required
            maxLength={160}
            onChange={(event) =>
              setPreview((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Boda de Ana y Luis"
          />
          <label htmlFor="activityTitle">Actividad principal</label>
          <input
            id="activityTitle"
            name="activityTitle"
            onChange={(event) =>
              setPreview((current) => ({ ...current, activity: event.target.value }))
            }
            required
            maxLength={160}
            placeholder="Gathering, ceremonia o fiesta"
          />
          <DateTimeField
            name="startsAt"
            label="Inicio"
            required
            onValueChange={(value) => setPreview((current) => ({ ...current, startsAt: value }))}
          />
          <DateTimeField name="endsAt" label="Fin opcional" />
          <label htmlFor="address">Dirección</label>
          <input
            id="address"
            name="address"
            maxLength={500}
            onChange={(event) =>
              setPreview((current) => ({ ...current, address: event.target.value }))
            }
          />
          <label htmlFor="description">Descripción opcional</label>
          <textarea
            id="description"
            name="description"
            maxLength={2000}
            onChange={(event) =>
              setPreview((current) => ({ ...current, description: event.target.value }))
            }
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
      </div>
    </section>
  );
}
