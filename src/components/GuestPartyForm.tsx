import { useState, type FormEvent } from 'react';

import {
  createDraftPerson,
  newRecipient,
  parsePastedNames,
  serializeDraftPeople,
  type DraftPerson,
} from '../lib/partyDraft';
import type { DeliveryRecipient } from '../lib/types';

export interface PartyFormValue {
  name: string;
  invitees: ReturnType<typeof serializeDraftPeople>;
  recipients: Array<{ kind: DeliveryRecipient['kind']; value: string }>;
}

interface Props {
  initialName?: string;
  initialPeople?: DraftPerson[];
  initialRecipients?: DeliveryRecipient[];
  busy: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (value: PartyFormValue) => Promise<void>;
}

export function GuestPartyForm({
  initialName = '',
  initialPeople = [createDraftPerson()],
  initialRecipients = [],
  busy,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [people, setPeople] = useState<DraftPerson[]>(initialPeople);
  const [recipients, setRecipients] = useState<DeliveryRecipient[]>(initialRecipients);
  const [entryMode, setEntryMode] = useState<'individual' | 'list'>('individual');
  const [pastedNames, setPastedNames] = useState('');

  function updatePerson(index: number, patch: Partial<DraftPerson>) {
    setPeople((current) =>
      current.map((person, personIndex) =>
        personIndex === index ? { ...person, ...patch } : person,
      ),
    );
  }

  function togglePlusOne(index: number) {
    setPeople((current) =>
      current.map((person, personIndex) =>
        personIndex === index
          ? {
              ...person,
              plusOne: person.plusOne
                ? null
                : {
                    key: crypto.randomUUID(),
                    name: person.name.trim()
                      ? 'Acompañante de ' + person.name.trim()
                      : 'Acompañante',
                  },
            }
          : person,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= people.length) return;
    setPeople((current) => {
      const next = [...current];
      const [person] = next.splice(index, 1);
      next.splice(nextIndex, 0, person);
      return next;
    });
  }

  function applyList() {
    const parsed = parsePastedNames(pastedNames);
    if (parsed.length) {
      setPeople(parsed);
      setEntryMode('individual');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invitees = serializeDraftPeople(people);
    if (!name.trim() || invitees.some((invitee) => !invitee.display_name)) return;
    await onSubmit({
      name: name.trim(),
      invitees,
      recipients: recipients
        .map(({ kind, value }) => ({ kind, value: value.trim() }))
        .filter((recipient) => recipient.value),
    });
  }

  const ticketCount = serializeDraftPeople(people).length;

  return (
    <form className="stack-form party-form" onSubmit={(event) => void submit(event)}>
      <label>
        Familia, pareja o grupo
        <input
          value={name}
          required
          maxLength={160}
          placeholder="Familia García"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <fieldset className="segmented-field">
        <legend>Cómo agregar personas</legend>
        <div className="segmented-control">
          <button
            className={entryMode === 'individual' ? '' : 'button--secondary'}
            type="button"
            aria-pressed={entryMode === 'individual'}
            onClick={() => setEntryMode('individual')}
          >
            Agregar uno por uno
          </button>
          <button
            className={entryMode === 'list' ? '' : 'button--secondary'}
            type="button"
            aria-pressed={entryMode === 'list'}
            onClick={() => setEntryMode('list')}
          >
            Pegar una lista
          </button>
        </div>
      </fieldset>

      {entryMode === 'list' ? (
        <div className="stack-form">
          <label>
            Un nombre por línea
            <textarea
              rows={6}
              value={pastedNames}
              placeholder={'Maya\nIvanna\nMau\nSharon'}
              onChange={(event) => setPastedNames(event.target.value)}
            />
          </label>
          <button className="button--secondary" type="button" onClick={applyList}>
            Usar esta lista
          </button>
        </div>
      ) : (
        <div className="people-builder">
          {people.map((person, index) => (
            <div className="person-row" key={person.key}>
              <label>
                Persona {index + 1}
                <input
                  value={person.name}
                  required
                  maxLength={120}
                  placeholder="Nombre"
                  onChange={(event) => updatePerson(index, { name: event.target.value })}
                />
              </label>
              <label className="plus-one-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(person.plusOne)}
                  onChange={() => togglePlusOne(index)}
                />
                +1
              </label>
              {person.plusOne && (
                <label className="plus-one-name">
                  Nombre del +1
                  <input
                    value={person.plusOne.name}
                    required
                    maxLength={120}
                    onChange={(event) =>
                      updatePerson(index, {
                        plusOne: person.plusOne
                          ? { ...person.plusOne, name: event.target.value }
                          : null,
                      })
                    }
                  />
                </label>
              )}
              <div className="button-row compact-actions">
                <button
                  className="button--secondary"
                  type="button"
                  disabled={index === 0}
                  aria-label={'Subir a ' + (person.name || 'persona ' + (index + 1))}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="button--secondary"
                  type="button"
                  disabled={index === people.length - 1}
                  aria-label={'Bajar a ' + (person.name || 'persona ' + (index + 1))}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  className="text-button danger-text"
                  type="button"
                  disabled={people.length === 1}
                  onClick={() =>
                    setPeople((current) =>
                      current.filter((_, personIndex) => personIndex !== index),
                    )
                  }
                >
                  Eliminar invitado
                </button>
              </div>
            </div>
          ))}
          <button
            className="button--secondary"
            type="button"
            onClick={() => setPeople((current) => [...current, createDraftPerson()])}
          >
            Agregar persona
          </button>
          <p className="form-hint">{ticketCount} boletos, derivados de personas y acompañantes.</p>
        </div>
      )}

      <fieldset className="recipient-editor">
        <legend>Destinatarios opcionales</legend>
        <p className="form-hint">
          Reciben el enlace; no consumen boletos y nunca se muestran públicamente.
        </p>
        {recipients.map((recipient, index) => (
          <div className="recipient-row" key={recipient.id}>
            <select
              aria-label={'Tipo de destinatario ' + (index + 1)}
              value={recipient.kind}
              onChange={(event) =>
                setRecipients((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, kind: event.target.value as DeliveryRecipient['kind'] }
                      : item,
                  ),
                )
              }
            >
              <option value="email">Email</option>
              <option value="phone">Teléfono</option>
            </select>
            <input
              aria-label={'Destinatario ' + (index + 1)}
              type={recipient.kind === 'email' ? 'email' : 'tel'}
              value={recipient.value}
              maxLength={254}
              onChange={(event) =>
                setRecipients((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
            />
            <button
              className="text-button danger-text"
              type="button"
              onClick={() =>
                setRecipients((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              Quitar
            </button>
          </div>
        ))}
        <div className="button-row">
          <button
            className="button--secondary"
            type="button"
            onClick={() => setRecipients((current) => [...current, newRecipient('email')])}
          >
            Agregar email
          </button>
          <button
            className="button--secondary"
            type="button"
            onClick={() => setRecipients((current) => [...current, newRecipient('phone')])}
          >
            Agregar teléfono
          </button>
        </div>
      </fieldset>

      <div className="button-row">
        <button disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
        {onCancel && (
          <button className="button--secondary" type="button" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
