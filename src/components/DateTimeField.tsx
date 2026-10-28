import { useState } from 'react';

import { combineDisplayDateTime, formatDateInput, splitDateTimeLocal } from '../lib/dates';

interface Props {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
}

export function DateTimeField({
  name,
  label,
  defaultValue,
  required = false,
  onValueChange,
}: Props) {
  const initial = splitDateTimeLocal(defaultValue);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const combined = combineDisplayDateTime(date, time);
  return (
    <fieldset className="date-time-field">
      <legend>{label}</legend>
      <div className="date-time-grid">
        <label>
          Fecha (dd/mm/aaaa)
          <input
            aria-label={`${label}: fecha`}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            pattern="\d{2}/\d{2}/\d{4}"
            value={date}
            required={required}
            onKeyDown={(event) => {
              const target = event.currentTarget;
              if (
                event.key === 'Backspace' &&
                target.selectionStart === target.selectionEnd &&
                target.selectionStart &&
                target.value[target.selectionStart - 1] === '/'
              ) {
                event.preventDefault();
                const next = formatDateInput(
                  target.value.slice(0, target.selectionStart - 2) +
                    target.value.slice(target.selectionStart),
                );
                setDate(next);
                onValueChange?.(combineDisplayDateTime(next, time));
                const position = Math.max(0, target.selectionStart - 2);
                requestAnimationFrame(() => target.setSelectionRange(position, position));
              }
            }}
            onChange={(event) => {
              const target = event.target;
              const cursor = target.selectionStart ?? target.value.length;
              const digitsBeforeCursor = target.value.slice(0, cursor).replace(/\D/g, '').length;
              const next = formatDateInput(target.value);
              setDate(next);
              onValueChange?.(combineDisplayDateTime(next, time));
              let position = 0;
              let digits = 0;
              while (position < next.length && digits < digitsBeforeCursor) {
                if (/\d/.test(next[position])) digits += 1;
                position += 1;
              }
              if (next[position] === '/' && target.value[cursor - 1] === '/') position += 1;
              requestAnimationFrame(() => target.setSelectionRange(position, position));
            }}
          />
        </label>
        <label>
          Hora
          <input
            aria-label={`${label}: hora`}
            type="time"
            step={60}
            title="HH:MM (24 horas)"
            value={time}
            required={required}
            onChange={(event) => {
              const next = event.target.value;
              setTime(next);
              onValueChange?.(combineDisplayDateTime(date, next));
            }}
          />
          <small className="form-hint">HH:MM, formato de 24 horas.</small>
        </label>
      </div>
      <input type="hidden" name={name} value={combined} />
      {date && time && !combined && (
        <small className="field-error">Escribe una fecha y hora válidas.</small>
      )}
    </fieldset>
  );
}
