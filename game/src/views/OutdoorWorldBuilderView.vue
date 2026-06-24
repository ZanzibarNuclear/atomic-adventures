<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import yaml from "js-yaml";
import HexMap from "../lib/maps/components/HexMap.vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import {
  addWaypoint,
  resolvedPlacementHandles,
  resolvedWaypoints,
  setLandmarkWorld,
  setStandWorld,
  setWaypointWorld,
} from "../lib/maps/composables/useMapBuilder.js";
import { axialToPixel, boundsOf } from "../lib/maps/composables/useHexGeometry.js";
import { normalizeStandEntries } from "../lib/maps/composables/useAvatarStand.js";
import { resolveWaypoint } from "../lib/maps/composables/useRoutes.js";
import {
  buildMapMovementAudit,
  movementAuditSummary,
} from "../lib/maps/debug/mapMovementAudit.js";
import { storyApi } from "../lib/storyApi.js";
import { useWorldContent } from "../composables/useWorldContent.js";

const PASSAGE_KINDS = new Set(["gate", "hole", "bridge", "ford", "stair"]);
const ROUTE_KINDS = ["road", "drive", "path", "trail"];
const FEATURE_LINE_KINDS = ["river", "fence", "cliff", "ravine"];
const TERRAIN_KINDS = ["forest", "clearing", "gorge", "rock", "water"];
const { refresh: refreshSharedWorld } = useWorldContent();
const builderFlags = new Set();
const router = useRouter();

const loaded = ref(null);
const draftMeta = ref({});
const baseline = ref("");
const version = ref(0);
const selectedKey = ref("");
const selectedHandleId = ref(null);
const tool = ref("select");
const search = ref("");
const status = ref("");
const errors = ref({});
const warnings = ref([]);
const yamlPreview = ref("");
const revisions = ref([]);
const showHistory = ref(false);
const renames = ref([]);
const auditEntries = ref([]);
const auditSummary = ref(null);
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const canvasView = ref("map");
const mapHost = ref(null);
const camera = ref({ x: -250, y: -220, width: 500, height: 440 });
const fitFrame = ref({ x: -250, y: -220, width: 500, height: 440 });
const zoomAction = ref("fit");
const panning = ref(null);
const landmarkDraft = ref(null);
const landmarkEditDraft = ref(null);
const standDraft = ref(null);
const standEditDraft = ref(null);
const auditRenameDraft = ref({ from: "", to: "" });
const navigationPromptVisible = ref(false);
const pendingRoute = ref("");
const savingBeforeNavigation = ref(false);
let resizeObserver = null;

const emptyWorld = {
  orientation: "pointy",
  size: 44,
  start: null,
  journey: [],
  hexes: [],
  features: [],
  routes: [],
};
const outdoor = useOutdoorWorld(emptyWorld);

const currentWorld = computed(() => ({
  ...clonePlain(draftMeta.value),
  hexes: clonePlain(outdoor.editableHexes),
  features: clonePlain(outdoor.editableFeatures),
  routes: clonePlain(outdoor.editableRoutes),
}));
const dirty = computed(() => Boolean(baseline.value) && JSON.stringify(currentWorld.value) !== baseline.value);
const errorMessages = computed(() =>
  Object.entries(errors.value).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);
const invalidAuditEntries = computed(() =>
  auditEntries.value.filter((entry) => entry.status === "invalid"),
);
const movementAuditRenames = computed(() =>
  Array.isArray(draftMeta.value.movementAuditRenames)
    ? draftMeta.value.movementAuditRenames
    : [],
);
const allHexIds = computed(() => outdoor.editableHexes.map((hex) => hex.id));
const allHexSet = computed(() => new Set(allHexIds.value));
const selected = computed(() => {
  const [type, id] = splitKey(selectedKey.value);
  if (type === "hex" || type === "landmark" || type === "stand") {
    return outdoor.editableHexes.find((hex) => hex.id === standHexId(id)) ?? null;
  }
  if (type === "route") return outdoor.editableRoutes.find((route) => route.id === id) ?? null;
  if (type === "feature" || type === "passage") {
    return outdoor.editableFeatures.find((feature) => feature.id === id) ?? null;
  }
  return null;
});
const selectedType = computed(() => splitKey(selectedKey.value)[0]);
const selectedStand = computed(() => {
  if (selectedType.value !== "stand" || !selected.value) return null;
  const standId = standIdFromKey(splitKey(selectedKey.value)[1]);
  return (selected.value.stands ?? []).find((stand) => stand.id === standId) ?? null;
});
const selectedStandIndex = computed(() =>
  selected.value?.stands?.findIndex((stand) => stand.id === selectedStand.value?.id) ?? -1,
);
const landmarkEditDirty = computed(() =>
  selectedType.value === "landmark" &&
  landmarkEditDraft.value &&
  selected.value?.landmark &&
  JSON.stringify(landmarkFromDraft(landmarkEditDraft.value)) !== JSON.stringify(landmarkFromDraft(selected.value.landmark)),
);
const standEditDirty = computed(() =>
  selectedType.value === "stand" &&
  standEditDraft.value &&
  selectedStand.value &&
  JSON.stringify(standFromDraft(standEditDraft.value)) !== JSON.stringify(normalizeStand(selectedStand.value)),
);
const selectedIsLine = computed(() =>
  selectedType.value === "route" ||
  (selectedType.value === "feature" && Array.isArray(selected.value?.points)),
);
const selectedIsPassage = computed(() => selectedType.value === "passage");
const selectedIsPlacement = computed(() =>
  ["hex", "landmark", "stand"].includes(selectedType.value),
);
const editMode = computed(() => selectedIsLine.value ? "line" : selectedIsPlacement.value ? "placement" : null);
const editHandles = computed(() => {
  if (!selected.value) return [];
  const editSubject = selectedType.value === "landmark" && landmarkEditDraft.value
    ? { ...selected.value, landmark: landmarkFromDraft(landmarkEditDraft.value) }
    : selectedType.value === "stand" && standEditDraft.value
      ? {
        ...selected.value,
        stands: selected.value.stands.map((stand) =>
          stand.id === selectedStand.value?.id ? standFromDraft(standEditDraft.value) : stand,
        ),
      }
    : selected.value;
  if (selectedIsLine.value) {
    return resolvedWaypoints(selected.value, outdoor.hexById, outdoor.size).map((handle) => ({
      ...handle,
      handleKey: `point-${handle.index}`,
    }));
  }
  if (selectedIsPassage.value && selected.value.at) {
    const point = resolveWaypoint(selected.value.at, outdoor.hexById, outdoor.size);
    const handles = [{ ...point, index: 0, role: "passage", handleKey: "passage" }];
    if (selected.value.boothAt) {
      handles.push({
        ...resolveWaypoint(selected.value.boothAt, outdoor.hexById, outdoor.size),
        index: 1,
        role: "booth",
        handleKey: "booth",
      });
    }
    return handles;
  }
  return resolvedPlacementHandles(editSubject, outdoor.size).map((handle) => ({
    ...handle,
    handleKey: handle.role === "stand" ? `stand-${handle.standId ?? handle.index}` : handle.role,
  }));
});
const builderEdit = computed(() => Boolean(selected.value && (editHandles.value.length || selectedIsLine.value)));
const viewBoxString = computed(() => {
  const box = camera.value;
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
});
const editHandleScale = computed(() => camera.value.width / Math.max(fitFrame.value.width, 1));

const filteredGroups = computed(() => {
  const term = search.value.trim().toLowerCase();
  const matches = (item) => !term || `${item.id} ${item.label ?? ""} ${item.kind ?? ""}`.toLowerCase().includes(term);
  return [
    { label: "Hexes", type: "hex", items: outdoor.editableHexes.filter(matches) },
    { label: "Routes", type: "route", items: outdoor.editableRoutes.filter(matches) },
    {
      label: "Features & barriers",
      type: "feature",
      items: outdoor.editableFeatures.filter((item) => !PASSAGE_KINDS.has(item.kind)).filter(matches),
    },
    {
      label: "Passages",
      type: "passage",
      items: outdoor.editableFeatures.filter((item) => PASSAGE_KINDS.has(item.kind)).filter(matches),
    },
    {
      label: "Landmarks",
      type: "landmark",
      items: outdoor.editableHexes.filter((item) => item.landmark).filter(matches),
    },
    {
      label: "Stand points",
      type: "stand",
      items: outdoor.editableHexes.flatMap((hex) =>
        normalizeStandEntries(hex).map((stand) => ({
          id: `${hex.id}:${stand.id}`,
          label: stand.label,
          kind: hex.id,
        })),
      ).filter(matches),
    },
  ];
});

onMounted(async () => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    await loadWorld();
    resizeObserver = new ResizeObserver(() => fitMap(false));
    if (mapHost.value) resizeObserver.observe(mapHost.value);
  } catch (error) {
    status.value = error.message;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", warnBeforeUnload);
  resizeObserver?.disconnect();
  stopPan();
});

onBeforeRouteLeave((to) => {
  if (!dirty.value) return true;
  pendingRoute.value = to.fullPath;
  navigationPromptVisible.value = true;
  return false;
});

function warnBeforeUnload(event) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
}

async function loadWorld() {
  const result = await storyApi("/api/world/outdoors");
  applyLoaded(result);
  await nextTick();
  fitMap();
}

function applyLoaded(result) {
  loaded.value = result;
  version.value = result.version;
  warnings.value = result.warnings ?? [];
  yamlPreview.value = result.yaml ?? dumpYaml(result.world);
  errors.value = {};
  renames.value = [];
  auditEntries.value = [];
  auditSummary.value = null;
  const world = clonePlain(result.world);
  const { hexes, features, routes, ...meta } = world;
  draftMeta.value = meta;
  outdoor.syncFromMapData({ ...meta, hexes, features, routes });
  baseline.value = JSON.stringify(currentWorld.value);
  if (!selected.value) selectedKey.value = world.start ? `hex:${world.start}` : "";
}

async function saveWorld() {
  errors.value = {};
  status.value = "";
  const audit = runMovementAudit(false);
  if (audit?.invalid > 0 && !window.confirm(
    `The movement audit reports ${audit.invalid} invalid case(s). Save this deliberate geometry change anyway?`,
  )) return false;
  try {
    const result = await storyApi("/api/world/outdoors", {
      method: "PUT",
      body: JSON.stringify({
        world: currentWorld.value,
        expectedVersion: version.value,
        renames: renames.value,
      }),
    });
    applyLoaded(result);
    await refreshSharedWorld(result.revision);
    status.value = `Saved world version ${result.version}.`;
    return true;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.status === 409
      ? "This world changed in another window. Revert or reload before saving."
      : error.message;
    return false;
  }
}

function revertWorld() {
  if (!loaded.value) return;
  applyLoaded(loaded.value);
  status.value = "Reverted unsaved changes.";
}

function keepEditing() {
  navigationPromptVisible.value = false;
  pendingRoute.value = "";
}

async function discardAndLeave() {
  const route = pendingRoute.value;
  navigationPromptVisible.value = false;
  pendingRoute.value = "";
  if (loaded.value) applyLoaded(loaded.value);
  await router.push(route);
}

async function saveAndLeave() {
  savingBeforeNavigation.value = true;
  const saved = await saveWorld();
  savingBeforeNavigation.value = false;
  if (!saved) return;
  const route = pendingRoute.value;
  navigationPromptVisible.value = false;
  pendingRoute.value = "";
  await router.push(route);
}

async function loadHistory() {
  revisions.value = await storyApi("/api/world/outdoors/revisions");
  showHistory.value = true;
}

async function restoreRevision(revision) {
  if (dirty.value && !window.confirm("Discard unsaved edits and restore this revision?")) return;
  if (!window.confirm(`Restore world revision ${revision} as a new revision?`)) return;
  try {
    const result = await storyApi(`/api/world/outdoors/revisions/${revision}/restore`, {
      method: "POST",
      body: "{}",
    });
    applyLoaded(result);
    await refreshSharedWorld(result.revision);
    status.value = `Restored revision ${revision}.`;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.message;
  }
}

function select(type, id) {
  if (
    landmarkEditDirty.value &&
    !window.confirm("Discard unsaved landmark changes and leave this landmark?")
  ) {
    return;
  }
  if (
    standEditDirty.value &&
    !window.confirm("Discard unsaved stand changes and leave this stand?")
  ) {
    return;
  }
  selectedKey.value = `${type}:${id}`;
  selectedHandleId.value = null;
  tool.value = "select";
  landmarkDraft.value = null;
  standDraft.value = null;
  landmarkEditDraft.value = type === "landmark"
    ? landmarkDraftFrom(outdoor.editableHexes.find((hex) => hex.id === id)?.landmark)
    : null;
  standEditDraft.value = type === "stand"
    ? standDraftFrom(
      outdoor.editableHexes
        .find((hex) => hex.id === standHexId(id))
        ?.stands
        ?.find((stand) => stand.id === standIdFromKey(id)),
    )
    : null;
}

function selectFeature(id) {
  const feature = outdoor.editableFeatures.find((item) => item.id === id);
  select(PASSAGE_KINDS.has(feature?.kind) ? "passage" : "feature", id);
}

function splitKey(key) {
  const index = key.indexOf(":");
  return index < 0 ? ["", ""] : [key.slice(0, index), key.slice(index + 1)];
}

function standHexId(id) {
  return String(id ?? "").split(":")[0] ?? "";
}

function standIdFromKey(id) {
  return String(id ?? "").split(":")[1] ?? "";
}

function onHandleMove({ x, y, role, index }) {
  if (!selected.value) return;
  if (selectedIsLine.value) {
    setWaypointWorld(selected.value, index, x, y, outdoor.hexById, outdoor.size);
  } else if (selectedIsPassage.value) {
    const key = role === "booth" ? "boothAt" : "at";
    if (!selected.value[key]) return;
    const holder = { points: [selected.value[key]] };
    setWaypointWorld(holder, 0, x, y, outdoor.hexById, outdoor.size);
    selected.value[key] = holder.points[0];
  } else if (role === "landmark") {
    if (selectedType.value === "landmark" && landmarkEditDraft.value) {
      const center = axialToPixel(selected.value.q, selected.value.r, outdoor.size);
      landmarkEditDraft.value.dx = Math.round(((x - center.x) / outdoor.size) * 100) / 100;
      landmarkEditDraft.value.dy = Math.round(((y - center.y) / outdoor.size) * 100) / 100;
      return;
    }
    setLandmarkWorld(selected.value, x, y, outdoor.size);
  } else if (role === "stand") {
    if (selectedType.value === "stand" && standEditDraft.value) {
      applyStandPointToDraft(standEditDraft.value, selected.value, x, y);
      return;
    }
    setStandWorld(selected.value, x, y, outdoor.size, index ?? selectedStandIndex.value);
  }
}

function onBuilderMapClick({ x, y }) {
  if (tool.value !== "add-point" || !selectedIsLine.value) return;
  const index = addWaypoint(selected.value, x, y);
  selectedHandleId.value = `point-${index}`;
}

function toggleAddPointMode() {
  tool.value = tool.value === "add-point" ? "select" : "add-point";
}

function beginAddStand() {
  if (!selected.value || !selectedIsPlacement.value) return;
  const hex = selected.value;
  const center = axialToPixel(hex.q, hex.r, outdoor.size);
  standDraft.value = {
    id: uniqueId("stand", hex.stands ?? []),
    label: "",
    anchor: hex.landmark ? "landmark" : "hex",
    dx: 0,
    dy: 0,
    x: Math.round(center.x),
    y: Math.round(center.y),
  };
}

function confirmAddStand() {
  if (!selected.value || !standDraft.value) return;
  const draft = standDraft.value;
  const id = draft.id.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    status.value = "Stand IDs must use kebab-case.";
    return;
  }
  if ((selected.value.stands ?? []).some((stand) => stand.id === id)) {
    status.value = `The stand ID "${id}" already exists on this hex.`;
    return;
  }
  const at = draft.anchor === "world"
    ? { x: Number(draft.x), y: Number(draft.y) }
    : draft.anchor === "landmark"
      ? { from: "landmark", dx: Number(draft.dx), dy: Number(draft.dy) }
      : { dx: Number(draft.dx), dy: Number(draft.dy) };
  selected.value.stands ??= [];
  selected.value.stands.push({ id, label: draft.label.trim() || id, at });
  standDraft.value = null;
  selectedKey.value = `stand:${selected.value.id}:${id}`;
}

function beginAddLandmark() {
  const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
  if (!hex) return;
  selectedKey.value = `hex:${hex.id}`;
  selectedHandleId.value = null;
  tool.value = "select";
  standDraft.value = null;
  landmarkDraft.value = {
    icon: "◆",
    label: hex.label ?? hex.id,
    building: "",
    blurb: "",
    dx: 0,
    dy: 0,
  };
}

function confirmAddLandmark() {
  if (!selected.value || !landmarkDraft.value) return;
  if (!landmarkDraft.value.icon.trim() && !landmarkDraft.value.building.trim()) {
    status.value = "Landmarks need an icon or building ID.";
    return;
  }
  selected.value.landmark = landmarkFromDraft(landmarkDraft.value);
  landmarkDraft.value = null;
  select("landmark", selected.value.id);
}

function saveLandmarkEdit() {
  if (!selected.value || !landmarkEditDraft.value) return;
  if (!landmarkEditDraft.value.icon.trim() && !landmarkEditDraft.value.building.trim()) {
    status.value = "Landmarks need an icon or building ID.";
    return;
  }
  const hexId = selected.value.id;
  selected.value.landmark = landmarkFromDraft(landmarkEditDraft.value);
  landmarkEditDraft.value = null;
  select("hex", hexId);
}

function backToHexFromLandmark() {
  if (!selected.value) return;
  const hexId = selected.value.id;
  if (
    landmarkEditDirty.value &&
    !window.confirm("Discard unsaved landmark changes and return to the cell?")
  ) {
    return;
  }
  landmarkEditDraft.value = null;
  select("hex", hexId);
}

function saveStandEdit() {
  if (!selected.value || !selectedStand.value || !standEditDraft.value) return;
  const stand = standFromDraft(standEditDraft.value);
  if (!stand.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stand.id)) {
    status.value = "Stand IDs must use kebab-case.";
    return;
  }
  if (
    (selected.value.stands ?? []).some((item) =>
      item.id === stand.id && item.id !== selectedStand.value.id,
    )
  ) {
    status.value = `The stand ID "${stand.id}" already exists on this hex.`;
    return;
  }
  const hexId = selected.value.id;
  const index = selectedStandIndex.value;
  if (index >= 0) selected.value.stands[index] = stand;
  standEditDraft.value = null;
  select("hex", hexId);
}

function backToHexFromStand() {
  if (!selected.value) return;
  const hexId = selected.value.id;
  if (
    standEditDirty.value &&
    !window.confirm("Discard unsaved stand changes and return to the cell?")
  ) {
    return;
  }
  standEditDraft.value = null;
  select("hex", hexId);
}

function landmarkDraftFrom(landmark = {}) {
  return {
    icon: landmark.icon ?? "",
    label: landmark.label ?? "",
    building: landmark.building ?? "",
    blurb: landmark.blurb ?? "",
    dx: Number(landmark.dx ?? 0),
    dy: Number(landmark.dy ?? 0),
  };
}

function landmarkFromDraft(draft = {}) {
  return {
    ...(String(draft.building ?? "").trim() ? { building: String(draft.building).trim() } : {}),
    ...(String(draft.icon ?? "").trim() ? { icon: String(draft.icon).trim() } : {}),
    ...(String(draft.label ?? "").trim() ? { label: String(draft.label).trim() } : {}),
    ...(Number(draft.dx) ? { dx: Number(draft.dx) } : {}),
    ...(Number(draft.dy) ? { dy: Number(draft.dy) } : {}),
    ...(String(draft.blurb ?? "").trim() ? { blurb: String(draft.blurb).trim() } : {}),
  };
}

function standDraftFrom(stand = {}) {
  const at = stand.at ?? {};
  return {
    id: stand.id ?? "",
    label: stand.label ?? "",
    anchor: at.from === "landmark" ? "landmark" : at.x != null ? "world" : "hex",
    dx: Number(at.dx ?? 0),
    dy: Number(at.dy ?? 0),
    x: Number(at.x ?? 0),
    y: Number(at.y ?? 0),
  };
}

function standFromDraft(draft = {}) {
  const at = draft.anchor === "world"
    ? { x: Number(draft.x), y: Number(draft.y) }
    : draft.anchor === "landmark"
      ? { from: "landmark", dx: Number(draft.dx), dy: Number(draft.dy) }
      : { dx: Number(draft.dx), dy: Number(draft.dy) };
  return {
    id: String(draft.id ?? "").trim(),
    ...(String(draft.label ?? "").trim() ? { label: String(draft.label).trim() } : {}),
    at,
  };
}

function normalizeStand(stand = {}) {
  return {
    id: String(stand.id ?? "").trim(),
    ...(String(stand.label ?? "").trim() ? { label: String(stand.label).trim() } : {}),
    at: clonePlain(stand.at ?? {}),
  };
}

function applyStandPointToDraft(draft, hex, x, y) {
  if (!draft || !hex) return;
  if (draft.anchor === "world") {
    draft.x = Math.round(x);
    draft.y = Math.round(y);
    return;
  }
  const anchor = draft.anchor === "landmark" && hex.landmark
    ? {
      x: axialToPixel(hex.q, hex.r, outdoor.size).x + outdoor.size * (hex.landmark.dx ?? 0),
      y: axialToPixel(hex.q, hex.r, outdoor.size).y + outdoor.size * (hex.landmark.dy ?? 0),
    }
    : axialToPixel(hex.q, hex.r, outdoor.size);
  draft.dx = Math.round(((x - anchor.x) / outdoor.size) * 100) / 100;
  draft.dy = Math.round(((y - anchor.y) / outdoor.size) * 100) / 100;
}

function addHex() {
  const occupied = new Set(outdoor.editableHexes.map((hex) => `${hex.q},${hex.r}`));
  let q = 0;
  let r = 0;
  outer: for (let radius = 0; radius < 100; radius += 1) {
    for (q = -radius; q <= radius; q += 1) {
      for (r = -radius; r <= radius; r += 1) {
        if (!occupied.has(`${q},${r}`)) break outer;
      }
    }
  }
  const id = uniqueId("new-hex", outdoor.editableHexes);
  outdoor.editableHexes.push({ id, q, r, terrain: "forest" });
  if (!draftMeta.value.start) draftMeta.value.start = id;
  select("hex", id);
  focusSelection();
}

function addRoute() {
  const id = uniqueId("new-route", outdoor.editableRoutes);
  const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
  const points = hex
    ? [{ hex: hex.id, dx: -0.25, dy: 0 }, { hex: hex.id, dx: 0.25, dy: 0 }]
    : [{ x: -20, y: 0 }, { x: 20, y: 0 }];
  outdoor.editableRoutes.push({ id, kind: "path", label: "New route", points });
  select("route", id);
}

function addBarrier() {
  const id = uniqueId("new-barrier", outdoor.editableFeatures);
  const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
  const center = hex ? axialToPixel(hex.q, hex.r, outdoor.size) : { x: 0, y: 0 };
  outdoor.editableFeatures.push({
    id,
    kind: "fence",
    points: [
      { x: Math.round(center.x - 20), y: Math.round(center.y) },
      { x: Math.round(center.x + 20), y: Math.round(center.y) },
    ],
  });
  select("feature", id);
}

function addCascade() {
  if (selected.value?.kind !== "river") return;
  selected.value.cascades ??= [];
  selected.value.cascades.push({
    id: uniqueId("new-cascade", selected.value.cascades),
    from: 0.35,
    to: 0.65,
  });
}

function removeCascade(index) {
  if (!selected.value?.cascades) return;
  selected.value.cascades.splice(index, 1);
}

function addPassage() {
  const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
  if (!hex) return;
  const id = uniqueId(`${hex.id}-gate`, outdoor.editableFeatures);
  outdoor.editableFeatures.push({
    id,
    kind: "gate",
    hex: hex.id,
    visibility: "obvious",
    at: { hex: hex.id, dx: 0, dy: 0 },
  });
  select("passage", id);
}

function duplicateSelected() {
  if (!selected.value) return;
  const copy = clonePlain(selected.value);
  if (selectedType.value === "hex") {
    copy.id = uniqueId(`${copy.id}-copy`, outdoor.editableHexes);
    copy.q += 1;
    while (outdoor.editableHexes.some((hex) => hex.q === copy.q && hex.r === copy.r)) copy.q += 1;
    outdoor.editableHexes.push(copy);
    select("hex", copy.id);
  } else if (selectedType.value === "route") {
    copy.id = uniqueId(`${copy.id}-copy`, outdoor.editableRoutes);
    outdoor.editableRoutes.push(copy);
    select("route", copy.id);
  } else if (["feature", "passage"].includes(selectedType.value)) {
    copy.id = uniqueId(`${copy.id}-copy`, outdoor.editableFeatures);
    outdoor.editableFeatures.push(copy);
    select(selectedType.value, copy.id);
  }
}

function deleteSelected() {
  if (!selected.value) return;
  const [type, id] = splitKey(selectedKey.value);
  if (!window.confirm(`Delete ${type} "${id}"? References will be checked when you save.`)) return;
  if (type === "landmark") {
    delete selected.value.landmark;
    select("hex", id);
  } else if (type === "stand") {
    const hexId = standHexId(id);
    const standId = standIdFromKey(id);
    selected.value.stands = (selected.value.stands ?? []).filter((stand) => stand.id !== standId);
    select("hex", hexId);
  } else if (type === "hex") {
    removeById(outdoor.editableHexes, id);
    selectedKey.value = "";
  } else if (type === "route") {
    removeById(outdoor.editableRoutes, id);
    selectedKey.value = "";
  } else {
    removeById(outdoor.editableFeatures, id);
    selectedKey.value = "";
  }
}

async function renameSelected() {
  if (!selected.value) return;
  const [type, oldId] = splitKey(selectedKey.value);
  if (["landmark", "stand"].includes(type)) return;
  const next = window.prompt(`Rename ${type} "${oldId}" to:`, oldId)?.trim();
  if (!next || next === oldId) return;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
    status.value = "IDs must use kebab-case.";
    return;
  }
  const collection = type === "hex"
    ? outdoor.editableHexes
    : type === "route"
      ? outdoor.editableRoutes
      : outdoor.editableFeatures;
  if (collection.some((item) => item.id === next)) {
    status.value = `The ID "${next}" already exists.`;
    return;
  }
  if (type === "hex") {
    try {
      const preview = await storyApi("/api/world/outdoors/rename-preview", {
        method: "POST",
        body: JSON.stringify({ from: oldId, to: next, world: currentWorld.value }),
      });
      const lines = preview.references.slice(0, 12).map((reference) =>
        reference.kind === "story"
          ? `${reference.areaId}/${reference.beatId}: ${reference.path}`
          : reference.path,
      );
      const overflow = preview.references.length - lines.length;
      const summary = lines.length
        ? `\n\nReferences to update:\n${lines.join("\n")}${overflow > 0 ? `\n…and ${overflow} more` : ""}`
        : "\n\nNo existing references were found.";
      if (!window.confirm(`Rename "${oldId}" to "${next}"?${summary}`)) return;
    } catch (error) {
      status.value = error.message;
      return;
    }
  }
  selected.value.id = next;
  if (type === "hex") {
    cascadeHexRename(oldId, next);
    let chained = false;
    const updated = renames.value
      .filter((item) => item.from !== oldId)
      .map((item) => {
        if (item.to !== oldId) return item;
        chained = true;
        return { ...item, to: next };
      });
    renames.value = chained
      ? updated
      : [...updated, { kind: "hex", from: oldId, to: next }];
  }
  selectedKey.value = `${type}:${next}`;
}

function cascadeHexRename(from, to) {
  if (draftMeta.value.start === from) draftMeta.value.start = to;
  draftMeta.value.journey = (draftMeta.value.journey ?? []).map((id) => id === from ? to : id);
  cascadeMovementAuditRename(from, to);
  for (const route of outdoor.editableRoutes) {
    for (const point of route.points ?? []) if (point.hex === from) point.hex = to;
  }
  for (const feature of outdoor.editableFeatures) {
    if (feature.hex === from) feature.hex = to;
    for (const key of ["at", "labelAt", "boothAt"]) if (feature[key]?.hex === from) feature[key].hex = to;
    for (const point of feature.points ?? []) if (point.hex === from) point.hex = to;
  }
}

function cascadeMovementAuditRename(from, to) {
  const existing = Array.isArray(draftMeta.value.movementAuditRenames)
    ? draftMeta.value.movementAuditRenames
    : [];
  let chained = false;
  const updated = existing
    .filter((item) => item.from !== from)
    .map((item) => {
      if (item.to !== from) return item;
      chained = true;
      return { ...item, to };
    });
  draftMeta.value.movementAuditRenames = chained
    ? updated
    : [...updated, { kind: "hex", from, to }];
}

function setMovementAuditRenames(next) {
  draftMeta.value.movementAuditRenames = next;
}

function addMovementAuditRename() {
  const from = auditRenameDraft.value.from.trim();
  const to = auditRenameDraft.value.to.trim();
  if (!from || !to) {
    status.value = "Movement audit aliases need both old and current hex IDs.";
    return;
  }
  const existing = movementAuditRenames.value.filter((item) => item.from !== from);
  setMovementAuditRenames([...existing, { kind: "hex", from, to }]);
  auditRenameDraft.value = { from: "", to: "" };
  status.value = `Movement audit alias added: ${from} → ${to}.`;
}

function removeMovementAuditRename(index) {
  setMovementAuditRenames(movementAuditRenames.value.filter((_, i) => i !== index));
  status.value = "Movement audit alias removed.";
}

function moveSelected(delta) {
  const [type, id] = splitKey(selectedKey.value);
  const list = type === "hex"
    ? outdoor.editableHexes
    : type === "route"
      ? outdoor.editableRoutes
      : ["feature", "passage"].includes(type)
        ? outdoor.editableFeatures
        : null;
  if (!list) return;
  const index = list.findIndex((item) => item.id === id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
}

function pointMode(point) {
  return point.hex != null ? "hex" : "raw";
}

function csv(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function setCsv(target, key, event) {
  target[key] = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
}

function setPointMode(point, mode) {
  if (mode === "hex") {
    const first = outdoor.editableHexes[0];
    Object.keys(point).forEach((key) => delete point[key]);
    Object.assign(point, { hex: first?.id ?? "", dx: 0, dy: 0 });
  } else {
    const resolved = resolveWaypoint(point, outdoor.hexById, outdoor.size);
    Object.keys(point).forEach((key) => delete point[key]);
    Object.assign(point, { x: Math.round(resolved.x), y: Math.round(resolved.y) });
  }
}

function ensureBoothAt() {
  if (!selected.value || !selectedIsPassage.value) return;
  if (selected.value.boothAt) return;
  const at = resolveWaypoint(selected.value.at, outdoor.hexById, outdoor.size);
  selected.value.boothAt = {
    x: Math.round(at.x - 13),
    y: Math.round(at.y - 10),
  };
}

function removeBoothAt() {
  if (!selected.value || !selectedIsPassage.value) return;
  delete selected.value.boothAt;
  if (selectedHandleId.value === "booth") selectedHandleId.value = null;
}

function removePoint(index) {
  if (!selected.value?.points || selected.value.points.length <= 2) return;
  selected.value.points.splice(index, 1);
}

function movePoint(index, delta) {
  const list = selected.value?.points;
  const next = index + delta;
  if (!list || next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
}

function runMovementAudit(showStatus = true) {
  try {
    auditEntries.value = buildMapMovementAudit(currentWorld.value, renames.value);
    auditSummary.value = movementAuditSummary(auditEntries.value);
    if (showStatus) {
      status.value = auditSummary.value.invalid
        ? `Movement audit: ${auditSummary.value.invalid} invalid case(s).`
        : `Movement audit passed ${auditSummary.value.total} cases.`;
    }
    return auditSummary.value;
  } catch (error) {
    auditEntries.value = [];
    auditSummary.value = { total: 0, valid: 0, blocked: 0, invalid: 1 };
    if (showStatus) status.value = `Movement audit could not run: ${error.message}`;
    return auditSummary.value;
  }
}

function fitMap(updateCamera = true) {
  const hexes = outdoor.editableHexes;
  if (!hexes.length) return;
  const bounds = boundsOf(hexes, outdoor.size);
  const padded = {
    x: bounds.x - 35,
    y: bounds.y - 35,
    width: bounds.width + 70,
    height: bounds.height + 70,
  };
  const rect = mapHost.value?.getBoundingClientRect();
  const aspect = rect?.width && rect?.height ? rect.width / rect.height : padded.width / padded.height;
  const frame = expandToAspect(padded, aspect);
  fitFrame.value = frame;
  if (updateCamera) camera.value = frame;
}

function focusSelection() {
  if (!selected.value) return;
  let point = null;
  if (selectedIsPlacement.value) point = axialToPixel(selected.value.q, selected.value.r, outdoor.size);
  else if (editHandles.value.length) {
    point = {
      x: editHandles.value.reduce((sum, handle) => sum + handle.x, 0) / editHandles.value.length,
      y: editHandles.value.reduce((sum, handle) => sum + handle.y, 0) / editHandles.value.length,
    };
  }
  if (!point) return;
  const width = fitFrame.value.width * 0.42;
  const height = width / (camera.value.width / camera.value.height);
  camera.value = { x: point.x - width / 2, y: point.y - height / 2, width, height };
}

function zoomBy(factor, clientX = null, clientY = null) {
  const rect = mapHost.value?.getBoundingClientRect();
  const fx = rect && clientX != null ? (clientX - rect.left) / rect.width : 0.5;
  const fy = rect && clientY != null ? (clientY - rect.top) / rect.height : 0.5;
  const current = camera.value;
  const minWidth = fitFrame.value.width * 0.12;
  const maxWidth = fitFrame.value.width * 3;
  const width = Math.max(minWidth, Math.min(maxWidth, current.width * factor));
  const height = width * (current.height / current.width);
  const anchorX = current.x + current.width * fx;
  const anchorY = current.y + current.height * fy;
  camera.value = {
    x: anchorX - width * fx,
    y: anchorY - height * fy,
    width,
    height,
  };
}

function onWheel(event) {
  zoomBy(event.deltaY > 0 ? 1.12 : 0.88, event.clientX, event.clientY);
}

function applyZoomAction(event) {
  const action = event.target.value;
  zoomAction.value = action;
  if (action === "fit") fitMap();
  else if (action === "focus") focusSelection();
}

function startPan(event) {
  if (event.target.closest(".edit-handle") || event.button === 2) return;
  if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) return;
  event.preventDefault();
  panning.value = {
    clientX: event.clientX,
    clientY: event.clientY,
    camera: { ...camera.value },
  };
  window.addEventListener("pointermove", movePan);
  window.addEventListener("pointerup", stopPan);
}

function movePan(event) {
  if (!panning.value || !mapHost.value) return;
  const rect = mapHost.value.getBoundingClientRect();
  const dx = (event.clientX - panning.value.clientX) * panning.value.camera.width / rect.width;
  const dy = (event.clientY - panning.value.clientY) * panning.value.camera.height / rect.height;
  camera.value = {
    ...panning.value.camera,
    x: panning.value.camera.x - dx,
    y: panning.value.camera.y - dy,
  };
}

function stopPan() {
  panning.value = null;
  window.removeEventListener("pointermove", movePan);
  window.removeEventListener("pointerup", stopPan);
}

function expandToAspect(frame, aspect) {
  const current = frame.width / frame.height;
  if (current < aspect) {
    const width = frame.height * aspect;
    return { ...frame, x: frame.x - (width - frame.width) / 2, width };
  }
  const height = frame.width / aspect;
  return { ...frame, y: frame.y - (height - frame.height) / 2, height };
}

function uniqueId(base, list) {
  const used = new Set(list.map((item) => item.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function removeById(list, id) {
  const index = list.findIndex((item) => item.id === id);
  if (index >= 0) list.splice(index, 1);
}

function dumpYaml(world) {
  return yaml.dump(world, { noRefs: true, lineWidth: 100, noCompatMode: true, sortKeys: false });
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

</script>

<template>
  <main class="world-builder">
    <header class="world-toolbar">
      <div>
        <p class="label">Outdoor world</p>
        <h2>World Builder</h2>
      </div>
      <div class="toolbar-group">
        <button class="sm muted" @click="leftCollapsed = !leftCollapsed">{{ leftCollapsed ? "Show objects" : "Hide objects" }}</button>
        <button class="sm muted" @click="rightCollapsed = !rightCollapsed">{{ rightCollapsed ? "Show inspector" : "Hide inspector" }}</button>
        <button class="sm muted" :disabled="!dirty" @click="revertWorld">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveWorld">Save world</button>
      </div>
    </header>

    <p v-if="status" class="world-status">{{ status }}</p>
    <p v-if="dirty" class="dirty-banner">Unsaved world changes</p>

    <div
      class="world-workspace"
      :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
    >
      <aside v-if="!leftCollapsed" class="object-browser panel">
        <input v-model="search" placeholder="Search world objects…" />
        <div class="create-grid">
          <button class="sm" @click="addHex">+ Hex</button>
          <button class="sm" @click="addRoute">+ Route</button>
          <button class="sm" @click="addBarrier">+ Barrier</button>
          <button class="sm" @click="addPassage">+ Passage</button>
          <button class="sm" @click="beginAddLandmark">+ Landmark</button>
        </div>
        <section v-for="group in filteredGroups" :key="group.label" class="object-group">
          <h3>{{ group.label }} <span>{{ group.items.length }}</span></h3>
          <button
            v-for="item in group.items"
            :key="`${group.type}:${item.id}`"
            class="object-item"
            :class="{ active: selectedKey === `${group.type}:${item.id}` }"
            @click="select(group.type, item.id)"
          >
            <strong>{{ item.label || item.landmark?.label || item.id }}</strong>
            <span>{{ item.id }}<template v-if="item.kind"> · {{ item.kind }}</template></span>
          </button>
        </section>
      </aside>

      <section class="canvas-column">
        <div class="canvas-toolbar panel">
          <div class="tool-group">
            <label class="toolbar-field">
              <span>Zoom</span>
              <select v-model="zoomAction" class="toolbar-select" aria-label="Map zoom actions" @change="applyZoomAction">
                <option value="fit">Fit map</option>
                <option value="focus" :disabled="!selected">Focus selection</option>
              </select>
            </label>
            <div class="segmented-control" aria-label="Canvas view">
              <button class="sm" :class="{ active: canvasView === 'map' }" @click="canvasView = 'map'">Map</button>
              <button class="sm" :class="{ active: canvasView === 'yaml' }" @click="canvasView = 'yaml'">YAML</button>
            </div>
            <button class="sm muted" @click="runMovementAudit()">Run movement audit</button>
          </div>
        </div>
        <div
          v-show="canvasView === 'map'"
          ref="mapHost"
          class="world-canvas"
          :class="{ panning }"
          @wheel.prevent="onWheel"
          @pointerdown="startPan"
        >
          <HexMap
            v-if="loaded"
            :map-data="outdoor.displayMapData"
            :route-models="outdoor.routeModels"
            :feature-models="outdoor.featureModels"
            :current-hex="selectedIsPlacement ? selected?.id ?? draftMeta.start : draftMeta.start"
            :discovered="allHexIds"
            :discovered-openings="outdoor.editableFeatures.map((feature) => feature.id)"
            :flags="builderFlags"
            :mode="'full'"
            :builder-view="true"
            :expanded="true"
            :builder-edit="builderEdit"
            :edit-mode="editMode"
            :edit-handles="editHandles"
            :edit-kind="selected?.kind ?? 'path'"
            :selected-handle-id="selectedHandleId"
            :add-point-mode="tool === 'add-point' && selectedIsLine"
            :clickable-hex-ids="allHexSet"
            :selectable-objects="tool !== 'add-point' || !selectedIsLine"
            :view-box-override="viewBoxString"
            :edit-handle-scale="editHandleScale"
            :movement-audit-entries="auditEntries"
            :avatar-instant="true"
            @hex-click="select('hex', $event)"
            @route-select="select('route', $event)"
            @feature-select="selectFeature"
            @passage-select="select('passage', $event)"
            @landmark-select="select('landmark', $event)"
            @select-handle="selectedHandleId = $event"
            @waypoint-move="onHandleMove"
            @builder-map-click="onBuilderMapClick"
          />
          <p class="pan-hint">Wheel to zoom · Shift-drag or middle-drag to pan</p>
        </div>
        <pre v-show="canvasView === 'yaml'" class="yaml-canvas">{{ dirty ? dumpYaml(currentWorld) : yamlPreview }}</pre>
      </section>

      <aside v-if="!rightCollapsed" class="inspector panel">
        <template v-if="selected">
          <div class="inspector-heading">
            <div>
              <p class="label">{{ selectedType }}</p>
              <h3>{{ selected.id }}</h3>
            </div>
            <div class="row-actions">
              <button class="sm muted" @click="moveSelected(-1)">↑</button>
              <button class="sm muted" @click="moveSelected(1)">↓</button>
            </div>
          </div>

          <div class="row-actions">
            <template v-if="selectedType === 'landmark'">
              <button class="sm" :disabled="!landmarkEditDirty" @click="saveLandmarkEdit">Save changes</button>
              <button class="sm muted" @click="backToHexFromLandmark">Back to cell</button>
            </template>
            <template v-else-if="selectedType === 'stand'">
              <button class="sm" :disabled="!standEditDirty" @click="saveStandEdit">Save changes</button>
              <button class="sm muted" @click="backToHexFromStand">Back to cell</button>
            </template>
            <template v-else>
              <button class="sm muted" @click="renameSelected">Rename</button>
              <button class="sm muted" @click="duplicateSelected">Duplicate</button>
            </template>
            <button class="sm danger-outline" @click="deleteSelected">Delete</button>
          </div>

          <template v-if="selectedType === 'hex'">
            <label>Terrain
              <select v-model="selected.terrain">
                <option v-for="kind in TERRAIN_KINDS" :key="kind">{{ kind }}</option>
              </select>
            </label>
            <label>Display label<input v-model="selected.label" /></label>
            <section class="hex-subitems">
              <div class="subitem-heading">
                <strong>Landmark</strong>
                <button v-if="!selected.landmark && !landmarkDraft" class="sm" @click="beginAddLandmark">Add landmark</button>
              </div>
              <button
                v-if="selected.landmark"
                class="subitem-row"
                @click="select('landmark', selected.id)"
              >
                <strong>{{ selected.landmark.label || selected.landmark.building || selected.landmark.icon || "Landmark" }}</strong>
                <span>{{ selected.landmark.building || selected.landmark.icon || "custom" }}</span>
              </button>
              <div v-if="landmarkDraft" class="draft-card">
                <label>Label<input v-model="landmarkDraft.label" /></label>
                <label>Icon<input v-model="landmarkDraft.icon" /></label>
                <label>Building ID<input v-model="landmarkDraft.building" /></label>
                <label>Blurb<textarea v-model="landmarkDraft.blurb" rows="3" /></label>
                <div class="field-grid">
                  <label>Offset x<input v-model.number="landmarkDraft.dx" type="number" step=".01" /></label>
                  <label>Offset y<input v-model.number="landmarkDraft.dy" type="number" step=".01" /></label>
                </div>
                <div class="row-actions">
                  <button class="sm" @click="confirmAddLandmark">Confirm</button>
                  <button class="sm muted" @click="landmarkDraft = null">Cancel</button>
                </div>
              </div>
            </section>
            <section class="hex-subitems">
              <div class="subitem-heading">
                <strong>Stand points</strong>
                <button v-if="!standDraft" class="sm" @click="beginAddStand">Add stand</button>
              </div>
              <button
                v-for="stand in normalizeStandEntries(selected)"
                :key="stand.id"
                class="subitem-row"
                @click="select('stand', `${selected.id}:${stand.id}`)"
              >
                <strong>{{ stand.label || stand.id }}</strong>
                <span>{{ stand.id }}</span>
              </button>
              <div v-if="standDraft" class="draft-card">
                <label>ID<input v-model="standDraft.id" /></label>
                <label>Label<input v-model="standDraft.label" /></label>
                <label>Anchor
                  <select v-model="standDraft.anchor">
                    <option value="hex">Hex-relative</option>
                    <option value="landmark" :disabled="!selected.landmark">Landmark-relative</option>
                    <option value="world">World coordinates</option>
                  </select>
                </label>
                <div v-if="standDraft.anchor === 'world'" class="field-grid">
                  <label>X<input v-model.number="standDraft.x" type="number" /></label>
                  <label>Y<input v-model.number="standDraft.y" type="number" /></label>
                </div>
                <div v-else class="field-grid">
                  <label>Offset x<input v-model.number="standDraft.dx" type="number" step=".01" /></label>
                  <label>Offset y<input v-model.number="standDraft.dy" type="number" step=".01" /></label>
                </div>
                <div class="row-actions">
                  <button class="sm" @click="confirmAddStand">Confirm</button>
                  <button class="sm muted" @click="standDraft = null">Cancel</button>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="selectedType === 'landmark' && landmarkEditDraft">
            <label>Label<input v-model="landmarkEditDraft.label" /></label>
            <label>Icon<input v-model="landmarkEditDraft.icon" /></label>
            <label>Building ID<input v-model="landmarkEditDraft.building" /></label>
            <label>Blurb<textarea v-model="landmarkEditDraft.blurb" rows="4" /></label>
            <div class="field-grid">
              <label>Offset x<input v-model.number="landmarkEditDraft.dx" type="number" step=".01" /></label>
              <label>Offset y<input v-model.number="landmarkEditDraft.dy" type="number" step=".01" /></label>
            </div>
          </template>

          <template v-else-if="selectedType === 'stand' && standEditDraft">
            <label>ID<input v-model="standEditDraft.id" /></label>
            <label>Label<input v-model="standEditDraft.label" /></label>
            <label>Anchor
              <select v-model="standEditDraft.anchor">
                <option value="hex">Hex-relative</option>
                <option value="landmark" :disabled="!selected.landmark">Landmark-relative</option>
                <option value="world">World coordinates</option>
              </select>
            </label>
            <div v-if="standEditDraft.anchor === 'world'" class="field-grid">
              <label>X<input v-model.number="standEditDraft.x" type="number" /></label>
              <label>Y<input v-model.number="standEditDraft.y" type="number" /></label>
            </div>
            <div v-else class="field-grid">
              <label>Offset x<input v-model.number="standEditDraft.dx" type="number" step=".01" /></label>
              <label>Offset y<input v-model.number="standEditDraft.dy" type="number" step=".01" /></label>
            </div>
          </template>

          <template v-else-if="selectedType === 'route'">
            <label>Kind
              <select v-model="selected.kind"><option v-for="kind in ROUTE_KINDS" :key="kind">{{ kind }}</option></select>
            </label>
            <label>Label<input v-model="selected.label" /></label>
            <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
          </template>

          <template v-else-if="selectedType === 'feature'">
            <label>Kind
              <select v-model="selected.kind"><option v-for="kind in FEATURE_LINE_KINDS" :key="kind">{{ kind }}</option></select>
            </label>
            <label>Label<input v-model="selected.label" /></label>
            <label>Flow<input v-model="selected.flow" /></label>
            <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
            <fieldset v-if="selected.kind === 'river'">
              <legend>Cascades</legend>
              <div
                v-for="(cascade, index) in selected.cascades ?? []"
                :key="cascade.id ?? index"
                class="cascade-row"
              >
                <label>ID<input v-model="cascade.id" /></label>
                <label>From<input v-model.number="cascade.from" type="number" min="0" max="1" step=".01" /></label>
                <label>To<input v-model.number="cascade.to" type="number" min="0" max="1" step=".01" /></label>
                <button class="sm danger-outline" @click="removeCascade(index)">Remove</button>
              </div>
              <button class="sm" @click="addCascade">Add cascade</button>
            </fieldset>
          </template>

          <template v-else-if="selectedType === 'passage'">
            <label>Kind
              <select v-model="selected.kind">
                <option v-for="kind in [...PASSAGE_KINDS]" :key="kind">{{ kind }}</option>
              </select>
            </label>
            <label>Hex
              <select v-model="selected.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select>
            </label>
            <label>Visibility
              <select v-model="selected.visibility"><option>obvious</option><option>hidden</option></select>
            </label>
            <label>Label<input v-model="selected.label" /></label>
            <label>Radius<input v-model.number="selected.radius" type="number" /></label>
            <fieldset>
              <legend>Requirements</legend>
              <label>All flags
                <input
                  :value="csv(selected.require?.all)"
                  @input="selected.require ??= {}; setCsv(selected.require, 'all', $event)"
                />
              </label>
              <label>Any flags
                <input
                  :value="csv(selected.require?.any)"
                  @input="selected.require ??= {}; setCsv(selected.require, 'any', $event)"
                />
              </label>
              <label>Not flags
                <input
                  :value="csv(selected.require?.not)"
                  @input="selected.require ??= {}; setCsv(selected.require, 'not', $event)"
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Unlock action</legend>
              <label>Button label
                <input
                  :value="selected.unlock?.label ?? ''"
                  @input="selected.unlock ??= {}; selected.unlock.label = $event.target.value"
                />
              </label>
              <label>Locked status
                <input
                  :value="selected.unlock?.status ?? ''"
                  @input="selected.unlock ??= {}; selected.unlock.status = $event.target.value"
                />
              </label>
              <label>Set flags
                <input
                  :value="csv(selected.unlock?.set_flags)"
                  @input="selected.unlock ??= {}; setCsv(selected.unlock, 'set_flags', $event)"
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>On crossing</legend>
              <label>Set flags
                <input
                  :value="csv(selected.on_cross?.set_flags)"
                  @input="selected.on_cross ??= {}; setCsv(selected.on_cross, 'set_flags', $event)"
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Passage point</legend>
              <label>Coordinate mode
                <select :value="pointMode(selected.at)" @change="setPointMode(selected.at, $event.target.value)">
                  <option value="hex">Hex anchor</option><option value="raw">World coordinates</option>
                </select>
              </label>
              <template v-if="selected.at?.hex != null">
                <label>Anchor hex<select v-model="selected.at.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select></label>
                <div class="field-grid">
                  <label>dx<input v-model.number="selected.at.dx" type="number" step=".01" /></label>
                  <label>dy<input v-model.number="selected.at.dy" type="number" step=".01" /></label>
                </div>
              </template>
              <div v-else class="field-grid">
                <label>X<input v-model.number="selected.at.x" type="number" /></label>
                <label>Y<input v-model.number="selected.at.y" type="number" /></label>
              </div>
            </fieldset>
            <fieldset v-if="selected.kind === 'gate'">
              <legend>Guard booth point</legend>
              <div v-if="selected.boothAt">
                <label>Coordinate mode
                  <select :value="pointMode(selected.boothAt)" @change="setPointMode(selected.boothAt, $event.target.value)">
                    <option value="hex">Hex anchor</option><option value="raw">World coordinates</option>
                  </select>
                </label>
                <template v-if="selected.boothAt?.hex != null">
                  <label>Anchor hex<select v-model="selected.boothAt.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select></label>
                  <div class="field-grid">
                    <label>dx<input v-model.number="selected.boothAt.dx" type="number" step=".01" /></label>
                    <label>dy<input v-model.number="selected.boothAt.dy" type="number" step=".01" /></label>
                  </div>
                </template>
                <div v-else class="field-grid">
                  <label>X<input v-model.number="selected.boothAt.x" type="number" /></label>
                  <label>Y<input v-model.number="selected.boothAt.y" type="number" /></label>
                </div>
                <button class="sm muted" @click="removeBoothAt">Remove booth</button>
              </div>
              <button v-else class="sm" @click="ensureBoothAt">Add guard booth</button>
            </fieldset>
          </template>

          <fieldset v-if="selectedIsLine">
            <legend>Control points</legend>
            <div class="point-tools">
              <button
                class="sm"
                :class="{ active: tool === 'add-point' }"
                @click="toggleAddPointMode"
              >
                {{ tool === "add-point" ? "Done adding points" : "Add point on map" }}
              </button>
            </div>
            <article v-for="(point, index) in selected.points" :key="index" class="point-editor">
              <div class="point-heading">
                <strong>Point {{ index + 1 }}</strong>
                <div class="row-actions">
                  <button class="sm muted" @click="movePoint(index, -1)">↑</button>
                  <button class="sm muted" @click="movePoint(index, 1)">↓</button>
                  <button class="sm muted" :disabled="selected.points.length <= 2" @click="removePoint(index)">×</button>
                </div>
              </div>
              <select :value="pointMode(point)" @change="setPointMode(point, $event.target.value)">
                <option value="hex">Hex anchor</option><option value="raw">World coordinates</option>
              </select>
              <template v-if="point.hex != null">
                <select v-model="point.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select>
                <div class="field-grid">
                  <input v-model.number="point.dx" type="number" step=".01" aria-label="Point dx" />
                  <input v-model.number="point.dy" type="number" step=".01" aria-label="Point dy" />
                </div>
              </template>
              <div v-else class="field-grid">
                <input v-model.number="point.x" type="number" aria-label="Point x" />
                <input v-model.number="point.y" type="number" aria-label="Point y" />
              </div>
            </article>
          </fieldset>
        </template>
        <p v-else class="empty-note">Select an object from the map or object browser.</p>

        <p v-for="message in errorMessages.slice(0, 12)" :key="message" class="field-error">
          {{ message }}
        </p>
        <section class="audit-renames">
          <div class="subitem-heading">
            <strong>Movement audit names</strong>
          </div>
          <p class="empty-note">
            Keep old audit IDs mapped to current hex IDs after renames.
          </p>
          <div v-if="movementAuditRenames.length" class="audit-rename-list">
            <div
              v-for="(rename, index) in movementAuditRenames"
              :key="`${rename.from}:${rename.to}:${index}`"
              class="audit-rename-row"
            >
              <code>{{ rename.from }}</code>
              <span>→</span>
              <code>{{ rename.to }}</code>
              <button class="sm muted" @click="removeMovementAuditRename(index)">Remove</button>
            </div>
          </div>
          <div class="audit-rename-form">
            <input v-model.trim="auditRenameDraft.from" placeholder="old hex ID" />
            <select v-model="auditRenameDraft.to">
              <option value="">current hex ID</option>
              <option v-for="id in allHexIds" :key="id">{{ id }}</option>
            </select>
            <button class="sm" @click="addMovementAuditRename">Add alias</button>
          </div>
        </section>
        <section v-if="auditSummary || warnings.length" class="diagnostics">
          <p v-if="auditSummary" :class="{ warning: auditSummary.invalid }">
            Movement audit:
            {{ auditSummary.invalid
              ? `${auditSummary.invalid} invalid case(s) out of ${auditSummary.total}.`
              : `passed ${auditSummary.total} cases.` }}
          </p>
          <ul v-if="invalidAuditEntries.length" class="audit-issues">
            <li v-for="entry in invalidAuditEntries.slice(0, 8)" :key="entry.id">
              <strong>{{ entry.label }}</strong>
              <span>{{ entry.reason || "Movement result did not match the audit expectation." }}</span>
            </li>
          </ul>
          <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
            {{ warning.path }}: {{ warning.message }}
          </p>
        </section>

        <section v-if="showHistory" class="history">
          <h3>World revisions</h3>
          <button
            v-for="revision in revisions"
            :key="revision.revision"
            class="revision-item"
            @click="restoreRevision(revision.revision)"
          >
            r{{ revision.revision }} · {{ revision.operation }} ·
            {{ new Date(revision.createdAt).toLocaleString() }}
          </button>
        </section>
      </aside>
    </div>

    <div
      v-if="navigationPromptVisible"
      class="unsaved-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-unsaved-title"
    >
      <section class="unsaved-dialog">
        <p class="label">Unsaved world changes</p>
        <h2 id="world-unsaved-title">Save before leaving World Builder?</h2>
        <p>Save the draft, discard it, or return to the map without changing workspaces.</p>
        <div class="row-actions">
          <button :disabled="savingBeforeNavigation" @click="saveAndLeave">
            {{ savingBeforeNavigation ? "Saving…" : "Save and continue" }}
          </button>
          <button class="danger-outline" :disabled="savingBeforeNavigation" @click="discardAndLeave">
            Discard changes
          </button>
          <button class="muted" :disabled="savingBeforeNavigation" @click="keepEditing">
            Keep editing
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.world-builder { padding: .85rem; }
.world-toolbar, .toolbar-group, .tool-group, .canvas-toolbar, .inspector-heading, .row-actions, .point-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.world-toolbar h2, .world-toolbar p, .inspector h3 { margin: 0; }
.world-status, .dirty-banner { margin: .65rem 0 0; padding: .55rem .75rem; border-radius: 7px; }
.world-status { background: #24344a; color: #b8d8ff; }
.dirty-banner { background: #59481f; color: #ffe4a3; }
.world-workspace {
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr) minmax(290px, 350px);
  gap: .75rem;
  height: calc(100vh - 10.5rem);
  min-height: 560px;
  margin-top: .75rem;
}
.world-workspace.left-collapsed { grid-template-columns: minmax(440px, 1fr) minmax(290px, 350px); }
.world-workspace.right-collapsed { grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr); }
.world-workspace.left-collapsed.right-collapsed { grid-template-columns: 1fr; }
.panel { min-width: 0; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: .75rem; }
.object-browser, .inspector { overflow: auto; }
.object-browser input, .inspector input, .inspector textarea, .inspector select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .45rem .55rem;
}
.create-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; margin-top: .6rem; }
.object-group { margin-top: .9rem; }
.object-group h3 { display: flex; justify-content: space-between; margin: 0 0 .35rem; color: #aeb5c0; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
.object-group h3 span { color: #6f7787; }
.object-item { display: grid; width: 100%; gap: .1rem; margin-top: .25rem; text-align: left; background: #252b35; }
.object-item span { color: #8e96a3; font-size: .72rem; }
.object-item.active, .canvas-toolbar button.active, .point-tools button.active { background: #49624f; border-color: #6f9b79; }
.segmented-control {
  display: flex;
  gap: .2rem;
  padding: .16rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #171b22;
}
.toolbar-field {
  display: flex;
  align-items: center;
  gap: .4rem;
  color: #bdc4ce;
  font-size: .78rem;
}
.toolbar-select {
  min-width: 10rem;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .42rem .55rem;
}
.canvas-column { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .55rem; min-width: 0; }
.world-canvas { position: relative; min-height: 0; overflow: hidden; border: 1px solid #3b4655; border-radius: 11px; background: #1d241f; }
.yaml-canvas {
  min-height: 0;
  margin: 0;
  overflow: auto;
  padding: .85rem;
  border: 1px solid #3b4655;
  border-radius: 11px;
  background: #11151b;
  color: #d8dee8;
  white-space: pre;
  font-size: .75rem;
  line-height: 1.45;
}
.world-canvas :deep(.hexmap), .world-canvas :deep(.hexmap.expanded) { height: 100%; min-height: 100%; border-radius: 0; }
.world-canvas.panning { cursor: grabbing; }
.pan-hint { position: absolute; left: .65rem; bottom: .45rem; margin: 0; padding: .25rem .45rem; border-radius: 5px; background: rgba(10, 13, 11, .7); color: #aeb7ad; font-size: .72rem; pointer-events: none; }
.inspector { display: grid; align-content: start; gap: .7rem; }
.inspector label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .8rem; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.hex-subitems { display: grid; gap: .45rem; padding-top: .35rem; border-top: 1px solid #343d4d; }
.subitem-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; color: #bdc4ce; font-size: .82rem; }
.subitem-row {
  display: grid;
  gap: .1rem;
  width: 100%;
  padding: .5rem .6rem;
  text-align: left;
  border: 1px solid #343d4d;
  border-radius: 7px;
  background: #1b2028;
}
.subitem-row span { color: #8e96a3; font-size: .72rem; }
.draft-card {
  display: grid;
  gap: .55rem;
  padding: .6rem;
  border: 1px solid #485267;
  border-radius: 8px;
  background: #1b2028;
}
.cascade-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(4.5rem, .7fr) minmax(4.5rem, .7fr) auto; gap: .45rem; align-items: end; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
fieldset { display: grid; gap: .55rem; margin: 0; padding: .65rem; border: 1px solid #3b4557; border-radius: 8px; }
legend { color: #8bc49a; }
.point-editor { display: grid; gap: .4rem; padding: .5rem; border: 1px solid #343d4d; border-radius: 7px; background: #1b2028; }
.point-tools { display: flex; justify-content: flex-end; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.audit-renames { display: grid; gap: .45rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.audit-rename-list { display: grid; gap: .35rem; }
.audit-rename-row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: .4rem; }
.audit-rename-row code { overflow: hidden; text-overflow: ellipsis; color: #d9e0ea; font-size: .74rem; }
.audit-rename-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: .4rem; align-items: center; }
.diagnostics { display: grid; gap: .4rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.diagnostics p { margin: 0; color: #aab2bd; font-size: .75rem; }
.audit-issues { display: grid; gap: .35rem; margin: 0; padding: 0; list-style: none; }
.audit-issues li { display: grid; gap: .15rem; padding: .45rem .55rem; border: 1px solid #704848; border-radius: 7px; background: #2c2024; }
.audit-issues strong { color: #ffd0d0; font-size: .78rem; }
.audit-issues span { color: #d8b5b5; font-size: .76rem; line-height: 1.35; }
.warning { color: #efcb83 !important; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.history { display: grid; gap: .4rem; }
.revision-item { text-align: left; font-size: .76rem; }
.empty-note { color: #939ba7; }
.unsaved-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(8, 10, 14, .72);
  backdrop-filter: blur(3px);
}
.unsaved-dialog {
  width: min(32rem, 100%);
  padding: 1.25rem;
  border: 1px solid #4a566b;
  border-radius: 12px;
  background: #202630;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .45);
}
.unsaved-dialog h2 { margin: .25rem 0 .65rem; font-size: 1.15rem; }
.unsaved-dialog p:not(.label) { color: #bfc5cf; line-height: 1.5; }
@media (max-width: 1050px) {
  .world-workspace, .world-workspace.left-collapsed, .world-workspace.right-collapsed {
    grid-template-columns: 220px minmax(420px, 1fr);
    height: auto;
  }
  .inspector { grid-column: 1 / -1; max-height: none; }
  .world-canvas { min-height: 68vh; }
}
@media (max-width: 720px) {
  .world-workspace, .world-workspace.left-collapsed, .world-workspace.right-collapsed {
    grid-template-columns: 1fr;
  }
  .inspector { grid-column: auto; }
}
</style>
