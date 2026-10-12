export const DEFAULT_INVITATION_MODULE_ORDER = [
  'cover',
  'information',
  'schedule',
  'location',
  'guests',
  'closing',
] as const;

export type InvitationModuleId = (typeof DEFAULT_INVITATION_MODULE_ORDER)[number];

export function normalizeInvitationModuleOrder(order?: readonly string[]): InvitationModuleId[] {
  const known = new Set<InvitationModuleId>(DEFAULT_INVITATION_MODULE_ORDER);
  const selected = (order || []).filter(
    (module, index, values): module is InvitationModuleId =>
      known.has(module as InvitationModuleId) && values.indexOf(module) === index,
  );
  return [
    ...selected,
    ...DEFAULT_INVITATION_MODULE_ORDER.filter((module) => !selected.includes(module)),
  ];
}
