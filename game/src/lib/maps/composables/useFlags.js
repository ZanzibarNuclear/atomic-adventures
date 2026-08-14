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

/**
 * Whether a story choice still offers something the player can do.
 * Hides pure discovery choices once every flag they set is already true
 * (e.g. "Inspect the gate" after story.gate.inspected).
 */
export function isStoryChoiceAvailable(choice, flags) {
  if (!choice || choice.disabled) return false;
  const require = choice.require ?? choice.conditions ?? null;
  if (require && !requireSatisfied(require, flags)) return false;

  const sets = [
    ...(Array.isArray(choice.set_flags) ? choice.set_flags : []),
    ...(Array.isArray(choice.sets) ? choice.sets : []),
  ].filter(Boolean);
  if (!sets.length) return true;

  const hasOtherEffect =
    Boolean(choice.go_hex) ||
    Boolean(choice.go_room) ||
    Boolean(choice.go_exterior_node) ||
    Boolean(choice.enter) ||
    Boolean(choice.openPassage || choice.open_passage) ||
    Boolean(choice.closePassage || choice.close_passage) ||
    Boolean(choice.crossPassage || choice.cross_passage) ||
    Boolean(choice.view) ||
    (Array.isArray(choice.effects) && choice.effects.length > 0) ||
    (Array.isArray(choice.grantMilestones) && choice.grantMilestones.length > 0);

  // Flag-only choices are one-shot once all their flags are already set.
  if (!hasOtherEffect && sets.every((name) => hasFlag(flags, name))) {
    return false;
  }
  return true;
}
