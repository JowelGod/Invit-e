import { useState, type FormEvent } from 'react';

import { moveItem } from '../lib/admin';
import { formText } from '../lib/forms';
import type { GuestPartyRecord, InviteeKind, InviteeRecord } from '../lib/types';
import {
  generateInvitationLink,
  reorderInvitees,
  retireInvitee,
  updateGuestParty,
  updateInvitee,
} from '../services/api';
import { StatusBadge } from './StatusBadge';

interface Props {
  party: GuestPartyRecord;
  disabled: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

export function PartyCard({ party, disabled, onChanged, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function saveParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        updateGuestParty({
          partyId: party.id,
          name: formText(form, 'name'),
          primaryContactName: formText(form, 'primaryContactName'),
          contactEmail: formText(form, 'contactEmail'),
          contactPhone: formText(form, 'contactPhone'),
          assignedCapacity: Number(form.get('assignedCapacity')),
        }),
      'No fue posible actualizar el grupo.',
    );
  }

  async function saveInvitee(event: FormEvent<HTMLFormElement>, invitee: InviteeRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = formText(form, 'kind') as InviteeKind;
    await run(
      () =>
        updateInvitee({
          inviteeId: invitee.id,
          displayName: formText(form, 'displayName'),
          kind,
          companionOfId: kind === 'plus_one' ? formText(form, 'companionOfId') : null,
          companionLabel: kind === 'plus_one' ? formText(form, 'companionLabel') : null,
        }),
      'No fue posible actualizar el lugar.',
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(party.invitees, index, index + direction);
    if (reordered === party.invitees) return;
    await run(
      () =>
        reorderInvitees(
          party.id,
          reordered.map((invitee) => invitee.id),
        ),
      'No fue posible reordenar los lugares.',
    );
  }

  async function generateLink() {
    setBusy(true);
    try {
      const link = await generateInvitationLink(party.id);
      setGeneratedLink(link);
      await navigator.clipboard?.writeText(link);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible generar el enlace.');
    } finally {
      setBusy(false);
    }
  }

  const namedGuests = party.invitees.filter((invitee) => invitee.invitee_type === 'named_guest');
  const responseCounts = party.invitees.reduce(
    (counts, invitee) => ({ ...counts, [invitee.response]: counts[invitee.response] + 1 }),
    { pending: 0, confirmed: 0, rejected: 0 },
  );

  return (
    <details className="party-card">
      <summary>
        <span>
          <strong>{party.name}</strong>
          <small>
            {party.assigned_capacity} lugares · {responseCounts.confirmed} confirmados ·{' '}
            {responseCounts.rejected} rechazados · {responseCounts.pending} pendientes
          </small>
        </span>
      </summary>
      <div className="party-card__content">
        <form className="stack-form" onSubmit={(event) => void saveParty(event)}>
          <div className="field-grid">
            <label>
              Grupo
              <input name="name" required maxLength={160} defaultValue={party.name} />
            </label>
            <label>
              Contacto principal
              <input
                name="primaryContactName"
                required
                maxLength={160}
                defaultValue={party.primary_contact_name}
              />
            </label>
            <label>
              Email de contacto
              <input
                name="contactEmail"
                type="email"
                required
                maxLength={254}
                defaultValue={party.contact_email || ''}
              />
            </label>
            <label>
              Teléfono (opcional)
              <input
                name="contactPhone"
                type="tel"
                maxLength={32}
                defaultValue={party.contact_phone || ''}
              />
            </label>
            <label>
              Lugares asignados
              <input
                name="assignedCapacity"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={party.assigned_capacity}
              />
            </label>
          </div>
          <div className="button-row">
            <button disabled={disabled || busy}>Guardar grupo</button>
            <button
              className="button--secondary"
              type="button"
              disabled={disabled || busy}
              onClick={() => void generateLink()}
            >
              {generatedLink ? 'Regenerar enlace' : 'Generar enlace'}
            </button>
          </div>
        </form>
        {generatedLink && (
          <div className="generated-link" role="status">
            <label htmlFor={`link-${party.id}`}>Enlace nuevo (copiado)</label>
            <input id={`link-${party.id}`} readOnly value={generatedLink} />
            <small>Regenerarlo revoca el enlace anterior. El token no se puede recuperar.</small>
          </div>
        )}
        <div className="invitee-editor-list">
          {party.invitees.map((invitee, index) => (
            <InviteeEditor
              key={invitee.id}
              invitee={invitee}
              index={index}
              total={party.invitees.length}
              namedGuests={namedGuests}
              disabled={disabled || busy}
              onSave={saveInvitee}
              onMove={move}
              onRetire={(id) => run(() => retireInvitee(id), 'No fue posible retirar el lugar.')}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function InviteeEditor({
  invitee,
  index,
  total,
  namedGuests,
  disabled,
  onSave,
  onMove,
  onRetire,
}: {
  invitee: InviteeRecord;
  index: number;
  total: number;
  namedGuests: InviteeRecord[];
  disabled: boolean;
  onSave: (event: FormEvent<HTMLFormElement>, invitee: InviteeRecord) => Promise<void>;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
  onRetire: (id: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<InviteeKind>(invitee.invitee_type);
  return (
    <form className="invitee-editor" onSubmit={(event) => void onSave(event, invitee)}>
      <div className="invitee-editor__heading">
        <span>Lugar {index + 1}</span>
        <StatusBadge status={invitee.response} />
      </div>
      <label>
        Nombre (opcional)
        <input name="displayName" maxLength={120} defaultValue={invitee.display_name || ''} />
      </label>
      <label>
        Tipo
        <select
          name="kind"
          value={kind}
          disabled={invitee.response !== 'pending'}
          onChange={(event) => setKind(event.target.value as InviteeKind)}
        >
          <option value="named_guest">Invitado nominal</option>
          <option value="plus_one">Acompañante</option>
        </select>
      </label>
      {kind === 'plus_one' && (
        <div className="field-grid">
          <label>
            Acompaña a
            <select
              name="companionOfId"
              required
              defaultValue={invitee.companion_of_invitee_id || ''}
            >
              <option value="">Selecciona una persona</option>
              {namedGuests
                .filter((named) => named.id !== invitee.id)
                .map((named, namedIndex) => (
                  <option key={named.id} value={named.id}>
                    {named.display_name || `Lugar ${namedIndex + 1}`}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Etiqueta
            <input
              name="companionLabel"
              maxLength={120}
              defaultValue={invitee.companion_label || 'Acompañante'}
            />
          </label>
        </div>
      )}
      <div className="button-row compact-actions">
        <button disabled={disabled}>Guardar</button>
        <button
          className="button--secondary"
          type="button"
          disabled={disabled || index === 0}
          aria-label={`Subir lugar ${index + 1}`}
          onClick={() => void onMove(index, -1)}
        >
          ↑
        </button>
        <button
          className="button--secondary"
          type="button"
          disabled={disabled || index === total - 1}
          aria-label={`Bajar lugar ${index + 1}`}
          onClick={() => void onMove(index, 1)}
        >
          ↓
        </button>
        <button
          className="button--danger"
          type="button"
          disabled={disabled || invitee.response !== 'pending' || total <= 1}
          onClick={() => {
            if (window.confirm('¿Retirar este lugar? Esta acción conserva el registro histórico.'))
              void onRetire(invitee.id);
          }}
        >
          Retirar
        </button>
      </div>
    </form>
  );
}
