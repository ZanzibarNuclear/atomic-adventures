import { applyCharacterState, captureCharacterState } from "../../composables/useCharacterState.js";

const QUEST_STATUSES = new Set([
  "unavailable", "available", "active", "completed", "failed", "abandoned",
]);

export function applyEffectsAtomically(effects = [], {
  character,
  flags = new Set(),
  now = () => new Date().toISOString(),
}) {
  const draft = captureCharacterState(character);
  const draftFlags = new Set(flags);
  const definitions = character.definitions ?? {};
  try {
    for (const effect of effects) applyEffect(draft, draftFlags, definitions, effect, now);
  } catch (error) {
    return { ok: false, error: error.message, effect: error.effect };
  }
  applyCharacterState(character, draft);
  flags.clear();
  for (const flag of draftFlags) flags.add(flag);
  return { ok: true };
}

function applyEffect(state, flags, definitions, effect, now) {
  const fail = (message) => {
    const error = new Error(message);
    error.effect = effect;
    throw error;
  };
  const [domain, operation] = String(effect?.op ?? "").split(".");
  if (!domain || !operation) fail("Effect operation is required.");

  if (domain === "flag") {
    if (!effect.id) fail("Flag ID is required.");
    if (operation === "set") flags.add(effect.id);
    else if (operation === "clear") flags.delete(effect.id);
    else fail(`Unsupported flag operation "${operation}".`);
    return;
  }

  const catalog = catalogFor(definitions, domain);
  if (!catalog[effect.id]) fail(`Unknown ${domain} "${effect.id}".`);

  if (domain === "item") {
    const quantity = positive(effect.quantity, 1);
    const current = state.holdings.items[effect.id]?.quantity ?? 0;
    const maximum = Number(catalog[effect.id].maxQuantity ?? (catalog[effect.id].carrying === "unique" ? 1 : Infinity));
    if (operation === "add") {
      if (current + quantity > maximum) fail(`Adding ${effect.id} exceeds its maximum quantity.`);
      state.holdings.items[effect.id] = { quantity: current + quantity };
    } else if (operation === "remove") {
      if (current < quantity) fail(`Not enough ${effect.id} to remove.`);
      if (current === quantity) delete state.holdings.items[effect.id];
      else state.holdings.items[effect.id] = { quantity: current - quantity };
    } else fail(`Unsupported item operation "${operation}".`);
    return;
  }

  if (domain === "stat") {
    const definition = catalog[effect.id];
    const current = state.stats[effect.id] ?? definition.default ?? 0;
    let next;
    if (operation === "set") next = effect.value;
    else if (operation === "add") next = Number(current) + Number(effect.value);
    else fail(`Unsupported stat operation "${operation}".`);
    if (typeof next === "number") {
      if (Number.isFinite(Number(definition.min))) next = Math.max(next, Number(definition.min));
      if (Number.isFinite(Number(definition.max))) next = Math.min(next, Number(definition.max));
    }
    state.stats[effect.id] = next;
    return;
  }

  if (domain === "knowledge") {
    if (operation === "acquire") state.knowledge[effect.id] ??= { acquiredAt: now() };
    else if (operation === "forget") delete state.knowledge[effect.id];
    else fail(`Unsupported knowledge operation "${operation}".`);
    return;
  }

  if (domain === "skill") {
    const definition = catalog[effect.id];
    const skill = state.skills[effect.id] ?? { rank: 0, evidence: {} };
    if (operation === "acquire") skill.rank = Math.max(1, skill.rank);
    else if (operation === "set-rank") skill.rank = Number(effect.rank);
    else if (operation === "add-rank") skill.rank += Number(effect.rank ?? 1);
    else if (operation === "add-evidence") {
      if (!effect.evidence) fail("Skill evidence ID is required.");
      skill.evidence[effect.evidence] = (skill.evidence[effect.evidence] ?? 0) + Number(effect.value ?? 1);
    } else fail(`Unsupported skill operation "${operation}".`);
    if (skill.rank < 0 || skill.rank > Number(definition.maxRank ?? 1)) fail(`Skill rank for ${effect.id} is out of bounds.`);
    if (skill.rank > 0) skill.acquiredAt ??= now();
    state.skills[effect.id] = skill;
    return;
  }

  if (domain === "quest") {
    const quest = state.quests[effect.id] ?? { status: "unavailable", objectives: {} };
    if (operation === "make-available") quest.status = "available";
    else if (operation === "start") quest.status = "active";
    else if (operation === "set-status") {
      if (!QUEST_STATUSES.has(effect.status)) fail(`Unknown quest status "${effect.status}".`);
      quest.status = effect.status;
    } else if (operation === "advance-objective") {
      const objective = objectiveState(quest, effect.objective, fail);
      objective.count = (objective.count ?? 0) + Number(effect.value ?? 1);
      objective.status = "active";
    } else if (operation === "complete-objective") {
      const objective = objectiveState(quest, effect.objective, fail);
      objective.status = "completed";
    } else fail(`Unsupported quest operation "${operation}".`);
    state.quests[effect.id] = quest;
    return;
  }

  if (domain === "document") {
    const document = state.documents[effect.id] ?? {};
    if (operation === "discover") document.discoveredAt ??= now();
    else if (operation === "mark-read") {
      document.discoveredAt ??= now();
      document.readAt ??= now();
    } else fail(`Unsupported document operation "${operation}".`);
    state.documents[effect.id] = document;
    return;
  }

  fail(`Unsupported effect domain "${domain}".`);
}

function catalogFor(definitions, domain) {
  const key = domain === "item" ? "items"
    : domain === "stat" ? "stats"
      : domain === "skill" ? "skills"
        : domain === "quest" ? "quests"
          : domain === "document" ? "documents"
            : domain;
  return Object.fromEntries((definitions[key] ?? []).map((entry) => [entry.id, entry]));
}

function positive(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function objectiveState(quest, id, fail) {
  if (!id) fail("Quest objective ID is required.");
  return (quest.objectives[id] ??= { status: "pending", count: 0 });
}
