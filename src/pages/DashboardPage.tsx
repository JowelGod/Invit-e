import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { CapacityGrid } from '../components/CapacityGrid';
import { formatDateTime } from '../lib/dates';
import type { EventRecord } from '../lib/types';
import { listEvents } from '../services/api';

export function DashboardPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void listEvents()
      .then((result) => active && setEvents(result))
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Error inesperado.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Panel</p>
          <h1 id="dashboard-title">Tus eventos</h1>
        </div>
        <Link className="button" to="/app/eventos/nuevo">
          Crear evento
        </Link>
      </div>
      {loading && (
        <p className="centered-state" role="status">
          Cargando eventos…
        </p>
      )}
      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="empty-state">
          <h2>Aún no hay eventos</h2>
          <p>Crea el primero para comenzar a asignar lugares e invitaciones.</p>
          <Link className="button" to="/app/eventos/nuevo">
            Crear mi primer evento
          </Link>
        </div>
      )}
      <div className="event-list">
        {events.map((event) => (
          <article className="event-card" key={event.id}>
            <div>
              <p className="eyebrow">{formatDateTime(event.starts_at, event.timezone)}</p>
              <h2>
                <Link to={`/app/eventos/${event.id}`}>{event.title}</Link>
              </h2>
              <p>
                {event.location_name || 'Ubicación por definir'} ·{' '}
                {event.status === 'published'
                  ? 'Publicado'
                  : event.status === 'archived'
                    ? 'Archivado'
                    : 'Borrador'}
              </p>
            </div>
            {event.summary && <CapacityGrid summary={event.summary} />}
          </article>
        ))}
      </div>
    </section>
  );
}
