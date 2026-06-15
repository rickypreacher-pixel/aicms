// Unit tests for the audit diff. Run: node scripts/test-audit.mjs
import { diffAudit, collapseAudit } from '../src/lib/auditDiff.js';

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n      got:  ' + JSON.stringify(got) + '\n      want: ' + JSON.stringify(want)); }
}
const M = (id, extra = {}) => ({ id, first: 'F' + id, last: 'L' + id, ...extra });
const find = (cs, action) => cs.filter((c) => c.action === action);

console.log('\nAudit diff');
{
  // create
  const cs = diffAudit({ members: [M(1)] }, { members: [M(1), M(2)] });
  check('detects created', [cs.length, cs[0].action, cs[0].entity, cs[0].entity_label], [1, 'created', 'member', 'F2 L2']);
}
{
  // delete (keeps the deleted record's label even though it's gone from next)
  const cs = diffAudit({ members: [M(1, { first: 'Pete', last: 'Lopez' }), M(2)] }, { members: [M(2)] });
  check('detects deleted with label', [cs.length, cs[0].action, cs[0].entity_label], [1, 'deleted', 'Pete Lopez']);
}
{
  // update
  const cs = diffAudit({ members: [M(1, { email: 'a@x' })] }, { members: [M(1, { email: 'b@x' })] });
  check('detects updated', [cs.length, cs[0].action], [1, 'updated']);
}
{
  // no change → nothing
  check('no change → empty', diffAudit({ members: [M(1)] }, { members: [M(1)] }).length, 0);
}
{
  // multiple entity types in one save
  const base = { members: [M(1)], users: [{ id: 5, email: 'u@x' }], visitors: [] };
  const next = { members: [M(1), M(2)], users: [], visitors: [M(9)] };
  const cs = diffAudit(base, next);
  check('mixed: 1 member create + 1 visitor create + 1 user delete', [find(cs, 'created').length, find(cs, 'deleted').length], [2, 1]);
}
{
  // ignores non-audited high-churn arrays (attendance/checkIns)
  const cs = diffAudit({ attendance: [{ id: 1 }], checkIns: [{ id: 1 }] }, { attendance: [{ id: 1 }, { id: 2 }], checkIns: [{ id: 1 }, { id: 2 }] });
  check('ignores attendance/checkIns', cs.length, 0);
}
{
  // null base (first load) → diff vs {} yields creations only; caller skips when base is null
  const cs = diffAudit({}, { members: [M(1)] });
  check('empty base → member counted as created', cs.length, 1);
}

console.log('\nCollapse (bulk import)');
{
  const many = { members: Array.from({ length: 50 }, (_, i) => M(i + 1)) };
  const cs = diffAudit({ members: [] }, many);
  check('50 raw creates', cs.length, 50);
  const collapsed = collapseAudit(cs);
  check('collapsed to 1 summary row', collapsed.length, 1);
  check('summary label', collapsed[0].entity_label, '50 members (created in bulk)');
}
{
  // small bursts are NOT collapsed
  const cs = diffAudit({ members: [] }, { members: [M(1), M(2), M(3)] });
  check('3 creates not collapsed', collapseAudit(cs).length, 3);
}

console.log('\n────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
