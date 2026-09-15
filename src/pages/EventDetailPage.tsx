import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { CapacityGrid } from '../components/CapacityGrid';
import { FormMessage } from '../components/FormMessage';
import { StatusBadge } from '../components/StatusBadge';
import { formText } from '../lib/forms';
import type { EventDetail } from '../lib/types';
import {
  createGuestParty,
  generateInvitationLink,
  getEventDetail,
  subscribeToEvent,
} from '../services/api';
import { supabase } from '../lib/supabase';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});

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
        if (active) {
          setError(caught instanceof Error ? caught.message : 'No fue posible cargar el evento.');
        }
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

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    const places = Number(form.get('places'));
    const names = formText(form, 'names')
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);
    const inviteeNames = Array.from({ length: places }, (_, index) => names[index] || null);
    try {
      await createGuestParty({
        eventId,
        name: formText(form, 'partyName'),
        inviteeNames,
      });
      event.currentTarget.reset();
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No fue posible crear el grupo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateLink(partyId: string) {
    try {
      const link = await generateInvitationLink(partyId);
      setGeneratedLinks((current) => ({ ...current, [partyId]: link }));
      await navigator.clipboard?.writeText(link);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No fue posible generar el enlace.');
    }
  }

  if (loading)
    return (
      <p className="centered-state" role="status">
        Cargando evento…
      </p>
    );
  if (error || !detail)
    return (
      <p className="message message--error" role="alert">
        {error || 'Evento no encontrado.'}
      </p>
    );

  return (
    <section aria-labelledby="event-title">
      <Link className="back-link" to="/app">
        ← Todos los eventos
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{new Date(detail.event.starts_at).toLocaleString('es-MX')}</p>
          <h1 id="event-title">{detail.event.title}</h1>
          <p>{detail.event.location_name || 'Ubicación por definir'}</p>
        </div>
      </div>
      <CapacityGrid summary={detail.summary} />

      <div className="detail-layout">
        <section className="content-section" aria-labelledby="parties-title">
          <h2 id="parties-title">Grupos invitados</h2>
          {detail.parties.length === 0 && <p className="empty-copy">Aún no hay grupos.</p>}
          <div className="party-list">
            {detail.parties.map((party) => (
              <article className="party-card" key={party.id}>
                <div className="party-card__heading">
                  <div>
                    <h3>{party.name}</h3>
                    <p>{party.invitees.length} lugares</p>
                  </div>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void handleGenerateLink(party.id)}
                  >
                    {generatedLinks[party.id] ? 'Regenerar enlace' : 'Generar enlace'}
                  </button>
                </div>
                {generatedLinks[party.id] && (
                  <div className="generated-link" role="status">
                    <label htmlFor={`link-${party.id}`}>Enlace nuevo (copiado)</label>
                    <input id={`link-${party.id}`} readOnly value={generatedLinks[party.id]} />
                    <small>
                      Por seguridad, el token no puede recuperarse después. Regenerarlo revoca el
                      anterior.
                    </small>
                  </div>
                )}
                <ul className="invitee-list">
                  {party.invitees.map((invitee, index) => (
                    <li key={invitee.id}>
                      <span>{invitee.display_name || `Lugar ${index + 1}`}</span>
                      <StatusBadge status={invitee.response} />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <aside className="side-panel" aria-labelledby="new-party-title">
          <h2 id="new-party-title">Agregar grupo</h2>
          <form onSubmit={(event) => void handleCreateParty(event)}>
            <label htmlFor="partyName">Familia, pareja o grupo</label>
            <input
              id="partyName"
              name="partyName"
              required
              maxLength={160}
              placeholder="Familia García"
            />
            <label htmlFor="places">Número de lugares</label>
            <input
              id="places"
              name="places"
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              required
            />
            <label htmlFor="names">Nombres, uno por línea (opcional)</label>
            <textarea id="names" name="names" rows={5} placeholder={'Ana García\nLuis García'} />
            <small>
              Si faltan nombres, se crearán lugares sin nombre. Cada lugar será una fila
              independiente.
            </small>
            <FormMessage error={formError} />
            <button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Agregar grupo'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
