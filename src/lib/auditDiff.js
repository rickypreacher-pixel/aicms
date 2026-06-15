// ─────────────────────────────────────────────────────────────────────────────
// Audit diff — compares the church_data blob a device last synced (base) with what
// it's about to save (next) and produces a list of human-readable change records
// (who-changed-what is added by the caller). Because the app saves a whole blob,
// diffing at the save chokepoint is the cleanest way to capture create/update/delete
// without instrumenting hundreds of call sites.
//
// Pure & dependency-free so it can be unit-tested in isolation.
// ─────────────────────────────────────────────────────────────────────────────

const NAME = (o) => (o && (o.first || o.last)) ? ((o.first || '') + ' ' + (o.last || '')).trim() : '';

// Which blob arrays to audit, and how to label each record for a human reader.
// (High-churn/low-value arrays like attendance, check-ins, RSVPs and logs are
//  intentionally excluded to keep the audit trail meaningful.)
const AUDIT_ENTITIES = {
  members:      { entity: 'member',             label: (o) => NAME(o) || ('member #' + o.id) },
  visitors:     { entity: 'visitor',            label: (o) => NAME(o) || ('visitor #' + o.id) },
  prospects:    { entity: 'prospect',           label: (o) => NAME(o) || ('prospect #' + o.id) },
  children:     { entity: 'child',              label: (o) => NAME(o) || ('child #' + o.id) },
  users:        { entity: 'app user',           label: (o) => o.email || ('user #' + o.id) },
  roles:        { entity: 'role',               label: (o) => o.name || ('role ' + o.id) },
  groups:       { entity: 'group',              label: (o) => o.name || ('group #' + o.id) },
  benevolence:  { entity: 'benevolence record', label: (o) => NAME(o) || o.recipient || o.name || ('record #' + o.id) },
  sickVisits:   { entity: 'hospital/visit',     label: (o) => NAME(o) || o.name || ('record #' + o.id) },
  equipment:    { entity: 'equipment',          label: (o) => o.name || ('item #' + o.id) },
  announcements:{ entity: 'announcement',       label: (o) => o.title || ('announcement ' + o.id) },
};

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const idOf = (o) => String(o && o.id);

// Returns an array of { action, entity, entity_id, entity_label }.
export function diffAudit(base, next) {
  base = base || {}; next = next || {};
  const changes = [];
  for (const field of Object.keys(AUDIT_ENTITIES)) {
    const cfg = AUDIT_ENTITIES[field];
    const b = Array.isArray(base[field]) ? base[field] : [];
    const n = Array.isArray(next[field]) ? next[field] : [];
    const bMap = new Map(b.map((o) => [idOf(o), o]));
    const nMap = new Map(n.map((o) => [idOf(o), o]));
    for (const [id, o] of nMap) {
      if (!bMap.has(id)) changes.push({ action: 'created', entity: cfg.entity, entity_id: id, entity_label: cfg.label(o) });
      else if (!eq(o, bMap.get(id))) changes.push({ action: 'updated', entity: cfg.entity, entity_id: id, entity_label: cfg.label(o) });
    }
    for (const [id, o] of bMap) {
      if (!nMap.has(id)) changes.push({ action: 'deleted', entity: cfg.entity, entity_id: id, entity_label: cfg.label(o) });
    }
  }
  return changes;
}

// Collapse large same-entity/same-action bursts (e.g. a CSV import) into a single
// summary row so the audit trail stays readable.
export function collapseAudit(changes, threshold = 20) {
  const groups = new Map();
  for (const c of changes) {
    const k = c.entity + '|' + c.action;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const out = [];
  for (const [k, list] of groups) {
    if (list.length > threshold) {
      const [entity, action] = k.split('|');
      out.push({ action, entity, entity_id: null, entity_label: list.length + ' ' + entity + 's (' + action + ' in bulk)' });
    } else {
      out.push(...list);
    }
  }
  return out;
}

export const AUDITED_FIELDS = Object.keys(AUDIT_ENTITIES);
