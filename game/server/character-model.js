import { validateCharacterEffects } from "./character-reference-validation.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TABS = new Set(["overview", "inventory", "knowledge", "skills", "quests", "documents"]);
const VISIBILITY = new Set(["always", "when-acquired", "when-started", "hidden"]);
const STAT_TYPES = new Set(["integer", "decimal", "meter", "boolean", "enum"]);
const STAT_DIRECTIONS = new Set(["higher-is-better"]);
const STAT_TONES = new Set(["positive", "warning", "error"]);
const SKILL_MODES = new Set(["acquired", "ranked"]);
const ACTIVITIES = new Set(["resting", "light", "moderate", "strenuous"]);
const STAGE_VIEW_KINDS = new Set([
  "inventory",
  "character-stats",
  "character",
  "closeup",
  "lesson",
  "document",
  "console",
  "simulation",
]);

export function normalizeCharacterDocument(input = {}) {
  const source = input && typeof input === "object" ? structuredClone(input) : {};
  const profile = source.profile ?? {};
  const panel = source.panel ?? {};
  return {
    id: text(source.id) || "character-main",
    profile: {
      id: text(profile.id),
      name: text(profile.name),
      portrait: nullableText(profile.portrait),
      summary: nullableText(profile.summary),
    },
    panel: {
      tabs: stringList(panel.tabs),
      statGroups: normalizeOrdered(panel.statGroups),
      inventoryGroups: normalizeOrdered(panel.inventoryGroups),
    },
    holdings: normalizeHoldings(source.holdings),
    items: array(source.items).map((item) => ({
      id: text(item.id),
      label: text(item.label),
      description: nullableText(item.description),
      kind: text(item.kind) || "item",
      group: nullableText(item.group),
      icon: nullableText(item.icon),
      carrying: item.carrying === "stack" ? "stack" : "unique",
      maxQuantity: finiteNumber(item.maxQuantity, item.carrying === "stack" ? 99 : 1),
      massKg: item.massKg == null ? null : finiteNumber(item.massKg, 0),
      portable: item.portable !== false,
      visible: text(item.visible) || "when-acquired",
      relatedDocument: nullableText(item.relatedDocument),
      container: item.container && typeof item.container === "object"
        ? {
            capacity: item.container.capacity && typeof item.container.capacity === "object"
              ? structuredClone(item.container.capacity)
              : {},
            accepts: item.container.accepts && typeof item.container.accepts === "object"
              ? {
                  ...item.container.accepts,
                  kinds: stringList(item.container.accepts.kinds),
                }
              : {},
            nesting: item.container.nesting === true,
          }
        : null,
      properties: item.properties && typeof item.properties === "object"
        ? structuredClone(item.properties)
        : {},
      actions: array(item.actions).map((action) => ({
        id: text(action.id),
        label: text(action.label),
        consume: finiteNumber(action.consume, 0),
        consumeOptions: array(action.consumeOptions).map((option) => ({
          id: text(option.id),
          label: text(option.label),
          portion: option.portion == null ? null : finiteNumber(option.portion, 0),
          remaining: option.remaining === true,
        })),
        depletedItem: nullableText(action.depletedItem),
        timeMinutes: finiteNumber(action.timeMinutes, 0),
        activity: text(action.activity) || "light",
        effects: array(action.effects).map((effect) => structuredClone(effect)),
        view: action.view && typeof action.view === "object"
          ? structuredClone(action.view)
          : null,
      })),
    })),
    stats: array(source.stats).map((stat, index) => ({
      ...stat,
      id: text(stat.id),
      label: text(stat.label),
      type: text(stat.type) || "integer",
      group: nullableText(stat.group),
      order: finiteNumber(stat.order, index),
      visible: text(stat.visible) || "always",
    })),
    knowledge: normalizeCatalog(source.knowledge),
    skills: array(source.skills).map((skill, index) => ({
      ...skill,
      id: text(skill.id),
      label: text(skill.label),
      mode: text(skill.mode) || "acquired",
      maxRank: finiteNumber(skill.maxRank, 1),
      rankLabels: stringList(skill.rankLabels),
      practice: {
        evidence: array(skill.practice?.evidence).map((evidence) => ({
          ...evidence,
          id: text(evidence.id),
          label: text(evidence.label),
          target: finiteNumber(evidence.target, 1),
        })),
        awards: array(skill.practice?.awards).map((award) => ({
          ...award,
          rank: finiteNumber(award.rank, 0),
          badge: nullableText(award.badge),
          earnedText: nullableText(award.earnedText),
          require: award.require && typeof award.require === "object"
            ? structuredClone(award.require)
            : {},
        })),
      },
      order: finiteNumber(skill.order, index),
      visible: text(skill.visible) || "when-acquired",
    })),
    quests: array(source.quests).map((quest, index) => ({
      ...quest,
      id: text(quest.id),
      label: text(quest.label),
      order: finiteNumber(quest.order, index),
      visible: text(quest.visible) || "when-started",
      autoComplete: quest.autoComplete === true,
      objectives: normalizeCatalog(quest.objectives).map((objective) => ({
        ...objective,
        target: objective.target == null ? null : finiteNumber(objective.target, 0),
      })),
    })),
    documents: normalizeCatalog(source.documents, "title"),
  };
}

export function applyCharacterRenames(character, renames = []) {
  const maps = Object.fromEntries(
    ["items", "stats", "knowledge", "skills", "quests", "documents"]
      .map((domain) => [domain, renameMapFor(renames, domain)]),
  );
  if (!Object.values(maps).some((map) => map.size)) return character;
  const rename = (domain, value) => resolveRename(maps[domain] ?? new Map(), value);

  for (const domain of Object.keys(maps)) {
    for (const entry of character[domain] ?? []) entry.id = rename(domain, entry.id);
  }
  for (const item of character.items ?? []) {
    if (item.relatedDocument) item.relatedDocument = rename("documents", item.relatedDocument);
    for (const action of item.actions ?? []) renameEffects(action.effects, rename);
  }
  for (const stack of Object.values(character.holdings?.stacks ?? {})) {
    if (stack.item) stack.item = rename("items", stack.item);
  }
  for (const instance of Object.values(character.holdings?.instances ?? {})) {
    if (instance.item) instance.item = rename("items", instance.item);
  }
  for (const skill of character.skills ?? []) {
    for (const award of skill.practice?.awards ?? []) renameRequirements(award.require, rename);
  }
  return character;
}

export function validateCharacterDocument(input) {
  const character = normalizeCharacterDocument(input);
  const errors = {};
  const warnings = [];
  const add = (path, message) => ((errors[path] ??= []).push(message));

  if (character.id !== "character-main") add("id", 'Character document ID must be "character-main".');
  if (!ID_PATTERN.test(character.profile.id)) add("profile.id", "Use a kebab-case profile ID.");
  if (!character.profile.name) add("profile.name", "Character name is required.");

  const statGroups = validateIds(character.panel.statGroups, "panel.statGroups", add);
  const inventoryGroups = validateIds(character.panel.inventoryGroups, "panel.inventoryGroups", add);
  const duplicateTabs = new Set();
  for (const [index, tab] of character.panel.tabs.entries()) {
    if (!TABS.has(tab)) add(`panel.tabs.${index}`, `Unknown character tab "${tab}".`);
    if (duplicateTabs.has(tab)) add(`panel.tabs.${index}`, "Tabs may appear only once.");
    duplicateTabs.add(tab);
  }
  if (!character.panel.tabs.length) add("panel.tabs", "Choose at least one character tab.");

  const itemIds = validateIds(character.items, "items", add);
  validateHoldings(character.holdings, itemIds, add);
  character.items.forEach((item, index) => {
    const base = `items.${index}`;
    if (!item.label) add(`${base}.label`, "Item label is required.");
    if (item.group && !inventoryGroups.has(item.group)) add(`${base}.group`, `Unknown inventory group "${item.group}".`);
    if (!["unique", "stack"].includes(item.carrying)) add(`${base}.carrying`, "Use unique or stack.");
    if (!(item.maxQuantity >= 1)) add(`${base}.maxQuantity`, "Maximum quantity must be at least 1.");
    if (item.carrying === "unique" && item.maxQuantity !== 1) {
      add(`${base}.maxQuantity`, "Unique items must have a maximum quantity of 1.");
    }
    if (item.massKg != null && item.massKg < 0) add(`${base}.massKg`, "Item mass cannot be negative.");
    if (!VISIBILITY.has(item.visible)) add(`${base}.visible`, "Choose a supported visibility.");
    if (item.container) {
      if (
        item.container.capacity.slots != null &&
        (!Number.isInteger(Number(item.container.capacity.slots)) ||
          Number(item.container.capacity.slots) < 1)
      ) {
        add(`${base}.container.capacity.slots`, "Slot capacity must be a positive integer.");
      }
      if (
        item.container.capacity.massKg != null &&
        (!Number.isFinite(Number(item.container.capacity.massKg)) ||
          Number(item.container.capacity.massKg) <= 0)
      ) {
        add(`${base}.container.capacity.massKg`, "Mass capacity must be positive.");
      }
    }
    const actionIds = new Set();
    item.actions.forEach((action, actionIndex) => {
      const actionBase = `${base}.actions.${actionIndex}`;
      if (!ID_PATTERN.test(action.id)) add(`${actionBase}.id`, "Use a kebab-case action ID.");
      if (actionIds.has(action.id)) add(`${actionBase}.id`, "Item action IDs must be unique.");
      actionIds.add(action.id);
      if (!action.label) add(`${actionBase}.label`, "Item action label is required.");
      if (action.consume < 0) add(`${actionBase}.consume`, "Consume quantity cannot be negative.");
      if (action.timeMinutes < 0) add(`${actionBase}.timeMinutes`, "Time cannot be negative.");
      if (!ACTIVITIES.has(action.activity)) add(`${actionBase}.activity`, "Choose a supported activity profile.");
      if (action.view) {
        if (!STAGE_VIEW_KINDS.has(text(action.view.kind))) {
          add(`${actionBase}.view.kind`, "Choose a supported stage view.");
        }
        if (action.view.kind === "document" && !text(action.view.id)) {
          add(`${actionBase}.view.id`, "Choose a document.");
        }
      }
    });
  });

  validateIds(character.stats, "stats", add);
  character.stats.forEach((stat, index) => {
    const base = `stats.${index}`;
    if (!stat.label) add(`${base}.label`, "Stat label is required.");
    if (!STAT_TYPES.has(stat.type)) add(`${base}.type`, "Choose a supported stat type.");
    if (stat.group && !statGroups.has(stat.group)) add(`${base}.group`, `Unknown stat group "${stat.group}".`);
    if (!VISIBILITY.has(stat.visible)) add(`${base}.visible`, "Choose a supported visibility.");
    if (stat.direction && !STAT_DIRECTIONS.has(stat.direction)) {
      add(`${base}.direction`, "Choose a supported stat direction.");
    }
    for (const [activity, rate] of Object.entries(stat.drift?.perGameHour ?? {})) {
      if (!ACTIVITIES.has(activity)) add(`${base}.drift.perGameHour.${activity}`, "Unknown activity profile.");
      if (!Number.isFinite(Number(rate))) add(`${base}.drift.perGameHour.${activity}`, "Drift rate must be numeric.");
    }
    (stat.thresholds ?? []).forEach((threshold, thresholdIndex) => {
      if (!Number.isFinite(Number(threshold.at))) {
        add(`${base}.thresholds.${thresholdIndex}.at`, "Threshold must be numeric.");
      }
      if (!text(threshold.state)) {
        add(`${base}.thresholds.${thresholdIndex}.state`, "Threshold state is required.");
      }
    });
    (stat.displayStates ?? []).forEach((state, stateIndex) => {
      if (!Number.isFinite(Number(state.at))) {
        add(`${base}.displayStates.${stateIndex}.at`, "Display state minimum must be numeric.");
      }
      if (!text(state.state)) {
        add(`${base}.displayStates.${stateIndex}.state`, "Display state label is required.");
      }
      if (state.tone && !STAT_TONES.has(text(state.tone))) {
        add(`${base}.displayStates.${stateIndex}.tone`, "Choose positive, warning, or error.");
      }
    });
  });

  validateIds(character.knowledge, "knowledge", add);
  character.knowledge.forEach((entry, index) => {
    if (!entry.label) add(`knowledge.${index}.label`, "Knowledge label is required.");
  });

  validateIds(character.skills, "skills", add);
  character.skills.forEach((skill, index) => {
    const base = `skills.${index}`;
    if (!skill.label) add(`${base}.label`, "Skill label is required.");
    if (!SKILL_MODES.has(skill.mode)) add(`${base}.mode`, "Use acquired or ranked.");
    if (skill.mode === "ranked" && !(skill.maxRank >= 1)) add(`${base}.maxRank`, "Ranked skills require maxRank of at least 1.");
    if (skill.rankLabels.length && skill.rankLabels.length !== skill.maxRank) {
      add(`${base}.rankLabels`, "Provide one rank label for each rank.");
    }
    const evidenceIds = validateIds(skill.practice.evidence, `${base}.practice.evidence`, add);
    skill.practice.evidence.forEach((evidence, evidenceIndex) => {
      if (!evidence.label) add(`${base}.practice.evidence.${evidenceIndex}.label`, "Evidence label is required.");
      if (!(evidence.target >= 1)) add(`${base}.practice.evidence.${evidenceIndex}.target`, "Evidence target must be at least 1.");
    });
    let previousRank = 0;
    skill.practice.awards.forEach((award, awardIndex) => {
      const awardBase = `${base}.practice.awards.${awardIndex}`;
      if (!(award.rank >= 1 && award.rank <= skill.maxRank)) {
        add(`${awardBase}.rank`, "Award rank must be within the skill's rank range.");
      }
      if (award.rank <= previousRank) add(`${awardBase}.rank`, "Awards must be ordered by increasing rank.");
      previousRank = award.rank;
      array(award.require?.evidence).forEach((condition, conditionIndex) => {
        if (!evidenceIds.has(text(condition.id))) {
          add(`${awardBase}.require.evidence.${conditionIndex}.id`, `Unknown evidence "${condition.id}".`);
        }
      });
    });
  });

  validateIds(character.quests, "quests", add);
  character.quests.forEach((quest, index) => {
    if (!quest.label) add(`quests.${index}.label`, "Quest label is required.");
    validateIds(quest.objectives, `quests.${index}.objectives`, add);
    quest.objectives.forEach((objective, objectiveIndex) => {
      if (!objective.label) {
        add(`quests.${index}.objectives.${objectiveIndex}.label`, "Objective label is required.");
      }
      if (objective.target != null && !(objective.target >= 1)) {
        add(`quests.${index}.objectives.${objectiveIndex}.target`, "Objective target must be at least 1.");
      }
    });
  });

  const documentIds = validateIds(character.documents, "documents", add);
  character.documents.forEach((document, index) => {
    if (!document.title) add(`documents.${index}.title`, "Document title is required.");
  });
  character.items.forEach((item, index) => {
    if (item.relatedDocument && !documentIds.has(item.relatedDocument)) {
      add(`items.${index}.relatedDocument`, `Unknown document "${item.relatedDocument}".`);
    }
  });
  character.items.forEach((item, itemIndex) => {
    item.actions.forEach((action, actionIndex) => {
      validateCharacterEffects(
        action.effects,
        `items.${itemIndex}.actions.${actionIndex}.effects`,
        character,
        add,
        {
          unknownDomainPath: "id",
          unknownReferenceMessage: (domain, id) => `Unknown ${domain || "effect"} "${id}".`,
        },
      );
    });
  });

  if (!itemIds.size) warnings.push({ path: "items", message: "The item catalog is empty." });
  return { character, errors, warnings, valid: Object.keys(errors).length === 0 };
}

function normalizeHoldings(value) {
  if (!value || typeof value !== "object") return null;
  return {
    holders: plainObject(value.holders),
    stacks: plainObject(value.stacks),
    instances: plainObject(value.instances),
    nextId: finiteNumber(value.nextId, 1),
  };
}

function validateHoldings(holdings, itemIds, add) {
  if (!holdings) return;
  const holderIds = new Set(Object.keys(holdings.holders ?? {}));
  for (const [id, stack] of Object.entries(holdings.stacks ?? {})) {
    if (!itemIds.has(text(stack.item))) add(`holdings.stacks.${id}.item`, `Unknown item "${stack.item}".`);
    if (!holderIds.has(text(stack.holder))) add(`holdings.stacks.${id}.holder`, `Unknown holder "${stack.holder}".`);
    if (!(finiteNumber(stack.quantity, 0) > 0)) add(`holdings.stacks.${id}.quantity`, "Quantity must be positive.");
  }
  for (const [id, instance] of Object.entries(holdings.instances ?? {})) {
    if (!itemIds.has(text(instance.item))) add(`holdings.instances.${id}.item`, `Unknown item "${instance.item}".`);
    if (!holderIds.has(text(instance.holder))) add(`holdings.instances.${id}.holder`, `Unknown holder "${instance.holder}".`);
  }
}

function normalizeCatalog(value, labelField = "label") {
  return array(value).map((entry, index) => ({
    ...entry,
    id: text(entry.id),
    [labelField]: text(entry[labelField]),
    order: finiteNumber(entry.order, index),
    visible: text(entry.visible) || "when-acquired",
  }));
}

function normalizeOrdered(value) {
  return array(value).map((entry, index) => ({
    id: text(entry.id),
    label: text(entry.label),
    order: finiteNumber(entry.order, index),
  }));
}

function validateIds(items, path, add) {
  const ids = new Set();
  items.forEach((item, index) => {
    if (!ID_PATTERN.test(item.id)) add(`${path}.${index}.id`, "Use a unique kebab-case ID.");
    if (ids.has(item.id)) add(`${path}.${index}.id`, "IDs must be unique within this catalog.");
    ids.add(item.id);
  });
  return ids;
}

function renameRequirements(require, rename) {
  if (!require || typeof require !== "object") return;
  for (const domain of ["items", "knowledge", "documents"]) {
    renameGroup(require[domain], domain, rename);
  }
  for (const domain of ["stats", "skills", "quests"]) {
    for (const condition of require[domain] ?? []) {
      if (condition?.id) condition.id = rename(domain, condition.id);
    }
  }
  for (const condition of require.evidence ?? []) {
    if (condition?.skill) condition.skill = rename("skills", condition.skill);
  }
}

function renameGroup(value, domain, rename) {
  const groups = Array.isArray(value) ? { all: value } : value ?? {};
  for (const key of ["all", "any", "not"]) {
    for (const [index, entry] of (groups[key] ?? []).entries()) {
      if (typeof entry === "string") groups[key][index] = rename(domain, entry);
      else if (entry?.id) entry.id = rename(domain, entry.id);
    }
  }
}

function renameEffects(effects = [], rename) {
  for (const effect of effects) {
    const domain = effectDomain(effect.op);
    if (domain && effect.id) effect.id = rename(domain, effect.id);
  }
}

function effectDomain(op) {
  const raw = String(op ?? "").split(".")[0];
  return {
    item: "items",
    stat: "stats",
    knowledge: "knowledge",
    skill: "skills",
    quest: "quests",
    document: "documents",
  }[raw] ?? (["items", "stats", "knowledge", "skills", "quests", "documents"].includes(raw) ? raw : null);
}

function renameMapFor(renames, domain) {
  return new Map(
    renames
      .filter((rename) => rename?.domain === domain && rename.from && rename.to)
      .map((rename) => [String(rename.from), String(rename.to)]),
  );
}

function resolveRename(map, value) {
  let current = value;
  const seen = new Set();
  while (map.has(current) && !seen.has(current)) {
    seen.add(current);
    current = map.get(current);
  }
  return current;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? structuredClone(value)
    : {};
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function nullableText(value) {
  return text(value) || null;
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(text).filter(Boolean);
  return [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
