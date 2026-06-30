<script setup>
import { computed, ref, watch } from "vue";
import RevisionHistoryPanel from "../RevisionHistoryPanel.vue";
import DoorInspector from "./DoorInspector.vue";
import ExteriorNodeInspector from "./ExteriorNodeInspector.vue";
import FixtureInspector from "./FixtureInspector.vue";
import LinkInspector from "./LinkInspector.vue";
import PathInspector from "./PathInspector.vue";
import RoomInspector from "./RoomInspector.vue";
import RoomStandInspector from "./RoomStandInspector.vue";
import StationInventoryAuthoring from "./StationInventoryAuthoring.vue";
import SwitchInspector from "./SwitchInspector.vue";
import TransitionInspector from "./TransitionInspector.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, default: null },
  selectedHandleId: { type: String, default: null },
  selectedPathNode: { type: Object, default: null },
  rollDoorRoom: { type: Object, default: null },
  addMode: { type: String, default: null },
  characterCatalog: { type: Object, required: true },
  errors: { type: Object, required: true },
  warnings: { type: Array, required: true },
  storyBeats: { type: Array, default: () => [] },
  showHistory: { type: Boolean, default: false },
  revisions: { type: Array, required: true },
});

const emit = defineEmits([
  "open-location-beat",
  "open-transition-beat",
  "open-artifact",
  "duplicate-artifact",
  "move-selected",
  "rename-selected",
  "duplicate-selected",
  "delete-selected",
  "toggle-path-add-mode",
  "remove-selected-path-handle",
  "restore-revision",
]);

const errorMessages = computed(() =>
  Object.entries(props.errors).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);

const fixedSelectionSources = new Set(["fixtures", "walls", "links"]);
const editing = ref(false);
const selectedArtifactItemId = ref("");
const placementFormOpen = ref(false);
const editingPlacementId = ref("");

watch(
  () => `${props.selection?.source ?? ""}:${props.selection?.id ?? ""}`,
  () => {
    editing.value = false;
    placementFormOpen.value = false;
    selectedArtifactItemId.value = "";
    editingPlacementId.value = "";
  },
);

watch(
  () => props.characterCatalog.items,
  () => {
    if (
      selectedArtifactItemId.value &&
      !props.characterCatalog.items.some((item) => item.id === selectedArtifactItemId.value)
    ) {
      selectedArtifactItemId.value = "";
    }
  },
  { immediate: true },
);

function selectionEyebrow(source) {
  return source === "exits" ? "map transition" : source;
}

function selectionTitle(selection) {
  if (!selection) return "";
  return selection.entity?.label || selection.id;
}

function transitionBeatMatches(beat, transitionId, direction) {
  const match = beat.match ?? {};
  const beatTransition = match.mapTransition ?? match.localExit;
  if (beatTransition !== transitionId) return false;
  if (!match.transitionDirection) {
    return direction === "toRegional" && Boolean(match.localExit);
  }
  return match.transitionDirection === direction;
}

function locationBeatMatches(beat, selection) {
  if (selection?.source === "rooms") {
    return beat.trigger?.place === "indoors" && beat.trigger?.room === selection.id;
  }
  if (selection?.source === "nodes") {
    return beat.trigger?.place === "indoors" && beat.trigger?.exteriorNode === selection.id;
  }
  return false;
}

function beatContextLabel(beat) {
  const match = beat.match ?? {};
  const details = [
    originHexPrefix(match.originHex),
    match.mapTransition ? `via ${match.mapTransition}` : "",
    match.localExit ? `via ${match.localExit}` : "",
    match.transitionDirection || "",
  ].filter(Boolean);
  return details.join(" / ") || "Default location beat";
}

function originHexLabel(value) {
  const origins = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value
        ? [value]
        : [];
  return origins.join(", ");
}

function originHexPrefix(value) {
  const label = originHexLabel(value);
  return label ? `from ${label}` : "";
}

const locationBeatTarget = computed(() => {
  const selection = props.selection;
  if (selection?.source === "rooms") {
    return { locationMode: "rooms", location: selection.id, label: "Room beats" };
  }
  if (selection?.source === "nodes") {
    return { locationMode: "exterior", location: selection.id, label: "Exterior node beats" };
  }
  return null;
});

const associatedLocationBeats = computed(() => {
  const selection = props.selection;
  if (!locationBeatTarget.value) return [];
  return props.storyBeats.filter((beat) => locationBeatMatches(beat, selection));
});

const placedArtifacts = computed(() => {
  if (props.selection?.source !== "rooms") return [];
  return (props.draft.pickups ?? []).filter((pickup) => pickup.room === props.selection.id);
});

const currentStandOptions = computed(() =>
  props.selection?.source === "rooms"
    ? [
        ...(props.selection.entity?.stands ?? []),
        ...derivedDoorStandOptions(props.selection.id),
      ]
    : [],
);

const associatedTransitionBeats = computed(() => {
  const selection = props.selection;
  if (selection?.source !== "exits") return { toLocal: [], toRegional: [] };
  const transitionId = selection.id;
  return {
    toLocal: props.storyBeats.filter((beat) =>
      transitionBeatMatches(beat, transitionId, "toLocal"),
    ),
    toRegional: props.storyBeats.filter((beat) =>
      transitionBeatMatches(beat, transitionId, "toRegional"),
    ),
  };
});

const summaryRows = computed(() => {
  const selection = props.selection;
  const entity = selection?.entity;
  if (!selection || !entity) return [];
  if (selection.source === "rooms") {
    return [
      ["ID", selection.id],
      ["Level", entity.level],
      ["Size", `${entity.w ?? 0} x ${entity.h ?? 0}`],
      ["Default stand", entity.defaultStand || "None"],
    ];
  }
  if (selection.source === "doors") {
    return [
      ["ID", selection.id],
      ["Rooms", doorRoomSummary(selection.id, entity)],
      ["Kind", entity.kind || "door"],
      ["State", doorInitialSummary(entity)],
      ["Key", entity.lock?.key || entity.key || "None"],
    ];
  }
  if (selection.source === "paths") {
    return [
      ["ID", selection.id],
      ["Kind", entity.kind || "path"],
      ["Nodes", String((entity.nodes ?? entity.points ?? []).length)],
    ];
  }
  if (selection.source === "nodes") {
    return [
      ["ID", selection.id],
      ["Level", entity.level],
      ["Door", entity.door || "None"],
      ["Room", entity.room || "None"],
      ["Join node", entity.joinNode || "None"],
    ];
  }
  if (selection.source === "exits") {
    return [
      ["ID", selection.id],
      ["Regional hex", entity.hex || props.draft.outdoorHex || "Default"],
      ["Regional stand", entity.standAt?.stand || "Default"],
      ["Local arrival stand", entity.exteriorNode || props.draft.exterior?.entry || "Default"],
      ["Regional entry from", (entity.entryFrom ?? []).join(", ") || "Any"],
    ];
  }
  if (selection.source === "stands") {
    return [
      ["ID", selection.id.split("/")[1]],
      ["Room", selection.id.split("/")[0]],
      ["Kind", entity.kind || "authored"],
      ["Position", entity.at ? `${entity.at.x}, ${entity.at.y}` : "Default"],
    ];
  }
  if (selection.source === "links") {
    return [
      ["ID", selection.id],
      ["From", entity.from],
      ["To", entity.to],
      ["Kind", entity.kind || "open"],
      ["Door", entity.door || "None"],
    ];
  }
  if (selection.source === "switches") {
    return [
      ["ID", selection.id],
      ["Room", entity.room],
      ["Door", entity.door],
    ];
  }
  if (selection.source === "fixtures" || selection.source === "walls") {
    return [
      ["ID", selection.id],
      ["Kind", selection.source === "walls" ? "stone wall" : entity.kind || "fixture"],
      ["Role", entity.visualOnly ? "Visual only" : "Traversal"],
      ["Levels", (entity.onLevels ?? []).join(", ") || "Default"],
    ];
  }
  return [["ID", selection.id]];
});

function doorRoomSummary(doorId, door) {
  const rooms = new Set();
  if (door.room) rooms.add(door.room);
  for (const link of props.draft.links ?? []) {
    if (link.kind === "door" && link.door === doorId) {
      if (link.from) rooms.add(link.from);
      if (link.to) rooms.add(link.to);
    }
  }
  return [...rooms].join(" <-> ") || "None";
}

function doorRoomIds(doorId, door) {
  const rooms = new Set();
  if (door.room) rooms.add(door.room);
  for (const link of props.draft.links ?? []) {
    if (link.kind !== "door" || link.door !== doorId) continue;
    if (link.from) rooms.add(link.from);
    if (link.to) rooms.add(link.to);
  }
  return rooms;
}

function derivedDoorStandOptions(roomId) {
  return (props.draft.doors ?? [])
    .filter((door) => door.id && doorRoomIds(door.id, door).has(roomId))
    .map((door) => ({
      id: `door:${door.id}`,
      label: `${door.label || door.id} threshold`,
    }));
}

function doorInitialSummary(door) {
  const initial = door.initial ?? {};
  const open = initial.open ?? (initial.closed != null ? !initial.closed : false);
  const locked = initial.locked === true;
  return `${open ? "Open" : "Closed"}${locked ? ", locked" : ""}`;
}

function artifactLabel(id) {
  const item = props.characterCatalog.items.find((candidate) => candidate.id === id);
  return item?.label || id;
}

function standLabel(id) {
  const stand = currentStandOptions.value.find((candidate) => candidate.id === id);
  return stand?.label || id || "None";
}

function uniquePickupId(itemId, roomId) {
  const used = new Set((props.draft.pickups ?? []).map((pickup) => pickup.id));
  let id = `${roomId}-${itemId}`;
  let suffix = 2;
  while (used.has(id)) id = `${roomId}-${itemId}-${suffix++}`;
  return id;
}

function placeArtifact() {
  if (props.selection?.source !== "rooms" || !selectedArtifactItemId.value) return;
  const item = props.characterCatalog.items.find((candidate) => candidate.id === selectedArtifactItemId.value);
  if (!item) return;
  props.draft.pickups ??= [];
  props.draft.pickups.push({
    id: uniquePickupId(item.id, props.selection.id),
    room: props.selection.id,
    item: item.id,
    label: item.label,
  });
  selectedArtifactItemId.value = "";
  placementFormOpen.value = false;
}

function editPlacement(placementId) {
  editingPlacementId.value = placementId;
}

function stopEditingPlacement(placementId) {
  if (editingPlacementId.value === placementId) editingPlacementId.value = "";
}

function removePlacement(placementId) {
  if (editingPlacementId.value === placementId) editingPlacementId.value = "";
  props.draft.pickups = (props.draft.pickups ?? []).filter((pickup) => pickup.id !== placementId);
}

</script>

<template>
  <aside class="inspector panel">
    <template v-if="selection">
      <div class="inspector-heading">
        <div>
          <p class="label">{{ selectionEyebrow(selection.source) }}</p>
          <h3>{{ selectionTitle(selection) }}</h3>
        </div>
        <div class="row-actions">
          <button v-if="!editing" class="sm" @click="editing = true">Edit</button>
          <button v-else class="sm muted" @click="editing = false">Done</button>
        </div>
      </div>

      <section v-if="!editing" class="detail-card">
        <div v-for="[label, value] in summaryRows" :key="label" class="detail-row">
          <span>{{ label }}</span>
          <strong>{{ value || "None" }}</strong>
        </div>
        <template v-if="selection.source === 'exits'">
          <div class="beat-associations">
            <div>
              <p class="label">To local beats</p>
              <p v-if="!associatedTransitionBeats.toLocal.length" class="empty-note">None yet.</p>
              <ul v-else>
                <li v-for="beat in associatedTransitionBeats.toLocal" :key="beat.id">
                  <button
                    type="button"
                    class="beat-link"
                    @click="emit('open-transition-beat', {
                      transitionId: selection.id,
                      direction: 'toLocal',
                      locationMode: beat.trigger?.exteriorNode ? 'exterior' : 'rooms',
                      location: beat.trigger?.exteriorNode || beat.trigger?.room,
                      beatId: beat.id,
                    })"
                  >
                    <strong>{{ beat.heading || beat.id }}</strong>
                    <span>{{ beat.trigger?.exteriorNode || beat.trigger?.room || beat.id }}</span>
                  </button>
                </li>
              </ul>
              <button
                type="button"
                class="sm muted add-beat"
                @click="emit('open-transition-beat', {
                  transitionId: selection.id,
                  direction: 'toLocal',
                  locationMode: 'exterior',
                  location: selection.entity.exteriorNode || draft.exterior?.entry,
                  create: true,
                })"
              >
                Add to local beat
              </button>
            </div>
            <div>
              <p class="label">To regional beats</p>
              <p v-if="!associatedTransitionBeats.toRegional.length" class="empty-note">None yet.</p>
              <ul v-else>
                <li v-for="beat in associatedTransitionBeats.toRegional" :key="beat.id">
                  <button
                    type="button"
                    class="beat-link"
                    @click="emit('open-transition-beat', {
                      transitionId: selection.id,
                      direction: 'toRegional',
                      locationMode: 'outdoors',
                      location: beat.trigger?.hex,
                      beatId: beat.id,
                    })"
                  >
                    <strong>{{ beat.heading || beat.id }}</strong>
                    <span>{{ beat.trigger?.hex || beat.id }}</span>
                  </button>
                </li>
              </ul>
              <button
                type="button"
                class="sm muted add-beat"
                @click="emit('open-transition-beat', {
                  transitionId: selection.id,
                  direction: 'toRegional',
                  locationMode: 'outdoors',
                  location: selection.entity.hex || draft.outdoorHex,
                  create: true,
                })"
              >
                Add to regional beat
              </button>
            </div>
          </div>
        </template>
        <div v-else-if="locationBeatTarget" class="beat-associations">
          <div>
            <p class="label">{{ locationBeatTarget.label }}</p>
            <p v-if="!associatedLocationBeats.length" class="empty-note">None yet.</p>
            <ul v-else>
              <li v-for="beat in associatedLocationBeats" :key="beat.id">
                <button
                  type="button"
                  class="beat-link"
                  @click="emit('open-location-beat', {
                    locationMode: locationBeatTarget.locationMode,
                    location: locationBeatTarget.location,
                    beatId: beat.id,
                  })"
                >
                  <strong>{{ beat.heading || beat.id }}</strong>
                  <span>{{ beatContextLabel(beat) }}</span>
                </button>
              </li>
            </ul>
            <button
              type="button"
              class="sm muted add-beat"
              @click="emit('open-location-beat', {
                locationMode: locationBeatTarget.locationMode,
                location: locationBeatTarget.location,
                create: true,
              })"
            >
              Add beat
            </button>
          </div>
        </div>
        <div v-if="selection.source === 'rooms'" class="artifact-associations">
          <p class="label">Artifact placements</p>
          <p v-if="!placedArtifacts.length" class="empty-note">None yet.</p>
          <ul v-else>
            <li v-for="placement in placedArtifacts" :key="placement.id">
              <div class="artifact-placement-card">
                <button
                  type="button"
                  class="artifact-link"
                  @click="emit('open-artifact', { catalog: 'items', id: placement.item })"
                >
                  <strong>{{ artifactLabel(placement.item) }}</strong>
                  <span>{{ placement.item }} / {{ placement.id }}</span>
                </button>
                <template v-if="editingPlacementId === placement.id">
                  <label>Placement text<input v-model="placement.label"></label>
                  <label>Standpoint
                    <select v-model="placement.stand">
                      <option :value="null">None</option>
                      <option v-for="stand in currentStandOptions" :key="stand.id" :value="stand.id">
                        {{ stand.label || stand.id }} ({{ stand.id }})
                      </option>
                    </select>
                  </label>
                  <div class="row-actions placement-actions">
                    <button type="button" class="sm muted" @click="stopEditingPlacement(placement.id)">Done</button>
                    <button type="button" class="sm danger-outline" @click="removePlacement(placement.id)">Remove</button>
                  </div>
                </template>
                <template v-else>
                  <p class="placement-text">{{ placement.label || "No placement text." }}</p>
                  <p v-if="placement.stand" class="placement-meta">Standpoint: {{ standLabel(placement.stand) }}</p>
                  <div class="row-actions placement-actions">
                    <button type="button" class="sm muted" @click="editPlacement(placement.id)">Edit</button>
                    <button
                      type="button"
                      class="sm muted"
                      @click="emit('duplicate-artifact', { catalog: 'items', id: placement.item })"
                    >
                      Duplicate
                    </button>
                    <button type="button" class="sm danger-outline" @click="removePlacement(placement.id)">Remove</button>
                  </div>
                </template>
              </div>
            </li>
          </ul>
          <div v-if="placementFormOpen" class="artifact-placement-form">
            <label>Artifact
              <select
                v-model="selectedArtifactItemId"
                :disabled="!characterCatalog.items.length"
                @change="placeArtifact"
              >
                <option value="">Select artifact...</option>
                <option v-for="item in characterCatalog.items" :key="item.id" :value="item.id">
                  {{ item.label }} ({{ item.id }})
                </option>
              </select>
            </label>
            <button type="button" class="sm muted" @click="placementFormOpen = false">Cancel</button>
          </div>
          <button
            v-else
            type="button"
            class="sm muted add-beat"
            :disabled="!characterCatalog.items.length"
            @click="placementFormOpen = true"
          >
            Place artifact
          </button>
        </div>
      </section>

      <div v-if="editing" class="edit-toolbar">
        <div class="row-actions object-actions">
          <button class="sm muted" :disabled="fixedSelectionSources.has(selection.source)" @click="emit('rename-selected')">Rename</button>
          <button class="sm muted" :disabled="fixedSelectionSources.has(selection.source)" @click="emit('duplicate-selected')">Duplicate object</button>
          <button class="sm danger-outline" :disabled="['fixtures', 'walls'].includes(selection.source)" @click="emit('delete-selected')">Delete</button>
        </div>
      </div>

      <RoomInspector
        v-if="editing && selection.source === 'rooms'"
        :draft="draft"
        :selection="selection"
      />

      <DoorInspector
        v-else-if="editing && selection.source === 'doors'"
        :draft="draft"
        :selection="selection"
        :character-catalog="characterCatalog"
        :roll-door-room="rollDoorRoom"
      />

      <PathInspector
        v-else-if="editing && selection.source === 'paths'"
        :draft="draft"
        :selection="selection"
        :selected-handle-id="selectedHandleId"
        :selected-path-node="selectedPathNode"
        :add-mode="addMode"
        @toggle-path-add-mode="emit('toggle-path-add-mode', $event)"
        @remove-selected-path-handle="emit('remove-selected-path-handle')"
      />

      <ExteriorNodeInspector
        v-else-if="editing && selection.source === 'nodes'"
        :draft="draft"
        :selection="selection"
      />

      <TransitionInspector
        v-else-if="editing && selection.source === 'exits'"
        :draft="draft"
        :selection="selection"
      />

      <FixtureInspector
        v-else-if="editing && ['fixtures', 'walls'].includes(selection.source)"
        :selection="selection"
      />

      <LinkInspector
        v-else-if="editing && selection.source === 'links'"
        :draft="draft"
        :selection="selection"
      />

      <RoomStandInspector
        v-else-if="editing && selection.source === 'stands'"
        :draft="draft"
        :selection="selection"
      />

      <SwitchInspector
        v-else-if="editing && selection.source === 'switches'"
        :draft="draft"
        :selection="selection"
      />
    </template>
    <p v-else class="empty-note">Select a room, door, path, node, or transition.</p>

    <StationInventoryAuthoring
      v-if="editing && selection?.source === 'rooms'"
      :draft="draft"
      :character-catalog="characterCatalog"
      :selection="selection"
    />

    <p v-for="message in errorMessages.slice(0, 12)" :key="message" class="field-error">
      {{ message }}
    </p>
    <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
      {{ warning.path }}: {{ warning.message }}
    </p>
    <RevisionHistoryPanel
      :visible="showHistory"
      title="Building revisions"
      :revisions="revisions"
      @restore="emit('restore-revision', $event)"
    />
  </aside>
</template>

<style scoped>
.panel { min-width: 0; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: .75rem; }
.inspector { overflow: auto; display: grid; align-content: start; gap: .7rem; }
.inspector-heading, .row-actions, .inspector :deep(.row-actions), .inspector :deep(.point-heading) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.inspector-heading { align-items: start; }
.inspector h3 { margin: 0; overflow-wrap: anywhere; }
.inspector input, .inspector textarea, .inspector select,
.inspector :deep(input), .inspector :deep(textarea), .inspector :deep(select) {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .45rem .55rem;
}
.inspector label, .inspector :deep(label) { display: grid; gap: .3rem; color: #bdc4ce; font-size: .8rem; }
.inspector :deep(.form-section) {
  display: grid;
  gap: .55rem;
  padding: .65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.inspector :deep(.section-heading) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .65rem;
}
.inspector :deep(.section-heading h4) {
  margin: 0;
  color: #d7dde6;
  font-size: .78rem;
  font-weight: 700;
}
.inspector :deep(.section-heading code) {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #9da7b5;
  font-size: .74rem;
}
.inspector :deep(.field-grid) { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.inspector :deep(.check-field) { display: flex !important; align-items: center; }
.inspector :deep(.check-field input) { width: auto; }
.inspector :deep(fieldset) { display: grid; gap: .55rem; margin: 0; padding: .65rem; border: 1px solid #3b4557; border-radius: 8px; }
.inspector :deep(legend) { color: #8bc49a; }
.detail-card, .edit-toolbar {
  display: grid;
  gap: .55rem;
  padding: .65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.detail-row {
  display: grid;
  grid-template-columns: minmax(6rem, .75fr) minmax(0, 1fr);
  gap: .75rem;
  align-items: baseline;
}
.detail-row span { color: #8e96a3; font-size: .75rem; }
.detail-row strong { min-width: 0; overflow-wrap: anywhere; color: #eef1f5; font-size: .85rem; font-weight: 600; }
.beat-associations,
.artifact-associations {
  display: grid;
  gap: .65rem;
  padding-top: .65rem;
  border-top: 1px solid #343d4d;
}
.beat-associations p,
.artifact-associations p { margin: 0; }
.beat-associations ul,
.artifact-associations ul {
  display: grid;
  gap: .35rem;
  margin: .35rem 0 0;
  padding: 0;
  list-style: none;
}
.beat-associations li,
.artifact-associations li { display: block; }
.beat-link,
.artifact-link {
  display: grid;
  gap: .1rem;
  width: 100%;
  padding: .45rem .55rem;
  border: 1px solid #394457;
  border-radius: 7px;
  background: #202733;
  text-align: left;
}
.beat-link:hover { border-color: #5f718f; background: #273142; }
.artifact-link:hover { border-color: #5f718f; background: #273142; }
.beat-link strong,
.artifact-link strong { color: #eef1f5; font-size: .8rem; }
.beat-link span,
.artifact-link span { color: #9da7b5; font-size: .74rem; }
.artifact-placement-card,
.artifact-placement-form {
  display: grid;
  gap: .45rem;
  padding: .5rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.placement-text {
  margin: 0;
  color: #bdc4ce;
  font-size: .8rem;
  overflow-wrap: anywhere;
}
.placement-meta {
  margin: 0;
  color: #8e96a3;
  font-size: .74rem;
  overflow-wrap: anywhere;
}
.placement-actions { justify-content: flex-start; }
.add-beat { width: 100%; margin-top: .4rem; justify-content: center; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
button.active, .inspector :deep(button.active) { background: #49624f; border-color: #6f9b79; }
.object-actions { justify-content: flex-start; }
.danger-outline, .inspector :deep(.danger-outline) { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.empty-note { color: #939ba7; }
.read-only-note, .inspector :deep(.read-only-note) { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.warning { color: #efcb83; font-size: .78rem; }
</style>
