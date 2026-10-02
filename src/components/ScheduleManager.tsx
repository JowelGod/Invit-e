import { useState, type FormEvent } from 'react';

import { formatDateTime, toDateTimeLocal } from '../lib/dates';
import { formText } from '../lib/forms';
import { moveItem } from '../lib/admin';
import type { ScheduleItem } from '../lib/types';
import {
  createScheduleItem,
  removeScheduleItem,
  reorderSchedule,
  updateScheduleItem,
} from '../services/api';

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

  async function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(items, index, index + direction);
    if (reordered === items) return;
    setBusy(true);
    try {
      await reorderSchedule(
        eventId,
        reordered.map((item) => item.id),
      );
      await onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'No fue posible reordenar la agenda.');
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
      <h2 id="schedule-title">Agenda</h2>
      {items.length === 0 && <p className="empty-copy">Aún no hay actividades.</p>}
      <div className="schedule-list">
        {items.map((item, index) => (
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
                    disabled={disabled || busy || index === 0}
                    aria-label={`Subir ${item.title}`}
                    onClick={() => void move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="button--secondary"
                    type="button"
                    disabled={disabled || busy || index === items.length - 1}
                    aria-label={`Bajar ${item.title}`}
                    onClick={() => void move(index, 1)}
                  >
                    ↓
                  </button>
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
      <div className="field-grid">
        <label>
          Inicio
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={item ? toDateTimeLocal(item.starts_at) : ''}
          />
        </label>
        <label>
          Fin (opcional)
          <input
            name="endsAt"
            type="datetime-local"
            defaultValue={item?.ends_at ? toDateTimeLocal(item.ends_at) : ''}
          />
        </label>
      </div>
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
