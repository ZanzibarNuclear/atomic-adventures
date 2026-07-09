<script setup>
import { computed, ref, watch } from "vue";
import { moveStoryBeat, splitStoryBeat } from "../../../lib/story/storyArcOperations.js";

const props = defineProps({
  documentText: { type: String, default: "" },
  catalog: { type: Object, default: () => ({}) },
  beats: { type: Array, default: () => [] },
  dirty: { type: Boolean, default: false },
  status: { type: String, default: "" },
  errors: { type: Object, default: () => ({}) },
});

const emit = defineEmits([
  "update:documentText",
  "save",
  "revert",
  "reload",
  "add-scene",
  "select-scene",
  "move-beat",
  "split-beat",
]);

const parsed = computed(() => {
  try {
    return JSON.parse(props.documentText || "{}");
  } catch {
    return null;
  }
});
const storyArcs = computed(() => Array.isArray(parsed.value?.storyArcs) ? parsed.value.storyArcs : []);
const parseError = computed(() => parsed.value ? "" : "Story arc content could not be read.");
const selection = ref({ kind: "arc", arcId: "", beatId: "" });
const expandedArcIds = ref(new Set());
const editing = ref(false);
const editTitle = ref("");
const moveDialog = ref(null);
const operationError = ref("");
const splitDialog = ref(null);
const draggedBeat = ref(null);

const selectedStoryArc = computed(() =>
  storyArcs.value.find((arc) => arc.id === selection.value.arcId) ?? null,
);
const selectedStoryBeat = computed(() => {
  if (selection.value.kind !== "beat") return null;
  return selectedStoryArc.value?.beats?.find((beat) => beat.id === selection.value.beatId) ?? null;
});
const selectedBeatIndex = computed(() =>
  selectedStoryArc.value?.beats?.findIndex((beat) => beat.id === selectedStoryBeat.value?.id) ?? -1,
);
const linkedScenes = computed(() => {
  if (!selectedStoryBeat.value) return [];
  return props.beats.filter((scene) =>
    scene.id === selectedStoryBeat.value.scene || scene.storyBeat === selectedStoryBeat.value.id,
  );
});
const selectedArcIndex = computed(() => storyArcs.value.findIndex((arc) => arc.id === selectedStoryArc.value?.id));
const previousArc = computed(() => storyArcs.value[selectedArcIndex.value - 1] ?? null);
const nextArc = computed(() => storyArcs.value[selectedArcIndex.value + 1] ?? null);
const outgoingBeat = computed(() => selectedStoryArc.value?.beats?.at(-1) ?? null);
const validationEntries = computed(() => errorEntries(props.errors));

watch(storyArcs, (arcs) => {
  if (!arcs.length) {
    selection.value = { kind: "arc", arcId: "", beatId: "" };
    expandedArcIds.value = new Set();
    return;
  }
  if (!arcs.some((arc) => arc.id === selection.value.arcId)) selectArc(arcs[0].id);
  if (!expandedArcIds.value.size) expandedArcIds.value = new Set([arcs[0].id]);
}, { immediate: true });

watch([selectedStoryArc, selectedStoryBeat], () => {
  if (!editing.value) return;
  editing.value = false;
  editTitle.value = "";
});

function selectArc(arcId) {
  if (editing.value && !window.confirm("Discard the title edit?")) return;
  editing.value = false;
  selection.value = { kind: "arc", arcId, beatId: "" };
}

function selectBeat(arcId, beatId) {
  if (editing.value && !window.confirm("Discard the title edit?")) return;
  editing.value = false;
  selection.value = { kind: "beat", arcId, beatId };
}

function toggleArc(arcId) {
  const next = new Set(expandedArcIds.value);
  if (next.has(arcId)) next.delete(arcId);
  else next.add(arcId);
  expandedArcIds.value = next;
}

function beginEdit() {
  const item = selectedStoryBeat.value ?? selectedStoryArc.value;
  if (!item) return;
  editTitle.value = item.title ?? "";
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  editTitle.value = "";
}

function applyTitle() {
  const ids = { arcId: selectedStoryArc.value?.id, beatId: selectedStoryBeat.value?.id };
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === ids.arcId);
    const target = ids.beatId ? arc?.beats?.find((item) => item.id === ids.beatId) : arc;
    if (target) target.title = editTitle.value.trim();
  });
  cancelEdit();
}

function updateDocument(mutator) {
  if (!parsed.value) return;
  const next = structuredClone(parsed.value);
  mutator(next);
  emit("update:documentText", JSON.stringify(next, null, 2));
}

function addStoryArc() {
  updateDocument((document) => {
    document.storyArcs ??= [];
    const id = uniqueId("new-story-arc", document.storyArcs.map((item) => item.id));
    document.storyArcs.push({
      id,
      title: "New story arc",
      defaultMode: "story",
      startBeat: "new-story-beat",
      beats: [createStoryBeat("new-story-beat")],
    });
    expandedArcIds.value = new Set([...expandedArcIds.value, id]);
    selectArc(id);
  });
}

function addStoryBeat() {
  const arcId = selectedStoryArc.value?.id;
  if (!arcId) return;
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    if (!arc) return;
    arc.beats ??= [];
    const id = uniqueId("new-story-beat", arc.beats.map((item) => item.id));
    arc.beats.push(createStoryBeat(id));
    arc.startBeat ||= id;
    selectBeat(arcId, id);
  });
}

function removeStoryBeat() {
  const arcId = selectedStoryArc.value?.id;
  const beatId = selectedStoryBeat.value?.id;
  if (!arcId || !beatId || !window.confirm(`Delete story beat "${beatId}"? Linked scenes will not be deleted.`)) return;
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    if (!arc) return;
    arc.beats = (arc.beats ?? []).filter((beat) => beat.id !== beatId);
    if (arc.startBeat === beatId) arc.startBeat = arc.beats[0]?.id ?? "";
    for (const beat of arc.beats) if (beat.next === beatId) beat.next = null;
    selectArc(arcId);
  });
}

function addScene() {
  emit("add-scene", {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    primarySceneId: selectedStoryBeat.value?.scene ?? null,
  });
}

function requestMove() {
  moveDialog.value = {
    fromArcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    toArcId: selectedStoryArc.value?.id,
    toIndex: selectedBeatIndex.value,
  };
  operationError.value = "";
}

function beginDrag(arcId, beatId) {
  draggedBeat.value = { fromArcId: arcId, beatId };
}

function dropBeat(toArcId, toIndex) {
  if (!draggedBeat.value) return;
  moveDialog.value = { ...draggedBeat.value, toArcId, toIndex };
  draggedBeat.value = null;
  operationError.value = "";
}

function destinationPositions(arcId) {
  const arc = storyArcs.value.find((item) => item.id === arcId);
  const count = arc?.beats?.length ?? 0;
  return Array.from({ length: count + 1 }, (_, index) => ({
    index,
    label: index === count ? "At end" : `Before ${arc.beats[index].title || arc.beats[index].id}`,
  }));
}

function applyMove() {
  if (!moveDialog.value || !parsed.value) return;
  const result = moveStoryBeat(parsed.value, moveDialog.value);
  if (!result.ok) {
    operationError.value = [result.message, ...(result.conflicts ?? [])].join(" ");
    return;
  }
  emit("update:documentText", JSON.stringify(result.document, null, 2));
  selectBeat(moveDialog.value.toArcId, moveDialog.value.beatId);
  expandedArcIds.value = new Set([...expandedArcIds.value, moveDialog.value.toArcId]);
  moveDialog.value = null;
}

function requestSplit() {
  const base = `${selectedStoryBeat.value?.id || "story-beat"}-continued`;
  splitDialog.value = {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    newBeatId: uniqueId(base, storyArcs.value.flatMap((arc) => arc.beats?.map((beat) => beat.id) ?? [])),
    newBeatTitle: `${selectedStoryBeat.value?.title || "Story beat"} — continued`,
    splitIndex: 1,
  };
  operationError.value = "";
}

function applySplit() {
  if (!splitDialog.value || !parsed.value) return;
  const result = splitStoryBeat(parsed.value, {
    ...splitDialog.value,
    sceneIds: linkedScenes.value.map((scene) => scene.id),
  });
  if (!result.ok) {
    operationError.value = result.message;
    return;
  }
  emit("split-beat", {
    arcId: splitDialog.value.arcId,
    beatId: splitDialog.value.beatId,
    newBeatId: splitDialog.value.newBeatId,
    storyArcDocument: result.document,
    sceneIds: result.movedSceneIds,
    sceneVersions: Object.fromEntries(linkedScenes.value.map((scene) => [scene.id, scene.version])),
  });
  selectBeat(splitDialog.value.arcId, splitDialog.value.newBeatId);
  expandedArcIds.value = new Set([...expandedArcIds.value, splitDialog.value.arcId]);
  splitDialog.value = null;
}

function sceneLocation(scene) {
  const trigger = scene?.trigger ?? {};
  if (trigger.hex) return labelFor(props.catalog?.world?.hexes, trigger.hex);
  if (trigger.room) return labelFor(props.catalog?.world?.rooms, trigger.room);
  if (trigger.exteriorNode) return labelFor(props.catalog?.world?.exteriorNodes, trigger.exteriorNode);
  if (trigger.event) return `Event: ${trigger.event}`;
  return "No location trigger";
}

function labelFor(options = [], id) {
  const item = options?.find((option) => option.id === id);
  return item ? `${item.label ?? item.name ?? id} (${id})` : id;
}

function errorEntries(errors) {
  return Object.entries(errors ?? {}).flatMap(([path, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((message) => ({ path, message })),
  );
}

function errorCountFor(arcIndex, beatIndex = null) {
  const prefix = beatIndex == null
    ? `storyArcs.${arcIndex}`
    : `storyArcs.${arcIndex}.beats.${beatIndex}`;
  return validationEntries.value.filter((entry) => entry.path.startsWith(prefix)).length;
}

function createStoryBeat(id) {
  return {
    id,
    title: "New story beat",
    scene: null,
    choices: [],
    allowed: {
      movement: { mode: null, hexes: [], rooms: [], exteriorNodes: [], transitions: [] },
      storyForwardActions: [], optionalActions: [], storyChoices: [], stageViews: [],
      indoorActions: [], outdoorActions: [], itemActions: [], developerActions: [],
    },
    completesWhen: null,
    onEnter: null,
    onComplete: null,
    next: null,
    nextArc: null,
  };
}

function uniqueId(base, existingIds = []) {
  const used = new Set(existingIds);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}
</script>

<template>
  <section class="arc-panel">
    <aside class="outline panel" aria-label="Story outline">
      <header class="panel-heading">
        <div><p class="label">Story mode</p><h2>Story outline</h2></div>
        <button type="button" class="sm muted" @click="addStoryArc">Add arc</button>
      </header>
      <p v-if="status" class="builder-status">{{ status }}</p>
      <p v-if="parseError" class="field-error">{{ parseError }}</p>
      <ol v-if="storyArcs.length" class="arc-list">
        <li v-for="(arc, arcIndex) in storyArcs" :key="arc.id" class="arc-row" @dragover.prevent @drop="dropBeat(arc.id, arc.beats?.length ?? 0)">
          <div class="arc-row-main" :class="{ selected: selection.kind === 'arc' && selection.arcId === arc.id }">
            <button type="button" class="disclosure" :aria-expanded="expandedArcIds.has(arc.id)" @click="toggleArc(arc.id)">
              {{ expandedArcIds.has(arc.id) ? "▾" : "▸" }}
            </button>
            <button type="button" class="outline-select" @click="selectArc(arc.id)">
              <strong>{{ arc.title || arc.id }}</strong>
              <span>{{ arc.beats?.length ?? 0 }} beats</span>
            </button>
            <span v-if="errorCountFor(arcIndex)" class="warning-badge">{{ errorCountFor(arcIndex) }}</span>
          </div>
          <ol v-if="expandedArcIds.has(arc.id)" class="beat-list">
            <li v-for="(beat, beatIndex) in arc.beats ?? []" :key="beat.id" @dragover.prevent.stop @drop.stop="dropBeat(arc.id, beatIndex)">
              <button
                type="button"
                class="beat-select"
                draggable="true"
                :class="{ selected: selection.kind === 'beat' && selection.arcId === arc.id && selection.beatId === beat.id }"
                @click="selectBeat(arc.id, beat.id)"
                @dragstart="beginDrag(arc.id, beat.id)"
                @dragend="draggedBeat = null"
              >
                <span class="beat-position">{{ beatIndex + 1 }}</span>
                <span class="beat-copy"><strong>{{ beat.title || beat.id }}</strong><small>{{ beat.id }}</small></span>
                <span class="scene-count">{{ beats.filter(scene => scene.id === beat.scene || scene.storyBeat === beat.id).length }} scenes</span>
                <span v-if="errorCountFor(arcIndex, beatIndex)" class="warning-badge">{{ errorCountFor(arcIndex, beatIndex) }}</span>
              </button>
            </li>
          </ol>
        </li>
      </ol>
      <p v-else class="empty-note">No story arcs found.</p>
    </aside>

    <main class="detail panel">
      <header class="panel-heading">
        <div>
          <p class="label">{{ selectedStoryBeat ? "Story beat" : "Story arc" }}</p>
          <h2>{{ selectedStoryBeat?.title || selectedStoryArc?.title || "Select an arc" }}</h2>
        </div>
        <div class="toolbar">
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <button type="button" class="sm muted" :disabled="!dirty" @click="$emit('revert')">Revert</button>
          <button type="button" class="sm muted" @click="$emit('reload')">Reload</button>
          <button type="button" class="sm" :disabled="!dirty || Boolean(parseError)" @click="$emit('save')">Save all</button>
        </div>
      </header>

      <template v-if="selectedStoryArc">
        <form v-if="editing" class="title-editor" @submit.prevent="applyTitle">
          <label>Title <input v-model="editTitle" autofocus></label>
          <div class="toolbar"><button type="button" class="sm muted" @click="cancelEdit">Cancel</button><button class="sm">Apply</button></div>
        </form>

        <article v-else-if="!selectedStoryBeat" class="object-detail">
          <div class="detail-actions"><button type="button" class="sm" @click="beginEdit">Edit arc</button><button type="button" class="sm muted" @click="addStoryBeat">Add beat</button></div>
          <dl class="metadata">
            <div><dt>Stable ID</dt><dd>{{ selectedStoryArc.id }}</dd></div>
            <div><dt>Starting beat</dt><dd>{{ selectedStoryArc.startBeat || "None" }}</dd></div>
            <div><dt>Beat count</dt><dd>{{ selectedStoryArc.beats?.length ?? 0 }}</dd></div>
            <div><dt>Previous arc</dt><dd>{{ previousArc?.title || "None" }}</dd></div>
            <div><dt>Next arc</dt><dd>{{ outgoingBeat?.nextArc ? (storyArcs.find(arc => arc.id === outgoingBeat.nextArc)?.title || outgoingBeat.nextArc) : (nextArc?.title || "None") }}</dd></div>
          </dl>
        </article>

        <article v-else class="object-detail">
          <div class="detail-actions">
            <button type="button" class="sm" @click="beginEdit">Edit title</button>
            <button type="button" class="sm muted" @click="requestMove">Move beat</button>
            <button type="button" class="sm muted" :disabled="linkedScenes.length < 2" @click="requestSplit">Split scenes</button>
            <button type="button" class="sm muted" @click="addScene">Add scene</button>
            <button type="button" class="sm danger" @click="removeStoryBeat">Delete beat</button>
          </div>
          <dl class="metadata">
            <div><dt>Stable ID</dt><dd>{{ selectedStoryBeat.id }}</dd></div>
            <div><dt>Arc</dt><dd>{{ selectedStoryArc.title || selectedStoryArc.id }}</dd></div>
            <div><dt>Position</dt><dd>{{ selectedBeatIndex + 1 }} of {{ selectedStoryArc.beats?.length ?? 0 }}</dd></div>
            <div><dt>Previous</dt><dd>{{ selectedStoryArc.beats?.[selectedBeatIndex - 1]?.title || previousArc?.title || "None" }}</dd></div>
            <div><dt>Next</dt><dd>{{ selectedStoryArc.beats?.[selectedBeatIndex + 1]?.title || (selectedStoryBeat.nextArc && storyArcs.find(arc => arc.id === selectedStoryBeat.nextArc)?.title) || "End of arc" }}</dd></div>
          </dl>
          <section class="scenes-section">
            <header><div><p class="label">Linked content</p><h3>Scenes</h3></div><span>{{ linkedScenes.length }}</span></header>
            <ol v-if="linkedScenes.length" class="scene-list">
              <li v-for="scene in linkedScenes" :key="scene.id">
                <button type="button" class="scene-select" @click="$emit('select-scene', { arcId: selectedStoryArc.id, beatId: selectedStoryBeat.id, sceneId: scene.id })">
                  <strong>{{ scene.heading || scene.id }}</strong>
                  <span>{{ sceneLocation(scene) }}</span>
                  <p>{{ scene.text }}</p>
                </button>
              </li>
            </ol>
            <p v-else class="empty-note">No scenes are linked to this beat.</p>
          </section>
        </article>
      </template>

      <section v-if="validationEntries.length" class="validation-list">
        <p v-for="entry in validationEntries" :key="`${entry.path}:${entry.message}`" class="field-error"><strong>{{ entry.path }}</strong>: {{ entry.message }}</p>
      </section>
    </main>

    <div v-if="moveDialog" class="dialog-backdrop" @click.self="moveDialog = null">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="move-dialog-title" @submit.prevent="applyMove">
        <p class="label">Reorganize story</p>
        <h2 id="move-dialog-title">Move {{ selectedStoryBeat?.title || moveDialog.beatId }}</h2>
        <label>Destination arc
          <select v-model="moveDialog.toArcId" @change="moveDialog.toIndex = 0">
            <option v-for="arc in storyArcs" :key="arc.id" :value="arc.id">{{ arc.title || arc.id }}</option>
          </select>
        </label>
        <label>Position
          <select v-model.number="moveDialog.toIndex">
            <option v-for="position in destinationPositions(moveDialog.toArcId)" :key="position.index" :value="position.index">{{ position.label }}</option>
          </select>
        </label>
        <p class="dialog-note">The beat's scenes and hidden runtime data move with it. A conflicting non-linear handoff will stop the move.</p>
        <p v-if="operationError" class="field-error">{{ operationError }}</p>
        <div class="toolbar"><button type="button" class="sm muted" @click="moveDialog = null">Cancel</button><button class="sm">Move beat</button></div>
      </form>
    </div>
    <div v-if="splitDialog" class="dialog-backdrop" @click.self="splitDialog = null">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="split-dialog-title" @submit.prevent="applySplit">
        <p class="label">Change beat boundary</p>
        <h2 id="split-dialog-title">Split scenes into a new beat</h2>
        <label>New beat title <input v-model="splitDialog.newBeatTitle"></label>
        <label>Stable ID <input v-model="splitDialog.newBeatId"></label>
        <label>New beat begins with
          <select v-model.number="splitDialog.splitIndex">
            <option v-for="(scene, index) in linkedScenes.slice(1)" :key="scene.id" :value="index + 1">{{ scene.heading || scene.id }}</option>
          </select>
        </label>
        <div class="split-preview">
          <p><strong>Original beat:</strong> {{ linkedScenes.slice(0, splitDialog.splitIndex).map(scene => scene.heading || scene.id).join(" → ") }}</p>
          <p><strong>New beat:</strong> {{ linkedScenes.slice(splitDialog.splitIndex).map(scene => scene.heading || scene.id).join(" → ") }}</p>
        </div>
        <p class="dialog-note">Existing hidden runtime fields stay unchanged on the original beat and are not copied. The scenes and arc document are saved together.</p>
        <p v-if="operationError" class="field-error">{{ operationError }}</p>
        <div class="toolbar"><button type="button" class="sm muted" @click="splitDialog = null">Cancel</button><button class="sm">Split beat</button></div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.arc-panel { display: grid; grid-template-columns: minmax(300px, .72fr) minmax(500px, 1.28fr); gap: 1rem; height: calc(100% - 3rem); min-height: 0; margin-top: .75rem; }
.panel { min-height: 0; overflow: auto; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: 1rem; }
.panel-heading, .toolbar, .detail-actions, .scenes-section header { display: flex; align-items: center; justify-content: space-between; gap: .65rem; flex-wrap: wrap; }
.toolbar, .detail-actions { justify-content: flex-end; }
h2, h3, p { margin: 0; }
.label { color: #8e96a3; font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.arc-list, .beat-list, .scene-list { list-style: none; margin: .8rem 0 0; padding: 0; }
.arc-row { border-top: 1px solid #343d4d; padding: .35rem 0; }
.arc-row-main { display: grid; grid-template-columns: 2rem 1fr auto; align-items: center; border-radius: 7px; }
.arc-row-main.selected, .beat-select.selected { background: #323b4a; box-shadow: inset 3px 0 #d9a441; }
.disclosure, .outline-select, .beat-select, .scene-select { border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.disclosure { padding: .65rem; }
.outline-select { display: flex; justify-content: space-between; gap: .5rem; padding: .7rem .35rem; width: 100%; }
.outline-select span, .scene-count { color: #9ba4b2; font-size: .78rem; }
.beat-list { margin: .15rem 0 .4rem 1.4rem; border-left: 1px solid #3b4555; }
.beat-select { width: 100%; display: grid; grid-template-columns: 1.8rem 1fr auto auto; align-items: center; gap: .5rem; padding: .65rem .6rem; border-radius: 6px; }
.beat-position { color: #8e96a3; font-variant-numeric: tabular-nums; }
.beat-copy { display: grid; gap: .16rem; }
.beat-copy small { color: #8e96a3; }
.warning-badge { margin-right: .5rem; min-width: 1.35rem; border-radius: 99px; background: #8d4b42; color: white; text-align: center; font-size: .72rem; padding: .15rem .35rem; }
.builder-status, .empty-note { color: #aeb6c3; margin-top: .75rem; }
.dirty-pill { border-radius: 99px; background: #705826; color: #f5d98f; padding: .2rem .55rem; font-size: .75rem; }
.object-detail, .title-editor { margin-top: 1rem; }
.title-editor { display: grid; gap: .8rem; max-width: 42rem; }
.title-editor label { display: grid; gap: .4rem; }
.title-editor input { width: 100%; }
.metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; margin: 1rem 0; }
.metadata div { border: 1px solid #343d4d; border-radius: 7px; padding: .7rem; }
.metadata dt { color: #8e96a3; font-size: .75rem; }
.metadata dd { margin: .25rem 0 0; }
.scenes-section { border-top: 1px solid #343d4d; padding-top: 1rem; }
.scene-list { display: grid; gap: .65rem; }
.scene-list li { border: 1px solid #343d4d; border-radius: 8px; overflow: hidden; }
.scene-select { display: grid; gap: .3rem; width: 100%; padding: .85rem; }
.scene-select span { color: #9ba4b2; font-size: .8rem; }
.scene-select p { color: #c7cdd7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.validation-list { margin-top: 1rem; }
.field-error { color: #f3a69d; margin-top: .4rem; }
.danger { color: #ffc0b8; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1rem; background: rgb(8 11 16 / .72); }
.dialog { width: min(32rem, 100%); display: grid; gap: .85rem; border: 1px solid #566175; border-radius: 10px; background: #20252f; padding: 1.2rem; box-shadow: 0 18px 60px rgb(0 0 0 / .45); }
.dialog label { display: grid; gap: .35rem; }
.dialog-note { color: #aeb6c3; font-size: .86rem; }
.split-preview { display: grid; gap: .45rem; border: 1px solid #343d4d; border-radius: 7px; padding: .7rem; color: #c7cdd7; }
@media (max-width: 900px) { .arc-panel { grid-template-columns: 1fr; height: auto; } .panel { max-height: none; } .metadata { grid-template-columns: 1fr; } }
</style>
