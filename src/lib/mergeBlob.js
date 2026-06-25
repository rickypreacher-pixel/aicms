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
  'sickVisits','benevolence','hospitalityFund',
];
// Arrays of bare scalar values (e.g. ids), merged as a set.
const SCALAR_ARRAYS = ['followupDismissedChildIds', 'adminNotesRead'];
// Objects merged per top-level key (additive — keys are never dropped).
// careContacted = Care Pulse {memberId: ISODate} snooze marks; additive so marks from any device survive.
const OBJECT_FIELDS = ['permissions','churchSettings','emailConfig','cleaningSchedule','eventSchedule','careContacted'];
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
  if (SCALAR_ARR_SET.has(field)) return String(item);
  return String(item && item.id);
}

// Best-effort recency for the edit-vs-edit tiebreak.
function tsOf(item) {
  const t = item && (item.at || item.updatedAt || item.createdAt || item.date);
  const n = t ? new Date(t).getTime() : 0;
  return Number.isFinite(n) ? n : 0;
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
      else out.push(tsOf(L) >= tsOf(R) ? L : R); // both changed → newer wins, tie → local
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
    if (ID_SET.has(field) || SCALAR_ARR_SET.has(field) || field === 'teacherSchedule') {
      out[field] = mergeArray(field, base[field], local[field], remote[field]);
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
