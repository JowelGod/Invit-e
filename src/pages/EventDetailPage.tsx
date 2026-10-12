import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CapacityGrid } from '../components/CapacityGrid';
import { FormMessage } from '../components/FormMessage';
import { GuestPartyForm, type PartyFormValue } from '../components/GuestPartyForm';
import { PartyCard } from '../components/PartyCard';
import { ScheduleManager } from '../components/ScheduleManager';
import { filterParties, type PartyFilter } from '../lib/admin';
import { formatDateTime } from '../lib/dates';
import { formText } from '../lib/forms';
import { supabase } from '../lib/supabase';
import type { EventDetail, EventStatus } from '../lib/types';
import {
  changeEventStatus,
  moveEventToTrash,
  getEventDetail,
  saveGuestParty,
  subscribeToEvent,
  updateEvent,
} from '../services/api';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PartyFilter>('all');
  const [newLink, setNewLink] = useState('');
  const [copied, setCopied] = useState(false);

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

  async function handleCreateParty(value: PartyFormValue) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await saveGuestParty({ eventId, partyId: null, ...value });
      setNewLink(result.link || '');
      setCopied(false);
      await load();
      setMessage('Grupo guardado y enlace seguro creado.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear el grupo.');
    } finally {
      setBusy(false);
    }
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
          timezone: detail?.event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      'Evento actualizado.',
    );
  }

  async function setStatus(status: EventStatus) {
    await run(() => changeEventStatus(eventId, status), 'Estado actualizado.');
  }

  async function moveToTrash() {
    if (!window.confirm('¿Mover este evento a la papelera durante 30 días?')) return;
    setBusy(true);
    try {
      await moveEventToTrash(eventId);
      void navigate('/app');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible mover el evento.');
      setBusy(false);
    }
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
      <nav className="breadcrumbs desktop-only" aria-label="Migas de pan">
        <Link to="/app">Inicio</Link>
        <span aria-hidden="true">›</span>
        <Link to="/app">Eventos</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{detail.event.title}</span>
      </nav>
      <Link className="back-link mobile-only" to="/app">
        ← Eventos
      </Link>

      <div className="page-heading">
        <div>
          <h1 id="event-title">{detail.event.title}</h1>
          <p className="event-date">
            {formatDateTime(detail.event.starts_at, detail.event.timezone)}
          </p>
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
            <details className="danger-menu">
              <summary>Más acciones</summary>
              <div>
                <button
                  className="button--danger"
                  disabled={busy}
                  onClick={() => void moveToTrash()}
                >
                  Mover a papelera
                </button>
              </div>
            </details>
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
              <input name="startsAt" type="hidden" value={detail.event.starts_at} />
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
            <p className="form-hint">
              Zona horaria detectada: {detail.event.timezone}. Plantilla: {detail.event.template_id}
              .
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
              <h2 id="parties-title">Invitaciones e invitados</h2>
              <p>{detail.parties.length} invitaciones registradas.</p>
            </div>
          </div>

          {!archived && (
            <details className="new-party-panel">
              <summary>Agregar invitados</summary>
              <GuestPartyForm
                busy={busy}
                submitLabel="Guardar invitación"
                onSubmit={handleCreateParty}
                eventPreview={{
                  title: detail.event.title,
                  timezone: detail.event.timezone,
                  schedule: detail.schedule,
                }}
              />
              {newLink && (
                <div className="generated-link" role="status">
                  <label htmlFor="new-party-link">Enlace creado</label>
                  <div className="copy-field">
                    <input id="new-party-link" readOnly value={newLink} />
                    <button
                      className="button--secondary"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(newLink);
                        setCopied(true);
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  <small aria-live="polite">
                    {copied ? 'Enlace copiado.' : 'Disponible en esta sesión.'}
                  </small>
                </div>
              )}
            </details>
          )}

          <div className="admin-filters" role="search">
            <label>
              Buscar
              <input
                type="search"
                value={query}
                placeholder="Grupo, destinatario o invitado"
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
                eventId={eventId}
                party={party}
                disabled={archived}
                onChanged={load}
                onError={setError}
                onSuccess={setMessage}
                eventPreview={{
                  title: detail.event.title,
                  timezone: detail.event.timezone,
                  schedule: detail.schedule,
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function statusLabel(status: EventStatus): string {
  if (status === 'published') return 'publicado';
  if (status === 'archived') return 'archivado';
  return 'borrador';
}
