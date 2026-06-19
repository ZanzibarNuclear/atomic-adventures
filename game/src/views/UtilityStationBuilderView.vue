<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import yaml from "js-yaml";
import utilityStationData from "../../content/world/utility-station.yaml";
import GridMap from "../lib/maps/components/GridMap.vue";
import { storyApi } from "../lib/storyApi.js";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState, setAllDoorsOpen } from "../lib/maps/composables/useDoors.js";
import {
  findGridEditable,
  getExitMapAt,
  gridEditModeForSource,
  listAllGridEditable,
  removePathNodeFromPath,
  removePathPoint,
  resolvedDoorHandle,
  resolvedExitHandle,
  resolvedNodeHandle,
  resolvedPathHandles,
  resolvedPathNodeHandles,
  resolvedRoomHandles,
  resolvedRoomStandHandle,
  setDoorAt,
  setExitMapAt,
  setNodeAt,
  setNodeLabel,
  setPathPoint,
  setRollDoorProps,
  setRoomFromHandle,
  setRoomLabel,
  setRoomStandAt,
  addPathNode,
  addPathPoint,
} from "../lib/maps/composables/useGridBuilder.js";
import { auditIndoorBuilding } from "../lib/maps/testing/indoorBuildingAudit.js";

const router = useRouter();
const source = ref(clonePlain(utilityStationData));
const draft = ref(clonePlain(source.value));
const baseline = ref("");
const version = ref(0);
const loaded = ref(false);
const level = ref(source.value.exterior?.level ?? source.value.levels?.at(-1)?.id ?? "");
const viewportMode = ref("fit-all");
const selectedKey = ref("");
const selectedHandleId = ref(null);
const search = ref("");
const addMode = ref(null);
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const exteriorFog = ref(false);
const status = ref("");
const errors = ref({});
const warnings = ref([]);
const revisions = ref([]);
const showHistory = ref(false);
const renames = ref([]);
const auditResult = ref(null);
const pendingRoute = ref("");
const navigationPromptVisible = ref(false);
const savingBeforeNavigation = ref(false);
const doorStates = ref(buildInitialDoorState(source.value.id, buildBuilding(source.value)));

const building = computed(() => buildBuilding(draft.value));
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value);
const allRoomIds = computed(() => building.value.rooms.map((room) => room.id));
const allExteriorIds = computed(() => building.value.exterior.nodes.map((node) => node.id));
const editableItems = computed(() =>
  listAllGridEditable(draft.value, level.value).filter((item) => {
    const term = search.value.trim().toLowerCase();
    return !term || `${item.id} ${item.label} ${item.source}`.toLowerCase().includes(term);
  }),
);
const groupedItems = computed(() => [
  { source: "rooms", label: "Rooms" },
  { source: "doors", label: "Doors" },
  { source: "paths", label: "Exterior paths" },
  { source: "nodes", label: "Exterior nodes" },
  { source: "exits", label: "World transitions" },
  { source: "fixtures", label: "Fixtures (read-only geometry)" },
  { source: "links", label: "Room connections" },
  { source: "stands", label: "Room stands" },
].map((group) => ({
  ...group,
  items: editableItems.value.filter((item) => item.source === group.source),
})));
const selection = computed(() => {
  const parsed = splitKey(selectedKey.value);
  if (!parsed) return null;
  const entity = findGridEditable(draft.value, parsed.source, parsed.id);
  return entity ? { ...parsed, entity } : null;
});
const editMode = computed(() =>
  selection.value ? gridEditModeForSource(selection.value.source) : null,
);
const cell = computed(() => draft.value.cell ?? 64);
const editHandles = computed(() => {
  const selected = selection.value;
  if (!selected) return [];
  if (selected.source === "paths") {
    return [
      ...resolvedPathHandles(selected.entity, cell.value, draft.value),
      ...resolvedPathNodeHandles(draft.value, selected.entity, cell.value),
    ];
  }
  if (selected.source === "rooms") return resolvedRoomHandles(selected.entity, cell.value);
  if (selected.source === "doors") {
    return selected.entity.kind === "roll" ? [] : resolvedDoorHandle(selected.entity, cell.value);
  }
  if (selected.source === "nodes") return resolvedNodeHandle(selected.entity, cell.value);
  if (selected.source === "exits") return resolvedExitHandle(selected.entity, cell.value);
  if (selected.source === "stands") return resolvedRoomStandHandle(selected.entity, cell.value);
  return [];
});
const selectedPathNode = computed(() => {
  const id = selectedHandleId.value?.match(/^node-(.+)$/)?.[1];
  return id ? draft.value.exterior?.nodes?.find((node) => node.id === id) ?? null : null;
});
const rollDoorRoom = computed(() => {
  const door = selection.value?.source === "doors" ? selection.value.entity : null;
  return door?.kind === "roll"
    ? draft.value.rooms?.find((room) => room.id === door.room) ?? null
    : null;
});
const generatedYaml = computed(() =>
  yaml.dump(draft.value, { noRefs: true, lineWidth: 100, noCompatMode: true, sortKeys: false }),
);
const errorMessages = computed(() =>
  Object.entries(errors.value).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);

onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload));
onMounted(async () => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    applyLoaded(await storyApi("/api/world/buildings/utility-station"));
  } catch (error) {
    status.value = error.message;
  }
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

function splitKey(key) {
  const index = key.indexOf(":");
  return index < 0 ? null : { source: key.slice(0, index), id: key.slice(index + 1) };
}

function selectItem(sourceName, id) {
  selectedKey.value = `${sourceName}:${id}`;
  selectedHandleId.value = null;
  addMode.value = null;
}

function selectStand({ roomId, standId }) {
  if (standId.startsWith("door:")) {
    selectItem("doors", standId.slice("door:".length));
    return;
  }
  selectItem("stands", `${roomId}/${standId}`);
}

function onHandleMove(payload) {
  const selected = selection.value;
  if (!selected) return;
  const x = payload.x / cell.value;
  const y = payload.y / cell.value;
  if (selected.source === "paths") {
    if (payload.role === "path-node" && payload.nodeId) {
      setNodeAt(draft.value, payload.nodeId, x, y);
    } else {
      setPathPoint(draft.value, selected.id, payload.index, x, y);
    }
  } else if (selected.source === "rooms") {
    setRoomFromHandle(draft.value, selected.id, payload.role, x, y);
  } else if (selected.source === "doors") {
    setDoorAt(draft.value, selected.id, x, y);
  } else if (selected.source === "nodes") {
    setNodeAt(draft.value, selected.id, x, y);
  } else if (selected.source === "exits") {
    setExitMapAt(draft.value, selected.id, x, y);
  } else if (selected.source === "stands") {
    setRoomStandAt(draft.value, selected.id, x, y);
  }
}

function onMapClick(payload) {
  const selected = selection.value;
  if (selected?.source !== "paths" || !addMode.value) return;
  const x = payload.x / cell.value;
  const y = payload.y / cell.value;
  if (addMode.value === "node") {
    const id = addPathNode(draft.value, selected.id, x, y);
    selectedHandleId.value = id ? `node-${id}` : null;
  } else {
    const index = addPathPoint(draft.value, selected.id, x, y);
    selectedHandleId.value = index >= 0 ? `point-${index}` : null;
  }
}

function removeSelectedPathHandle() {
  const selected = selection.value;
  if (selected?.source !== "paths") return;
  const point = selectedHandleId.value?.match(/^point-(\d+)$/);
  const node = selectedHandleId.value?.match(/^node-(.+)$/);
  if (point) removePathPoint(draft.value, selected.id, Number(point[1]));
  if (node) removePathNodeFromPath(draft.value, selected.id, node[1]);
  selectedHandleId.value = null;
}

function revertDraft() {
  draft.value = clonePlain(source.value);
  baseline.value = JSON.stringify(source.value);
  selectedHandleId.value = null;
  doorStates.value = buildInitialDoorState(source.value.id, buildBuilding(source.value));
  errors.value = {};
  renames.value = [];
  auditResult.value = null;
  status.value = "Reverted unsaved utility station changes.";
}

function applyLoaded(result) {
  source.value = clonePlain(result.building);
  draft.value = clonePlain(result.building);
  baseline.value = JSON.stringify(result.building);
  version.value = result.version;
  warnings.value = result.warnings ?? [];
  errors.value = {};
  loaded.value = true;
  renames.value = [];
  auditResult.value = null;
  if (!result.building.levels?.some((item) => item.id === level.value)) {
    level.value = result.building.exterior?.level ?? result.building.levels?.at(-1)?.id ?? "";
  }
  doorStates.value = buildInitialDoorState(result.building.id, buildBuilding(result.building));
}

async function saveDraft() {
  errors.value = {};
  status.value = "";
  try {
    const result = await storyApi("/api/world/buildings/utility-station", {
      method: "PUT",
      body: JSON.stringify({
        building: draft.value,
        expectedVersion: version.value,
        renames: renames.value,
      }),
    });
    applyLoaded(result);
    status.value = `Saved utility station version ${result.version}.`;
    return true;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.status === 409
      ? "This building changed in another window. Revert or reload before saving."
      : error.message;
    return false;
  }
}

function collectionFor(sourceName) {
  if (sourceName === "rooms") return draft.value.rooms;
  if (sourceName === "doors") return draft.value.doors;
  if (sourceName === "paths") return draft.value.exterior?.paths;
  if (sourceName === "nodes") return draft.value.exterior?.nodes;
  if (sourceName === "exits") return draft.value.transitions ?? draft.value.exits;
  if (sourceName === "fixtures") return draft.value.fixtures;
  if (sourceName === "links") return draft.value.links;
  if (sourceName === "stands") {
    const roomId = selection.value?.source === "stands"
      ? selection.value.id.split("/")[0]
      : selection.value?.source === "rooms"
        ? selection.value.id
        : null;
    return draft.value.rooms.find((room) => room.id === roomId)?.stands ?? null;
  }
  return null;
}

function uniqueId(base, list = []) {
  const used = new Set(list.map((item) => item.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function addObject(sourceName) {
  let list = collectionFor(sourceName);
  let item = null;
  if (sourceName === "stands") {
    const room = selection.value?.source === "rooms"
      ? selection.value.entity
      : draft.value.rooms.find((candidate) =>
          !candidate.feature &&
          (candidate.level === level.value || candidate.levels?.includes(level.value))
        );
    if (!room) return;
    room.stands ??= [];
    list = room.stands;
    item = {
      id: uniqueId("new-stand", list),
      at: {
        x: Number(room.x ?? 0) + Number(room.w ?? 1) / 2,
        y: Number(room.y ?? 0) + Number(room.h ?? 1) / 2,
      },
      label: "New stand",
    };
    list.push(item);
    room.defaultStand ??= item.id;
    selectItem("stands", `${room.id}/${item.id}`);
    return;
  }
  if (!list) return;
  if (sourceName === "rooms") {
    item = {
      id: uniqueId("new-room", list),
      level: level.value,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      label: "New Room",
    };
  } else if (sourceName === "doors") {
    item = {
      id: uniqueId("new-door", list),
      kind: "man",
      level: level.value,
      at: { x: 0, y: 0 },
      initial: { closed: true, locked: false },
    };
  } else if (sourceName === "paths") {
    item = {
      id: uniqueId("new-path", list),
      smooth: true,
      nodes: [],
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
  } else if (sourceName === "nodes") {
    item = {
      id: uniqueId("new-stand", list),
      at: { x: 0, y: 0 },
      label: "New stand",
    };
  } else if (sourceName === "exits") {
    item = {
      id: uniqueId("new-transition", list),
      label: "New transition",
      at: { x: 0, y: 0 },
      hex: draft.value.outdoorHex ?? "utility-yard",
    };
  } else if (sourceName === "links") {
    const rooms = draft.value.rooms.filter((room) =>
      room.level === level.value || room.levels?.includes(level.value),
    );
    if (rooms.length < 2) {
      status.value = "Add at least two rooms on this floor before creating a connection.";
      return;
    }
    item = {
      from: rooms[0].id,
      to: rooms[1].id,
      kind: "open",
    };
  }
  if (!item) return;
  list.push(item);
  const id = sourceName === "links"
    ? `${item.from}-${item.to}-${list.length - 1}`
    : item.id;
  selectItem(sourceName, id);
}

function duplicateSelected() {
  const selected = selection.value;
  const list = selected ? collectionFor(selected.source) : null;
  if (!selected || !list || ["fixtures", "links"].includes(selected.source)) return;
  const copy = clonePlain(selected.entity);
  copy.id = uniqueId(`${copy.id}-copy`, list);
  if (selected.source === "rooms") {
    copy.x = Number(copy.x ?? 0) + 0.5;
    copy.y = Number(copy.y ?? 0) + 0.5;
  }
  if (copy.at) {
    copy.at.x = Number(copy.at.x ?? 0) + 0.25;
    copy.at.y = Number(copy.at.y ?? 0) + 0.25;
  }
  list.push(copy);
  selectItem(
    selected.source,
    selected.source === "stands"
      ? `${selected.id.split("/")[0]}/${copy.id}`
      : copy.id,
  );
}

function deleteSelected() {
  const selected = selection.value;
  const list = selected ? collectionFor(selected.source) : null;
  if (!selected || !list || selected.source === "fixtures") return;
  if (!window.confirm(
    `Delete ${selected.source.slice(0, -1)} "${selected.id}"? References are checked when you save.`,
  )) return;
  const index = selected.source === "links"
    ? Number(selected.id.split("-").at(-1))
    : list.findIndex((item) => item.id === (
        selected.source === "stands" ? selected.id.split("/")[1] : selected.id
      ));
  if (selected.source === "stands") {
    const room = draft.value.rooms.find((item) => item.id === selected.id.split("/")[0]);
    if (room?.defaultStand === selected.id.split("/")[1]) room.defaultStand = null;
  }
  if (index >= 0) list.splice(index, 1);
  selectedKey.value = "";
  selectedHandleId.value = null;
}

function moveSelected(delta) {
  const selected = selection.value;
  const list = selected ? collectionFor(selected.source) : null;
  if (!selected || !list) return;
  const index = selected.source === "links"
    ? Number(selected.id.split("-").at(-1))
    : list.findIndex((item) => item.id === (
        selected.source === "stands" ? selected.id.split("/")[1] : selected.id
      ));
  const next = index + delta;
  if (index < 0 || next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
}

async function renameSelected() {
  const selected = selection.value;
  if (!selected || ["fixtures", "links"].includes(selected.source)) return;
  const currentId = selected.source === "stands" ? selected.id.split("/")[1] : selected.id;
  const next = window.prompt(`Rename "${currentId}" to:`, currentId)?.trim();
  if (!next || next === currentId) return;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
    status.value = "IDs must use kebab-case.";
    return;
  }
  const list = collectionFor(selected.source);
  if (list.some((item) => item.id === next)) {
    status.value = `The ID "${next}" already exists.`;
    return;
  }
  const kind = {
    rooms: "room",
    doors: "door",
    paths: "path",
    nodes: "exteriorNode",
    exits: "transition",
  }[selected.source];
  if (selected.source === "stands") {
    const roomId = selected.id.split("/")[0];
    const room = draft.value.rooms.find((item) => item.id === roomId);
    if (room?.defaultStand === currentId) room.defaultStand = next;
    selected.entity.id = next;
    selectedKey.value = `stands:${roomId}/${next}`;
    return;
  }
  let references = [];
  if (["room", "exteriorNode"].includes(kind)) {
    try {
      const preview = await storyApi(
        "/api/world/buildings/utility-station/rename-preview",
        {
          method: "POST",
          body: JSON.stringify({
            kind,
            from: selected.id,
            to: next,
            building: draft.value,
          }),
        },
      );
      references = preview.references ?? [];
    } catch (error) {
      status.value = error.message;
      return;
    }
  }
  const summary = references.length
    ? `\n\n${references.length} story reference(s) will also be updated.`
    : "";
  if (!window.confirm(`Rename "${selected.id}" to "${next}"?${summary}`)) return;
  const from = selected.id;
  selected.entity.id = next;
  cascadeLocalRename(kind, from, next);
  renames.value.push({ kind, from, to: next });
  selectedKey.value = `${selected.source}:${next}`;
}

function cascadeLocalRename(kind, from, to) {
  const replace = (value) => value === from ? to : value;
  if (kind === "room") {
    draft.value.start = replace(draft.value.start);
    for (const room of draft.value.rooms) if (room.mirror) room.mirror = replace(room.mirror);
    for (const link of draft.value.links) {
      link.from = replace(link.from);
      link.to = replace(link.to);
    }
    for (const door of draft.value.doors) {
      if (door.room) door.room = replace(door.room);
      if (door.showWhenRoom) door.showWhenRoom = replace(door.showWhenRoom);
      if (door.showWhenDiscovered) door.showWhenDiscovered = replace(door.showWhenDiscovered);
      if (door.showWhenRevealed) door.showWhenRevealed = replace(door.showWhenRevealed);
      if (door.lock?.freeFrom) door.lock.freeFrom = replace(door.lock.freeFrom);
    }
    for (const node of draft.value.exterior?.nodes ?? []) if (node.room) node.room = replace(node.room);
    for (const transition of draft.value.transitions ?? []) if (transition.room) transition.room = replace(transition.room);
    for (const pickup of draft.value.pickups ?? []) pickup.room = replace(pickup.room);
    for (const item of draft.value.switches ?? []) item.room = replace(item.room);
    for (const action of draft.value.actions ?? []) if (action.room) action.room = replace(action.room);
    for (const fixture of draft.value.fixtures ?? []) {
      fixture.connects = (fixture.connects ?? []).map(replace);
      if (fixture.revealRoom) fixture.revealRoom = replace(fixture.revealRoom);
    }
  }
  if (kind === "door") {
    for (const link of draft.value.links) if (link.door) link.door = replace(link.door);
    for (const node of draft.value.exterior?.nodes ?? []) if (node.door) node.door = replace(node.door);
    for (const transition of draft.value.transitions ?? []) if (transition.door) transition.door = replace(transition.door);
    for (const item of draft.value.switches ?? []) item.door = replace(item.door);
    for (const room of draft.value.rooms) if (room.revealWhenDoor) room.revealWhenDoor = replace(room.revealWhenDoor);
    for (const fixture of draft.value.fixtures ?? []) {
      if (fixture.revealWhenDoor) fixture.revealWhenDoor = replace(fixture.revealWhenDoor);
    }
  }
  if (kind === "exteriorNode") {
    draft.value.exterior.entry = replace(draft.value.exterior.entry);
    for (const path of draft.value.exterior.paths ?? []) {
      path.nodes = (path.nodes ?? []).map(replace);
    }
    for (const transition of draft.value.transitions ?? []) {
      if (transition.exteriorNode) transition.exteriorNode = replace(transition.exteriorNode);
    }
    for (const action of draft.value.actions ?? []) {
      if (action.exteriorNode) action.exteriorNode = replace(action.exteriorNode);
    }
  }
}

function runIndoorAudit() {
  auditResult.value = auditIndoorBuilding(draft.value);
  status.value = auditResult.value.valid
    ? `Indoor audit passed: ${auditResult.value.roomCount} rooms and ${auditResult.value.exteriorNodeCount} exterior nodes are connected.`
    : `Indoor audit found ${auditResult.value.unreachableRooms.length} unreachable room(s) and ${auditResult.value.unreachableExteriorNodes.length} unreachable exterior node(s).`;
}

async function loadHistory() {
  revisions.value = await storyApi("/api/world/buildings/utility-station/revisions");
  showHistory.value = true;
}

async function restoreRevision(revision) {
  if (dirty.value && !window.confirm("Discard unsaved edits and restore this revision?")) return;
  if (!window.confirm(`Restore utility station revision ${revision} as a new revision?`)) return;
  try {
    const result = await storyApi(
      `/api/world/buildings/utility-station/revisions/${revision}/restore`,
      { method: "POST", body: "{}" },
    );
    applyLoaded(result);
    status.value = `Restored utility station revision ${revision}.`;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.message;
  }
}

function setDoorPreview(open) {
  const next = buildInitialDoorState(building.value.areaId, building.value);
  setAllDoorsOpen(next, building.value.areaId, building.value, open);
  doorStates.value = next;
}

function keepEditing() {
  navigationPromptVisible.value = false;
  pendingRoute.value = "";
}

async function discardAndLeave() {
  const route = pendingRoute.value;
  navigationPromptVisible.value = false;
  pendingRoute.value = "";
  draft.value = clonePlain(source.value);
  baseline.value = JSON.stringify(source.value);
  await router.push(route);
}

async function saveAndLeave() {
  savingBeforeNavigation.value = true;
  const saved = await saveDraft();
  savingBeforeNavigation.value = false;
  if (!saved) return;
  const route = pendingRoute.value;
  navigationPromptVisible.value = false;
  pendingRoute.value = "";
  await router.push(route);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}
</script>

<template>
  <main class="station-builder">
    <header class="station-toolbar">
      <div>
        <p class="label">Indoor world</p>
        <h2>Utility Station</h2>
      </div>
      <div class="toolbar-actions">
        <button class="sm muted" @click="leftCollapsed = !leftCollapsed">
          {{ leftCollapsed ? "Show objects" : "Hide objects" }}
        </button>
        <button class="sm muted" @click="rightCollapsed = !rightCollapsed">
          {{ rightCollapsed ? "Show inspector" : "Hide inspector" }}
        </button>
        <button class="sm muted" :disabled="!dirty" @click="revertDraft">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveDraft">Save building</button>
      </div>
    </header>

    <p v-if="status" class="station-status">{{ status }}</p>
    <p v-if="dirty" class="dirty-banner">Unsaved utility station changes</p>

    <div
      class="station-workspace"
      :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
    >
      <aside v-if="!leftCollapsed" class="object-browser panel">
        <input v-model="search" placeholder="Search station objects…" />
        <div class="create-grid">
          <button class="sm" @click="addObject('rooms')">+ Room</button>
          <button class="sm" @click="addObject('doors')">+ Door</button>
          <button class="sm" @click="addObject('paths')">+ Path</button>
          <button class="sm" @click="addObject('nodes')">+ Node</button>
          <button class="sm" @click="addObject('exits')">+ Transition</button>
          <button class="sm" @click="addObject('links')">+ Connection</button>
          <button class="sm" @click="addObject('stands')">+ Stand</button>
        </div>
        <section v-for="group in groupedItems" :key="group.source" class="object-group">
          <h3>{{ group.label }} <span>{{ group.items.length }}</span></h3>
          <button
            v-for="item in group.items"
            :key="`${item.source}:${item.id}`"
            class="object-item"
            :class="{ active: selectedKey === `${item.source}:${item.id}` }"
            @click="selectItem(item.source, item.id)"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.id }}</span>
          </button>
        </section>
      </aside>

      <section class="canvas-column">
        <div class="canvas-toolbar panel">
          <div class="tool-group">
            <label>Floor
              <select v-model="level">
                <option v-for="item in building.levels" :key="item.id" :value="item.id">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label>Camera
              <select v-model="viewportMode">
                <option value="fit-all">Fit all</option>
                <option value="gameplay">Gameplay preview</option>
              </select>
            </label>
            <label class="check-field">
              <input v-model="exteriorFog" type="checkbox" />
              Exterior fog
            </label>
          </div>
          <div class="tool-group">
            <button class="sm muted" @click="setDoorPreview(true)">Open all doors</button>
            <button class="sm muted" @click="setDoorPreview(false)">Close all doors</button>
          </div>
        </div>

        <div class="station-canvas">
          <GridMap
            v-if="loaded"
            :building="building"
            :current-room="
              selection?.source === 'rooms'
                ? selection.id
                : selection?.source === 'stands'
                  ? selection.id.split('/')[0]
                  : ''
            "
            :current-stand="selection?.source === 'stands' ? selection.id.split('/')[1] : null"
            :discovered="allRoomIds"
            :revealed="allRoomIds"
            :level="level"
            :stand-level="level"
            :reachable-rooms="allRoomIds"
            :reachable-exterior-nodes="allExteriorIds"
            :door-states="doorStates"
            :builder-view="true"
            :builder-edit="!!selection"
            :edit-mode="editMode"
            :edit-handles="editHandles"
            :selected-handle-id="selectedHandleId"
            :selected-item-id="selection?.id ?? ''"
            :add-point-mode="!!addMode"
            :map-click-mode="addMode"
            :hydro-discovered="true"
            :viewport-mode="viewportMode"
            :exterior-fog="exteriorFog"
            @select-item="selectItem($event.source, $event.id)"
            @select-handle="selectedHandleId = $event"
            @grid-handle-move="onHandleMove"
            @builder-map-click="onMapClick"
            @room-click="selectItem('rooms', $event)"
            @exterior-node-click="selectItem('nodes', $event)"
            @stand-click="selectStand"
          />
        </div>
      </section>

      <aside v-if="!rightCollapsed" class="inspector panel">
        <template v-if="selection">
          <div>
            <p class="label">{{ selection.source }}</p>
            <h3>{{ selection.id }}</h3>
          </div>
          <div class="row-actions">
            <button class="sm muted" @click="moveSelected(-1)">↑</button>
            <button class="sm muted" @click="moveSelected(1)">↓</button>
            <button class="sm muted" :disabled="['fixtures', 'links'].includes(selection.source)" @click="renameSelected">Rename</button>
            <button class="sm muted" :disabled="['fixtures', 'links'].includes(selection.source)" @click="duplicateSelected">Duplicate</button>
            <button class="sm danger-outline" :disabled="selection.source === 'fixtures'" @click="deleteSelected">Delete</button>
          </div>

          <template v-if="selection.source === 'rooms'">
            <label>Label
              <input
                :value="selection.entity.label"
                @input="setRoomLabel(draft, selection.id, $event.target.value)"
              />
            </label>
            <div class="field-grid">
              <label>X<input v-model.number="selection.entity.x" type="number" step=".5" /></label>
              <label>Y<input v-model.number="selection.entity.y" type="number" step=".5" /></label>
              <label>Width<input v-model.number="selection.entity.w" type="number" min=".5" step=".5" /></label>
              <label>Height<input v-model.number="selection.entity.h" type="number" min=".5" step=".5" /></label>
            </div>
          </template>

          <template v-else-if="selection.source === 'doors'">
            <label>Label<input v-model="selection.entity.label" /></label>
            <template v-if="selection.entity.kind === 'man'">
              <div class="field-grid">
                <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
                <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
              </div>
              <label class="check-field">
                <input v-model="selection.entity.vertical" type="checkbox" />
                Vertical
              </label>
            </template>
            <template v-else-if="rollDoorRoom">
              <label>Wall
                <select
                  :value="rollDoorRoom.rollDoor"
                  @change="setRollDoorProps(draft, selection.id, { edge: $event.target.value })"
                >
                  <option>north</option><option>east</option><option>south</option><option>west</option>
                </select>
              </label>
              <label>Span
                <input
                  :value="rollDoorRoom.rollSpan"
                  type="number"
                  min=".1"
                  max="1"
                  step=".05"
                  @input="setRollDoorProps(draft, selection.id, { rollSpan: Number($event.target.value) })"
                />
              </label>
            </template>
          </template>

          <template v-else-if="selection.source === 'paths'">
            <label class="check-field">
              <input v-model="selection.entity.smooth" type="checkbox" />
              Smooth path
            </label>
            <div class="row-actions">
              <button class="sm" :class="{ active: addMode === 'point' }" @click="addMode = addMode === 'point' ? null : 'point'">
                Add waypoint
              </button>
              <button class="sm" :class="{ active: addMode === 'node' }" @click="addMode = addMode === 'node' ? null : 'node'">
                Add stand node
              </button>
              <button class="sm danger-outline" :disabled="!selectedHandleId" @click="removeSelectedPathHandle">
                Delete selected handle
              </button>
            </div>
            <label v-if="selectedPathNode">Node label
              <input
                :value="selectedPathNode.label"
                @input="setNodeLabel(draft, selectedPathNode.id, $event.target.value)"
              />
            </label>
          </template>

          <template v-else-if="selection.source === 'nodes'">
            <label>Label
              <input
                :value="selection.entity.label"
                @input="setNodeLabel(draft, selection.id, $event.target.value)"
              />
            </label>
            <div class="field-grid">
              <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
              <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
            </div>
          </template>

          <template v-else-if="selection.source === 'exits'">
            <label>Label<input v-model="selection.entity.label" /></label>
            <div class="field-grid">
              <label>Map X
                <input
                  :value="getExitMapAt(selection.entity).x"
                  type="number"
                  step=".01"
                  @input="setExitMapAt(draft, selection.id, Number($event.target.value), getExitMapAt(selection.entity).y)"
                />
              </label>
              <label>Map Y
                <input
                  :value="getExitMapAt(selection.entity).y"
                  type="number"
                  step=".01"
                  @input="setExitMapAt(draft, selection.id, getExitMapAt(selection.entity).x, Number($event.target.value))"
                />
              </label>
            </div>
          </template>

          <template v-else-if="selection.source === 'fixtures'">
            <p class="read-only-note">
              Fixture geometry is currently read-only. Its room connections and level placement
              are validated on save.
            </p>
            <label>Kind<input :value="selection.entity.kind" disabled /></label>
            <label>Connects<input :value="(selection.entity.connects ?? []).join(', ')" disabled /></label>
            <label>Levels<input :value="(selection.entity.onLevels ?? []).join(', ')" disabled /></label>
          </template>

          <template v-else-if="selection.source === 'links'">
            <label>From room
              <select v-model="selection.entity.from">
                <option v-for="room in draft.rooms" :key="room.id" :value="room.id">{{ room.id }}</option>
              </select>
            </label>
            <label>To room
              <select v-model="selection.entity.to">
                <option v-for="room in draft.rooms" :key="room.id" :value="room.id">{{ room.id }}</option>
              </select>
            </label>
            <label>Connection kind
              <select v-model="selection.entity.kind">
                <option value="open">Open</option>
                <option value="door">Door</option>
                <option value="stairs">Stairs</option>
                <option value="winding-stairs">Winding stairs</option>
              </select>
            </label>
            <label v-if="selection.entity.kind === 'door'">Door
              <select v-model="selection.entity.door">
                <option value="">Choose a door</option>
                <option v-for="door in draft.doors" :key="door.id" :value="door.id">{{ door.id }}</option>
              </select>
            </label>
          </template>

          <template v-else-if="selection.source === 'stands'">
            <label>Label<input v-model="selection.entity.label" /></label>
            <div class="field-grid">
              <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
              <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
            </div>
            <label>Pose<input v-model="selection.entity.pose" placeholder="stand or sit" /></label>
            <label>Interaction
              <input v-model="selection.entity.interaction" placeholder="optional semantic ID" />
            </label>
            <label class="check-field">
              <input
                type="checkbox"
                :checked="
                  draft.rooms.find((room) => room.id === selection.id.split('/')[0])
                    ?.defaultStand === selection.entity.id
                "
                @change="
                  draft.rooms.find((room) => room.id === selection.id.split('/')[0]).defaultStand =
                    $event.target.checked ? selection.entity.id : null
                "
              />
              Default room stand
            </label>
          </template>
        </template>
        <p v-else class="empty-note">Select a room, door, path, node, or transition.</p>

        <details>
          <summary>Draft YAML</summary>
          <pre class="yaml-preview">{{ generatedYaml }}</pre>
        </details>
        <p v-for="message in errorMessages.slice(0, 12)" :key="message" class="field-error">
          {{ message }}
        </p>
        <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
          {{ warning.path }}: {{ warning.message }}
        </p>
        <section class="audit-panel">
          <button class="sm muted" @click="runIndoorAudit">Run traversal audit</button>
          <template v-if="auditResult && !auditResult.valid">
            <p v-if="auditResult.unreachableRooms.length">
              Unreachable rooms: {{ auditResult.unreachableRooms.join(", ") }}
            </p>
            <p v-if="auditResult.unreachableExteriorNodes.length">
              Unreachable exterior nodes: {{ auditResult.unreachableExteriorNodes.join(", ") }}
            </p>
          </template>
        </section>
        <section v-if="showHistory" class="history">
          <h3>Building revisions</h3>
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

    <div v-if="navigationPromptVisible" class="unsaved-backdrop" role="dialog" aria-modal="true">
      <section class="unsaved-dialog">
        <p class="label">Unsaved utility station changes</p>
        <h2>Leave this map workspace?</h2>
        <p>Save the draft, discard it, or return to the map without changing workspaces.</p>
        <div class="row-actions">
          <button :disabled="savingBeforeNavigation" @click="saveAndLeave">
            {{ savingBeforeNavigation ? "Saving…" : "Save and continue" }}
          </button>
          <button class="danger-outline" :disabled="savingBeforeNavigation" @click="discardAndLeave">
            Discard changes
          </button>
          <button class="muted" @click="keepEditing">Keep editing</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.station-builder { padding: .85rem; }
.station-toolbar, .toolbar-actions, .tool-group, .canvas-toolbar, .row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.station-toolbar h2, .station-toolbar p, .inspector h3 { margin: 0; }
.station-status, .dirty-banner { margin: .65rem 0 0; padding: .55rem .75rem; border-radius: 7px; }
.station-status { background: #24344a; color: #b8d8ff; }
.dirty-banner { background: #59481f; color: #ffe4a3; }
.station-workspace {
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr) minmax(290px, 350px);
  gap: .75rem;
  height: calc(100vh - 13rem);
  min-height: 560px;
  margin-top: .75rem;
}
.station-workspace.left-collapsed { grid-template-columns: minmax(440px, 1fr) minmax(290px, 350px); }
.station-workspace.right-collapsed { grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr); }
.station-workspace.left-collapsed.right-collapsed { grid-template-columns: 1fr; }
.panel { min-width: 0; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: .75rem; }
.object-browser, .inspector { overflow: auto; }
.object-browser input, .inspector input, .inspector textarea, .inspector select, .canvas-toolbar select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .45rem .55rem;
}
.object-group { margin-top: .9rem; }
.create-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; margin-top: .6rem; }
.object-group h3 { display: flex; justify-content: space-between; margin: 0 0 .35rem; color: #aeb5c0; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
.object-group h3 span { color: #6f7787; }
.object-item { display: grid; width: 100%; gap: .1rem; margin-top: .25rem; text-align: left; background: #252b35; }
.object-item span { color: #8e96a3; font-size: .72rem; }
.object-item.active, button.active { background: #49624f; border-color: #6f9b79; }
.canvas-column { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .55rem; min-width: 0; }
.canvas-toolbar label { display: flex; align-items: center; gap: .35rem; color: #bdc4ce; font-size: .8rem; }
.station-canvas { min-height: 0; overflow: hidden; border: 1px solid #3b4655; border-radius: 11px; }
.station-canvas :deep(.gridmap), .station-canvas :deep(.gridmap.builder-view:not(.expanded)) {
  width: 100%;
  height: 100%;
  min-height: 100%;
  border-radius: 0;
}
.inspector { display: grid; align-content: start; gap: .7rem; }
.inspector label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .8rem; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.yaml-preview { max-height: 22rem; overflow: auto; padding: .65rem; border-radius: 7px; background: #11151b; white-space: pre-wrap; font-size: .72rem; }
.empty-note { color: #939ba7; }
.read-only-note, .audit-panel p { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
.audit-panel { display: grid; gap: .4rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.warning { color: #efcb83; font-size: .78rem; }
.history { display: grid; gap: .4rem; }
.revision-item { text-align: left; font-size: .76rem; }
.unsaved-backdrop {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
  padding: 1rem; background: rgba(8, 10, 14, .72); backdrop-filter: blur(3px);
}
.unsaved-dialog {
  width: min(32rem, 100%); padding: 1.25rem; border: 1px solid #4a566b;
  border-radius: 12px; background: #202630; box-shadow: 0 18px 48px rgba(0, 0, 0, .45);
}
.unsaved-dialog h2 { margin: .25rem 0 .65rem; font-size: 1.15rem; }
@media (max-width: 1050px) {
  .station-workspace, .station-workspace.left-collapsed, .station-workspace.right-collapsed {
    grid-template-columns: 220px minmax(420px, 1fr); height: auto;
  }
  .inspector { grid-column: 1 / -1; }
  .station-canvas { min-height: 68vh; }
}
@media (max-width: 720px) {
  .station-workspace, .station-workspace.left-collapsed, .station-workspace.right-collapsed { grid-template-columns: 1fr; }
  .inspector { grid-column: auto; }
}
</style>
