const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TABS = new Set(["overview", "inventory", "knowledge", "skills", "quests", "documents"]);
const VISIBILITY = new Set(["always", "when-acquired", "when-started", "hidden"]);
const STAT_TYPES = new Set(["integer", "decimal", "meter", "boolean", "enum"]);
const SKILL_MODES = new Set(["acquired", "ranked"]);

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
    items: array(source.items).map((item) => ({
      id: text(item.id),
      label: text(item.label),
      description: nullableText(item.description),
      kind: text(item.kind) || "item",
      group: nullableText(item.group),
      icon: nullableText(item.icon),
      tags: stringList(item.tags),
      carrying: item.carrying === "stack" ? "stack" : "unique",
      maxQuantity: finiteNumber(item.maxQuantity, item.carrying === "stack" ? 99 : 1),
      portable: item.portable !== false,
      visible: text(item.visible) || "when-acquired",
      relatedDocument: nullableText(item.relatedDocument),
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
      order: finiteNumber(skill.order, index),
      visible: text(skill.visible) || "when-acquired",
    })),
    quests: array(source.quests).map((quest, index) => ({
      ...quest,
      id: text(quest.id),
      label: text(quest.label),
      order: finiteNumber(quest.order, index),
      visible: text(quest.visible) || "when-started",
      objectives: normalizeCatalog(quest.objectives),
    })),
    documents: normalizeCatalog(source.documents, "title"),
  };
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
  character.items.forEach((item, index) => {
    const base = `items.${index}`;
    if (!item.label) add(`${base}.label`, "Item label is required.");
    if (item.group && !inventoryGroups.has(item.group)) add(`${base}.group`, `Unknown inventory group "${item.group}".`);
    if (!["unique", "stack"].includes(item.carrying)) add(`${base}.carrying`, "Use unique or stack.");
    if (!(item.maxQuantity >= 1)) add(`${base}.maxQuantity`, "Maximum quantity must be at least 1.");
    if (item.carrying === "unique" && item.maxQuantity !== 1) {
      add(`${base}.maxQuantity`, "Unique items must have a maximum quantity of 1.");
    }
    if (!VISIBILITY.has(item.visible)) add(`${base}.visible`, "Choose a supported visibility.");
  });

  validateIds(character.stats, "stats", add);
  character.stats.forEach((stat, index) => {
    const base = `stats.${index}`;
    if (!stat.label) add(`${base}.label`, "Stat label is required.");
    if (!STAT_TYPES.has(stat.type)) add(`${base}.type`, "Choose a supported stat type.");
    if (stat.group && !statGroups.has(stat.group)) add(`${base}.group`, `Unknown stat group "${stat.group}".`);
    if (!VISIBILITY.has(stat.visible)) add(`${base}.visible`, "Choose a supported visibility.");
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
  });

  validateIds(character.quests, "quests", add);
  character.quests.forEach((quest, index) => {
    if (!quest.label) add(`quests.${index}.label`, "Quest label is required.");
    validateIds(quest.objectives, `quests.${index}.objectives`, add);
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

  if (!itemIds.size) warnings.push({ path: "items", message: "The item catalog is empty." });
  return { character, errors, warnings, valid: Object.keys(errors).length === 0 };
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

function array(value) {
  return Array.isArray(value) ? value : [];
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
