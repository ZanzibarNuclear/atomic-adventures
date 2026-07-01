import { hasFlag } from "../maps/composables/useFlags.js";

export function lessonAvailable(lesson, { flags = new Set(), character = null } = {}) {
  const availability = lesson?.availableWhen ?? {};
  return groupMatches(availability.flags, (id) => hasFlag(flags, id)) &&
    groupMatches(availability.knowledge, (id) => Boolean(character?.knowledge?.[id]));
}

function groupMatches(group = {}, has) {
  const all = group.all ?? [];
  const any = group.any ?? [];
  const not = group.not ?? [];
  if (all.some((id) => !has(id))) return false;
  if (any.length && !any.some((id) => has(id))) return false;
  if (not.some((id) => has(id))) return false;
  return true;
}
