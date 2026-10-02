import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { CapacityGrid } from '../components/CapacityGrid';
import { FormMessage } from '../components/FormMessage';
import { PartyCard } from '../components/PartyCard';
import { ScheduleManager } from '../components/ScheduleManager';
import { filterParties, type PartyFilter } from '../lib/admin';
import { formatDateTime, toDateTimeLocal } from '../lib/dates';
import { formText } from '../lib/forms';
import { supabase } from '../lib/supabase';
import type { EventDetail, EventStatus } from '../lib/types';
import {
  changeEventStatus,
  createGuestParty,
  getEventDetail,
  subscribeToEvent,
  updateEvent,
} from '../services/api';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PartyFilter>('all');

  const load = useCallback(async () => {
    try {
      setDetail(await getEventDetail(eventId));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar el evento.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    let active = true;
    void getEventDetail(eventId)
      .then((result) => {
        if (active) {
          setDetail(result);
          setError('');
        }
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : 'No fue posible cargar el evento.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const channel = subscribeToEvent(eventId, () => void load());
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  const visibleParties = useMemo(
    () => filterParties(detail?.parties || [], query, filter),
    [detail?.parties, query, filter],
  );

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar los cambios.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    const names = formText(form, 'names')
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);
    await run(
      () =>
        createGuestParty({
          eventId,
          name: formText(form, 'partyName'),
          primaryContactName: formText(form, 'primaryContactName'),
          contactEmail: formText(form, 'contactEmail'),
          contactPhone: formText(form, 'contactPhone'),
          assignedCapacity: Number(form.get('places')),
          inviteeNames: names,
        }),
      'Grupo agregado.',
    );
    target.reset();
  }

  async function handleEventUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        updateEvent({
          eventId,
          title: formText(form, 'title'),
          startsAt: formText(form, 'startsAt'),
          capacity: Number(form.get('capacity')),
          locationName: formText(form, 'locationName'),
          timezone: formText(form, 'timezone'),
        }),
      'Evento actualizado.',
    );
  }

  async function setStatus(status: EventStatus) {
    if (status === 'archived' && !window.confirm('¿Archivar este evento? No se podrá reactivar.'))
      return;
    await run(() => changeEventStatus(eventId, status), 'Estado actualizado.');
  }

  if (loading)
    return (
      <p className="centered-state" role="status">
        Cargando evento…
      </p>
    );
  if (!detail)
    return (
      <p className="message message--error" role="alert">
        {error || 'Evento no encontrado.'}
      </p>
    );

  const archived = detail.event.status === 'archived';

  return (
    <section aria-labelledby="event-title">
      <Link className="back-link" to="/app">
        ← Todos los eventos
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{formatDateTime(detail.event.starts_at, detail.event.timezone)}</p>
          <h1 id="event-title">{detail.event.title}</h1>
          <p>
            {detail.event.location_name || 'Ubicación por definir'} · Estado:{' '}
            {statusLabel(detail.event.status)}
          </p>
        </div>
        {!archived && (
          <div className="button-row">
            {detail.event.status === 'draft' ? (
              <button disabled={busy} onClick={() => void setStatus('published')}>
                Publicar
              </button>
            ) : (
              <button
                className="button--secondary"
                disabled={busy}
                onClick={() => void setStatus('draft')}
              >
                Volver a borrador
              </button>
            )}
            <button
              className="button--danger"
              disabled={busy}
              onClick={() => void setStatus('archived')}
            >
              Archivar
            </button>
          </div>
        )}
      </div>
      <FormMessage error={error} success={message} />
      {archived && (
        <p className="message archive-notice">
          Este evento está archivado. Sus enlaces públicos ya no muestran ni aceptan respuestas.
        </p>
      )}
      <CapacityGrid summary={detail.summary} />

      <div className="beta-sections">
        <details className="content-section">
          <summary>Configuración del evento</summary>
          <form
            className="stack-form inline-form"
            onSubmit={(event) => void handleEventUpdate(event)}
          >
            <label>
              Nombre
              <input name="title" required maxLength={160} defaultValue={detail.event.title} />
            </label>
            <div className="field-grid">
              <label>
                Fecha y hora
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={toDateTimeLocal(detail.event.starts_at)}
                />
              </label>
              <label>
                Capacidad total
                <input
                  name="capacity"
                  type="number"
                  min={1}
                  max={10000}
                  required
                  defaultValue={detail.event.capacity}
                />
              </label>
            </div>
            <label>
              Ubicación general
              <input
                name="locationName"
                maxLength={200}
                defaultValue={detail.event.location_name || ''}
              />
            </label>
            <label>
              Zona horaria IANA
              <input name="timezone" required defaultValue={detail.event.timezone} />
            </label>
            <p className="form-hint">
              Plantilla: <code>{detail.event.template_id}</code>. Se bloquea al publicar o generar
              el primer enlace.
            </p>
            <button disabled={archived || busy}>Guardar evento</button>
          </form>
        </details>

        <ScheduleManager
          eventId={eventId}
          timezone={detail.event.timezone}
          items={detail.schedule}
          disabled={archived}
          onChanged={load}
          onError={setError}
        />

        <section className="content-section" aria-labelledby="parties-title">
          <div className="section-heading">
            <div>
              <h2 id="parties-title">Grupos e invitados</h2>
              <p>{detail.parties.length} grupos registrados.</p>
            </div>
          </div>
          <div className="admin-filters" role="search">
            <label>
              Buscar
              <input
                type="search"
                value={query}
                placeholder="Grupo, contacto o invitado"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              Respuesta
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as PartyFilter)}
              >
                <option value="all">Todas</option>
                <option value="pending">Pendientes</option>
                <option value="confirmed">Confirmadas</option>
                <option value="rejected">Rechazadas</option>
              </select>
            </label>
          </div>
          {visibleParties.length === 0 && (
            <p className="empty-copy">No hay grupos que coincidan con los filtros.</p>
          )}
          <div className="party-list">
            {visibleParties.map((party) => (
              <PartyCard
                key={party.id}
                party={party}
                disabled={archived}
                onChanged={load}
                onError={setError}
              />
            ))}
          </div>
        </section>

        {!archived && (
          <section className="side-panel" aria-labelledby="new-party-title">
            <h2 id="new-party-title">Agregar grupo</h2>
            <form onSubmit={(event) => void handleCreateParty(event)}>
              <div className="field-grid">
                <label>
                  Familia, pareja o grupo
                  <input name="partyName" required maxLength={160} placeholder="Familia García" />
                </label>
                <label>
                  Contacto principal
                  <input name="primaryContactName" required maxLength={160} />
                </label>
                <label>
                  Email de contacto
                  <input name="contactEmail" type="email" required maxLength={254} />
                </label>
                <label>
                  Teléfono (opcional)
                  <input name="contactPhone" type="tel" maxLength={32} />
                </label>
                <label>
                  Lugares asignados
                  <input
                    name="places"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    required
                  />
                </label>
              </div>
              <label>
                Nombres, uno por línea (opcional)
                <textarea name="names" rows={4} placeholder={'Ana García\nLuis García'} />
              </label>
              <small>
                Los renglones faltantes se crean como lugares sin nombre. Después puedes marcar un
                lugar como acompañante y vincularlo a una persona del grupo.
              </small>
              <button type="submit" disabled={busy}>
                {busy ? 'Guardando…' : 'Agregar grupo'}
              </button>
            </form>
          </section>
        )}
      </div>
    </section>
  );
}

function statusLabel(status: EventStatus): string {
  if (status === 'published') return 'publicado';
  if (status === 'archived') return 'archivado';
  return 'borrador';
}
