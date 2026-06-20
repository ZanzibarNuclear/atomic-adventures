import { applyCharacterState, captureCharacterState } from "../../composables/useCharacterState.js";
import { evaluateRequirements } from "./requirements.js";
import {
  addItem,
  itemQuantity,
  removeItem,
  transferHolding,
} from "./holdings.js";

const QUEST_STATUSES = new Set([
  "unavailable", "available", "active", "completed", "failed", "abandoned",
]);
const QUEST_TRANSITIONS = {
  unavailable: new Set(["available", "active"]),
  available: new Set(["active", "failed", "abandoned"]),
  active: new Set(["completed", "failed", "abandoned"]),
  abandoned: new Set(["active"]),
  completed: new Set(),
  failed: new Set(),
};

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
    evaluateSkillAwards(draft, draftFlags, definitions, now);
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
    if (operation === "add") {
      try {
        addItem(state.holdings, definitions, effect.id, quantity, {
          holderId: effect.holder,
        });
      } catch (error) {
        fail(error.message);
      }
    } else if (operation === "remove") {
      if (itemQuantity(state.holdings, effect.id, {
        access: effect.access ?? "carried",
        nearbyHolderIds: effect.nearbyHolderIds ?? [],
        holderId: effect.holder,
      }) < quantity) fail(`Not enough ${effect.id} to remove.`);
      try {
        removeItem(state.holdings, definitions, effect.id, quantity, {
          access: effect.access ?? "carried",
          nearbyHolderIds: effect.nearbyHolderIds ?? [],
          holderId: effect.holder,
        });
      } catch (error) {
        fail(error.message);
      }
    } else if (operation === "transfer") {
      try {
        transferHolding(state.holdings, definitions, {
          type: effect.type,
          id: effect.recordId,
          quantity,
          toHolder: effect.toHolder,
        });
      } catch (error) {
        fail(error.message);
      }
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
    const skill = state.skills[effect.id] ?? {
      rank: 0,
      evidence: {},
      evidenceEvents: {},
      awards: {},
    };
    skill.evidence ??= {};
    skill.evidenceEvents ??= {};
    skill.awards ??= {};
    if (operation === "acquire") skill.rank = Math.max(1, skill.rank);
    else if (operation === "set-rank") {
      const rank = Number(effect.rank);
      if (!Number.isInteger(rank)) fail("Skill rank must be an integer.");
      skill.rank = rank;
    } else if (operation === "add-rank") {
      const rank = Number(effect.rank ?? 1);
      if (!Number.isInteger(rank)) fail("Skill rank change must be an integer.");
      skill.rank += rank;
    }
    else if (operation === "add-evidence") {
      if (!effect.evidence) fail("Skill evidence ID is required.");
      const evidenceDefinitions = definition.practice?.evidence ?? [];
      if (!evidenceDefinitions.some((entry) => entry.id === effect.evidence)) {
        fail(`Unknown evidence "${effect.evidence}" for skill ${effect.id}.`);
      }
      if (effect.once === true) {
        if (!effect.event) fail("One-time skill evidence requires an event ID.");
        if (skill.evidenceEvents[effect.event]) return;
        skill.evidenceEvents[effect.event] = now();
      }
      const value = Number(effect.value ?? 1);
      if (!Number.isFinite(value) || value <= 0) {
        fail("Skill evidence value must be a positive number.");
      }
      skill.evidence[effect.evidence] = (skill.evidence[effect.evidence] ?? 0) + value;
    } else fail(`Unsupported skill operation "${operation}".`);
    if (skill.rank < 0 || skill.rank > Number(definition.maxRank ?? 1)) fail(`Skill rank for ${effect.id} is out of bounds.`);
    if (skill.rank > 0) skill.acquiredAt ??= now();
    state.skills[effect.id] = skill;
    return;
  }

  if (domain === "quest") {
    const definition = catalog[effect.id];
    const quest = state.quests[effect.id] ?? { status: "unavailable", objectives: {} };
    quest.objectives ??= {};
    if (operation === "make-available") transitionQuest(quest, "available", fail);
    else if (operation === "start") transitionQuest(quest, "active", fail);
    else if (operation === "set-status") {
      if (!QUEST_STATUSES.has(effect.status)) fail(`Unknown quest status "${effect.status}".`);
      transitionQuest(quest, effect.status, fail);
    } else if (operation === "advance-objective") {
      if (quest.status !== "active") fail(`Quest ${effect.id} must be active to advance an objective.`);
      const objectiveDefinition = questObjective(definition, effect.objective, fail);
      const objective = objectiveState(quest, effect.objective, fail);
      const value = Number(effect.value ?? 1);
      if (!Number.isFinite(value) || value <= 0) fail("Quest objective progress must be a positive number.");
      objective.count = (objective.count ?? 0) + value;
      objective.status = "active";
      if (objectiveDefinition.target != null && objective.count >= objectiveDefinition.target) {
        objective.count = objectiveDefinition.target;
        objective.status = "completed";
      }
    } else if (operation === "complete-objective") {
      if (quest.status !== "active") fail(`Quest ${effect.id} must be active to complete an objective.`);
      const objectiveDefinition = questObjective(definition, effect.objective, fail);
      const objective = objectiveState(quest, effect.objective, fail);
      objective.status = "completed";
      if (objectiveDefinition.target != null) objective.count = objectiveDefinition.target;
    } else fail(`Unsupported quest operation "${operation}".`);
    if (
      definition.autoComplete &&
      quest.status === "active" &&
      definition.objectives?.length &&
      definition.objectives.every((objective) =>
        quest.objectives[objective.id]?.status === "completed")
    ) {
      quest.status = "completed";
      quest.completedAt ??= now();
    }
    if (quest.status === "active") quest.startedAt ??= now();
    if (quest.status === "completed") quest.completedAt ??= now();
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

function evaluateSkillAwards(state, flags, definitions, now) {
  const skills = [...(definitions.skills ?? [])]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) ||
      String(left.id).localeCompare(String(right.id)));
  for (const definition of skills) {
    const awards = [...(definition.practice?.awards ?? [])]
      .sort((left, right) => Number(left.rank) - Number(right.rank));
    if (!awards.length) continue;
    const skill = state.skills[definition.id] ?? {
      rank: 0,
      evidence: {},
      evidenceEvents: {},
      awards: {},
    };
    skill.evidence ??= {};
    skill.evidenceEvents ??= {};
    skill.awards ??= {};
    for (const award of awards) {
      if (Number(award.rank) <= Number(skill.rank ?? 0)) continue;
      const require = requirementsForSkillAward(award.require, definition.id);
      if (!evaluateRequirements(require, { character: state, flags }).ok) break;
      skill.rank = Number(award.rank);
      skill.acquiredAt ??= now();
      skill.awards[String(award.rank)] = {
        earnedAt: now(),
        badge: award.badge ?? null,
        earnedText: award.earnedText ?? null,
      };
      state.skills[definition.id] = skill;
    }
  }
}

function requirementsForSkillAward(require = {}, skillId) {
  return {
    ...require,
    evidence: (require.evidence ?? []).map((condition) => ({
      ...condition,
      skill: condition.skill ?? skillId,
    })),
  };
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

function questObjective(definition, id, fail) {
  const objective = definition.objectives?.find((entry) => entry.id === id);
  if (!objective) fail(`Unknown objective "${id}" for quest ${definition.id}.`);
  return objective;
}

function transitionQuest(quest, next, fail) {
  const current = quest.status ?? "unavailable";
  if (current === next) return;
  if (!QUEST_TRANSITIONS[current]?.has(next)) {
    fail(`Quest cannot transition from ${current} to ${next}.`);
  }
  quest.status = next;
}
