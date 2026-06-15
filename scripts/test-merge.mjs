// Unit tests for the 3-way church_data merge. Run: node scripts/test-merge.mjs
import { mergeChurchData } from '../src/lib/mergeBlob.js';

let pass = 0, fail = 0;
const ids = (arr) => (arr || []).map((x) => (typeof x === 'object' ? x.id : x)).sort();
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n      got:  ' + JSON.stringify(got) + '\n      want: ' + JSON.stringify(want)); }
}

const M = (id, extra = {}) => ({ id, first: 'F' + id, last: 'L' + id, ...extra });

console.log('\n3-way merge — members (the highest-stakes array)');
{
  // 1. Concurrent ADDS from both devices are both kept.
  const base = { members: [M(1), M(2)] };
  const local = { members: [M(1), M(2), M(3)] };   // this device added m3
  const remote = { members: [M(1), M(2), M(4)] };  // other device added m4
  check('concurrent adds both kept', ids(mergeChurchData(base, local, remote).members), [1, 2, 3, 4]);
}
{
  // 2. Local delete honored (and not resurrected by stale remote).
  const base = { members: [M(1), M(2)] };
  const local = { members: [M(1)] };                // this device deleted m2
  const remote = { members: [M(1), M(2)] };         // other device still has m2 (stale)
  check('local delete honored (no resurrect)', ids(mergeChurchData(base, local, remote).members), [1]);
}
{
  // 3. Remote delete honored.
  const base = { members: [M(1), M(2)] };
  const local = { members: [M(1), M(2)] };
  const remote = { members: [M(2)] };               // other device deleted m1
  check('remote delete honored', ids(mergeChurchData(base, local, remote).members), [2]);
}
{
  // 4. Pete/Spears scenario: deleted on cloud, a stale device still has them and re-saves.
  const base = { members: [M('pete'), M(1)] };
  const local = { members: [M('pete'), M(1)] };     // stale device, never saw the delete
  const remote = { members: [M(1)] };               // cloud already deleted pete
  check('cloud delete not resurrected by stale device', ids(mergeChurchData(base, local, remote).members), [1]);
}
{
  // 5. Add on one side + delete on the other — both honored.
  const base = { members: [M(1), M(2)] };
  const local = { members: [M(1), M(2), M(3)] };    // added m3
  const remote = { members: [M(1)] };               // deleted m2
  check('add + delete both honored', ids(mergeChurchData(base, local, remote).members), [1, 3]);
}

console.log('\nEdits');
{
  // 6. Edit on local only → local wins.
  const base = { members: [M(1, { email: 'a@x.com' })] };
  const local = { members: [M(1, { email: 'b@x.com' })] };   // changed email
  const remote = { members: [M(1, { email: 'a@x.com' })] };  // unchanged
  check('local edit kept', mergeChurchData(base, local, remote).members[0].email, 'b@x.com');
}
{
  // 7. Edit on remote only → remote wins.
  const base = { members: [M(1, { email: 'a@x.com' })] };
  const local = { members: [M(1, { email: 'a@x.com' })] };
  const remote = { members: [M(1, { email: 'c@x.com' })] };  // other device changed it
  check('remote edit kept', mergeChurchData(base, local, remote).members[0].email, 'c@x.com');
}
{
  // 8. Edit on both → newer timestamp wins.
  const base = { members: [M(1, { phone: '0', at: '2026-01-01T00:00:00Z' })] };
  const local = { members: [M(1, { phone: 'L', at: '2026-06-01T00:00:00Z' })] };
  const remote = { members: [M(1, { phone: 'R', at: '2026-06-09T00:00:00Z' })] };  // newer
  check('edit conflict → newer (remote) wins', mergeChurchData(base, local, remote).members[0].phone, 'R');
}
{
  // 9. Delete beats a concurrent edit (no resurrection of a deleted record).
  const base = { members: [M('pete', { email: 'a' })] };
  const local = { members: [] };                                   // deleted pete
  const remote = { members: [M('pete', { email: 'edited' })] };    // other device edited pete
  check('delete wins over concurrent edit', ids(mergeChurchData(base, local, remote).members), []);
}

console.log('\nConfig objects (settings / schedules) — additive per key');
{
  // 10. Two devices change different settings keys → both survive.
  const base = { churchSettings: { name: 'NTCC', pastorName: 'Hall', drawPct: 40 } };
  const local = { churchSettings: { name: 'NTCC', pastorName: 'Pastor Hall', drawPct: 40 } };  // changed pastorName
  const remote = { churchSettings: { name: 'NTCC', pastorName: 'Hall', drawPct: 50 } };        // changed drawPct
  const got = mergeChurchData(base, local, remote).churchSettings;
  check('settings: both edits survive', [got.pastorName, got.drawPct], ['Pastor Hall', 50]);
}
{
  // 11. eventSchedule: two devices fill different weeks → both kept.
  const base = { eventSchedule: { Picnic: { weeks: {} } } };
  const local = { eventSchedule: { Picnic: { weeks: { '2026-06-01': { a: 1 } } } } };
  const remote = { eventSchedule: { Picnic: { weeks: {} }, Fest: { weeks: { '2026-07-06': { b: 2 } } } } };
  const got = mergeChurchData(base, local, remote).eventSchedule;
  check('schedules: local change + remote new event both kept', [!!got.Picnic.weeks['2026-06-01'], !!got.Fest], [true, true]);
}

console.log('\nScalar arrays + scalar fields');
{
  // 12. dismissed-child-ids: concurrent adds union, removals honored.
  const base = { followupDismissedChildIds: ['a', 'b'] };
  const local = { followupDismissedChildIds: ['a', 'b', 'c'] };  // added c
  const remote = { followupDismissedChildIds: ['b'] };           // removed a
  check('scalar set: add kept, removal honored', mergeChurchData(base, local, remote).followupDismissedChildIds.sort(), ['b', 'c']);
}
{
  // 13. hospStartBalance: local changed → local; unchanged → remote.
  check('scalar: local change wins', mergeChurchData({ hospStartBalance: 100 }, { hospStartBalance: 250 }, { hospStartBalance: 100 }).hospStartBalance, 250);
  check('scalar: unchanged → remote wins', mergeChurchData({ hospStartBalance: 100 }, { hospStartBalance: 100 }, { hospStartBalance: 175 }).hospStartBalance, 175);
}

console.log('\nKeyed arrays + safety');
{
  // 14. teacherSchedule keyed by date|classroom — concurrent different slots kept.
  const base = { teacherSchedule: [] };
  const local = { teacherSchedule: [{ date: '2026-06-07', classroomId: 1, teacher: 'A' }] };
  const remote = { teacherSchedule: [{ date: '2026-06-07', classroomId: 2, teacher: 'B' }] };
  check('teacherSchedule: both slots kept', mergeChurchData(base, local, remote).teacherSchedule.length, 2);
}
{
  // 15. No-op: identical local & remote → unchanged.
  const same = { members: [M(1), M(2)], churchSettings: { name: 'X' } };
  check('identical sides → stable', ids(mergeChurchData(same, same, same).members), [1, 2]);
}
{
  // 16. checkIns concurrent adds (Sunday: two volunteers checking people in).
  const base = { checkIns: [{ id: 901 }] };
  const local = { checkIns: [{ id: 901 }, { id: 902 }] };
  const remote = { checkIns: [{ id: 901 }, { id: 903 }] };
  check('checkIns: concurrent volunteer adds kept', ids(mergeChurchData(base, local, remote).checkIns), [901, 902, 903]);
}

console.log('\nFull-shape blob (all real fields populated)');
{
  const full = (tag) => ({
    members: [M(1), M(2)], visitors: [{ id: 10 }], attendance: [{ id: 20 }], prayers: [{ id: 30 }],
    groups: [{ id: 40 }], grpMeetings: [{ id: 41 }], visitRecords: [{ id: 42 }], children: [{ id: 50 }],
    classrooms: [{ id: 51 }], equipment: [{ id: 60 }], workOrders: [{ id: 61 }], schedMaint: [{ id: 62 }],
    supplies: [{ id: 63 }], checkoutItems: [{ id: 64 }], checkouts: [{ id: 65 }], emailLog: [{ id: 70 }],
    emailTemplates: [{ id: 71 }], recurring: [{ id: 80 }], custom: [{ id: 81 }], checkIns: [{ id: 90 }],
    rollCalls: [{ id: 91 }], teacherSchedule: [{ date: '2026-06-07', classroomId: 1 }], kidsCheckIns: [{ id: 92 }],
    teacherFollowups: [{ id: 93 }], eventRsvps: [{ id: 94 }], announcements: [{ id: 95, at: '2026-06-01' }],
    roles: [{ id: 'role_admin' }], users: [{ id: 1 }], prospects: [{ id: 7000 }], sickVisits: [{ id: 96 }],
    benevolence: [{ id: 97 }], hospitalityFund: [{ id: 98 }], followupDismissedChildIds: ['x'],
    permissions: { role_admin: {} }, churchSettings: { name: 'NTCC', tag }, emailConfig: { provider: 'resend' },
    cleaningSchedule: {}, eventSchedule: {}, hospStartBalance: 100,
  });
  const base = full('base'), local = full('base'), remote = full('base');
  local.members = [M(1), M(2), M(3)];      // local adds m3
  remote.members = [M(1), M(2), M(4)];     // remote adds m4
  let merged, threw = false;
  try { merged = mergeChurchData(base, local, remote); } catch (e) { threw = true; console.log('     threw: ' + e.message); }
  check('full blob: no crash', threw, false);
  check('full blob: all 39 fields present', Object.keys(merged).length, 39);
  check('full blob: member adds merged', ids(merged.members), [1, 2, 3, 4]);
  check('full blob: untouched arrays intact', [merged.visitors.length, merged.prayers.length, merged.checkIns.length], [1, 1, 1]);
}

console.log('\n────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
