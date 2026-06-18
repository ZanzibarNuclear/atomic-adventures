<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, RouterLink } from "vue-router";
import mapData from "../../content/world/map.yaml";
import buildingData from "../../content/world/utility-station.yaml";
import HexMap from "../lib/maps/components/HexMap.vue";
import GridMap from "../lib/maps/components/GridMap.vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import { storyApi } from "../lib/storyApi.js";
import { storyBeatYaml } from "../lib/storyYamlPreview.js";

const outdoor = useOutdoorWorld(mapData);
const building = buildBuilding(buildingData);
const allHexIds = mapData.hexes.map((item) => item.id);
const allRoomIds = buildingData.rooms.map((item) => item.id);
const allExteriorIds = (buildingData.exterior?.nodes ?? []).map((item) => item.id);
const allHexSet = new Set(allHexIds);
const builderFlags = new Set();

const catalog = ref({ areas: [], world: { hexes: [], rooms: [], exteriorNodes: [], buildings: [] } });
const areaId = ref("part-i");
const beats = ref([]);
const selectedBeatId = ref("");
const locationMode = ref("outdoors");
const selectedLocation = ref(mapData.start);
const indoorLevel = ref(buildingData.exterior?.level ?? buildingData.levels.at(-1)?.id);
const draft = ref(null);
const baseline = ref("");
const isNew = ref(false);
const errors = ref({});
const status = ref("");
const revisions = ref([]);
const showRevisions = ref(false);

const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== baseline.value);
const yamlPreview = computed(() => storyBeatYaml(draft.value));
const locationBeats = computed(() =>
  beats.value.filter((beat) => {
    if (locationMode.value === "outdoors") return beat.trigger.hex === selectedLocation.value;
    if (locationMode.value === "rooms") return beat.trigger.room === selectedLocation.value;
    if (locationMode.value === "exterior") return beat.trigger.exteriorNode === selectedLocation.value;
    return Boolean(beat.trigger.event);
  }),
);
const selectedRoom = computed(() => locationMode.value === "rooms" ? selectedLocation.value : "");
const selectedExterior = computed(() => locationMode.value === "exterior" ? selectedLocation.value : null);

onMounted(async () => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    catalog.value = await storyApi("/api/catalog");
    areaId.value = catalog.value.areas[0]?.id ?? "part-i";
    await loadBeats();
  } catch (error) {
    status.value = error.message;
  }
});

onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload));
onBeforeRouteLeave(() => !dirty.value || window.confirm("Discard unsaved story changes?"));

watch(areaId, () => loadBeats());
watch([locationMode, selectedLocation], () => {
  selectedBeatId.value = "";
  draft.value = null;
  baseline.value = "";
  errors.value = {};
});

async function loadBeats(selectId = "") {
  if (!areaId.value) return;
  beats.value = await storyApi(`/api/story/areas/${encodeURIComponent(areaId.value)}/beats`);
  if (selectId) await selectBeat(selectId);
}

async function selectBeat(id) {
  if (dirty.value && !window.confirm("Discard unsaved story changes?")) return;
  const result = await storyApi(
    `/api/story/areas/${encodeURIComponent(areaId.value)}/beats/${encodeURIComponent(id)}`,
  );
  selectedBeatId.value = id;
  isNew.value = false;
  setDraft(result.beat);
}

function selectHex(id) {
  locationMode.value = "outdoors";
  selectedLocation.value = id;
  outdoor.state.currentId = id;
}

function selectRoom(id) {
  locationMode.value = "rooms";
  selectedLocation.value = id;
  const room = building.roomById[id];
  if (room?.level) indoorLevel.value = room.level;
}

function selectExterior(id) {
  locationMode.value = "exterior";
  selectedLocation.value = id;
  indoorLevel.value = buildingData.exterior?.level ?? indoorLevel.value;
}

function switchMode(mode) {
  if (dirty.value && !window.confirm("Discard unsaved story changes?")) return;
  locationMode.value = mode;
  if (mode === "outdoors") selectHex(mapData.start);
  else if (mode === "rooms") selectRoom(buildingData.rooms[0]?.id);
  else if (mode === "exterior") selectExterior(buildingData.exterior?.entry);
  else selectedLocation.value = "enter-building";
}

function newBeat(copy = null) {
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
    order: beats.value.length,
    once: true,
    acknowledge: true,
    eyebrow: "",
    heading: "",
    text: "",
    revisit: "",
    trigger,
    require: { all: [], any: [], not: [] },
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
  errors.value = {};
  status.value = "Saving…";
  try {
    let result;
    if (isNew.value) {
      result = await storyApi(`/api/story/areas/${encodeURIComponent(areaId.value)}/beats`, {
        method: "POST",
        body: JSON.stringify(draft.value),
      });
    } else {
      result = await storyApi(
        `/api/story/areas/${encodeURIComponent(areaId.value)}/beats/${encodeURIComponent(selectedBeatId.value)}`,
        {
          method: "PUT",
          body: JSON.stringify({ beat: draft.value, expectedVersion: draft.value.version }),
        },
      );
    }
    selectedBeatId.value = result.beat.id;
    isNew.value = false;
    setDraft(result.beat);
    await loadBeats();
    status.value = `Saved revision ${result.beat.version}.`;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.status === 409
      ? "This beat changed elsewhere. Reload it before saving."
      : error.message;
  }
}

async function deleteBeat() {
  if (!draft.value || isNew.value) return;
  if (!window.confirm(`Delete "${draft.value.id}"? Its revision history will remain available.`)) return;
  await storyApi(
    `/api/story/areas/${encodeURIComponent(areaId.value)}/beats/${encodeURIComponent(draft.value.id)}`,
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
    `/api/story/areas/${encodeURIComponent(areaId.value)}/beats/${encodeURIComponent(draft.value.id)}/revisions`,
  );
  showRevisions.value = true;
}

async function restoreRevision(revision) {
  if (!window.confirm(`Restore revision ${revision}? This creates a new revision.`)) return;
  const result = await storyApi(
    `/api/story/areas/${encodeURIComponent(areaId.value)}/beats/${encodeURIComponent(draft.value.id)}/revisions/${revision}/restore`,
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
</script>

<template>
  <main class="builder-page">
    <header class="builder-header">
      <div>
        <p class="label">Authoring</p>
        <h1>Story Builder</h1>
      </div>
      <div class="builder-header-actions">
        <select v-model="areaId" aria-label="Story area">
          <option v-for="area in catalog.areas" :key="area.id" :value="area.id">{{ area.name }}</option>
        </select>
        <RouterLink to="/">Open game</RouterLink>
      </div>
    </header>

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
          <label class="level-picker">Floor
            <select v-model="indoorLevel">
              <option v-for="level in buildingData.levels" :key="level.id" :value="level.id">{{ level.label }}</option>
            </select>
          </label>
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
            @room-click="selectRoom"
            @exterior-node-click="selectExterior" />
        </template>

        <label v-else>Event name
          <input v-model="selectedLocation" placeholder="enter-building" />
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
            <label>Order
              <input v-model.number="draft.order" type="number" />
            </label>
            <label class="check-field"><input v-model="draft.once" type="checkbox" /> Run once</label>
            <label class="check-field"><input v-model="draft.acknowledge" type="checkbox" /> Requires choice</label>
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
            <legend>Requirements</legend>
            <label>All flags<input :value="draft.require.all.join(', ')" @input="setCsv(draft.require, 'all', $event)" /></label>
            <label>Any flags<input :value="draft.require.any.join(', ')" @input="setCsv(draft.require, 'any', $event)" /></label>
            <label>Not flags<input :value="draft.require.not.join(', ')" @input="setCsv(draft.require, 'not', $event)" /></label>
          </fieldset>

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
  </main>
</template>

<style scoped>
.builder-page { max-width: 1500px; margin: 0 auto; padding: 1rem; }
.builder-header, .builder-header-actions, .section-heading, .form-toolbar, .toolbar-actions, .choice-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: .65rem; flex-wrap: wrap;
}
.builder-header h1, .section-heading h2 { margin: 0; }
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
.level-picker { margin-bottom: .6rem; }
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
