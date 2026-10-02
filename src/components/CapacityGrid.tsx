import type { CapacitySummary } from '../lib/types';

export function CapacityGrid({ summary }: { summary: CapacitySummary }) {
  const metrics = [
    ['Capacidad', summary.capacity],
    ['Asignados', summary.assigned],
    ['Sin asignar', summary.unassigned],
    ['Pendientes', summary.pending],
    ['Confirmados', summary.confirmed],
    ['Rechazados', summary.rejected],
    ['Disponibles', summary.available_to_reassign],
    ['Respuesta', `${summary.response_percentage}%`],
  ];

  return (
    <dl className="capacity-grid" aria-label="Resumen de capacidad">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
