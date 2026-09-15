import type { InviteeStatus } from '../lib/types';

const labels: Record<InviteeStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
};

export function StatusBadge({ status }: { status: InviteeStatus }) {
  return <span className={`status status--${status}`}>{labels[status]}</span>;
}
