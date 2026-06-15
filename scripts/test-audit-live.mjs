// Live test: audit_log insert (own action) + admin read RLS, against the real DB.
// Uses a throwaway owner account (church_id = its own uid). Cleans up the row; the auth
// user is removed separately via SQL. Run: node scripts/test-audit-live.mjs
const URL = 'https://orvbnolfurculecjeerf.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydmJub2xmdXJjdWxlY2plZXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTg4MjUsImV4cCI6MjA5MjYzNDgyNX0.539ttxQk8Bi4BxBm6Yf84gsbnXTZ6sVd1WBq4Nd1uSU';
const H = (t) => ({ apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
let ok = true;
const assert = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) ok = false; };

async function main() {
  const email = `audit-live-${Date.now()}@example.com`;
  const su = await fetch(URL + '/auth/v1/signup', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'AuditTest123!' }) }).then((r) => r.json());
  const token = su.access_token, uid = su.user?.id || su.id;
  if (!token || !uid) { console.log('  ✗ no session', JSON.stringify(su).slice(0, 200)); process.exit(1); }
  console.log('  · throwaway church_id:', uid);
  try {
    // 1. Insert an audit row as this user (RLS check: user_id = auth.uid()).
    const ins = await fetch(URL + '/rest/v1/audit_log', { method: 'POST', headers: { ...H(token), Prefer: 'return=minimal' },
      body: JSON.stringify({ church_id: uid, user_id: uid, user_name: 'Test Admin', user_email: email, action: 'deleted', entity: 'member', entity_id: '999', entity_label: 'Pete Lopez' }) });
    assert('insert own audit row allowed', ins.status === 201 || ins.status === 200);

    // 2. Insert with someone else's user_id must be rejected by RLS.
    const bad = await fetch(URL + '/rest/v1/audit_log', { method: 'POST', headers: { ...H(token), Prefer: 'return=minimal' },
      body: JSON.stringify({ church_id: uid, user_id: '00000000-0000-0000-0000-000000000000', action: 'deleted', entity: 'member' }) });
    assert('insert with spoofed user_id rejected by RLS', bad.status === 401 || bad.status === 403);

    // 3. Read back (RLS: can_access_counseling → owner can read own church).
    const got = await fetch(URL + `/rest/v1/audit_log?church_id=eq.${uid}&select=action,entity,entity_label,user_name`, { headers: H(token) }).then((r) => r.json());
    console.log('  · rows read back:', JSON.stringify(got));
    assert('owner can read their audit log', Array.isArray(got) && got.length === 1);
    assert('row content correct', got[0] && got[0].action === 'deleted' && got[0].entity_label === 'Pete Lopez');
  } finally {
    await fetch(URL + `/rest/v1/audit_log?church_id=eq.${uid}`, { method: 'DELETE', headers: H(token) });
    console.log('  · cleaned up audit rows for', email);
  }
  console.log('\n' + (ok ? 'LIVE AUDIT TEST PASSED' : 'LIVE AUDIT TEST FAILED'));
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.log('error:', e.message); process.exit(1); });
