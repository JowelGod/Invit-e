import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// This smoke test deliberately creates synthetic data and never resets a database.
const status = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const url = new URL(status.API_URL);
assert.equal(url.origin, 'http://127.0.0.1:54321', 'Only the local test instance is allowed');
const claims = JSON.parse(Buffer.from(status.ANON_KEY.split('.')[1], 'base64url'));
assert.equal(claims.role, 'anon');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const owner = createClient(url.origin, status.ANON_KEY, options);
const guest = createClient(url.origin, status.ANON_KEY, options);
const ok = ({ data, error }) => {
  assert.equal(error, null, error?.message);
  return data;
};
const rpc = async (client, name, args) => ok(await client.rpc(name, args));
const stamp = randomUUID();
const email = `qa-${stamp}@example.test`;
const password = `Local-${randomUUID()}!`;
ok(
  await owner.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Local smoke test' } },
  }),
);
ok(await owner.auth.signOut());
ok(await owner.auth.signInWithPassword({ email, password }));
console.log('PASS signup, sign out and password login');
const start = new Date(Date.now() + 90 * 86400000).toISOString();
const eventId = await rpc(owner, 'create_event_with_activity', {
  p_title: `Local smoke ${stamp}`,
  p_activity_title: 'Synthetic activity',
  p_starts_at: start,
  p_ends_at: null,
  p_capacity: 10,
  p_venue_name: 'Test venue',
  p_address: null,
  p_description: null,
  p_timezone: 'Europe/London',
});
const broken = await owner.from('invitees').select('id').eq('event_id', eventId).order('starts_at');
assert.match(broken.error?.message || '', /column invitees.starts_at does not exist/);
ok(
  await owner
    .from('invitees')
    .select('id,display_order')
    .eq('event_id', eventId)
    .order('display_order'),
);
const activities = ok(
  await owner
    .from('event_schedule_items')
    .select('id,starts_at')
    .eq('event_id', eventId)
    .order('starts_at'),
);
assert.equal(activities.length, 1);
console.log('PASS real PostgreSQL reproduction of old query and corrected queries');
await rpc(owner, 'update_event_details', {
  p_event_id: eventId,
  p_title: 'Local smoke edited',
  p_starts_at: start,
  p_capacity: 10,
  p_location_name: 'Test venue',
  p_timezone: 'Europe/London',
});
assert.ok(
  ok(await owner.from('events').select('id').is('deleted_at', null)).some((e) => e.id === eventId),
);
const draft = {
  p_event_id: eventId,
  p_guest_party_id: null,
  p_name: 'Synthetic family',
  p_invitees: [
    {
      key: randomUUID(),
      display_name: 'Test guest',
      invitee_type: 'named_guest',
      contacts: [{ kind: 'email', value: 'guest@example.test' }],
    },
    { key: randomUUID(), display_name: null, invitee_type: 'unnamed_extra', contacts: [] },
  ],
};
const party = await rpc(owner, 'save_guest_party_v4', draft);
assert.ok(party.token);
await rpc(owner, 'change_event_status', { p_event_id: eventId, p_status: 'published' });
let invitation = await rpc(guest, 'get_public_invitation', { p_token: party.token });
assert.equal(invitation.places.length, 2);
await rpc(guest, 'respond_to_invitation', {
  p_token: party.token,
  p_idempotency_key: randomUUID(),
  p_responses: invitation.places.map((p, i) => ({
    invitee_key: p.key,
    status: i ? 'rejected' : 'confirmed',
  })),
});
const summary = await rpc(owner, 'event_capacity_summary', { p_event_id: eventId });
assert.equal(summary.confirmed, 1);
assert.equal(summary.rejected, 1);
console.log('PASS event creation/edit/list, anonymous invitation, RSVP and summary');
const rows = ok(
  await owner
    .from('invitees')
    .select('public_key,display_name,invitee_type')
    .eq('guest_party_id', party.party_id)
    .order('display_order'),
);
await rpc(owner, 'save_guest_party_v4', {
  ...draft,
  p_guest_party_id: party.party_id,
  p_invitees: rows.map((r, i) => ({
    ...draft.p_invitees[i],
    key: r.public_key,
    display_name: i ? null : 'Edited test guest',
  })),
});
invitation = await rpc(guest, 'get_public_invitation', { p_token: party.token });
assert.equal(invitation.places[0].name, 'Edited test guest');
assert.equal(invitation.places[0].status, 'confirmed');
await rpc(owner, 'move_event_to_trash', { p_event_id: eventId });
assert.ok((await rpc(owner, 'get_trashed_events')).some((e) => e.id === eventId));
assert.equal(await rpc(guest, 'get_public_invitation', { p_token: party.token }), null);
await rpc(owner, 'restore_trashed_event', { p_event_id: eventId });
assert.ok(
  ok(await owner.from('events').select('id').is('deleted_at', null)).some((e) => e.id === eventId),
);
assert.equal(await rpc(guest, 'get_public_invitation', { p_token: party.token }), null);
console.log('PASS stable link after editing, trash, restore and revoked-link isolation');
ok(
  await owner.auth.resetPasswordForEmail(email, {
    redirectTo: 'http://localhost:5173/restablecer',
  }),
);
let message;
for (let attempt = 0; attempt < 10; attempt++) {
  const mailbox = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  message = mailbox.messages.find((m) => m.To?.some((to) => to.Address === email));
  if (message) break;
  await new Promise((resolve) => setTimeout(resolve, 300));
}
assert.ok(message, 'Recovery email must arrive in the local inbox');
const mail = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
const body = mail.Text || mail.HTML;
const match = body.match(/https?:\/\/[^\s<>"']+\/auth\/v1\/verify\?[^\s<>"']+/);
assert.ok(match, 'Recovery email must contain a verification link');
const recoveryUrl = new URL(match[0].replaceAll('&amp;', '&'));
assert.ok(['127.0.0.1', 'localhost'].includes(recoveryUrl.hostname));
assert.equal(recoveryUrl.port, '54321');
const response = await fetch(recoveryUrl, { redirect: 'manual' });
assert.equal(response.status, 303);
const redirect = new URL(response.headers.get('location'));
assert.equal(redirect.origin, 'http://localhost:5173');
assert.equal(redirect.pathname, '/restablecer');
const tokens = new URLSearchParams(redirect.hash.slice(1));
const recovery = createClient(url.origin, status.ANON_KEY, options);
ok(
  await recovery.auth.setSession({
    access_token: tokens.get('access_token'),
    refresh_token: tokens.get('refresh_token'),
  }),
);
const replacement = `Local-${randomUUID()}!`;
ok(await recovery.auth.updateUser({ password: replacement }));
ok(await recovery.auth.signOut());
ok(await recovery.auth.signInWithPassword({ email, password: replacement }));
ok(await recovery.auth.signOut());
ok(await owner.auth.signOut());
console.log('PASS local recovery email, recovery session, password update and login');
console.log(
  'Synthetic fixtures remain in local Supabase; no reset or Cloud operation was performed.',
);
