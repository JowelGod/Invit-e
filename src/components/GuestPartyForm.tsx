import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';

import {
  createDraftContact,
  createDraftExtra,
  createDraftInvitee,
  isValidEmail,
  isValidPhone,
  moveDraftInvitee,
  reorderDraftInvitees,
  parsePastedNames,
  serializeDraftInvitees,
  validatePartyDraft,
  type DraftContactKind,
  type DraftInvitee,
} from '../lib/partyDraft';
import type { PublicScheduleItem } from '../lib/types';
import { InvitationTemplate } from './InvitationTemplate';

export interface PartyFormValue {
  name: string;
  invitees: ReturnType<typeof serializeDraftInvitees>;
}

interface Props {
  initialName?: string;
  initialInvitees?: DraftInvitee[];
  busy: boolean;
  submitLabel: string;
  eventPreview?: { title: string; timezone: string; schedule: PublicScheduleItem[] };
  onCancel?: () => void;
  onSubmit: (value: PartyFormValue) => Promise<void>;
}

export function GuestPartyForm({
  initialName = '',
  initialInvitees = [createDraftInvitee()],
  busy,
  submitLabel,
  eventPreview,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [invitees, setInvitees] = useState<DraftInvitee[]>(initialInvitees);
  const [entryMode, setEntryMode] = useState<'individual' | 'list'>('individual');
  const [pastedNames, setPastedNames] = useState('');
  const [error, setError] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'edit' | 'preview'>('edit');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [expandedKey, setExpandedKey] = useState(initialInvitees[0]?.key || '');
  const [touchedContacts, setTouchedContacts] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function hasInviteeError(invitee: DraftInvitee): boolean {
    return (
      (attempted && !invitee.name.trim()) ||
      invitee.contacts.filter((contact) => contact.kind === 'phone').length > 2 ||
      invitee.contacts.some(
        (contact) =>
          touchedContacts[contact.id] &&
          Boolean(contact.value.trim()) &&
          (contact.kind === 'email' ? !isValidEmail(contact.value) : !isValidPhone(contact.value)),
      )
    );
  }

  function updateInvitee(index: number, patch: Partial<DraftInvitee>) {
    setInvitees((current) =>
      current.map((invitee, inviteeIndex) =>
        inviteeIndex === index ? { ...invitee, ...patch } : invitee,
      ),
    );
  }

  function addContact(index: number, kind: DraftContactKind) {
    if (
      kind === 'phone' &&
      invitees[index].contacts.filter((contact) => contact.kind === 'phone').length >= 2
    )
      return;
    setInvitees((current) =>
      current.map((invitee, inviteeIndex) =>
        inviteeIndex === index
          ? { ...invitee, contacts: [...invitee.contacts, createDraftContact(kind)] }
          : invitee,
      ),
    );
  }

  function updateContact(inviteeIndex: number, contactId: string, value: string) {
    setInvitees((current) =>
      current.map((invitee, index) =>
        index === inviteeIndex
          ? {
              ...invitee,
              contacts: invitee.contacts.map((contact) =>
                contact.id === contactId ? { ...contact, value } : contact,
              ),
            }
          : invitee,
      ),
    );
  }

  function removeContact(inviteeIndex: number, contactId: string) {
    setInvitees((current) =>
      current.map((invitee, index) =>
        index === inviteeIndex
          ? {
              ...invitee,
              contacts: invitee.contacts.filter((contact) => contact.id !== contactId),
            }
          : invitee,
      ),
    );
  }

  function applyList() {
    const parsed = parsePastedNames(pastedNames);
    if (!parsed.length) return;
    setInvitees((current) => [
      ...current.filter((item) => item.type === 'unnamed_extra'),
      ...parsed,
    ]);
    setEntryMode('individual');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePartyDraft(name, invitees);
    if (validation) {
      setAttempted(true);
      const fieldErrors = invitees.flatMap((person, index) => [
        ...(!person.name.trim() && person.type === 'named_guest'
          ? [`invitado ${index + 1}: nombre`]
          : []),
        ...person.contacts
          .filter(
            (contact) =>
              contact.value.trim() &&
              (contact.kind === 'email'
                ? !isValidEmail(contact.value)
                : !isValidPhone(contact.value)),
          )
          .map(
            (contact) =>
              `invitado ${index + 1}: ${contact.kind === 'email' ? 'correo' : 'teléfono'}`,
          ),
        ...(person.contacts.filter((contact) => contact.kind === 'phone').length > 2
          ? [`invitado ${index + 1}: demasiados teléfonos`]
          : []),
      ]);
      setError(
        fieldErrors.length > 1 ? `${validation} Revisa ${fieldErrors.join('; ')}.` : validation,
      );
      setTouchedContacts(
        Object.fromEntries(
          invitees.flatMap((person) => person.contacts.map((contact) => [contact.id, true])),
        ),
      );
      const invalid = invitees.find(
        (person) =>
          person.type === 'named_guest' &&
          (!person.name.trim() ||
            person.contacts.some(
              (contact) =>
                contact.value.trim() &&
                (contact.kind === 'email'
                  ? !isValidEmail(contact.value)
                  : !isValidPhone(contact.value)),
            ) ||
            person.contacts.filter((contact) => contact.kind === 'phone').length > 2),
      );
      if (invalid) setExpandedKey(invalid.key);
      requestAnimationFrame(() => {
        const input = !name.trim()
          ? formRef.current?.querySelector<HTMLInputElement>('input[required]')
          : invalid
            ? formRef.current?.querySelector<HTMLInputElement>(
                `[data-person-key="${invalid.key}"] input:invalid, [data-person-key="${invalid.key}"] input[aria-invalid="true"]`,
              )
            : formRef.current?.querySelector<HTMLInputElement>('input[required]');
        input?.focus();
      });
      return;
    }
    setError('');
    try {
      await onSubmit({ name: name.trim(), invitees: serializeDraftInvitees(invitees) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar la invitación.');
    }
  }

  const extraLabels = useMemo(() => {
    let number = 0;
    return invitees.map((invitee) => (invitee.type === 'unnamed_extra' ? ++number : 0));
  }, [invitees]);
  const previewPlaces = invitees.map((invitee, index) => ({
    key: invitee.key,
    name:
      invitee.type === 'named_guest'
        ? invitee.name || `Invitado ${index + 1}`
        : `Invitado adicional ${extraLabels[index]}`,
    type: invitee.type,
  }));

  return (
    <div className="party-editor-shell">
      {eventPreview && (
        <div className="editor-mobile-tabs" role="tablist" aria-label="Editor de invitación">
          <button
            type="button"
            aria-selected={mobilePanel === 'edit'}
            onClick={() => setMobilePanel('edit')}
          >
            Editar
          </button>
          <button
            type="button"
            aria-selected={mobilePanel === 'preview'}
            onClick={() => setMobilePanel('preview')}
          >
            Vista previa
          </button>
        </div>
      )}
      <div className="party-editor-layout">
        <form
          ref={formRef}
          noValidate
          className={`stack-form party-form ${mobilePanel === 'preview' ? 'mobile-hidden' : ''}`}
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Título de la invitación
            <input
              value={name}
              required
              maxLength={160}
              placeholder="Familia García, Mario y Sofi o Compañeros de clase"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <fieldset className="segmented-field">
            <legend>Cómo agregar invitados</legend>
            <div className="segmented-control">
              <button
                className={entryMode === 'individual' ? '' : 'button--secondary'}
                type="button"
                aria-pressed={entryMode === 'individual'}
                onClick={() => setEntryMode('individual')}
              >
                Uno por uno
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
                  placeholder={'Ana García\nLuis Pérez'}
                  value={pastedNames}
                  onChange={(event) => setPastedNames(event.target.value)}
                />
              </label>
              <p className="form-hint">
                Cada línea no vacía crea un invitado. Se quitan espacios al principio y al final;
                guiones y barras pertenecen al nombre.
              </p>
              <button className="button--secondary" type="button" onClick={applyList}>
                Usar esta lista
              </button>
            </div>
          ) : (
            <div className="people-builder">
              {invitees.map((invitee, index) => (
                <article
                  className={`person-row ${draggingIndex === index ? 'is-dragging' : ''}`}
                  key={invitee.key}
                  data-person-key={invitee.key}
                  draggable={invitees.length > 1}
                  onDragStart={(event: DragEvent<HTMLElement>) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                    setDraggingIndex(index);
                  }}
                  onDragOver={(event) => {
                    if (invitees.length > 1) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const source = Number(event.dataTransfer.getData('text/plain'));
                    setInvitees((current) => reorderDraftInvitees(current, source, index));
                    setDraggingIndex(null);
                  }}
                  onDragEnd={() => setDraggingIndex(null)}
                >
                  {invitees.length > 1 && (
                    <span className="drag-handle" aria-hidden="true" title="Arrastrar para ordenar">
                      ⠿
                    </span>
                  )}
                  {invitee.type === 'named_guest' ? (
                    <details
                      className="person-fields"
                      open={expandedKey === invitee.key}
                      onToggle={(event) => {
                        if (event.currentTarget.open) setExpandedKey(invitee.key);
                      }}
                    >
                      <summary
                        onClick={(event) => {
                          event.preventDefault();
                          setExpandedKey(expandedKey === invitee.key ? '' : invitee.key);
                        }}
                      >
                        <strong>{invitee.name.trim() || `Invitado ${index + 1}`}</strong>
                        <small>
                          {invitee.contacts.filter((contact) => contact.value.trim()).length}{' '}
                          contactos
                        </small>
                        {hasInviteeError(invitee) && (
                          <span className="field-error">Revisar datos</span>
                        )}
                      </summary>
                      <label>
                        Invitado{' '}
                        {
                          invitees.slice(0, index + 1).filter((item) => item.type === 'named_guest')
                            .length
                        }
                        <input
                          value={invitee.name}
                          required
                          aria-invalid={attempted && !invitee.name.trim()}
                          maxLength={120}
                          placeholder="Nombre"
                          onChange={(event) => updateInvitee(index, { name: event.target.value })}
                        />
                        {attempted && !invitee.name.trim() && (
                          <small className="field-error">Escribe el nombre del invitado.</small>
                        )}
                      </label>
                      <div className="invitee-contacts">
                        {invitee.contacts.map((contact) => (
                          <div className="recipient-row" key={contact.id}>
                            <label>
                              {contact.kind === 'email' ? 'Email' : 'Teléfono'}
                              <input
                                aria-label={`${contact.kind === 'email' ? 'Email' : 'Teléfono'} de ${invitee.name || `invitado ${index + 1}`}`}
                                type={contact.kind === 'email' ? 'email' : 'tel'}
                                value={contact.value}
                                maxLength={254}
                                aria-invalid={Boolean(
                                  touchedContacts[contact.id] &&
                                  contact.value.trim() &&
                                  (contact.kind === 'email'
                                    ? !isValidEmail(contact.value)
                                    : !isValidPhone(contact.value)),
                                )}
                                onBlur={() =>
                                  setTouchedContacts((current) => ({
                                    ...current,
                                    [contact.id]: true,
                                  }))
                                }
                                onChange={(event) =>
                                  updateContact(index, contact.id, event.target.value)
                                }
                              />
                              {touchedContacts[contact.id] &&
                                contact.value.trim() &&
                                (contact.kind === 'email'
                                  ? !isValidEmail(contact.value)
                                  : !isValidPhone(contact.value)) && (
                                  <small className="field-error">
                                    {contact.kind === 'email'
                                      ? 'Escribe un correo válido.'
                                      : 'Escribe un teléfono válido (7 a 15 dígitos).'}
                                  </small>
                                )}
                            </label>
                            <button
                              className="text-button danger-text"
                              type="button"
                              onClick={() => removeContact(index, contact.id)}
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                        <div className="button-row compact-actions">
                          <button
                            className="button--secondary"
                            type="button"
                            onClick={() => addContact(index, 'email')}
                          >
                            + Email
                          </button>
                          <button
                            className="button--secondary"
                            type="button"
                            onClick={() => addContact(index, 'phone')}
                            disabled={
                              invitee.contacts.filter((contact) => contact.kind === 'phone')
                                .length >= 2
                            }
                          >
                            + Teléfono
                          </button>
                        </div>
                        <small className="form-hint">
                          Máximo dos teléfonos por persona; son opcionales.
                        </small>
                      </div>
                    </details>
                  ) : (
                    <div className="extra-ticket-label">
                      <strong>Invitado adicional {extraLabels[index]}</strong>
                      <small>Boleto anónimo, sin nombre ni contacto.</small>
                    </div>
                  )}
                  <div className="button-row compact-actions ticket-actions">
                    {invitees.length > 1 && (
                      <>
                        <button
                          className="button--secondary"
                          type="button"
                          disabled={index === 0}
                          aria-label={`Subir boleto ${index + 1}`}
                          onClick={() =>
                            setInvitees((current) => moveDraftInvitee(current, index, -1))
                          }
                        >
                          ↑
                        </button>
                        <button
                          className="button--secondary"
                          type="button"
                          disabled={index === invitees.length - 1}
                          aria-label={`Bajar boleto ${index + 1}`}
                          onClick={() =>
                            setInvitees((current) => moveDraftInvitee(current, index, 1))
                          }
                        >
                          ↓
                        </button>
                      </>
                    )}
                    <button
                      className="text-button danger-text"
                      type="button"
                      disabled={invitees.length === 1}
                      onClick={() =>
                        setInvitees((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Quitar boleto
                    </button>
                  </div>
                </article>
              ))}
              <div className="button-row">
                <button
                  className="button--secondary"
                  type="button"
                  onClick={() => {
                    const next = createDraftInvitee();
                    setInvitees((current) => [...current, next]);
                    setExpandedKey(next.key);
                  }}
                >
                  Agregar invitado
                </button>
                <button
                  className="button--secondary"
                  type="button"
                  onClick={() => setInvitees((current) => [...current, createDraftExtra()])}
                >
                  Agregar boleto extra
                </button>
              </div>
              <p className="form-hint">
                <strong>{invitees.length} boletos:</strong>{' '}
                {invitees.filter((item) => item.type === 'named_guest').length} nominales y{' '}
                {invitees.filter((item) => item.type === 'unnamed_extra').length} extra.
              </p>
            </div>
          )}

          <p className="form-hint">
            La invitación podrá enviarse a los correos o teléfonos configurados. También podrás
            copiar y compartir el enlace manualmente.
          </p>
          {error && (
            <p className="message message--error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
            {onCancel && (
              <button
                className="button--secondary"
                type="button"
                disabled={busy}
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {eventPreview && (
          <aside
            className={`editor-preview ${mobilePanel === 'edit' ? 'mobile-preview-hidden' : ''}`}
            aria-label="Vista previa en vivo"
          >
            <InvitationTemplate
              title={eventPreview.title}
              timezone={eventPreview.timezone}
              schedule={eventPreview.schedule}
              partyTitle={name || 'Título de la invitación'}
              places={previewPlaces}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
