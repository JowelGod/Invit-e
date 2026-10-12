import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INVITATION_MODULE_ORDER,
  normalizeInvitationModuleOrder,
} from './invitationModules';

describe('orden de módulos de invitación', () => {
  it('acepta un orden parcial, elimina duplicados y completa módulos futuros', () => {
    expect(normalizeInvitationModuleOrder(['guests', 'cover', 'guests', 'unknown'])).toEqual([
      'guests',
      'cover',
      'information',
      'schedule',
      'location',
      'closing',
    ]);
    expect(normalizeInvitationModuleOrder()).toEqual(DEFAULT_INVITATION_MODULE_ORDER);
  });
});
