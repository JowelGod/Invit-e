import { useState, type FormEvent } from 'react';

import { formatDateTime, toDateTimeLocal, validateDateRange } from '../lib/dates';
import { formText } from '../lib/forms';
import type { ScheduleItem } from '../lib/types';
import {
  createScheduleItem,
  removeScheduleItem,
  updateScheduleItem,
  type ScheduleInput,
} from '../services/api';
import { DateTimeField } from './DateTimeField';

interface Props {
  eventId: string;
  timezone: string;
  items: ScheduleItem[];
  disabled: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onPreviewChange?: (items: ScheduleItem[]) => void;
}

export function ScheduleManager({
  eventId,
  timezone,
  items,
  disabled,
  onChanged,
  onError,
  onPreviewChange,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  function previewDraft(draft: ScheduleInput, itemId?: string) {
    const preview: ScheduleItem = {
      id: itemId || 'preview-activity',
      title: draft.title || 'Nueva actividad',
      description: draft.description || null,
      starts_at: draft.startsAt ? new Date(draft.startsAt).toISOString() : new Date().toISOString(),
      ends_at: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      venue_name: draft.venueName || null,
      address: draft.address || null,
      place_id: null,
      latitude: null,
      longitude: null,
      display_order: 0,
    };
    const next = itemId
      ? items.map((item) => (item.id === itemId ? preview : item))
      : [...items, preview];
    onPreviewChange?.([...next].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  }

  async function submit(event: FormEvent<HTMLFormElement>, itemId?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const input: ScheduleInput = {
        title: formText(form, 'title'),
        description: formText(form, 'description'),
        startsAt: formText(form, 'startsAt'),
        endsAt: formText(form, 'endsAt'),
        venueName: formText(form, 'venueName'),
        address: formText(form, 'address'),
      };
      const dateError = validateDateRange(input.startsAt, input.endsAt);
      if (dateError) throw new Error(dateError);
      if (!itemId && new Date(input.startsAt) < new Date())
        throw new Error('La actividad debe iniciar en una fecha futura.');
      if (itemId) await updateScheduleItem(itemId, input);
      else await createScheduleItem(eventId, input);
      setFormVersion((value) => value + 1);
      setEditing(null);
      await onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible guardar la actividad.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    if (!window.confirm('¿Retirar esta actividad de la línea de tiempo?')) return;
    setBusy(true);
    try {
      await removeScheduleItem(itemId);
      await onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible retirar la actividad.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-section" aria-labelledby="schedule-title">
      <h2 id="schedule-title">Línea de tiempo</h2>
      <p>La actividad principal y las adicionales se ordenan automáticamente por fecha y hora.</p>
      {items.length === 0 && (
        <p className="empty-copy">El evento necesita una actividad principal.</p>
      )}
      <div className="schedule-list timeline">
        {[...items]
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((item) => (
            <article className="schedule-item" key={item.id}>
              {editing === item.id ? (
                <ScheduleForm
                  item={item}
                  busy={busy}
                  onCancel={() => {
                    setEditing(null);
                    onPreviewChange?.(items);
                  }}
                  onDraftChange={(draft) => previewDraft(draft, item.id)}
                  onSubmit={(event) => void submit(event, item.id)}
                />
              ) : (
                <>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{formatDateTime(item.starts_at, timezone)}</p>
                    {(item.venue_name || item.address) && (
                      <p>{[item.venue_name, item.address].filter(Boolean).join(' · ')}</p>
                    )}
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <div className="button-row compact-actions">
                    <button
                      className="button--secondary"
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => setEditing(item.id)}
                    >
                      Editar
                    </button>
                    <button
                      className="button--danger"
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => void remove(item.id)}
                    >
                      Retirar
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
      </div>
      {!disabled && (
        <details className="inline-form">
          <summary>Agregar actividad</summary>
          <ScheduleForm
            key={formVersion}
            busy={busy}
            onDraftChange={(draft) => previewDraft(draft)}
            onSubmit={(event) => void submit(event)}
          />
        </details>
      )}
    </section>
  );
}

function ScheduleForm({
  item,
  busy,
  onCancel,
  onSubmit,
  onDraftChange,
}: {
  item?: ScheduleItem;
  busy: boolean;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftChange?: (draft: ScheduleInput) => void;
}) {
  const [draft, setDraft] = useState<ScheduleInput>({
    title: item?.title || '',
    description: item?.description || '',
    startsAt: item?.starts_at ? toDateTimeLocal(item.starts_at) : '',
    endsAt: item?.ends_at ? toDateTimeLocal(item.ends_at) : '',
    venueName: item?.venue_name || '',
    address: item?.address || '',
  });
  function update(patch: Partial<ScheduleInput>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDraftChange?.(next);
  }
  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <label>
        Actividad
        <input
          name="title"
          required
          maxLength={160}
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <DateTimeField
        name="startsAt"
        label="Inicio"
        required
        defaultValue={item?.starts_at}
        onValueChange={(value) => update({ startsAt: value })}
      />
      <DateTimeField
        name="endsAt"
        label="Fin opcional"
        defaultValue={item?.ends_at || undefined}
        onValueChange={(value) => update({ endsAt: value })}
      />
      <label>
        Lugar
        <input
          name="venueName"
          maxLength={200}
          value={draft.venueName}
          onChange={(event) => update({ venueName: event.target.value })}
        />
      </label>
      <label>
        Dirección
        <input
          name="address"
          maxLength={500}
          value={draft.address}
          onChange={(event) => update({ address: event.target.value })}
        />
      </label>
      <label>
        Descripción
        <textarea
          name="description"
          maxLength={2000}
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </label>
      <div className="button-row">
        <button disabled={busy}>{busy ? 'Guardando…' : 'Guardar actividad'}</button>
        {onCancel && (
          <button className="button--secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
