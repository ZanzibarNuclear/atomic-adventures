const GROUP_DOMAINS = ["items", "knowledge", "documents"];
const CONDITION_DOMAINS = ["stats", "skills", "quests"];
const EFFECT_DOMAINS = {
  item: "items",
  stat: "stats",
  knowledge: "knowledge",
  skill: "skills",
  quest: "quests",
  document: "documents",
};

export function characterCatalogs(character = {}) {
  return Object.fromEntries(
    ["items", "stats", "knowledge", "skills", "quests", "documents"]
      .map((key) => [key, new Set((character[key] ?? []).map((entry) => entry.id))]),
  );
}

export function validateCharacterRequirements(require = {}, path, character, add, {
  groupMessage = (domain, id) => `Unknown reference "${id}".`,
  conditionMessage = (domain, id) => `Unknown ${singular(domain)} "${id}".`,
} = {}) {
  if (!character) return;
  const catalogs = characterCatalogs(character);
  for (const domain of GROUP_DOMAINS) {
    validateGroupReferences(
      require[domain],
      catalogs[domain],
      `${path}.${domain}`,
      add,
      (id) => groupMessage(domain, id),
    );
  }
  for (const domain of CONDITION_DOMAINS) {
    for (const [index, condition] of (require[domain] ?? []).entries()) {
      if (!catalogs[domain].has(condition?.id)) {
        add(`${path}.${domain}.${index}.id`, conditionMessage(domain, condition?.id));
      }
    }
  }
  for (const [index, condition] of (require.evidence ?? []).entries()) {
    if (!catalogs.skills.has(condition?.skill)) {
      add(`${path}.evidence.${index}.skill`, `Unknown skill "${condition?.skill}".`);
    }
  }
}

export function validateCharacterEffects(effects = [], path, character, add, {
  unknownDomainPath = "op",
  unknownReferencePath = "id",
  unknownDomainMessage = (domain) => `Unknown effect domain "${domain || "missing"}".`,
  unknownReferenceMessage = (domain, id) => `Unknown ${domain || "effect"} "${id}".`,
} = {}) {
  if (!character) return;
  const catalogs = characterCatalogs(character);
  effects.forEach((effect, index) => {
    const rawDomain = String(effect.op ?? "").split(".")[0];
    if (rawDomain === "flag") return;
    const catalogKey = EFFECT_DOMAINS[rawDomain] ?? rawDomain;
    if (!catalogs[catalogKey]) {
      add(`${path}.${index}.${unknownDomainPath}`, unknownDomainMessage(rawDomain));
    } else if (!catalogs[catalogKey].has(effect.id)) {
      add(`${path}.${index}.${unknownReferencePath}`, unknownReferenceMessage(rawDomain, effect.id));
    }
    validateSpecializedEffectReference(effect, `${path}.${index}`, character, add);
  });
}

export function validateGroupReferences(value, catalog, path, add, messageForId) {
  const groups = Array.isArray(value) ? { all: value } : value ?? {};
  for (const key of ["all", "any", "not"]) {
    (groups[key] ?? []).forEach((entry, index) => {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (!catalog.has(id)) add(`${path}.${key}.${index}`, messageForId(id));
    });
  }
}

function validateSpecializedEffectReference(effect, path, character, add) {
  if (effect.op === "skill.add-evidence") {
    const skill = (character.skills ?? []).find((entry) => entry.id === effect.id);
    if (!skill?.practice?.evidence?.some((entry) => entry.id === effect.evidence)) {
      add(`${path}.evidence`, `Unknown evidence "${effect.evidence}" for skill "${effect.id}".`);
    }
    if (effect.once === true && !String(effect.event ?? "").trim()) {
      add(`${path}.event`, "One-time evidence requires an event ID.");
    }
    if (!Number.isFinite(Number(effect.value ?? 1)) || Number(effect.value ?? 1) <= 0) {
      add(`${path}.value`, "Evidence value must be a positive number.");
    }
  }
  if (["quest.advance-objective", "quest.complete-objective"].includes(effect.op)) {
    const quest = (character.quests ?? []).find((entry) => entry.id === effect.id);
    if (!quest?.objectives?.some((entry) => entry.id === effect.objective)) {
      add(`${path}.objective`, `Unknown objective "${effect.objective}" for quest "${effect.id}".`);
    }
    if (
      effect.op === "quest.advance-objective" &&
      (!Number.isFinite(Number(effect.value ?? 1)) || Number(effect.value ?? 1) <= 0)
    ) {
      add(`${path}.value`, "Objective progress must be a positive number.");
    }
  }
}

function singular(domain) {
  return domain.endsWith("s") ? domain.slice(0, -1) : domain;
}
