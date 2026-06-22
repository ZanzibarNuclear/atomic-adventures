<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import HexMap from "../lib/maps/components/HexMap.vue";
import GridMap from "../lib/maps/components/GridMap.vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import { storyApi } from "../lib/storyApi.js";
import { storyBeatYaml } from "../lib/storyYamlPreview.js";
import { useWorldContent } from "../composables/useWorldContent.js";
import { useBuildingContent } from "../composables/useBuildingContent.js";

const { worldData, revision: worldRevision } = useWorldContent();
const { buildingData, revision: buildingRevision } = useBuildingContent();
const mapData = JSON.parse(JSON.stringify(worldData.value));
const outdoor = useOutdoorWorld(mapData);
const building = computed(() => buildBuilding(buildingData.value));
const allHexIds = computed(() => outdoor.editableHexes.map((item) => item.id));
const allRoomIds = computed(() => buildingData.value.rooms.map((item) => item.id));
const allExteriorIds = computed(() =>
  (buildingData.value.exterior?.nodes ?? []).map((item) => item.id),
);
const allHexSet = computed(() => new Set(allHexIds.value));
const builderFlags = new Set();
const STORY_AREA_ID = "part-i";
const router = useRouter();

const catalog = ref({ world: { hexes: [], rooms: [], exteriorNodes: [], buildings: [] } });
const beats = ref([]);
const selectedBeatId = ref("");
const locationMode = ref("outdoors");
const selectedLocation = ref(mapData.start);
const indoorLevel = ref(
  buildingData.value.exterior?.level ?? buildingData.value.levels.at(-1)?.id,
);
const indoorViewportMode = ref("fit-all");
const previewExteriorFog = ref(false);
const draft = ref(null);
const baseline = ref("");
const isNew = ref(false);
const errors = ref({});
const status = ref("");
const revisions = ref([]);
const showRevisions = ref(false);
const eventLocationInput = ref("enter-building");
const navigationPromptVisible = ref(false);
const pendingContextAction = ref(null);
const savingBeforeNavigation = ref(false);
let beatLoadRequest = 0;

const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== baseline.value);
const yamlPreview = computed(() => storyBeatYaml(draft.value));
function beatsForLocation(mode, location) {
  return beats.value.filter((beat) => {
    if (mode === "outdoors") return beat.trigger.hex === location;
    if (mode === "rooms") return beat.trigger.room === location;
    if (mode === "exterior") return beat.trigger.exteriorNode === location;
    return Boolean(beat.trigger.event);
  });
}
const locationBeats = computed(() =>
  beatsForLocation(locationMode.value, selectedLocation.value),
);
const selectedRoom = computed(() => locationMode.value === "rooms" ? selectedLocation.value : "");
const selectedExterior = computed(() => locationMode.value === "exterior" ? selectedLocation.value : null);
onMounted(async () => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    catalog.value = await storyApi("/api/catalog");
    await loadBeats();
  } catch (error) {
    status.value = error.message;
  }
});

onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload));
onBeforeRouteLeave((to) => {
  if (!dirty.value) return true;
  void requestContextChange(() => router.push(to.fullPath));
  return false;
});

watch(worldRevision, async () => {
  const next = worldData.value;
  outdoor.syncFromMapData(next);
  if (!allHexSet.value.has(selectedLocation.value)) {
    selectedLocation.value = next.start;
    outdoor.state.currentId = next.start;
    clearBeatSelection();
  }
  try {
    catalog.value = await storyApi("/api/catalog");
  } catch (error) {
    status.value = error.message;
  }
});

watch(buildingRevision, async () => {
  if (!buildingData.value.levels.some((item) => item.id === indoorLevel.value)) {
    indoorLevel.value = buildingData.value.exterior?.level
      ?? buildingData.value.levels.at(-1)?.id;
  }
  if (locationMode.value === "rooms" && !allRoomIds.value.includes(selectedLocation.value)) {
    applyRoomSelection(buildingData.value.rooms[0]?.id);
  }
  if (
    locationMode.value === "exterior" &&
    !allExteriorIds.value.includes(selectedLocation.value)
  ) {
    applyExteriorSelection(buildingData.value.exterior?.entry);
  }
  try {
    catalog.value = await storyApi("/api/catalog");
  } catch (error) {
    status.value = error.message;
  }
});

async function loadBeats(selectId = "") {
  await refreshBeatList();
  if (selectId) await loadBeat(selectId);
  else await openFirstBeatForSelectedLocation();
}

async function refreshBeatList() {
  beats.value = await storyApi(`/api/story/areas/${STORY_AREA_ID}/beats`);
}

async function loadBeat(id, selectionKey = selectedLocationKey()) {
  const request = ++beatLoadRequest;
  const result = await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(id)}`,
  );
  if (request !== beatLoadRequest || selectionKey !== selectedLocationKey()) return;
  selectedBeatId.value = id;
  isNew.value = false;
  setDraft(result.beat);
}

function selectBeat(id) {
  if (selectedBeatId.value === id) return;
  void requestContextChange(() => loadBeat(id));
}

function selectHex(id) {
  if (locationMode.value === "outdoors" && selectedLocation.value === id) return;
  void requestContextChange(() => applyHexSelection(id));
}

async function applyHexSelection(id) {
  locationMode.value = "outdoors";
  selectedLocation.value = id;
  outdoor.state.currentId = id;
  clearBeatSelection();
  await openFirstBeatForSelectedLocation();
}

function clearBeatSelection() {
  beatLoadRequest += 1;
  selectedBeatId.value = "";
  draft.value = null;
  baseline.value = "";
  isNew.value = false;
  errors.value = {};
  status.value = "";
}

function selectedLocationKey() {
  return `${locationMode.value}:${selectedLocation.value}`;
}

async function openFirstBeatForSelectedLocation(
  mode = locationMode.value,
  location = selectedLocation.value,
) {
  const selectionKey = `${mode}:${location}`;
  const firstBeat = beatsForLocation(mode, location)[0];
  if (!firstBeat) return;
  const request = ++beatLoadRequest;

  try {
    const result = await storyApi(
      `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(firstBeat.id)}`,
    );
    if (request !== beatLoadRequest || selectionKey !== selectedLocationKey()) return;
    selectedBeatId.value = firstBeat.id;
    isNew.value = false;
    setDraft(result.beat);
  } catch (error) {
    if (request === beatLoadRequest && selectionKey === selectedLocationKey()) {
      status.value = error.message;
    }
  }
}

function selectRoom(id) {
  if (locationMode.value === "rooms" && selectedLocation.value === id) return;
  void requestContextChange(() => applyRoomSelection(id));
}

async function applyRoomSelection(id) {
  locationMode.value = "rooms";
  selectedLocation.value = id;
  const room = building.value.roomById[id];
  if (room?.level) indoorLevel.value = room.level;
  clearBeatSelection();
  await openFirstBeatForSelectedLocation();
}

function selectExterior(id) {
  if (locationMode.value === "exterior" && selectedLocation.value === id) return;
  void requestContextChange(() => applyExteriorSelection(id));
}

function selectIndoorMapItem({ source, id }) {
  if (source === "rooms") {
    selectRoom(id);
  } else if (source === "nodes") {
    selectExterior(id);
  }
}

async function applyExteriorSelection(id) {
  locationMode.value = "exterior";
  selectedLocation.value = id;
  indoorLevel.value = buildingData.value.exterior?.level ?? indoorLevel.value;
  clearBeatSelection();
  await openFirstBeatForSelectedLocation();
}

function switchMode(mode) {
  if (
    (mode === "outdoors" && locationMode.value === "outdoors") ||
    (mode === "rooms" && ["rooms", "exterior"].includes(locationMode.value)) ||
    (mode === "events" && locationMode.value === "events")
  ) {
    return;
  }
  void requestContextChange(() => applyModeSelection(mode));
}

async function applyModeSelection(mode) {
  if (mode === "outdoors") {
    await applyHexSelection(outdoor.mapData.start);
  } else if (mode === "rooms") {
    await applyRoomSelection(buildingData.value.rooms[0]?.id);
  } else if (mode === "exterior") {
    await applyExteriorSelection(buildingData.value.exterior?.entry);
  } else {
    locationMode.value = "events";
    selectedLocation.value = "enter-building";
    eventLocationInput.value = selectedLocation.value;
    clearBeatSelection();
  }
}

function selectEventLocation(event) {
  const next = event.target.value.trim() || "enter-building";
  if (next === selectedLocation.value) return;
  void requestContextChange(() => {
    locationMode.value = "events";
    selectedLocation.value = next;
    eventLocationInput.value = next;
    clearBeatSelection();
  });
}

function newBeat(copy = null) {
  void requestContextChange(() => beginNewBeat(copy));
}

function beginNewBeat(copy = null) {
  const source = copy ? structuredClone(copy) : emptyBeat();
  source.id = uniqueId(copy ? `${copy.id}-copy` : suggestedId());
  source.version = undefined;
  source.choices = (source.choices ?? []).map((choice) => ({ ...choice, id: crypto.randomUUID() }));
  selectedBeatId.value = "";
  isNew.value = true;
  setDraft(source);
}

function emptyBeat() {
  const trigger = { place: null, hex: null, room: null, exteriorNode: null, event: null, flag: null };
  if (locationMode.value === "outdoors") Object.assign(trigger, { place: "outdoors", hex: selectedLocation.value });
  if (locationMode.value === "rooms") Object.assign(trigger, { place: "indoors", room: selectedLocation.value });
  if (locationMode.value === "exterior") Object.assign(trigger, { place: "indoors", exteriorNode: selectedLocation.value });
  if (locationMode.value === "events") trigger.event = selectedLocation.value || "enter-building";
  return {
    id: "",
    eyebrow: "",
    heading: "",
    text: "",
    revisit: "",
    trigger,
    choices: [],
  };
}

function suggestedId() {
  return String(selectedLocation.value || "new-beat").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueId(base) {
  const used = new Set(beats.value.map((beat) => beat.id));
  let candidate = base || "new-beat";
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function setDraft(value) {
  draft.value = structuredClone(value);
  baseline.value = JSON.stringify(draft.value);
  errors.value = {};
  status.value = "";
  revisions.value = [];
  showRevisions.value = false;
}

function revertDraft() {
  draft.value = JSON.parse(baseline.value);
  errors.value = {};
}

async function saveBeat() {
  if (!draft.value) return false;
  errors.value = {};
  status.value = "Saving…";
  try {
    let result;
    if (isNew.value) {
      result = await storyApi(`/api/story/areas/${STORY_AREA_ID}/beats`, {
        method: "POST",
        body: JSON.stringify(draft.value),
      });
    } else {
      result = await storyApi(
        `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(selectedBeatId.value)}`,
        {
          method: "PUT",
          body: JSON.stringify({ beat: draft.value, expectedVersion: draft.value.version }),
        },
      );
    }
    selectedBeatId.value = result.beat.id;
    isNew.value = false;
    setDraft(result.beat);
    await refreshBeatList();
    status.value = `Saved revision ${result.beat.version}.`;
    return true;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.status === 409
      ? "This beat changed elsewhere. Reload it before saving."
      : error.message;
    return false;
  }
}

async function deleteBeat() {
  if (!draft.value || isNew.value) return;
  if (!window.confirm(`Delete "${draft.value.id}"? Its revision history will remain available.`)) return;
  await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(draft.value.id)}`,
    { method: "DELETE", body: JSON.stringify({ expectedVersion: draft.value.version }) },
  );
  draft.value = null;
  selectedBeatId.value = "";
  baseline.value = "";
  await loadBeats();
}

async function loadRevisions() {
  if (!draft.value || isNew.value) return;
  revisions.value = await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(draft.value.id)}/revisions`,
  );
  showRevisions.value = true;
}

async function restoreRevision(revision) {
  if (!window.confirm(`Restore revision ${revision}? This creates a new revision.`)) return;
  const result = await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(draft.value.id)}/revisions/${revision}/restore`,
    { method: "POST" },
  );
  setDraft(result.beat);
  await loadBeats();
  await loadRevisions();
}

function addChoice() {
  draft.value.choices.push({
    id: crypto.randomUUID(),
    order: draft.value.choices.length,
    text: "",
    timeMinutes: 0,
    activity: "light",
    sets: [],
    set_flags: [],
    go_hex: null,
    go_room: null,
    enter: null,
  });
}

function moveChoice(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= draft.value.choices.length) return;
  const [choice] = draft.value.choices.splice(index, 1);
  draft.value.choices.splice(next, 0, choice);
  draft.value.choices.forEach((item, order) => { item.order = order; });
}

function setCsv(target, key, event) {
  target[key] = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
}

function destinationType(choice) {
  if (choice.go_hex) return "hex";
  if (choice.go_room) return "room";
  if (choice.enter) return "enter";
  return "";
}

function setDestinationType(choice, type) {
  choice.go_hex = type === "hex" ? catalog.value.world.hexes[0]?.id ?? null : null;
  choice.go_room = type === "room" ? catalog.value.world.rooms[0]?.id ?? null : null;
  choice.enter = type === "enter" ? catalog.value.world.buildings[0]?.id ?? "building" : null;
}

function fieldError(path) {
  return errors.value[path]?.join(" ");
}

function warnBeforeUnload(event) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
}

function requestContextChange(action) {
  if (!dirty.value) return Promise.resolve(action());
  pendingContextAction.value = action;
  navigationPromptVisible.value = true;
  return Promise.resolve(false);
}

function closeNavigationPrompt() {
  navigationPromptVisible.value = false;
  pendingContextAction.value = null;
}

function keepEditing() {
  eventLocationInput.value = selectedLocation.value;
  closeNavigationPrompt();
}

async function discardAndContinue() {
  const action = pendingContextAction.value;
  closeNavigationPrompt();
  clearBeatSelection();
  await action?.();
}

async function saveAndContinue() {
  const action = pendingContextAction.value;
  savingBeforeNavigation.value = true;
  const saved = await saveBeat();
  savingBeforeNavigation.value = false;
  if (!saved) {
    closeNavigationPrompt();
    return;
  }
  closeNavigationPrompt();
  await action?.();
}

</script>

<template>
  <main class="builder-page">
    <div class="builder-workspace">
      <section class="builder-map-column panel">
        <div class="mode-tabs">
          <button :class="{ active: locationMode === 'outdoors' }" @click="switchMode('outdoors')">Outdoor</button>
          <button :class="{ active: ['rooms', 'exterior'].includes(locationMode) }" @click="switchMode('rooms')">Indoor</button>
          <button :class="{ active: locationMode === 'events' }" @click="switchMode('events')">Events</button>
        </div>

        <HexMap
          v-if="locationMode === 'outdoors'"
          :map-data="outdoor.displayMapData"
          :route-models="outdoor.routeModels"
          :feature-models="outdoor.featureModels"
          :current-hex="selectedLocation"
          :discovered="allHexIds"
          :flags="builderFlags"
          :mode="'full'"
          :builder-view="true"
          :clickable-hex-ids="allHexSet"
          :avatar-instant="true"
          @hex-click="selectHex" />

        <template v-else-if="locationMode !== 'events'">
          <div class="indoor-preview-controls">
            <label>Floor
              <select v-model="indoorLevel">
                <option v-for="level in buildingData.levels" :key="level.id" :value="level.id">{{ level.label }}</option>
              </select>
            </label>
            <label>Camera
              <select v-model="indoorViewportMode">
                <option value="gameplay">Gameplay preview</option>
                <option value="fit-all">Fit all</option>
              </select>
            </label>
            <label class="preview-check">
              <input v-model="previewExteriorFog" type="checkbox">
              Exterior fog
            </label>
          </div>
          <GridMap
            :building="building"
            :current-room="selectedRoom"
            :exterior-node="selectedExterior"
            :discovered="allRoomIds"
            :revealed="allRoomIds"
            :level="indoorLevel"
            :stand-level="indoorLevel"
            :reachable-rooms="allRoomIds"
            :reachable-exterior-nodes="allExteriorIds"
            :door-states="buildInitialDoorState(building.areaId, building)"
            :builder-view="true"
            :hydro-discovered="true"
            :viewport-mode="indoorViewportMode"
            :exterior-fog="previewExteriorFog"
            @room-click="selectRoom"
            @exterior-node-click="selectExterior"
            @select-item="selectIndoorMapItem" />
        </template>

        <label v-else>Event name
          <input
            v-model="eventLocationInput"
            placeholder="enter-building"
            @change="selectEventLocation" />
        </label>
      </section>

      <section class="builder-list-column panel">
        <div class="section-heading">
          <div>
            <p class="label">Selected location</p>
            <h2>{{ selectedLocation }}</h2>
          </div>
          <button class="sm" @click="newBeat()">New beat</button>
        </div>
        <button
          v-for="beat in locationBeats"
          :key="beat.id"
          class="beat-list-item"
          :class="{ active: selectedBeatId === beat.id }"
          @click="selectBeat(beat.id)">
          <strong>{{ beat.heading || beat.id }}</strong>
          <span>{{ beat.id }}</span>
        </button>
        <p v-if="!locationBeats.length" class="empty-note">No beats are attached here yet.</p>
      </section>

      <section class="builder-form-column panel">
        <div v-if="!draft" class="empty-editor">
          Select a beat or create a new one.
        </div>
        <form v-else @submit.prevent="saveBeat">
          <div class="form-toolbar">
            <div>
              <span v-if="dirty" class="dirty-pill">Unsaved</span>
              <span v-else class="saved-pill">Saved</span>
            </div>
            <div class="toolbar-actions">
              <button type="button" class="sm muted" :disabled="!dirty" @click="revertDraft">Revert</button>
              <button type="button" class="sm muted" @click="newBeat(draft)">Duplicate</button>
              <button type="button" class="sm muted" :disabled="isNew" @click="loadRevisions">History</button>
              <button type="submit" class="sm" :disabled="!dirty">Save</button>
            </div>
          </div>

          <p v-if="status" class="builder-status">{{ status }}</p>
          <p v-for="message in errors.trigger ?? []" :key="message" class="field-error">{{ message }}</p>

          <div class="field-grid">
            <label>Beat ID
              <input v-model="draft.id" :readonly="!isNew" />
              <span v-if="fieldError('id')" class="field-error">{{ fieldError("id") }}</span>
            </label>
          </div>

          <div class="field-grid">
            <label>Eyebrow<input v-model="draft.eyebrow" /></label>
            <label>Heading<input v-model="draft.heading" /></label>
          </div>

          <label>Story text
            <textarea v-model="draft.text" rows="10" />
            <span v-if="fieldError('text')" class="field-error">{{ fieldError("text") }}</span>
          </label>
          <label>Revisit text<textarea v-model="draft.revisit" rows="5" /></label>

          <fieldset>
            <legend>Choices</legend>
            <article v-for="(choice, index) in draft.choices" :key="choice.id" class="choice-editor">
              <div class="choice-toolbar">
                <strong>Choice {{ index + 1 }}</strong>
                <div>
                  <button type="button" class="sm muted" @click="moveChoice(index, -1)">↑</button>
                  <button type="button" class="sm muted" @click="moveChoice(index, 1)">↓</button>
                  <button type="button" class="sm muted" @click="draft.choices.splice(index, 1)">Remove</button>
                </div>
              </div>
              <label>Label<input v-model="choice.text" /></label>
              <div class="field-grid">
                <label>Sets<input :value="choice.sets.join(', ')" @input="setCsv(choice, 'sets', $event)" /></label>
                <label>Set flags<input :value="choice.set_flags.join(', ')" @input="setCsv(choice, 'set_flags', $event)" /></label>
              </div>
              <details>
                <summary>Time cost</summary>
                <div class="field-grid">
                  <label>Game minutes<input v-model.number="choice.timeMinutes" type="number" min="0"></label>
                  <label>Activity
                    <select v-model="choice.activity">
                      <option>resting</option><option>light</option>
                      <option>moderate</option><option>strenuous</option>
                    </select>
                  </label>
                </div>
              </details>
              <label>Destination
                <select :value="destinationType(choice)" @change="setDestinationType(choice, $event.target.value)">
                  <option value="">No movement</option>
                  <option value="hex">Outdoor hex</option>
                  <option value="room">Indoor room</option>
                  <option value="enter">Enter building</option>
                </select>
              </label>
              <select v-if="choice.go_hex" v-model="choice.go_hex">
                <option v-for="hex in catalog.world.hexes" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
              </select>
              <select v-if="choice.go_room" v-model="choice.go_room">
                <option v-for="room in catalog.world.rooms" :key="room.id" :value="room.id">{{ room.label }} ({{ room.id }})</option>
              </select>
              <select v-if="choice.enter" v-model="choice.enter">
                <option v-for="item in catalog.world.buildings" :key="item.id" :value="item.id">{{ item.label }}</option>
              </select>
              <p v-for="message in errors[`choices.${index}.destination`] ?? []" :key="message" class="field-error">{{ message }}</p>
            </article>
            <button type="button" class="sm" @click="addChoice">Add choice</button>
          </fieldset>

          <details>
            <summary>Generated YAML</summary>
            <pre class="yaml-preview">{{ yamlPreview }}</pre>
          </details>

          <div v-if="showRevisions" class="revision-panel">
            <h3>Revision history</h3>
            <button
              v-for="revision in revisions"
              :key="revision.revision"
              type="button"
              class="revision-item"
              @click="restoreRevision(revision.revision)">
              r{{ revision.revision }} · {{ revision.operation }} · {{ new Date(revision.createdAt).toLocaleString() }}
            </button>
          </div>

          <button v-if="!isNew" type="button" class="danger" @click="deleteBeat">Delete beat</button>
        </form>
      </section>
    </div>

    <div
      v-if="navigationPromptVisible"
      class="unsaved-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title">
      <section class="unsaved-dialog">
        <p class="label">Unsaved changes</p>
        <h2 id="unsaved-title">Save before leaving this beat?</h2>
        <p>
          You can save these edits, discard them, or return to the editor
          without changing context.
        </p>
        <div class="unsaved-actions">
          <button
            type="button"
            :disabled="savingBeforeNavigation"
            @click="saveAndContinue">
            {{ savingBeforeNavigation ? "Saving…" : "Save and continue" }}
          </button>
          <button
            type="button"
            class="danger-outline"
            :disabled="savingBeforeNavigation"
            @click="discardAndContinue">
            Discard changes
          </button>
          <button
            type="button"
            class="muted"
            :disabled="savingBeforeNavigation"
            @click="keepEditing">
            Keep editing
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.builder-page { max-width: 1500px; margin: 0 auto; padding: 1rem; }
.builder-header, .builder-header-actions, .section-heading, .form-toolbar, .toolbar-actions, .choice-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: .65rem; flex-wrap: wrap;
}
.builder-header h1, .section-heading h2 { margin: 0; }
.open-menu { position: relative; }
.open-menu summary {
  list-style: none;
  user-select: none;
  background: #252a33;
  color: #9aa0ac;
  border: 1px solid #3a404a;
  border-radius: 8px;
  padding: .35rem .65rem;
  font-size: .82rem;
  cursor: pointer;
}
.open-menu summary::-webkit-details-marker { display: none; }
.open-menu summary::after { content: " ▾"; }
.open-menu[open] summary { background: #323945; color: #d5d9df; }
.open-menu-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + .35rem);
  right: 0;
  min-width: 10rem;
  padding: .35rem;
  border: 1px solid #465166;
  border-radius: 8px;
  background: #202630;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .35);
}
.open-menu-item {
  width: 100%;
  border: 0;
  background: transparent;
  padding: .45rem .55rem;
  text-align: left;
  white-space: nowrap;
}
.open-menu-item:hover:not(:disabled) { background: #344158; }
.builder-workspace { display: grid; grid-template-columns: minmax(320px, 1fr) 260px minmax(420px, 1.35fr); gap: 1rem; margin-top: 1rem; align-items: start; }
.panel { border: 1px solid #343d4d; border-radius: 12px; background: #20252f; padding: 1rem; min-width: 0; }
.builder-map-column { position: sticky; top: 1rem; }
.builder-list-column { max-height: calc(100vh - 2rem); overflow: auto; }
.mode-tabs { display: flex; gap: .4rem; margin-bottom: .75rem; }
.mode-tabs button.active, .beat-list-item.active { background: #49624f; border-color: #6f9b79; }
.beat-list-item { display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: .2rem; margin-top: .5rem; text-align: left; }
.beat-list-item span, .empty-note { color: #9aa0ac; font-size: .8rem; }
.builder-form-column form, fieldset { display: grid; gap: .8rem; }
label { display: grid; gap: .35rem; color: #bfc5cf; font-size: .82rem; }
input, textarea, select { width: 100%; border: 1px solid #485267; border-radius: 7px; background: #171b22; color: #eef1f5; padding: .5rem .6rem; font: inherit; }
textarea { resize: vertical; line-height: 1.5; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; }
.check-field { display: flex; align-items: center; align-self: end; }
.check-field input { width: auto; }
fieldset { border: 1px solid #3b4557; border-radius: 9px; padding: .85rem; }
legend { color: #8bc49a; padding: 0 .35rem; }
.choice-editor { display: grid; gap: .65rem; border: 1px solid #343d4d; border-radius: 8px; padding: .75rem; background: #1b2028; }
.dirty-pill, .saved-pill { border-radius: 99px; padding: .25rem .55rem; font-size: .75rem; }
.dirty-pill { background: #6d5625; color: #ffe19a; }
.saved-pill { background: #294d35; color: #bce8c7; }
.builder-status { color: #9fc7ff; margin: 0; }
.field-error { color: #ff9e9e; font-size: .78rem; margin: .2rem 0 0; }
.yaml-preview { max-height: 28rem; overflow: auto; padding: .8rem; background: #11151b; border-radius: 8px; white-space: pre-wrap; }
.revision-panel { display: grid; gap: .4rem; }
.revision-item { text-align: left; }
.danger { margin-top: 1rem; background: #5a2929; border-color: #854141; }
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
.unsaved-dialog p:not(.label) { margin: 0; color: #bfc5cf; line-height: 1.5; }
.unsaved-actions { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1.1rem; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.danger-outline:hover:not(:disabled) { background: #543034; }
.unsaved-actions .muted { background: #252a33; border-color: #3a404a; color: #b2b8c2; }
.level-picker { margin-bottom: .6rem; }
.indoor-preview-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .55rem;
  margin-bottom: .6rem;
}
.preview-check {
  grid-column: 1 / -1;
  display: flex;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: .45rem;
}
.preview-check input { width: auto; }
.empty-editor { color: #9aa0ac; padding: 3rem 1rem; text-align: center; }
@media (max-width: 1100px) {
  .builder-workspace { grid-template-columns: 1fr 1fr; }
  .builder-form-column { grid-column: 1 / -1; }
  .builder-map-column { position: static; }
}
@media (max-width: 720px) {
  .builder-workspace, .field-grid { grid-template-columns: 1fr; }
  .builder-form-column { grid-column: auto; }
}
</style>
