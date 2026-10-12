import { useState, type FormEvent } from 'react';

import { formatDateTime, validateDateRange } from '../lib/dates';
import { formText } from '../lib/forms';
import type { ScheduleItem } from '../lib/types';
import { DateTimeField } from './DateTimeField';
import { createScheduleItem, removeScheduleItem, updateScheduleItem } from '../services/api';

interface Props {
  eventId: string;
  timezone: string;
  items: ScheduleItem[];
  disabled: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

export function ScheduleManager({ eventId, timezone, items, disabled, onChanged, onError }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, itemId?: string) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setBusy(true);
    try {
      const input = {
        title: formText(form, 'title'),
        description: formText(form, 'description'),
        startsAt: formText(form, 'startsAt'),
        endsAt: formText(form, 'endsAt'),
        venueName: formText(form, 'venueName'),
        address: formText(form, 'address'),
      };
      const dateError = validateDateRange(input.startsAt, input.endsAt);
      if (dateError) throw new Error(dateError);
      if (!itemId && new Date(input.startsAt) < new Date()) {
        throw new Error('La actividad debe iniciar en una fecha futura.');
      }
      if (itemId) await updateScheduleItem(itemId, input);
      else await createScheduleItem(eventId, input);
      target.reset();
      setEditing(null);
      await onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible guardar la actividad.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    if (!window.confirm('¿Retirar esta actividad de la agenda?')) return;
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
                  onCancel={() => setEditing(null)}
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
          <ScheduleForm busy={busy} onSubmit={(event) => void submit(event)} />
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
}: {
  item?: ScheduleItem;
  busy: boolean;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <label>
        Actividad
        <input name="title" required maxLength={160} defaultValue={item?.title} />
      </label>
      <DateTimeField name="startsAt" label="Inicio" required defaultValue={item?.starts_at} />
      <DateTimeField name="endsAt" label="Fin opcional" defaultValue={item?.ends_at || undefined} />
      <label>
        Lugar
        <input name="venueName" maxLength={200} defaultValue={item?.venue_name || ''} />
      </label>
      <label>
        Dirección
        <input name="address" maxLength={500} defaultValue={item?.address || ''} />
      </label>
      <label>
        Descripción
        <textarea name="description" maxLength={2000} defaultValue={item?.description || ''} />
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
