// ─────────────────────────────────────────────────────────────────────────────
// 3-way merge for the church_data blob — makes concurrent saves non-destructive.
//
// The app stores all shared state in one JSON blob with last-write-wins. When two
// devices edit at the same time, the second save used to discard one side's changes.
// This merges them instead, using the version a device last loaded as the baseline:
//
//   base   = the blob this device last loaded from the cloud
//   local  = this device's current state (what it is about to save)
//   remote = the latest blob in the cloud (saved by the other device meanwhile)
//
// Guarantees:
//   • Concurrent ADDS from both sides are kept (the main data-loss case).
//   • DELETES from either side are honored — a record removed on one device is NOT
//     resurrected, even if the other device still has it (matches admin expectations
//     after deleting people).
//   • A record edited on both sides resolves to the newer copy (by timestamp), or
//     local on a tie.
//   • Config objects (settings/permissions/schedules) merge per top-level key,
//     additively (no key is dropped), so two devices editing different settings
//     both survive.
//
// Pure & dependency-free so it can be unit-tested in isolation.
// ─────────────────────────────────────────────────────────────────────────────

// Arrays of records identified by `id`.
const ID_ARRAYS = [
  'members','visitors','attendance','prayers','groups','grpMeetings','visitRecords',
  'children','classrooms','equipment','workOrders','schedMaint','supplies','checkoutItems',
  'checkouts','emailLog','emailTemplates','recurring','custom','checkIns','rollCalls',
  'kidsCheckIns','teacherFollowups','eventRsvps','announcements','roles','users','prospects',
  'sickVisits','benevolence','hospitalityFund','portalSignups','portalMembers','promoContacts',
  'serveTeams','serveSignups',
];
// Arrays of bare scalar values (e.g. ids), merged as a set.
const SCALAR_ARRAYS = ['followupDismissedChildIds', 'adminNotesRead'];
// ADD-ONLY arrays: never infer a delete from absence. A device that is merely behind
// (partial/just-loaded copy) must NOT be able to broadcast a phantom delete that wipes
// records for everyone — the root cause of the recurring kids-check-in "flapping" (a day's
// check-ins repeatedly dropping to 0 and being restored by another device). Union of both
// sides, keyed by the natural composite key; the only way to remove one is an explicit,
// intentional delete flow (or the dedicated table that replaces this blob path). Genuine
// deletes of a child check-in are rare; NEVER losing an entered check-in is what matters.
const UNION_ARRAYS = ['kidsCheckIns'];
const UNION_SET = new Set(UNION_ARRAYS);
// Objects merged per top-level key (additive — keys are never dropped).
// careContacted = Care Pulse {memberId: ISODate} snooze marks; additive so marks from any device survive.
// servicePlans = service Schedule Planner, keyed by "<service>|<date>"; additive so plans from any device survive.
const OBJECT_FIELDS = ['permissions','churchSettings','emailConfig','cleaningSchedule','eventSchedule','careContacted','servicePlans'];
// Single scalar values.
const SCALAR_FIELDS = ['hospStartBalance'];

const ID_SET = new Set(ID_ARRAYS);
const SCALAR_ARR_SET = new Set(SCALAR_ARRAYS);
const OBJ_SET = new Set(OBJECT_FIELDS);
const SCALAR_SET = new Set(SCALAR_FIELDS);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Identity key for an array element of a given field.
function keyFor(field, item) {
  if (field === 'teacherSchedule') return String(item && item.date) + '|' + String(item && item.classroomId);
  // Kids check-ins have non-unique / colliding ids (per-device counters). Key by the natural
  // composite childId|date (one check-in per child per date) so the merge is stable and doesn't
  // collapse distinct records or shrink the array (which the DB no-shrink guard would then revert).
  if (field === 'kidsCheckIns') return String(item && item.childId) + '|' + String(item && item.date);
  // Portal-access grants are keyed by the member they apply to (no own `id`).
  if (field === 'portalMembers') return String(item && item.memberId);
  if (SCALAR_ARR_SET.has(field)) return String(item);
  return String(item && item.id);
}

// Best-effort recency for the edit-vs-edit tiebreak.
function tsOf(item) {
  const t = item && (item.at || item.updatedAt || item.createdAt || item.date);
  const n = t ? new Date(t).getTime() : 0;
  return Number.isFinite(n) ? n : 0;
}

// Visit records move only FORWARD through the visitation pipeline. When BOTH devices edited the
// same record, the more-advanced STAGE must win (timestamp only breaks ties within one stage) —
// otherwise a stale device whose copy got a newer timestamp (a checkbox, a partial contact) could
// push the card back to an earlier stage for everyone ("reverted to Pastor Visit later"). Contacts
// from both sides are unioned so no logged contact is lost. Mirrors the app's load-side merge.
const VR_RANK = { Pastor: 0, TeamSupervisor: 1, TeamLeader: 2, Sponsor: 3, OngoingCare: 4, Complete: 5, Converted: 6 };
function mergeVisitRecord(L, R) {
  const rl = VR_RANK[String((L && L.stage) || '')] ?? 0;
  const rr = VR_RANK[String((R && R.stage) || '')] ?? 0;
  const w = rl !== rr ? (rl > rr ? L : R) : (tsOf(L) >= tsOf(R) ? L : R);
  const m = new Map();
  const contacts = [...(Array.isArray(L && L.contacts) ? L.contacts : []), ...(Array.isArray(R && R.contacts) ? R.contacts : [])];
  contacts.forEach((c) => { const key = String(c && c.id); if (!m.has(key)) m.set(key, c); });
  return { ...w, contacts: Array.from(m.values()) };
}

// Both sides changed the same record → pick the winner (field-aware).
function bothChangedWinner(field, L, R) {
  if (field === 'visitRecords') return mergeVisitRecord(L, R);
  return tsOf(L) >= tsOf(R) ? L : R; // newer wins, tie → local
}

function mergeArray(field, baseArr, localArr, remoteArr) {
  baseArr = Array.isArray(baseArr) ? baseArr : [];
  localArr = Array.isArray(localArr) ? localArr : [];
  remoteArr = Array.isArray(remoteArr) ? remoteArr : [];
  const k = (it) => keyFor(field, it);
  const bMap = new Map(baseArr.map((it) => [k(it), it]));
  const lMap = new Map(localArr.map((it) => [k(it), it]));
  const rMap = new Map(remoteArr.map((it) => [k(it), it]));
  const keys = new Set([...bMap.keys(), ...lMap.keys(), ...rMap.keys()]);
  const out = [];
  for (const key of keys) {
    const inB = bMap.has(key), inL = lMap.has(key), inR = rMap.has(key);
    const B = bMap.get(key), L = lMap.get(key), R = rMap.get(key);
    if (inL && inR) {
      // Present on both sides → resolve any edit.
      if (eq(L, R)) { out.push(L); continue; }
      const lChanged = !inB || !eq(L, B);
      const rChanged = !inB || !eq(R, B);
      if (lChanged && !rChanged) out.push(L);
      else if (rChanged && !lChanged) out.push(R);
      else out.push(bothChangedWinner(field, L, R)); // both changed → field-aware winner
    } else if (inL && !inR) {
      // Missing from remote. If it existed at base, the other device DELETED it → honor (drop).
      // If it never existed at base, this device ADDED it → keep.
      if (!inB) out.push(L);
    } else if (!inL && inR) {
      // Missing from local. If it existed at base, this device DELETED it → honor (drop).
      // If it never existed at base, the other device ADDED it → keep.
      if (!inB) out.push(R);
    }
    // !inL && !inR → deleted on both / base-only leftover → drop.
  }
  return out;
}

// ADD-ONLY union merge: keep every key present on EITHER side; never drop for absence.
// When a key is on both sides and differs, keep the newer copy (local on a tie).
function mergeArrayUnion(field, localArr, remoteArr) {
  localArr = Array.isArray(localArr) ? localArr : [];
  remoteArr = Array.isArray(remoteArr) ? remoteArr : [];
  const k = (it) => keyFor(field, it);
  const byKey = new Map();
  for (const it of remoteArr) byKey.set(k(it), it);
  for (const it of localArr) {
    const key = k(it);
    const ex = byKey.get(key);
    if (!ex || tsOf(it) >= tsOf(ex)) byKey.set(key, it);
  }
  return Array.from(byKey.values());
}

// Additive per-key merge for config objects. Start from remote (latest), then overlay
// any key THIS device actually changed relative to base. Never drops keys.
function mergeObject(baseObj, localObj, remoteObj) {
  const base = baseObj && typeof baseObj === 'object' ? baseObj : {};
  const local = localObj && typeof localObj === 'object' ? localObj : {};
  const remote = remoteObj && typeof remoteObj === 'object' ? remoteObj : {};
  const out = { ...remote };
  for (const key of Object.keys(local)) {
    if (!eq(local[key], base[key])) out[key] = local[key]; // local changed this key → keep local's value
  }
  return out;
}

export function mergeChurchData(base, local, remote) {
  base = base && typeof base === 'object' ? base : {};
  local = local && typeof local === 'object' ? local : {};
  remote = remote && typeof remote === 'object' ? remote : {};
  const out = {};
  const fields = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const field of fields) {
    if (UNION_SET.has(field)) {
      out[field] = mergeArrayUnion(field, local[field], remote[field]);
    } else if (ID_SET.has(field) || SCALAR_ARR_SET.has(field) || field === 'teacherSchedule') {
      // A device whose blob LACKS this key entirely is running an older build that predates the
      // field — it cannot have meaningfully edited or deleted anything here, so its absence must NOT
      // be read as a mass delete that wipes records the other side added. (This is what made a newly
      // added list — e.g. Event Promotion — "disappear when someone else adds a person" while some
      // devices were still on the old version.) Only run the delete-honoring 3-way merge when BOTH
      // sides actually carry the key; otherwise keep whichever side has it.
      if (!(field in local) && (field in remote)) out[field] = remote[field];
      else if (!(field in remote) && (field in local)) out[field] = local[field];
      else out[field] = mergeArray(field, base[field], local[field], remote[field]);
    } else if (OBJ_SET.has(field)) {
      out[field] = mergeObject(base[field], local[field], remote[field]);
    } else if (SCALAR_SET.has(field)) {
      out[field] = !eq(local[field], base[field]) ? local[field] : (field in remote ? remote[field] : local[field]);
    } else {
      // Unknown / meta field (e.g. _clearedAt): prefer local if present, else remote.
      out[field] = (field in local) ? local[field] : remote[field];
    }
  }
  return out;
}

export const _internals = { mergeArray, mergeObject, keyFor, tsOf, eq };
