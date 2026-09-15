import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

import { FormMessage } from '../components/FormMessage';
import type { InviteeStatus, PublicInvitation, RsvpResponse } from '../lib/types';
import { getPublicInvitation, submitRsvp } from '../services/api';

type Selection = Record<string, Exclude<InviteeStatus, 'pending'>>;

export function PublicInvitationPage() {
  const { token = '' } = useParams();
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Selection>({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    void getPublicInvitation(token)
      .then((data) => {
        if (!active) return;
        if (!data) setNotFound(true);
        else {
          setInvitation(data);
          setSelection(
            Object.fromEntries(
              data.places
                .filter((place) => place.status !== 'pending')
                .map((place) => [place.key, place.status as Exclude<InviteeStatus, 'pending'>]),
            ),
          );
        }
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : 'No fue posible abrir la invitación.',
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const responses: RsvpResponse[] = Object.entries(selection).map(([inviteeKey, status]) => ({
      invitee_key: inviteeKey,
      status,
    }));
    if (responses.length === 0) {
      setError('Selecciona al menos un lugar para responder.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await submitRsvp(token, responses, idempotencyKey);
      if (!updated) {
        setNotFound(true);
        return;
      }
      setInvitation(updated);
      setSuccess('Tu respuesta quedó guardada. Puedes cerrar esta página.');
      setIdempotencyKey(crypto.randomUUID());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar la respuesta.');
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <main className="public-invitation centered-state">Abriendo invitación…</main>;
  if (notFound)
    return (
      <main className="public-invitation centered-state">
        <div>
          <h1>Este enlace no está disponible</h1>
          <p>Puede haber expirado o sido reemplazado. Solicita uno nuevo al organizador.</p>
        </div>
      </main>
    );
  if (error && !invitation)
    return (
      <main className="public-invitation centered-state">
        <p role="alert">{error}</p>
      </main>
    );
  if (!invitation) return null;

  return (
    <main className="public-invitation">
      <article className="invitation-card">
        <p className="eyebrow">Invitación para</p>
        <h1>{invitation.party.name}</h1>
        <div className="invitation-event">
          <h2>{invitation.event.title}</h2>
          <p>{new Date(invitation.event.starts_at).toLocaleString('es-MX')}</p>
          {invitation.event.location_name && <p>{invitation.event.location_name}</p>}
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <fieldset>
            <legend>Confirma cada lugar que quieras responder</legend>
            <div className="rsvp-list">
              {invitation.places.map((place, index) => (
                <div className="rsvp-place" key={place.key}>
                  <p>{place.name || `Lugar ${index + 1}`}</p>
                  <div className="segmented-control">
                    <label>
                      <input
                        type="radio"
                        name={`place-${place.key}`}
                        value="confirmed"
                        checked={selection[place.key] === 'confirmed'}
                        onChange={() =>
                          setSelection((current) => ({ ...current, [place.key]: 'confirmed' }))
                        }
                      />
                      <span>Asistirá</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`place-${place.key}`}
                        value="rejected"
                        checked={selection[place.key] === 'rejected'}
                        onChange={() =>
                          setSelection((current) => ({ ...current, [place.key]: 'rejected' }))
                        }
                      />
                      <span>No asistirá</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          <FormMessage error={error} success={success} />
          <button type="submit" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar respuesta'}
          </button>
        </form>
      </article>
    </main>
  );
}
