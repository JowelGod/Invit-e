import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FormMessage } from '../components/FormMessage';
import type { TrashedEvent } from '../lib/types';
import { listTrashedEvents, purgeTrashedEvent, restoreTrashedEvent } from '../services/api';

function daysRemaining(value: string): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export function TrashPage() {
  const [events, setEvents] = useState<TrashedEvent[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let active = true;
    void listTrashedEvents()
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : 'No se pudo cargar la papelera.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function restore(event: TrashedEvent) {
    setBusy(event.id);
    setError('');
    try {
      await restoreTrashedEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setMessage('Evento restaurado. Sus enlaces anteriores permanecen revocados por seguridad.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo restaurar.');
    } finally {
      setBusy('');
    }
  }

  async function purge(event: TrashedEvent) {
    const title = window.prompt(
      `Escribe exactamente “${event.title}” para eliminarlo definitivamente.`,
    );
    if (title !== event.title) return;
    setBusy(event.id);
    setError('');
    try {
      await purgeTrashedEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setMessage('El evento fue eliminado definitivamente.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar definitivamente.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section aria-labelledby="trash-title">
      <Link className="back-link" to="/app">
        ← Mis eventos
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Retención de 30 días</p>
          <h1 id="trash-title">Papelera</h1>
        </div>
      </div>
      <FormMessage error={error} success={message} />
      {events.length === 0 && <p className="empty-copy">La papelera está vacía.</p>}
      <div className="event-list">
        {events.map((event) => {
          const days = daysRemaining(event.purge_after);
          return (
            <article className="event-card trash-card" key={event.id}>
              <div>
                <h2>{event.title}</h2>
                <p>
                  {days
                    ? `${days} días para ser elegible para purga`
                    : 'Ya es elegible para eliminación definitiva'}
                </p>
              </div>
              <div className="button-row">
                <button
                  className="button--secondary"
                  disabled={busy === event.id}
                  onClick={() => void restore(event)}
                >
                  Restaurar
                </button>
                <button
                  className="button--danger"
                  disabled={busy === event.id || days > 0}
                  onClick={() => void purge(event)}
                >
                  Eliminar definitivamente
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
