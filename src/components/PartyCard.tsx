import { useState } from 'react';

import { buildDraftInvitees } from '../lib/partyDraft';
import type { GuestPartyRecord, PublicScheduleItem } from '../lib/types';
import { generateInvitationLink, resetGuestPartyResponses, saveGuestParty } from '../services/api';
import { GuestPartyForm, type PartyFormValue } from './GuestPartyForm';
import { StatusBadge } from './StatusBadge';

interface Props {
  eventId: string;
  party: GuestPartyRecord;
  disabled: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  eventPreview: { title: string; timezone: string; schedule: PublicScheduleItem[] };
}

export function PartyCard({
  eventId,
  party,
  disabled,
  onChanged,
  onError,
  onSuccess,
  eventPreview,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  async function save(value: PartyFormValue) {
    setBusy(true);
    try {
      const result = await saveGuestParty({
        eventId,
        partyId: party.id,
        ...value,
      });
      if (result.link) setGeneratedLink(result.link);
      await onChanged();
      setEditing(false);
      onSuccess('Cambios guardados en la base de datos.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible guardar el grupo.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeAndCreateLink() {
    if (
      !window.confirm(
        'El enlace anterior dejará de funcionar. Los invitados y sus respuestas se conservarán.',
      )
    )
      return;
    setBusy(true);
    try {
      const link = await generateInvitationLink(party.id);
      setGeneratedLink(link);
      setCopied(false);
      onSuccess('El enlace anterior fue revocado y se creó uno nuevo.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible crear el enlace.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
  }

  async function resetResponses() {
    if (
      !window.confirm(
        '¿Reiniciar todas las respuestas de este grupo? El estado volverá a pendiente; el historial se conservará.',
      )
    )
      return;
    setBusy(true);
    try {
      await resetGuestPartyResponses(party.id);
      await onChanged();
      onSuccess('Respuestas reiniciadas; el historial se conservó.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible reiniciar respuestas.');
    } finally {
      setBusy(false);
    }
  }

  const responseCounts = party.invitees.reduce(
    (counts, invitee) => ({ ...counts, [invitee.response]: counts[invitee.response] + 1 }),
    { pending: 0, confirmed: 0, rejected: 0 },
  );
  const hasResponses = responseCounts.pending !== party.invitees.length;

  return (
    <details className="party-card">
      <summary>
        <span>
          <strong>{party.name}</strong>
          <small>
            {party.invitees.length} boletos · {responseCounts.confirmed} confirmados ·{' '}
            {responseCounts.rejected} rechazados · {responseCounts.pending} pendientes
          </small>
        </span>
      </summary>
      <div className="party-card__content">
        {editing ? (
          <GuestPartyForm
            initialName={party.name}
            initialInvitees={buildDraftInvitees(party.invitees, party.recipients)}
            busy={busy}
            submitLabel="Guardar cambios"
            eventPreview={eventPreview}
            onCancel={() => setEditing(false)}
            onSubmit={save}
          />
        ) : (
          <>
            <div className="party-readonly">
              <div>
                <h3>Invitados</h3>
                <ul className="plain-list">
                  {party.invitees.map((invitee) => (
                    <li key={invitee.id}>
                      <span>
                        {invitee.invitee_type === 'named_guest'
                          ? invitee.display_name
                          : `Invitado adicional ${
                              party.invitees.filter(
                                (item) =>
                                  item.invitee_type !== 'named_guest' &&
                                  item.display_order <= invitee.display_order,
                              ).length
                            }`}
                      </span>
                      <StatusBadge status={invitee.response} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Contactos</h3>
                {party.recipients.length ? (
                  <ul className="plain-list">
                    {party.recipients.map((recipient) => (
                      <li key={recipient.id}>
                        {recipient.kind === 'email' ? 'Email' : 'Teléfono'}: {recipient.value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-copy">Sin contactos.</p>
                )}
              </div>
            </div>
            <div className="button-row">
              <button
                className="button--secondary"
                type="button"
                disabled={disabled || busy}
                onClick={() => setEditing(true)}
              >
                Editar
              </button>
              <button
                className="button--secondary"
                type="button"
                disabled={disabled || busy}
                onClick={() => void revokeAndCreateLink()}
              >
                Revocar enlace y crear uno nuevo
              </button>
              {hasResponses && (
                <button
                  className="button--secondary"
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => void resetResponses()}
                >
                  Reiniciar respuestas
                </button>
              )}
            </div>
          </>
        )}

        <div className="link-status">
          <p>
            Estado del enlace: <strong>{party.has_active_link ? 'activo' : 'sin enlace'}</strong>.
          </p>
          {generatedLink && (
            <div className="generated-link" role="status">
              <label htmlFor={'link-' + party.id}>Enlace nuevo</label>
              <div className="copy-field">
                <input id={'link-' + party.id} readOnly value={generatedLink} />
                <button className="button--secondary" type="button" onClick={() => void copyLink()}>
                  Copiar
                </button>
              </div>
              <small aria-live="polite">
                {copied ? 'Enlace copiado.' : 'Disponible en esta sesión.'}
              </small>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
