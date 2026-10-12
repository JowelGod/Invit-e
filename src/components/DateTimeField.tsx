import { useState } from 'react';

import { combineDisplayDateTime, splitDateTimeLocal } from '../lib/dates';

interface Props {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}

export function DateTimeField({ name, label, defaultValue, required = false }: Props) {
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
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Hora
          <input
            aria-label={`${label}: hora`}
            type="time"
            value={time}
            required={required}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
      </div>
      <input type="hidden" name={name} value={combined} />
      {date && time && !combined && (
        <small className="field-error">Escribe una fecha y hora válidas.</small>
      )}
    </fieldset>
  );
}
