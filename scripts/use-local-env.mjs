import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Select only browser-safe values; never copy the complete CLI status output.
const status = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const url = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  throw new Error('Expected the local Supabase instance. Environment was not changed.');
}
const key = status.ANON_KEY;
const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
if (claims.role !== 'anon') throw new Error('Expected a public anon key.');
if (existsSync('.env.local')) {
  const current = readFileSync('.env.local', 'utf8');
  if (!/^VITE_SUPABASE_URL=http:\/\/(127\.0\.0\.1|localhost):54321\s*$/m.test(current)) {
    throw new Error('Back up the existing .env.local outside Git before selecting local.');
  }
}
writeFileSync('.env.local', `VITE_SUPABASE_URL=${url.origin}\nVITE_SUPABASE_ANON_KEY=${key}\n`, {
  mode: 0o600,
});
console.log('Local Supabase selected in .env.local. Restart Vite.');
