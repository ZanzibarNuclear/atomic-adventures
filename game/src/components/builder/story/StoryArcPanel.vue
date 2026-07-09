<script setup>
import { computed, ref, watch } from "vue";

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
  "remove-scene",
  "reorder-scenes",
]);

const parsed = computed(() => {
  try {
    return JSON.parse(props.documentText || "{}");
  } catch {
    return null;
  }
});

const storyArcs = computed(() => Array.isArray(parsed.value?.storyArcs) ? parsed.value.storyArcs : []);
const parseError = computed(() => parsed.value ? "" : "Story arc JSON is not valid.");
const selectedStoryArcId = ref("");
const selectedStoryBeatId = ref("");
const selectedPreviewSceneId = ref("");
const selectedStoryArc = computed(() =>
  storyArcs.value.find((arc) => arc.id === selectedStoryArcId.value) ?? storyArcs.value[0] ?? null,
);
const selectedStoryBeat = computed(() =>
  selectedStoryArc.value?.beats?.find((beat) => beat.id === selectedStoryBeatId.value) ??
  selectedStoryArc.value?.beats?.[0] ??
  null,
);
const linkedScenes = computed(() => {
  const beatId = selectedStoryBeat.value?.id;
  if (!beatId) return [];
  return props.beats.filter((beat) =>
    beat.id === selectedStoryBeat.value?.scene || beat.storyBeat === beatId,
  );
});
const selectedScene = computed(() =>
  linkedScenes.value.find((beat) => beat.id === selectedPreviewSceneId.value) ??
  props.beats.find((beat) => beat.id === selectedStoryBeat.value?.scene) ??
  linkedScenes.value[0] ??
  null,
);
const world = computed(() => props.catalog?.world ?? {});
const character = computed(() => props.catalog?.character ?? {});
const learning = computed(() => props.catalog?.learning ?? {});
const beatOptions = computed(() =>
  props.beats.map((beat) => ({
    id: beat.id,
    label: beat.heading || beat.id,
    detail: [beat.modes?.join(", "), beat.storyBeat].filter(Boolean).join(" / "),
  })),
);
const lessonOptions = computed(() => learning.value.lessons ?? []);
const documentOptions = computed(() => character.value.documents ?? []);
const itemOptions = computed(() => character.value.items ?? []);
const currentCompletionFamily = computed(() => completionFamily(selectedStoryBeat.value?.completesWhen));
const previewActions = computed(() => {
  const beat = selectedStoryBeat.value;
  const allowed = beat?.allowed ?? {};
  const movement = movementPreviewActions(allowed.movement ?? {}, world.value);
  return [
    ...movement,
    ...actionList(allowed.storyForwardActions, "Story beat action"),
    ...actionList(allowed.optionalActions, "Optional"),
  ];
});

watch(storyArcs, (items) => {
  if (!items.length) {
    selectedStoryArcId.value = "";
    selectedStoryBeatId.value = "";
    return;
  }
  if (!items.some((arc) => arc.id === selectedStoryArcId.value)) {
    selectedStoryArcId.value = items[0].id;
  }
}, { immediate: true });

watch(selectedStoryArc, (arc) => {
  const beats = arc?.beats ?? [];
  if (!beats.length) {
    selectedStoryBeatId.value = "";
    return;
  }
  if (!beats.some((beat) => beat.id === selectedStoryBeatId.value)) {
    selectedStoryBeatId.value = beats[0].id;
  }
}, { immediate: true });

watch(linkedScenes, (scenes) => {
  if (!scenes.length) {
    selectedPreviewSceneId.value = "";
    return;
  }
  if (!scenes.some((scene) => scene.id === selectedPreviewSceneId.value)) {
    selectedPreviewSceneId.value = selectedStoryBeat.value?.scene &&
      scenes.some((scene) => scene.id === selectedStoryBeat.value.scene)
      ? selectedStoryBeat.value.scene
      : scenes[0].id;
  }
}, { immediate: true });

function errorEntries(errors) {
  return Object.entries(errors ?? {}).flatMap(([path, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((message) => ({ path, message })),
  );
}

function updateDocument(mutator) {
  if (!parsed.value) return;
  const next = structuredClone(parsed.value);
  mutator(next);
  emit("update:documentText", JSON.stringify(next, null, 2));
}

function updateStoryArc(key, value) {
  const arcId = selectedStoryArc.value?.id;
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    if (arc) arc[key] = value || null;
  });
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
    selectedStoryArcId.value = id;
    selectedStoryBeatId.value = "new-story-beat";
  });
}

function addStoryBeat() {
  const arcId = selectedStoryArc.value?.id;
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    if (!arc) return;
    arc.beats ??= [];
    const id = uniqueId("new-story-beat", arc.beats.map((item) => item.id));
    arc.beats.push(createStoryBeat(id));
    arc.startBeat ||= id;
    selectedStoryBeatId.value = id;
  });
}

function addSceneForSelectedBeat() {
  if (!selectedStoryBeat.value?.id) return;
  emit("add-scene", {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value.id,
    primarySceneId: selectedStoryBeat.value.scene ?? null,
  });
}

function selectScene(scene) {
  if (!scene?.id) return;
  selectedPreviewSceneId.value = scene.id;
  emit("select-scene", {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    sceneId: scene.id,
  });
}

function removeScene(scene) {
  if (!scene?.id) return;
  emit("remove-scene", {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    scene,
  });
}

function setPrimaryScene(scene) {
  if (!scene?.id || scene.id === selectedStoryBeat.value?.scene) return;
  updateStoryBeat("scene", scene.id);
  selectedPreviewSceneId.value = scene.id;
}

function moveScene(scene, delta) {
  const index = linkedScenes.value.findIndex((item) => item.id === scene?.id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= linkedScenes.value.length) return;
  const ids = linkedScenes.value.map((item) => item.id);
  const [id] = ids.splice(index, 1);
  ids.splice(next, 0, id);
  emit("reorder-scenes", {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    sceneIds: ids,
  });
}

function removeStoryBeat() {
  const { arcId, beatId } = currentIds();
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    if (!arc) return;
    arc.beats = (arc.beats ?? []).filter((item) => item.id !== beatId);
    if (arc.startBeat === beatId) arc.startBeat = arc.beats[0]?.id ?? "";
    selectedStoryBeatId.value = arc.startBeat || arc.beats[0]?.id || "";
  });
}

function moveStoryBeat(delta) {
  const { arcId, beatId } = currentIds();
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    const beats = arc?.beats ?? [];
    const index = beats.findIndex((item) => item.id === beatId);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= beats.length) return;
    const [beat] = beats.splice(index, 1);
    beats.splice(next, 0, beat);
  });
}

function updateStoryBeat(key, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (beat) beat[key] = value || null;
  });
}

function updateAllowed(path, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (!beat) return;
    beat.allowed ??= {};
    beat.allowed.movement ??= {};
    const [section, key] = path.split(".");
    if (section === "movement") beat.allowed.movement[key] = value;
    else beat.allowed[path] = value;
  });
}

function updateCompletionFamily(family) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (!beat) return;
    beat.completesWhen = defaultCompletion(family);
  });
}

function updateCompletion(path, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (!beat) return;
    beat.completesWhen ??= {};
    const parts = path.split(".");
    let cursor = beat.completesWhen;
    for (const part of parts.slice(0, -1)) cursor = (cursor[part] ??= {});
    cursor[parts.at(-1)] = value || null;
  });
}

function updateFacilityPredicate(value) {
  try {
    updateCompletion("facility", JSON.parse(value || "{}"));
  } catch {
    // Keep typing local until the JSON is valid.
  }
}

function updateStageView(index, key, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (!beat) return;
    beat.allowed ??= {};
    beat.allowed.stageViews ??= [];
    beat.allowed.stageViews[index] ??= { kind: "inventory" };
    beat.allowed.stageViews[index][key] = value || null;
  });
}

function updateBeatEffect(key, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (!beat) return;
    beat[key] = value;
  });
}

function updateBeatEffectJson(key, value) {
  try {
    updateBeatEffect(key, JSON.parse(value || "null"));
  } catch {
    // Keep typing local until the JSON is valid.
  }
}

function addStageView() {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    if (!beat) return;
    beat.allowed ??= {};
    beat.allowed.stageViews ??= [];
    beat.allowed.stageViews.push({ kind: "inventory" });
  });
}

function removeStageView(index) {
  const ids = currentIds();
  updateDocument((document) => {
    const beat = findStoryBeat(document, ids);
    beat?.allowed?.stageViews?.splice(index, 1);
  });
}

function currentIds() {
  return { arcId: selectedStoryArc.value?.id, beatId: selectedStoryBeat.value?.id };
}

function findStoryBeat(document, { arcId, beatId }) {
  return document.storyArcs
    ?.find((arc) => arc.id === arcId)
    ?.beats
    ?.find((beat) => beat.id === beatId);
}

function selectedOptions(event) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function csv(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function csvList(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function completionFamily(completion) {
  if (!completion) return "";
  return ["flag", "facility", "location", "holding", "lesson"].find((key) => completion[key]) ?? "";
}

function defaultCompletion(family) {
  if (family === "flag") return { flag: "" };
  if (family === "facility") return { facility: { "hydro.online": true } };
  if (family === "location") return { location: { place: "outdoors", hex: world.value.hexes?.[0]?.id ?? "" } };
  if (family === "holding") return { holding: { item: itemOptions.value[0]?.id ?? "", holder: "zanzibar" } };
  if (family === "lesson") return { lesson: { id: lessonOptions.value[0]?.id ?? "", status: "completed" } };
  return null;
}

function movementPreviewActions(movement, catalogWorld) {
  return [
    ...(movement.hexes ?? []).map((id) => previewAction(`move-hex:${id}`, "Ordinary movement", labelFor(catalogWorld.hexes, id))),
    ...(movement.rooms ?? []).map((id) => previewAction(`move-room:${id}`, "Ordinary movement", labelFor(catalogWorld.rooms, id))),
    ...(movement.exteriorNodes ?? []).map((id) => previewAction(`move-exterior:${id}`, "Ordinary movement", labelFor(catalogWorld.exteriorNodes, id))),
    ...(movement.transitions ?? []).map((id) => previewAction(`exit-world:${id}`, "Ordinary movement", labelFor(catalogWorld.mapTransitions, id))),
  ];
}

function actionList(ids = [], group) {
  return ids.map((id) => previewAction(id, group, id));
}

function previewAction(id, group, label) {
  return { id, group, label: label || id };
}

function labelFor(options = [], id) {
  const item = options.find((option) => option.id === id);
  return item ? `${item.label ?? item.name ?? id} (${id})` : id;
}

function createStoryBeat(id) {
  return {
    id,
    title: "",
    scene: null,
    allowed: {
      movement: { mode: null, hexes: [], rooms: [], exteriorNodes: [], transitions: [] },
      storyForwardActions: [],
      optionalActions: [],
      storyChoices: [],
      stageViews: [],
      indoorActions: [],
      outdoorActions: [],
      itemActions: [],
      developerActions: [],
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

function sceneLocation(scene) {
  const trigger = scene?.trigger ?? {};
  if (trigger.hex) return labelFor(world.value.hexes, trigger.hex);
  if (trigger.room) return labelFor(world.value.rooms, trigger.room);
  if (trigger.exteriorNode) return labelFor(world.value.exteriorNodes, trigger.exteriorNode);
  if (trigger.event) return `Event: ${trigger.event}`;
  return "No location trigger";
}

function sceneFlagCriteria(scene) {
  const flags = scene?.conditions?.flags ?? {};
  const labels = [];
  if (Array.isArray(flags.all) && flags.all.length) labels.push(`requires ${flags.all.join(", ")}`);
  if (Array.isArray(flags.not) && flags.not.length) labels.push(`absent ${flags.not.join(", ")}`);
  return labels.join(" / ");
}
</script>

<template>
  <section class="arc-panel">
    <div class="arc-summary panel">
      <div class="arc-heading">
        <div>
          <p class="label">Story mode</p>
          <h2>Story arcs</h2>
        </div>
        <div class="arc-actions">
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <span v-else class="saved-pill">Saved</span>
          <button type="button" class="sm muted" @click="addStoryArc">Add arc</button>
          <button type="button" class="sm muted" @click="$emit('reload')">Reload</button>
        </div>
      </div>
      <p v-if="status" class="builder-status">{{ status }}</p>
      <p v-if="parseError" class="field-error">{{ parseError }}</p>
      <ul v-if="storyArcs.length" class="arc-list">
        <li v-for="arc in storyArcs" :key="arc.id" class="arc-card">
          <div>
            <strong>{{ arc.title || arc.id }}</strong>
            <span>{{ arc.id }}</span>
          </div>
          <dl>
            <div>
              <dt>Start beat</dt>
              <dd>{{ arc.startBeat || "none" }}</dd>
            </div>
            <div>
              <dt>Story beats</dt>
              <dd>{{ arc.beats?.length ?? 0 }}</dd>
            </div>
          </dl>
          <ol v-if="arc.beats?.length" class="beat-list">
            <li
              v-for="beat in arc.beats"
              :key="beat.id"
              :class="{ active: arc.id === selectedStoryArc?.id && beat.id === selectedStoryBeat?.id }"
              @click="selectedStoryArcId = arc.id; selectedStoryBeatId = beat.id"
            >
              <span>{{ beat.id }}</span>
              <small>{{ beat.title }}</small>
            </li>
          </ol>
        </li>
      </ul>
      <p v-else class="empty-note">No story arcs found in this document.</p>
    </div>

    <form class="arc-editor panel" @submit.prevent="$emit('save')">
      <div class="arc-heading">
        <div>
          <p class="label">Structured story arc editor</p>
          <h2>{{ selectedStoryBeat?.id || selectedStoryArc?.id || "Document" }}</h2>
        </div>
        <div class="arc-actions">
          <button type="button" class="sm muted" :disabled="!selectedStoryArc" @click="addStoryBeat">Add beat</button>
          <button type="button" class="sm muted" :disabled="!selectedStoryBeat" @click="moveStoryBeat(-1)">Move up</button>
          <button type="button" class="sm muted" :disabled="!selectedStoryBeat" @click="moveStoryBeat(1)">Move down</button>
          <button type="button" class="sm muted" :disabled="!selectedStoryBeat" @click="removeStoryBeat">Remove beat</button>
          <button type="button" class="sm muted" :disabled="!dirty" @click="$emit('revert')">Revert</button>
          <button type="submit" class="sm" :disabled="!dirty || Boolean(parseError)">Save</button>
        </div>
      </div>

      <div v-if="selectedStoryArc" class="structured-editor">
        <fieldset>
          <legend>Story arc</legend>
          <label>
            Title
            <input :value="selectedStoryArc.title" @input="updateStoryArc('title', $event.target.value)">
          </label>
          <label>
            Start story beat
            <select :value="selectedStoryArc.startBeat" @change="updateStoryArc('startBeat', $event.target.value)">
              <option v-for="beat in selectedStoryArc.beats ?? []" :key="beat.id" :value="beat.id">{{ beat.id }}</option>
            </select>
          </label>
        </fieldset>

        <fieldset v-if="selectedStoryBeat">
          <legend>Story beat</legend>
          <label>
            Beat title
            <textarea
              class="compact-textarea"
              :value="selectedStoryBeat.title"
              rows="2"
              @input="updateStoryBeat('title', $event.target.value)"
            />
          </label>
          <label>
            Primary scene
            <select :value="selectedStoryBeat.scene || ''" @change="updateStoryBeat('scene', $event.target.value)">
              <option value="">None</option>
              <option v-for="beat in beatOptions" :key="beat.id" :value="beat.id">
                {{ beat.label }} ({{ beat.id }}){{ beat.detail ? ` - ${beat.detail}` : "" }}
              </option>
            </select>
          </label>
          <div class="scene-panel">
            <div class="scene-panel-heading">
              <h3>Scenes for this beat</h3>
              <div class="scene-heading-actions">
                <span>{{ linkedScenes.length }} linked</span>
                <button type="button" class="sm muted" @click="addSceneForSelectedBeat">Add scene</button>
              </div>
            </div>
            <ul v-if="linkedScenes.length" class="scene-list">
              <li
                v-for="scene in linkedScenes"
                :key="scene.id"
                :class="{ primary: scene.id === selectedStoryBeat.scene }"
              >
                <button type="button" class="scene-select" @click="selectScene(scene)">
                  <strong>{{ scene.heading || scene.id }}</strong>
                  <span>{{ sceneLocation(scene) }}</span>
                  <small v-if="sceneFlagCriteria(scene)">{{ sceneFlagCriteria(scene) }}</small>
                </button>
                <div class="scene-row-actions">
                  <button
                    type="button"
                    class="sm muted"
                    :disabled="scene.id === selectedStoryBeat.scene"
                    @click="setPrimaryScene(scene)"
                  >
                    Make primary
                  </button>
                  <button type="button" class="sm muted" @click="moveScene(scene, -1)">Up</button>
                  <button type="button" class="sm muted" @click="moveScene(scene, 1)">Down</button>
                  <button type="button" class="sm muted" @click="removeScene(scene)">Remove</button>
                </div>
              </li>
            </ul>
            <p v-else class="empty-note">No scenes currently reference this story beat.</p>
            <article v-if="selectedScene" class="scene-preview">
              <p class="label">{{ selectedScene.id }}</p>
              <h3>{{ selectedScene.heading || "Untitled scene" }}</h3>
              <p>{{ selectedScene.text }}</p>
            </article>
          </div>
          <div class="two-col">
            <label>
              Next story beat
              <select :value="selectedStoryBeat.next || ''" @change="updateStoryBeat('next', $event.target.value)">
                <option value="">None</option>
                <option v-for="beat in selectedStoryArc.beats ?? []" :key="beat.id" :value="beat.id">{{ beat.id }}</option>
              </select>
            </label>
            <label>
              Next story arc
              <select :value="selectedStoryBeat.nextArc || ''" @change="updateStoryBeat('nextArc', $event.target.value)">
                <option value="">None</option>
                <option v-for="arc in storyArcs" :key="arc.id" :value="arc.id">{{ arc.title || arc.id }}</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset v-if="selectedStoryBeat">
          <legend>Movement references</legend>
          <div class="two-col">
            <label>
              Hexes
              <select multiple :value="selectedStoryBeat.allowed?.movement?.hexes ?? []" @change="updateAllowed('movement.hexes', selectedOptions($event))">
                <option v-for="hex in world.hexes ?? []" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
              </select>
            </label>
            <label>
              Rooms
              <select multiple :value="selectedStoryBeat.allowed?.movement?.rooms ?? []" @change="updateAllowed('movement.rooms', selectedOptions($event))">
                <option v-for="room in world.rooms ?? []" :key="room.id" :value="room.id">{{ room.label }} ({{ room.id }})</option>
              </select>
            </label>
            <label>
              Exterior nodes
              <select multiple :value="selectedStoryBeat.allowed?.movement?.exteriorNodes ?? []" @change="updateAllowed('movement.exteriorNodes', selectedOptions($event))">
                <option v-for="node in world.exteriorNodes ?? []" :key="node.id" :value="node.id">{{ node.label }} ({{ node.id }})</option>
              </select>
            </label>
            <label>
              Transitions
              <select multiple :value="selectedStoryBeat.allowed?.movement?.transitions ?? []" @change="updateAllowed('movement.transitions', selectedOptions($event))">
                <option v-for="transition in world.mapTransitions ?? []" :key="transition.id" :value="transition.id">{{ transition.label }} ({{ transition.id }})</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset v-if="selectedStoryBeat">
          <legend>Authored actions and views</legend>
          <label>
            Story beat actions
            <input :value="csv(selectedStoryBeat.allowed?.storyForwardActions)" @input="updateAllowed('storyForwardActions', csvList($event.target.value))">
          </label>
          <label>
            Optional actions
            <input :value="csv(selectedStoryBeat.allowed?.optionalActions)" @input="updateAllowed('optionalActions', csvList($event.target.value))">
          </label>
          <div class="two-col">
            <label>
              Story choices
              <input :value="csv(selectedStoryBeat.allowed?.storyChoices)" @input="updateAllowed('storyChoices', csvList($event.target.value))">
            </label>
            <label>
              Indoor actions
              <input :value="csv(selectedStoryBeat.allowed?.indoorActions)" @input="updateAllowed('indoorActions', csvList($event.target.value))">
            </label>
            <label>
              Outdoor actions
              <input :value="csv(selectedStoryBeat.allowed?.outdoorActions)" @input="updateAllowed('outdoorActions', csvList($event.target.value))">
            </label>
            <label>
              Item actions
              <input :value="csv(selectedStoryBeat.allowed?.itemActions)" @input="updateAllowed('itemActions', csvList($event.target.value))">
            </label>
            <label>
              Developer actions
              <input :value="csv(selectedStoryBeat.allowed?.developerActions)" @input="updateAllowed('developerActions', csvList($event.target.value))">
            </label>
          </div>
          <div class="stage-view-row" v-for="(view, index) in selectedStoryBeat.allowed?.stageViews ?? []" :key="index">
            <select :value="view.kind" @change="updateStageView(index, 'kind', $event.target.value)">
              <option value="inventory">Inventory</option>
              <option value="character">Character</option>
              <option value="document">Document</option>
              <option value="lesson">Lesson</option>
              <option value="console">Console</option>
              <option value="simulation">Simulation</option>
              <option value="closeup">Close-up</option>
            </select>
            <select
              v-if="view.kind === 'lesson'"
              :value="view.id || ''"
              @change="updateStageView(index, 'id', $event.target.value)"
            >
              <option value="">Any lesson</option>
              <option v-for="lesson in lessonOptions" :key="lesson.id" :value="lesson.id">{{ lesson.title || lesson.id }}</option>
            </select>
            <select
              v-else-if="view.kind === 'document'"
              :value="view.id || ''"
              @change="updateStageView(index, 'id', $event.target.value)"
            >
              <option value="">Any document</option>
              <option v-for="document in documentOptions" :key="document.id" :value="document.id">{{ document.label || document.title || document.id }}</option>
            </select>
            <input v-else :value="view.id || ''" placeholder="id" @input="updateStageView(index, 'id', $event.target.value)">
            <button type="button" class="sm muted" @click="removeStageView(index)">Remove</button>
          </div>
          <button type="button" class="sm muted" @click="addStageView">Add view</button>
        </fieldset>

        <fieldset v-if="selectedStoryBeat">
          <legend>Completion condition</legend>
          <label>
            Completion condition
            <select :value="currentCompletionFamily" @change="updateCompletionFamily($event.target.value)">
              <option value="">None</option>
              <option value="flag">Flag</option>
              <option value="facility">Facility</option>
              <option value="location">Location</option>
              <option value="holding">Holding</option>
              <option value="lesson">Lesson</option>
            </select>
          </label>
          <input
            v-if="currentCompletionFamily === 'flag'"
            :value="selectedStoryBeat.completesWhen?.flag || ''"
            @input="updateCompletion('flag', $event.target.value)"
          >
          <div v-else-if="currentCompletionFamily === 'location'" class="two-col">
            <label>
              Hex
              <select :value="selectedStoryBeat.completesWhen?.location?.hex || ''" @change="updateCompletion('location.hex', $event.target.value)">
                <option value="">None</option>
                <option v-for="hex in world.hexes ?? []" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
              </select>
            </label>
            <label>
              Room
              <select :value="selectedStoryBeat.completesWhen?.location?.room || ''" @change="updateCompletion('location.room', $event.target.value)">
                <option value="">None</option>
                <option v-for="room in world.rooms ?? []" :key="room.id" :value="room.id">{{ room.label }} ({{ room.id }})</option>
              </select>
            </label>
          </div>
          <div v-else-if="currentCompletionFamily === 'holding'" class="two-col">
            <label>
              Item
              <select :value="selectedStoryBeat.completesWhen?.holding?.item || ''" @change="updateCompletion('holding.item', $event.target.value)">
                <option value="">None</option>
                <option v-for="item in itemOptions" :key="item.id" :value="item.id">{{ item.label || item.id }}</option>
              </select>
            </label>
            <label>
              Holder
              <input :value="selectedStoryBeat.completesWhen?.holding?.holder || ''" @input="updateCompletion('holding.holder', $event.target.value)">
            </label>
          </div>
          <div v-else-if="currentCompletionFamily === 'lesson'" class="two-col">
            <label>
              Lesson
              <select :value="selectedStoryBeat.completesWhen?.lesson?.id || ''" @change="updateCompletion('lesson.id', $event.target.value)">
                <option value="">None</option>
                <option v-for="lesson in lessonOptions" :key="lesson.id" :value="lesson.id">{{ lesson.title || lesson.id }}</option>
              </select>
            </label>
            <label>
              Status
              <select :value="selectedStoryBeat.completesWhen?.lesson?.status || 'completed'" @change="updateCompletion('lesson.status', $event.target.value)">
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
          <label v-else-if="currentCompletionFamily === 'facility'">
            Facility condition JSON
            <input
              :value="JSON.stringify(selectedStoryBeat.completesWhen?.facility ?? {})"
              @input="updateFacilityPredicate($event.target.value)"
            >
          </label>
        </fieldset>

        <fieldset v-if="selectedStoryBeat">
          <legend>Beat effects</legend>
          <label>
            On enter
            <textarea
              class="compact-textarea"
              :value="JSON.stringify(selectedStoryBeat.onEnter ?? null, null, 2)"
              rows="6"
              @input="updateBeatEffectJson('onEnter', $event.target.value)"
            />
          </label>
          <label>
            On complete
            <textarea
              class="compact-textarea"
              :value="JSON.stringify(selectedStoryBeat.onComplete ?? null, null, 2)"
              rows="6"
              @input="updateBeatEffectJson('onComplete', $event.target.value)"
            />
          </label>
        </fieldset>

        <fieldset v-if="selectedStoryBeat">
          <legend>Active beat preview</legend>
          <ul v-if="previewActions.length" class="preview-list">
            <li v-for="action in previewActions" :key="`${action.group}:${action.id}`">
              <span>{{ action.group }}</span>
              <strong>{{ action.label }}</strong>
              <small>{{ action.id }}</small>
            </li>
          </ul>
          <p v-else class="empty-note">No preview actions for this story beat.</p>
        </fieldset>
      </div>

      <details class="json-details">
        <summary>Document JSON</summary>
      <textarea
        :value="documentText"
        rows="26"
        spellcheck="false"
        @input="$emit('update:documentText', $event.target.value)"
      />
      </details>
      <div v-if="errorEntries(errors).length" class="validation-list">
        <p v-for="entry in errorEntries(errors)" :key="`${entry.path}:${entry.message}`" class="field-error">
          <strong>{{ entry.path }}</strong>: {{ entry.message }}
        </p>
      </div>
    </form>
  </section>
</template>

<style scoped>
.arc-panel {
  display: grid;
  grid-template-columns: minmax(320px, 0.75fr) minmax(480px, 1.25fr);
  gap: 1rem;
  height: calc(100% - 3rem);
  min-height: 0;
  margin-top: 0.75rem;
}
.panel {
  min-height: 0;
  overflow: auto;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #20252f;
  padding: 1rem;
}
.arc-heading,
.arc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.arc-actions {
  justify-content: flex-end;
}
h2,
p {
  margin: 0;
}
.label {
  color: #8e96a3;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.builder-status {
  color: #9fc7ff;
  margin-top: 0.75rem;
}
.arc-list,
.beat-list,
.scene-list {
  display: grid;
  gap: 0.7rem;
  padding: 0;
  margin: 1rem 0 0;
  list-style: none;
}
.arc-card {
  display: grid;
  gap: 0.55rem;
  border: 1px solid #3d485b;
  border-radius: 8px;
  background: #1b2029;
  padding: 0.75rem;
}
.arc-card strong,
.arc-card span,
.beat-list span {
  display: block;
}
.arc-card span,
.beat-list small,
.empty-note {
  color: #9aa4b5;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}
dl div {
  border: 1px solid #354052;
  border-radius: 7px;
  padding: 0.45rem;
}
dt {
  color: #8e96a3;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
dd {
  margin: 0.15rem 0 0;
}
.beat-list li {
  border-top: 1px solid #313a49;
  padding-top: 0.5rem;
  cursor: pointer;
}
.beat-list li.active {
  border-color: #7290b5;
  background: #263142;
  border-radius: 7px;
  padding: 0.5rem;
}
textarea {
  width: 100%;
  min-height: 0;
  margin-top: 0.85rem;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.75rem;
  font: 0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: vertical;
}
.structured-editor {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.85rem;
}
fieldset {
  display: grid;
  gap: 0.65rem;
  border: 1px solid #354052;
  border-radius: 8px;
  padding: 0.75rem;
  margin: 0;
}
legend {
  color: #c9d3e4;
  font-weight: 700;
  padding: 0 0.35rem;
}
label {
  display: grid;
  gap: 0.3rem;
  color: #aeb8c9;
  font-size: 0.78rem;
  font-weight: 700;
}
input,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.45rem 0.55rem;
  font: inherit;
}
select[multiple] {
  min-height: 8rem;
}
.compact-textarea {
  min-height: 4.6rem;
  margin-top: 0;
  font: inherit;
}
.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}
.stage-view-row {
  display: grid;
  grid-template-columns: minmax(8rem, 0.7fr) minmax(10rem, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
}
.scene-panel {
  display: grid;
  gap: 0.55rem;
  border: 1px solid #354052;
  border-radius: 7px;
  padding: 0.65rem;
}
.scene-panel-heading,
.scene-select {
  display: flex;
  justify-content: space-between;
  gap: 0.65rem;
  align-items: center;
}
.scene-heading-actions,
.scene-row-actions {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.scene-panel-heading h3,
.scene-preview h3 {
  margin: 0;
}
.scene-panel-heading span,
.scene-select span {
  color: #9aa4b5;
}
.scene-list {
  margin-top: 0;
}
.scene-list li {
  border: 1px solid #313a49;
  border-radius: 7px;
  display: grid;
  gap: 0.35rem;
  padding: 0.35rem;
}
.scene-list li.primary {
  border-color: #7290b5;
  background: #263142;
}
.scene-select {
  width: 100%;
  border: 0;
  background: transparent;
  color: #eef1f5;
  padding: 0.45rem 0.55rem;
  text-align: left;
}
.scene-preview {
  display: grid;
  gap: 0.35rem;
  border-top: 1px solid #313a49;
  padding-top: 0.55rem;
}
.scene-preview p:last-child {
  color: #c9d3e4;
  line-height: 1.45;
}
.preview-list {
  display: grid;
  gap: 0.45rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.preview-list li {
  display: grid;
  grid-template-columns: minmax(8rem, 0.7fr) minmax(10rem, 1fr) minmax(8rem, 0.8fr);
  gap: 0.5rem;
  align-items: center;
  border: 1px solid #313a49;
  border-radius: 7px;
  padding: 0.45rem 0.55rem;
}
.preview-list span,
.preview-list small {
  color: #9aa4b5;
}
.json-details {
  margin-top: 0.85rem;
}
.json-details summary {
  color: #c9d3e4;
  cursor: pointer;
  font-weight: 700;
}
.dirty-pill,
.saved-pill {
  border-radius: 99px;
  padding: 0.25rem 0.55rem;
  font-size: 0.75rem;
}
.dirty-pill {
  background: #6d5625;
  color: #ffe19a;
}
.saved-pill {
  background: #294d35;
  color: #bce8c7;
}
.field-error {
  color: #ff9e9e;
  font-size: 0.78rem;
}
.validation-list {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
}
@media (max-width: 900px) {
  .arc-panel {
    grid-template-columns: 1fr;
  }
  .two-col,
  .stage-view-row,
  .preview-list li {
    grid-template-columns: 1fr;
  }
}
</style>
