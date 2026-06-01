export function getByPath(obj, path) {
  if (!path) return undefined;
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function applyRulesets({ rulesets, doc }) {
  const enabled = (rulesets || []).filter((r) => r && r.enabled);
  const errors = [];

  for (const r of enabled) {
    const value = getByPath(doc, r.field);
    const str = value === undefined || value === null ? '' : String(value);

    let re;
    try {
      re = new RegExp(String(r.pattern));
    } catch {
      // If a bad regex got stored somehow, treat as server error (configuration).
      errors.push({ id: r.id, name: r.name, field: r.field, error: 'Invalid regex pattern' });
      continue;
    }

    if (!re.test(str)) {
      errors.push({
        id: r.id,
        name: r.name,
        field: r.field,
        pattern: r.pattern,
        value: str,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

