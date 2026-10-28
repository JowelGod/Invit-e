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

export function parseDisplayDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function combineDisplayDateTime(dateValue: string, timeValue: string): string {
  const parsed = parseDisplayDate(dateValue);
  if (!parsed || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return '';
  const month = String(parsed.month).padStart(2, '0');
  const day = String(parsed.day).padStart(2, '0');
  return `${parsed.year}-${month}-${day}T${timeValue}`;
}

export function splitDateTimeLocal(value?: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const local = toDateTimeLocal(value);
  const [isoDate, time = ''] = local.split('T');
  const [year, month, day] = isoDate.split('-');
  return { date: `${day}/${month}/${year}`, time };
}

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}
