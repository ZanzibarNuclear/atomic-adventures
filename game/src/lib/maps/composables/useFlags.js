// Story flags — global booleans for unlock chains (hydro startup, discoveries, etc.).

export function createFlags(initial = []) {
  return new Set(initial.filter(Boolean));
}

export function hasFlag(flags, name) {
  return !!name && typeof flags?.has === "function" && flags.has(name);
}

export function hasAllFlags(flags, names = []) {
  return names.every((n) => hasFlag(flags, n));
}

export function hasAnyFlag(flags, names = []) {
  return names.some((n) => hasFlag(flags, n));
}

export function setFlags(flags, names = []) {
  if (typeof flags?.add !== "function") return;
  for (const n of names) {
    if (n) flags.add(n);
  }
}

/** YAML `require: { all: [...], any: [...], not: [...] }` */
export function requireSatisfied(require, flags) {
  if (!require) return true;
  const all = require.all ?? [];
  const any = require.any ?? [];
  const not = require.not ?? [];
  if (all.length && !hasAllFlags(flags, all)) return false;
  if (any.length && !hasAnyFlag(flags, any)) return false;
  if (not.some((n) => hasFlag(flags, n))) return false;
  return true;
}
