import type { CapacitySummary, InviteeStatus } from './types';

export function deriveCapacity(capacity: number, responses: InviteeStatus[]): CapacitySummary {
  const pending = responses.filter((status) => status === 'pending').length;
  const confirmed = responses.filter((status) => status === 'confirmed').length;
  const rejected = responses.filter((status) => status === 'rejected').length;

  return {
    capacity,
    assigned: responses.length,
    unassigned: Math.max(capacity - responses.length, 0),
    pending,
    confirmed,
    rejected,
    available_to_reassign: Math.max(capacity - pending - confirmed, 0),
    response_percentage:
      responses.length === 0 ? 0 : ((confirmed + rejected) * 100) / responses.length,
  };
}
