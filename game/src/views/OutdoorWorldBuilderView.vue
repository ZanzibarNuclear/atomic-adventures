<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import yaml from "js-yaml";
import HexMap from "../lib/maps/components/HexMap.vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import {
  addWaypoint,
  ensureDefaultStandAt,
  resolvedPlacementHandles,
  resolvedWaypoints,
  setLandmarkWorld,
  setStandWorld,
  setWaypointWorld,
} from "../lib/maps/composables/useMapBuilder.js";
import { axialToPixel, boundsOf } from "../lib/maps/composables/useHexGeometry.js";
import { resolveWaypoint } from "../lib/maps/composables/useRoutes.js";
import {
  buildMapMovementAudit,
  movementAuditSummary,
} from "../lib/maps/debug/mapMovementAudit.js";
import { storyApi } from "../lib/storyApi.js";
import { useWorldContent } from "../composables/useWorldContent.js";

const PASSAGE_KINDS = new Set(["gate", "hole", "bridge", "ford", "stair"]);
const LINE_KINDS = ["river", "road", "drive", "fence", "path", "trail"];
const TERRAIN_KINDS = ["forest", "clearing", "rock", "water"];
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
const mapHost = ref(null);
const camera = ref({ x: -250, y: -220, width: 500, height: 440 });
const fitFrame = ref({ x: -250, y: -220, width: 500, height: 440 });
const panning = ref(null);
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
const allHexIds = computed(() => outdoor.editableHexes.map((hex) => hex.id));
const allHexSet = computed(() => new Set(allHexIds.value));
const selected = computed(() => {
  const [type, id] = splitKey(selectedKey.value);
  if (type === "hex" || type === "landmark" || type === "stand") {
    return outdoor.editableHexes.find((hex) => hex.id === id) ?? null;
  }
  if (type === "route") return outdoor.editableRoutes.find((route) => route.id === id) ?? null;
  if (type === "feature" || type === "passage") {
    return outdoor.editableFeatures.find((feature) => feature.id === id) ?? null;
  }
  return null;
});
const selectedType = computed(() => splitKey(selectedKey.value)[0]);
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
  if (selectedIsLine.value) {
    return resolvedWaypoints(selected.value, outdoor.hexById, outdoor.size).map((handle) => ({
      ...handle,
      handleKey: `point-${handle.index}`,
    }));
  }
  if (selectedIsPassage.value && selected.value.at) {
    const point = resolveWaypoint(selected.value.at, outdoor.hexById, outdoor.size);
    return [{ ...point, index: 0, role: "passage", handleKey: "passage" }];
  }
  return resolvedPlacementHandles(selected.value, outdoor.size).map((handle) => ({
    ...handle,
    handleKey: handle.role,
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
      items: outdoor.editableHexes.filter((item) => item.standAt).filter(matches),
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
  selectedKey.value = `${type}:${id}`;
  selectedHandleId.value = null;
  tool.value = "select";
}

function selectFeature(id) {
  const feature = outdoor.editableFeatures.find((item) => item.id === id);
  select(PASSAGE_KINDS.has(feature?.kind) ? "passage" : "feature", id);
}

function splitKey(key) {
  const index = key.indexOf(":");
  return index < 0 ? ["", ""] : [key.slice(0, index), key.slice(index + 1)];
}

function onHandleMove({ x, y, role, index }) {
  if (!selected.value) return;
  if (selectedIsLine.value) {
    setWaypointWorld(selected.value, index, x, y, outdoor.hexById, outdoor.size);
  } else if (selectedIsPassage.value) {
    const holder = { points: [selected.value.at] };
    setWaypointWorld(holder, 0, x, y, outdoor.hexById, outdoor.size);
    selected.value.at = holder.points[0];
  } else if (role === "landmark") {
    setLandmarkWorld(selected.value, x, y, outdoor.size);
  } else if (role === "stand") {
    setStandWorld(selected.value, x, y, outdoor.size);
  }
}

function onBuilderMapClick({ x, y }) {
  if (tool.value !== "add-point" || !selectedIsLine.value) return;
  const index = addWaypoint(selected.value, x, y);
  selectedHandleId.value = `point-${index}`;
}

function addStand() {
  if (!selected.value || !selectedIsPlacement.value) return;
  if (selected.value.landmark) ensureDefaultStandAt(selected.value);
  else selected.value.standAt = { dx: 0, dy: 0 };
  selectedKey.value = `stand:${selected.value.id}`;
}

function addLandmark() {
  const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
  if (!hex) return;
  hex.landmark ??= { icon: "◆", label: hex.label ?? hex.id, dx: 0, dy: 0 };
  ensureDefaultStandAt(hex);
  select("landmark", hex.id);
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
    delete selected.value.standAt;
    select("hex", id);
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
  for (const route of outdoor.editableRoutes) {
    for (const point of route.points ?? []) if (point.hex === from) point.hex = to;
  }
  for (const feature of outdoor.editableFeatures) {
    if (feature.hex === from) feature.hex = to;
    for (const key of ["at", "labelAt", "boothAt"]) if (feature[key]?.hex === from) feature[key].hex = to;
    for (const point of feature.points ?? []) if (point.hex === from) point.hex = to;
  }
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
    auditEntries.value = buildMapMovementAudit(currentWorld.value);
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

function resetZoom() {
  camera.value = { ...fitFrame.value };
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
          <button class="sm" @click="addLandmark">+ Landmark</button>
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
            <button class="sm" :class="{ active: tool === 'select' }" @click="tool = 'select'">Select</button>
            <button
              class="sm"
              :class="{ active: tool === 'add-point' }"
              :disabled="!selectedIsLine"
              @click="tool = tool === 'add-point' ? 'select' : 'add-point'"
            >Add route point</button>
          </div>
          <div class="tool-group">
            <button class="sm muted" @click="zoomBy(.8)">＋</button>
            <button class="sm muted" @click="zoomBy(1.25)">−</button>
            <button class="sm muted" @click="fitMap()">Fit map</button>
            <button class="sm muted" :disabled="!selected" @click="focusSelection">Focus selection</button>
            <button class="sm muted" @click="resetZoom">Reset zoom</button>
          </div>
        </div>
        <div
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
            :add-point-mode="tool === 'add-point'"
            :clickable-hex-ids="allHexSet"
            :selectable-objects="tool === 'select'"
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
            <button v-if="!['landmark', 'stand'].includes(selectedType)" class="sm muted" @click="renameSelected">Rename</button>
            <button v-if="!['landmark', 'stand'].includes(selectedType)" class="sm muted" @click="duplicateSelected">Duplicate</button>
            <button class="sm danger-outline" @click="deleteSelected">Delete</button>
          </div>

          <template v-if="selectedType === 'hex'">
            <div class="field-grid">
              <label>Axial q<input v-model.number="selected.q" type="number" /></label>
              <label>Axial r<input v-model.number="selected.r" type="number" /></label>
            </div>
            <label>Terrain
              <select v-model="selected.terrain">
                <option v-for="kind in TERRAIN_KINDS" :key="kind">{{ kind }}</option>
              </select>
            </label>
            <label>Display label<input v-model="selected.label" /></label>
            <label>Area<input v-model="selected.area" /></label>
            <label class="check-field"><input v-model="selected.cascade" type="checkbox" /> Cascade scenery</label>
            <div class="row-actions">
              <button class="sm" @click="addStand">Add/edit stand</button>
              <button class="sm" @click="addLandmark">Add/edit landmark</button>
            </div>
          </template>

          <template v-else-if="selectedType === 'landmark'">
            <label>Label<input v-model="selected.landmark.label" /></label>
            <label>Icon<input v-model="selected.landmark.icon" /></label>
            <label>Building ID<input v-model="selected.landmark.building" /></label>
            <label>Blurb<textarea v-model="selected.landmark.blurb" rows="4" /></label>
            <div class="field-grid">
              <label>Offset x<input v-model.number="selected.landmark.dx" type="number" step=".01" /></label>
              <label>Offset y<input v-model.number="selected.landmark.dy" type="number" step=".01" /></label>
            </div>
            <button class="sm" @click="addStand">Add/edit stand</button>
          </template>

          <template v-else-if="selectedType === 'stand'">
            <label>Anchor
              <select
                :value="selected.standAt?.from === 'landmark' ? 'landmark' : selected.standAt?.x != null ? 'world' : 'hex'"
                @change="
                  $event.target.value === 'landmark'
                    ? selected.standAt = { from: 'landmark', dx: 0, dy: 0 }
                    : $event.target.value === 'world'
                      ? selected.standAt = axialToPixel(selected.q, selected.r, outdoor.size)
                      : selected.standAt = { dx: 0, dy: 0 }
                "
              >
                <option value="hex">Hex-relative</option>
                <option value="landmark" :disabled="!selected.landmark">Landmark-relative</option>
                <option value="world">World coordinates</option>
              </select>
            </label>
            <div v-if="selected.standAt?.x != null" class="field-grid">
              <label>X<input v-model.number="selected.standAt.x" type="number" /></label>
              <label>Y<input v-model.number="selected.standAt.y" type="number" /></label>
            </div>
            <div v-else class="field-grid">
              <label>Offset x<input v-model.number="selected.standAt.dx" type="number" step=".01" /></label>
              <label>Offset y<input v-model.number="selected.standAt.dy" type="number" step=".01" /></label>
            </div>
          </template>

          <template v-else-if="selectedType === 'route'">
            <label>Kind
              <select v-model="selected.kind"><option v-for="kind in LINE_KINDS" :key="kind">{{ kind }}</option></select>
            </label>
            <label>Label<input v-model="selected.label" /></label>
            <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
          </template>

          <template v-else-if="selectedType === 'feature'">
            <label>Kind
              <select v-model="selected.kind"><option v-for="kind in LINE_KINDS" :key="kind">{{ kind }}</option></select>
            </label>
            <label>Label<input v-model="selected.label" /></label>
            <label>Flow<input v-model="selected.flow" /></label>
            <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
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
          </template>

          <fieldset v-if="selectedIsLine">
            <legend>Control points</legend>
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
        <section class="diagnostics">
          <button class="sm muted" @click="runMovementAudit()">Run movement audit</button>
          <p v-if="auditSummary">
            {{ auditSummary.total }} cases · {{ auditSummary.invalid }} invalid
          </p>
          <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
            {{ warning.path }}: {{ warning.message }}
          </p>
        </section>

        <details>
          <summary>Generated YAML</summary>
          <pre class="yaml-preview">{{ dirty ? dumpYaml(currentWorld) : yamlPreview }}</pre>
        </details>

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
.object-item.active, .canvas-toolbar button.active { background: #49624f; border-color: #6f9b79; }
.canvas-column { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .55rem; min-width: 0; }
.world-canvas { position: relative; min-height: 0; overflow: hidden; border: 1px solid #3b4655; border-radius: 11px; background: #1d241f; }
.world-canvas :deep(.hexmap), .world-canvas :deep(.hexmap.expanded) { height: 100%; min-height: 100%; border-radius: 0; }
.world-canvas.panning { cursor: grabbing; }
.pan-hint { position: absolute; left: .65rem; bottom: .45rem; margin: 0; padding: .25rem .45rem; border-radius: 5px; background: rgba(10, 13, 11, .7); color: #aeb7ad; font-size: .72rem; pointer-events: none; }
.inspector { display: grid; align-content: start; gap: .7rem; }
.inspector label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .8rem; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
fieldset { display: grid; gap: .55rem; margin: 0; padding: .65rem; border: 1px solid #3b4557; border-radius: 8px; }
legend { color: #8bc49a; }
.point-editor { display: grid; gap: .4rem; padding: .5rem; border: 1px solid #343d4d; border-radius: 7px; background: #1b2028; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.diagnostics { display: grid; gap: .4rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.diagnostics p { margin: 0; color: #aab2bd; font-size: .75rem; }
.warning { color: #efcb83 !important; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.yaml-preview { max-height: 22rem; overflow: auto; padding: .65rem; border-radius: 7px; background: #11151b; white-space: pre-wrap; font-size: .72rem; }
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
