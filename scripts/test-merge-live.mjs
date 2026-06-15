// Live end-to-end test of the concurrent-save merge against the REAL Supabase database,
// using a throwaway owner account on an isolated church_id (its own uid). Cleans up after.
// Run: node scripts/test-merge-live.mjs
import { mergeChurchData } from '../src/lib/mergeBlob.js';

const URL = 'https://orvbnolfurculecjeerf.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydmJub2xmdXJjdWxlY2plZXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTg4MjUsImV4cCI6MjA5MjYzNDgyNX0.539ttxQk8Bi4BxBm6Yf84gsbnXTZ6sVd1WBq4Nd1uSU';
const H = (token) => ({ apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
const ids = (arr) => (arr || []).map((m) => m.id).sort((a, b) => a - b);
let ok = true;
const assert = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) ok = false; };

async function main() {
  // 1. Throwaway owner account → its church_id is its own uid (RLS lets the owner CRUD it).
  const email = `merge-live-${Date.now()}@example.com`;
  const su = await fetch(URL + '/auth/v1/signup', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'MergeTest123!' }) }).then((r) => r.json());
  const token = su.access_token, uid = su.user?.id || su.id;
  if (!token || !uid) { console.log('  ✗ could not create throwaway session', JSON.stringify(su).slice(0, 200)); process.exit(1); }
  console.log('  · throwaway church_id:', uid);

  const row = (data, ts) => fetch(URL + '/rest/v1/church_data', { method: 'POST', headers: { ...H(token), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ church_id: uid, data, updated_at: ts }) });
  const read = () => fetch(URL + `/rest/v1/church_data?church_id=eq.${uid}&select=data`, { headers: H(token) }).then((r) => r.json());

  try {
    // 2. Device B loads this baseline.
    const base = { members: [{ id: 1, first: 'Ann' }, { id: 2, first: 'Bob' }], churchSettings: { name: 'Test', pastorName: 'Hall' } };
    await row(base, new Date(Date.now() - 60000).toISOString());

    // 3. Device A saves first: adds member 4, deletes member 2, renames pastor.
    const remote = { members: [{ id: 1, first: 'Ann' }, { id: 4, first: 'Dan' }], churchSettings: { name: 'Test', pastorName: 'Pastor Hall' } };
    await row(remote, new Date().toISOString());

    // 4. Device B now saves its own work (added member 3) — detects A's newer write and merges.
    const localB = { members: [{ id: 1, first: 'Ann' }, { id: 2, first: 'Bob' }, { id: 3, first: 'Cara' }], churchSettings: { name: 'Test', pastorName: 'Hall' } };
    const remoteNow = (await read())[0].data;
    const merged = mergeChurchData(base, localB, remoteNow);
    await row(merged, new Date().toISOString());

    // 5. Verify the persisted result.
    const final = (await read())[0].data;
    console.log('  · final members:', JSON.stringify(ids(final.members)), ' pastor:', final.churchSettings.pastorName);
    assert("device A's add (m4) survived", final.members.some((m) => m.id === 4));
    assert("device B's add (m3) survived", final.members.some((m) => m.id === 3));
    assert("device A's delete (m2) honored — not resurrected by B", !final.members.some((m) => m.id === 2));
    assert('member 1 intact', final.members.some((m) => m.id === 1));
    assert('exactly m1,m3,m4 (no loss, no dupes)', JSON.stringify(ids(final.members)) === JSON.stringify([1, 3, 4]));
    assert("device A's settings edit (pastorName) survived", final.churchSettings.pastorName === 'Pastor Hall');
  } finally {
    // 6. Clean up the throwaway church_data row (auth user removed separately via SQL).
    await fetch(URL + `/rest/v1/church_data?church_id=eq.${uid}`, { method: 'DELETE', headers: H(token) });
    console.log('  · cleaned up church_data row for', email);
  }
  console.log('\n' + (ok ? 'LIVE TEST PASSED' : 'LIVE TEST FAILED'));
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.log('error:', e.message); process.exit(1); });
