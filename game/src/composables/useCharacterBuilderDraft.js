import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { storyApi } from "../lib/storyApi.js";
import {
  addItem,
  createHoldings,
  itemQuantity,
} from "../lib/character/holdings.js";

const characterCatalogs = [
  { id: "stats", label: "Stats" },
  { id: "knowledge", label: "Knowledge" },
  { id: "skills", label: "Skills" },
  { id: "quests", label: "Quests" },
];
const artifactCatalogs = [
  { id: "items", label: "Items" },
  { id: "documents", label: "Documents" },
];

export const tabOptions = ["overview", "inventory", "knowledge", "skills", "quests", "documents"];
export const visibilityOptions = ["always", "when-acquired", "when-started", "hidden"];
export const previewBarLevelOptions = [
  { id: "authored", label: "Authored defaults" },
  { id: "full", label: "Full (100%)" },
  { id: "high", label: "High (80%)" },
  { id: "middle", label: "Middle (50%)" },
  { id: "low", label: "Low (25%)" },
  { id: "critical", label: "Critical (5%)" },
  { id: "empty", label: "Empty (0%)" },
];

const previewBarLevelValues = {
  full: 100,
  high: 80,
  middle: 50,
  low: 25,
  critical: 5,
  empty: 0,
};

const previewWellbeingStats = [
  { id: "health", label: "Health", default: 100 },
  { id: "satiety", label: "Satiety", default: 100 },
  { id: "hydration", label: "Hydration", default: 100 },
  { id: "energy", label: "Energy", default: 100 },
  { id: "composure", label: "Composure", default: 100 },
];

export function useCharacterBuilderDraft() {
  const router = useRouter();
  const route = useRoute();
  const draft = ref(null);
  const baseline = ref("");
  const version = ref(0);
  const status = ref("");
  const errors = ref({});
  const warnings = ref([]);
  const selectedCatalog = ref("stats");
  const selectedId = ref("");
  const workspaceMode = ref("character");
  const previewMode = ref("early");
  const previewBarLevel = ref("authored");
  const revisions = ref([]);
  const showHistory = ref(false);
  const pendingRoute = ref("");
  const navigationPromptVisible = ref(false);
  const savingBeforeNavigation = ref(false);

  const activeCatalogs = computed(() =>
    workspaceMode.value === "artifacts" ? artifactCatalogs : characterCatalogs,
  );
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value);
  const selectedEntry = computed(() =>
    (draft.value?.[selectedCatalog.value] ?? []).find((entry) => entry.id === selectedId.value) ?? null,
  );
  const errorMessages = computed(() =>
    Object.entries(errors.value).flatMap(([path, messages]) =>
      messages.map((message) => `${path}: ${message}`),
    ),
  );
  const previewCharacter = computed(() =>
    buildPreviewCharacter(draft.value, previewMode.value, previewBarLevel.value));
  const previewContentSummary = computed(() =>
    summarizePreviewContent(previewCharacter.value));

  const warnBeforeUnload = (event) => {
    if (!dirty.value) return;
    event.preventDefault();
    event.returnValue = "";
  };

  onMounted(async () => {
    window.addEventListener("beforeunload", warnBeforeUnload);
    await loadCharacter();
  });
  onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload));
  onBeforeRouteLeave((to) => {
    if (!dirty.value) return true;
    pendingRoute.value = to.fullPath;
    navigationPromptVisible.value = true;
    return false;
  });

  async function loadCharacter() {
    try {
      const result = await storyApi("/api/character");
      applyLoaded(result);
    } catch (error) {
      status.value = error.message;
    }
  }

  function applyLoaded(result) {
    draft.value = structuredClone(result.character);
    version.value = result.version;
    baseline.value = JSON.stringify(draft.value);
    warnings.value = result.warnings ?? [];
    errors.value = {};
    status.value = "";
    applyRouteSelection();
  }

  function ensureSelection() {
    const entries = draft.value?.[selectedCatalog.value] ?? [];
    if (!entries.some((entry) => entry.id === selectedId.value)) {
      selectedId.value = entries[0]?.id ?? "";
    }
  }

  function selectCatalog(id) {
    selectedCatalog.value = id;
    selectedId.value = draft.value?.[id]?.[0]?.id ?? "";
  }

  function selectWorkspace(mode) {
    workspaceMode.value = mode;
    if (mode === "preview" || mode === "options") return;
    const catalogs = mode === "artifacts" ? artifactCatalogs : characterCatalogs;
    if (!catalogs.some((catalog) => catalog.id === selectedCatalog.value)) {
      selectCatalog(catalogs[0].id);
    } else {
      ensureSelection();
    }
  }

  function applyRouteSelection() {
    const mode = queryText(route.query.mode);
    if (["character", "artifacts", "options", "preview"].includes(mode)) {
      workspaceMode.value = mode;
    }
    if (workspaceMode.value === "preview" || workspaceMode.value === "options") return;
    const catalogs = workspaceMode.value === "artifacts" ? artifactCatalogs : characterCatalogs;
    const catalog = queryText(route.query.catalog);
    if (catalogs.some((item) => item.id === catalog)) {
      selectedCatalog.value = catalog;
    } else if (!catalogs.some((item) => item.id === selectedCatalog.value)) {
      selectedCatalog.value = catalogs[0].id;
    }
    const id = queryText(route.query.id);
    if ((draft.value?.[selectedCatalog.value] ?? []).some((entry) => entry.id === id)) {
      selectedId.value = id;
    } else {
      ensureSelection();
    }
    if (route.query.duplicate === "1" && selectedEntry.value) {
      const copy = duplicateEntry();
      clearDuplicateRoute(copy?.id);
    }
  }

  function toggleTab(tab) {
    const tabs = draft.value.panel.tabs;
    draft.value.panel.tabs = tabs.includes(tab)
      ? tabs.filter((item) => item !== tab)
      : [...tabs, tab];
  }

  function addGroup(kind) {
    const groups = draft.value.panel[kind];
    const id = uniqueId(kind === "statGroups" ? "status" : "group", groups);
    groups.push({ id, label: labelize(id), order: groups.length * 10 + 10 });
  }

  function removeGroup(kind, id) {
    draft.value.panel[kind] = draft.value.panel[kind].filter((group) => group.id !== id);
  }

  function addEntry() {
    const entries = draft.value[selectedCatalog.value];
    const id = uniqueId(`new-${selectedCatalog.value.replace(/s$/, "")}`, entries);
    entries.push(entryDefaults(selectedCatalog.value, id, entries.length));
    selectedId.value = id;
  }

  function duplicateEntry() {
    if (!selectedEntry.value) return;
    const entries = draft.value[selectedCatalog.value];
    const copy = structuredClone(selectedEntry.value);
    copy.id = uniqueId(`${copy.id}-copy`, entries);
    if (copy.label) copy.label += " copy";
    if (copy.title) copy.title += " copy";
    entries.push(copy);
    selectedId.value = copy.id;
    return copy;
  }

  function clearDuplicateRoute(id = selectedId.value) {
    const query = { ...route.query, id };
    delete query.duplicate;
    void router.replace({ query });
  }

  function moveEntry(delta) {
    const entries = draft.value[selectedCatalog.value];
    const index = entries.findIndex((entry) => entry.id === selectedId.value);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= entries.length) return;
    const [entry] = entries.splice(index, 1);
    entries.splice(next, 0, entry);
    entries.forEach((item, order) => { item.order = order; });
  }

  async function renameEntry() {
    const entry = selectedEntry.value;
    if (!entry) return;
    const next = window.prompt("New stable ID", entry.id)?.trim();
    if (!next || next === entry.id) return;
    const references = await loadReferences(selectedCatalog.value, entry.id);
    if (references.length) {
      status.value = `Cannot rename ${entry.id}; it has ${references.length} authored reference(s).`;
      return;
    }
    entry.id = next;
    selectedId.value = next;
  }

  async function deleteEntry() {
    const entry = selectedEntry.value;
    if (!entry) return;
    const references = await loadReferences(selectedCatalog.value, entry.id);
    if (references.length) {
      status.value = `Cannot delete ${entry.id}; referenced by ${references
        .map((reference) => reference.path).join(", ")}.`;
      return;
    }
    if (!window.confirm(`Delete "${entry.label ?? entry.title ?? entry.id}"?`)) return;
    draft.value[selectedCatalog.value] = draft.value[selectedCatalog.value]
      .filter((item) => item.id !== entry.id);
    ensureSelection();
  }

  async function saveDraft() {
    errors.value = {};
    status.value = "Saving...";
    try {
      const result = await storyApi("/api/character", {
        method: "PUT",
        body: JSON.stringify({
          character: draft.value,
          expectedVersion: version.value,
        }),
      });
      applyLoaded(result);
      status.value = `Saved character version ${result.version}.`;
      return true;
    } catch (error) {
      errors.value = error.errors ?? {};
      status.value = error.status === 409
        ? "Content changed elsewhere. Reload before saving."
        : error.message;
      return false;
    }
  }

  function revertDraft() {
    draft.value = JSON.parse(baseline.value);
    errors.value = {};
    status.value = "";
    ensureSelection();
  }

  async function loadHistory() {
    revisions.value = await storyApi("/api/character/revisions");
    showHistory.value = true;
  }

  async function restoreRevision(revision) {
    if (!window.confirm(`Restore character revision ${revision}?`)) return;
    const result = await storyApi(`/api/character/revisions/${revision}/restore`, {
      method: "POST",
    });
    applyLoaded(result);
    await loadHistory();
  }

  function setCsv(target, key, event) {
    target[key] = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  function setOptionalNumber(target, key, event) {
    target[key] = event.target.value === "" ? undefined : Number(event.target.value);
  }

  function setJson(target, key, event, fallback) {
    try {
      target[key] = JSON.parse(event.target.value || JSON.stringify(fallback));
      status.value = "";
    } catch (error) {
      status.value = `Invalid JSON for ${key}: ${error.message}`;
    }
  }

  function keepEditing() {
    pendingRoute.value = "";
    navigationPromptVisible.value = false;
  }

  function discardAndLeave() {
    const route = pendingRoute.value;
    baseline.value = JSON.stringify(draft.value);
    keepEditing();
    void router.push(route);
  }

  async function saveAndLeave() {
    savingBeforeNavigation.value = true;
    const route = pendingRoute.value;
    const saved = await saveDraft();
    savingBeforeNavigation.value = false;
    if (!saved) return;
    keepEditing();
    void router.push(route);
  }

  return {
    draft,
    status,
    errors,
    warnings,
    selectedCatalog,
    selectedId,
    workspaceMode,
    previewMode,
    previewBarLevel,
    revisions,
    showHistory,
    navigationPromptVisible,
    savingBeforeNavigation,
    activeCatalogs,
    dirty,
    selectedEntry,
    errorMessages,
    previewCharacter,
    previewContentSummary,
    loadCharacter,
    selectCatalog,
    selectWorkspace,
    toggleTab,
    addGroup,
    removeGroup,
    addEntry,
    duplicateEntry,
    moveEntry,
    renameEntry,
    deleteEntry,
    saveDraft,
    revertDraft,
    loadHistory,
    restoreRevision,
    setCsv,
    setOptionalNumber,
    setJson,
    keepEditing,
    discardAndLeave,
    saveAndLeave,
    labelize,
  };
}

async function loadReferences(domain, id) {
  return storyApi(
    `/api/character/references?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`,
  );
}

export function buildPreviewCharacter(draft, previewMode, previewBarLevel = "authored") {
  const definitions = draft
    ? { ...draft, stats: [...(draft.stats ?? [])] }
    : {
    profile: {},
    panel: {},
    items: [],
    stats: [],
    knowledge: [],
    skills: [],
    quests: [],
    documents: [],
  };
  if (previewBarLevel in previewBarLevelValues) ensurePreviewWellbeingStats(definitions);
  const populated = previewMode === "populated";
  const early = previewMode === "early";
  const include = (index) => populated || (early && index === 0);
  const stats = Object.fromEntries(
    definitions.stats.map((stat) => [stat.id, previewStatValue(stat, previewBarLevel)]),
  );
  const holdings = createPreviewHoldings(definitions, include);
  return {
    definitions,
    holdings,
    stats,
    knowledge: Object.fromEntries(
      definitions.knowledge.map((entry, index) => include(index)
        ? [entry.id, { acquiredAt: "preview" }]
        : null).filter(Boolean),
    ),
    skills: Object.fromEntries(
      definitions.skills.map((entry, index) => include(index)
        ? [entry.id, { rank: 1, evidence: {}, acquiredAt: "preview" }]
        : null).filter(Boolean),
    ),
    quests: Object.fromEntries(
      definitions.quests.map((entry, index) => include(index)
        ? [entry.id, { status: index === 0 ? "active" : "available", objectives: {} }]
        : null).filter(Boolean),
    ),
    documents: Object.fromEntries(
      definitions.documents.map((entry, index) => include(index)
        ? [entry.id, { discoveredAt: "preview" }]
        : null).filter(Boolean),
    ),
  };
}

export function summarizePreviewContent(character) {
  const definitions = character?.definitions ?? {};
  return [
    {
      id: "inventory",
      label: "Inventory",
      acquired: (definitions.items ?? [])
        .filter((item) => itemQuantity(character?.holdings, item.id) > 0).length,
      total: definitions.items?.length ?? 0,
    },
    previewCount("knowledge", definitions.knowledge, character?.knowledge),
    previewCount("skills", definitions.skills, character?.skills),
    previewCount("quests", definitions.quests, character?.quests),
    previewCount("documents", definitions.documents, character?.documents),
  ];
}

function createPreviewHoldings(definitions, include) {
  const holdings = createHoldings(definitions.profile?.id ?? "player");
  for (const [index, item] of (definitions.items ?? []).entries()) {
    if (!include(index)) continue;
    addItem(holdings, definitions, item.id, previewItemQuantity(item), {
      validateDefinition: false,
    });
  }
  return holdings;
}

function previewItemQuantity(item) {
  if (item.carrying !== "stack") return 1;
  const maxQuantity = Number(item.maxQuantity);
  return Number.isFinite(maxQuantity) ? Math.max(1, Math.min(3, maxQuantity)) : 3;
}

function previewCount(id, definitions = [], state = {}) {
  return {
    id,
    label: labelize(id),
    acquired: Object.keys(state ?? {}).length,
    total: definitions.length,
  };
}

function ensurePreviewWellbeingStats(definitions) {
  const stats = definitions.stats ??= [];
  const existing = new Set(stats.map((stat) => stat.id));
  for (const stat of previewWellbeingStats) {
    if (existing.has(stat.id)) continue;
    stats.push({
      ...stat,
      type: "meter",
      min: 0,
      max: 100,
      direction: "higher-is-better",
      visible: "always",
      order: 1000 + stats.length,
    });
  }
}

function previewStatValue(stat, previewBarLevel) {
  if (!(previewBarLevel in previewBarLevelValues) || !isPreviewWellbeingStat(stat)) {
    return stat.default ?? 0;
  }
  const min = finiteNumber(stat.min, 0);
  const max = finiteNumber(stat.max, 100);
  const reserve = min + ((max - min) * previewBarLevelValues[previewBarLevel]) / 100;
  return clamp(reserve, min, max);
}

function isPreviewWellbeingStat(stat) {
  return stat.type === "meter" || previewWellbeingStats.some((previewStat) => previewStat.id === stat.id);
}

function entryDefaults(catalog, id, order) {
  return {
    items: {
      id, label: labelize(id), description: null, kind: "item", group: null,
      icon: null, tags: [], carrying: "unique", maxQuantity: 1, portable: true,
      visible: "when-acquired", relatedDocument: null,
    },
    stats: {
      id, label: labelize(id), type: "integer", group: null, order,
      visible: "always", default: 0, direction: "higher-is-better",
    },
    knowledge: {
      id, label: labelize(id), description: null, order,
      visible: "when-acquired",
    },
    skills: {
      id, label: labelize(id), description: null, mode: "acquired", maxRank: 1,
      rankLabels: [], practice: { evidence: [], awards: [] },
      order, visible: "when-acquired",
    },
    quests: {
      id, label: labelize(id), description: null, order,
      visible: "when-started", autoComplete: false, objectives: [],
    },
    documents: {
      id, title: labelize(id), description: null, order,
      visible: "when-acquired",
    },
  }[catalog];
}

function uniqueId(base, entries) {
  const used = new Set(entries.map((entry) => entry.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function labelize(id) {
  return id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function queryText(value) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
