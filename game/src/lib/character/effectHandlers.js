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

export const EFFECT_HANDLERS = {
  flag: applyFlagEffect,
  item: applyItemEffect,
  stat: applyStatEffect,
  knowledge: applyKnowledgeEffect,
  skill: applySkillEffect,
  quest: applyQuestEffect,
  document: applyDocumentEffect,
};

export function catalogFor(definitions, domain) {
  const key = domain === "item" ? "items"
    : domain === "stat" ? "stats"
      : domain === "skill" ? "skills"
        : domain === "quest" ? "quests"
          : domain === "document" ? "documents"
            : domain;
  return Object.fromEntries((definitions[key] ?? []).map((entry) => [entry.id, entry]));
}

function applyFlagEffect({ flags, effect, operation, fail }) {
  if (!effect.id) fail("Flag ID is required.");
  if (operation === "set") flags.add(effect.id);
  else if (operation === "clear") flags.delete(effect.id);
  else fail(`Unsupported flag operation "${operation}".`);
}

function applyItemEffect({ state, definitions, effect, operation, fail }) {
  const quantity = positive(effect.quantity, 1);
  if (operation === "add") {
    callHoldingOperation(fail, () => {
      addItem(state.holdings, definitions, effect.id, quantity, {
        holderId: effect.holder,
      });
    });
  } else if (operation === "remove") {
    const access = effect.access ?? "carried";
    const nearbyHolderIds = effect.nearbyHolderIds ?? [];
    if (itemQuantity(state.holdings, effect.id, {
      access,
      nearbyHolderIds,
      holderId: effect.holder,
    }) < quantity) fail(`Not enough ${effect.id} to remove.`);
    callHoldingOperation(fail, () => {
      removeItem(state.holdings, definitions, effect.id, quantity, {
        access,
        nearbyHolderIds,
        holderId: effect.holder,
      });
    });
  } else if (operation === "transfer") {
    callHoldingOperation(fail, () => {
      transferHolding(state.holdings, definitions, {
        type: effect.type,
        id: effect.recordId,
        quantity,
        toHolder: effect.toHolder,
      });
    });
  } else fail(`Unsupported item operation "${operation}".`);
}

function applyStatEffect({ state, effect, operation, definition, fail }) {
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
}

function applyKnowledgeEffect({ state, effect, operation, now, fail }) {
  if (operation === "acquire") state.knowledge[effect.id] ??= { acquiredAt: now() };
  else if (operation === "forget") delete state.knowledge[effect.id];
  else fail(`Unsupported knowledge operation "${operation}".`);
}

function applySkillEffect({ state, effect, operation, definition, now, fail }) {
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
  } else if (operation === "add-evidence") {
    addSkillEvidence(skill, effect, definition, now, fail);
  } else fail(`Unsupported skill operation "${operation}".`);
  if (skill.rank < 0 || skill.rank > Number(definition.maxRank ?? 1)) {
    fail(`Skill rank for ${effect.id} is out of bounds.`);
  }
  if (skill.rank > 0) skill.acquiredAt ??= now();
  state.skills[effect.id] = skill;
}

function addSkillEvidence(skill, effect, definition, now, fail) {
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
}

function applyQuestEffect({ state, effect, operation, definition, now, fail }) {
  const quest = state.quests[effect.id] ?? { status: "unavailable", objectives: {} };
  quest.objectives ??= {};
  if (operation === "make-available") transitionQuest(quest, "available", fail);
  else if (operation === "start") transitionQuest(quest, "active", fail);
  else if (operation === "set-status") {
    if (!QUEST_STATUSES.has(effect.status)) fail(`Unknown quest status "${effect.status}".`);
    transitionQuest(quest, effect.status, fail);
  } else if (operation === "advance-objective") {
    advanceQuestObjective(quest, effect, definition, fail);
  } else if (operation === "complete-objective") {
    completeQuestObjective(quest, effect, definition, fail);
  } else fail(`Unsupported quest operation "${operation}".`);
  maybeAutoCompleteQuest(quest, definition, now);
  if (quest.status === "active") quest.startedAt ??= now();
  if (quest.status === "completed") quest.completedAt ??= now();
  state.quests[effect.id] = quest;
}

function advanceQuestObjective(quest, effect, definition, fail) {
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
}

function completeQuestObjective(quest, effect, definition, fail) {
  if (quest.status !== "active") fail(`Quest ${effect.id} must be active to complete an objective.`);
  const objectiveDefinition = questObjective(definition, effect.objective, fail);
  const objective = objectiveState(quest, effect.objective, fail);
  objective.status = "completed";
  if (objectiveDefinition.target != null) objective.count = objectiveDefinition.target;
}

function maybeAutoCompleteQuest(quest, definition, now) {
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
}

function applyDocumentEffect({ state, effect, operation, now, fail }) {
  const document = state.documents[effect.id] ?? {};
  if (operation === "discover") document.discoveredAt ??= now();
  else if (operation === "mark-read") {
    document.discoveredAt ??= now();
    document.readAt ??= now();
  } else fail(`Unsupported document operation "${operation}".`);
  state.documents[effect.id] = document;
}

function callHoldingOperation(fail, operation) {
  try {
    operation();
  } catch (error) {
    fail(error.message);
  }
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
