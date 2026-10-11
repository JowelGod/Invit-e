export function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

export function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function minDateTimeLocal(now = new Date()): string {
  return toDateTimeLocal(now.toISOString());
}

export function validateDateRange(startsAt: string, endsAt?: string): string | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return 'Selecciona una fecha y hora válidas.';
  if (endsAt) {
    const end = new Date(endsAt);
    if (Number.isNaN(end.getTime()) || end <= start) {
      return 'La hora de fin debe ser posterior a la hora de inicio.';
    }
  }
  return null;
}
