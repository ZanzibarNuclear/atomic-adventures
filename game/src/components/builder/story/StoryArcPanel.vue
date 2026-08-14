<script setup>
import { computed, ref, watch } from "vue";
import { moveStoryBeat, splitStoryBeat } from "../../../lib/story/storyArcOperations.js";
import StoryCompletionCard from "../../story/StoryCompletionCard.vue";
import ConfirmDialog from "../ConfirmDialog.vue";
import { useConfirmDialog } from "../../../composables/useConfirmDialog.js";

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
  "attach-scene",
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
const editId = ref("");
const editError = ref("");
const moveDialog = ref(null);
const operationError = ref("");
const splitDialog = ref(null);
const draggedBeat = ref(null);
const attachDialog = ref(null);
const attachRoomFilter = ref("");
const attachUnattachedOnly = ref(true);
const completionEditing = ref(false);
const completionDraft = ref(null);
const deleteConfirm = useConfirmDialog();
const completionError = ref("");

const selectedStoryArc = computed(() =>
  storyArcs.value.find((arc) => arc.id === selection.value.arcId) ?? null,
);
const selectedStoryBeat = computed(() => {
  if (selection.value.kind !== "beat") return null;
  return selectedStoryArc.value?.beats?.find((beat) => beat.id === selection.value.beatId) ?? null;
});
const isSelectingCompletion = computed(() =>
  selection.value.kind === "completion" && Boolean(selectedStoryArc.value),
);
const selectedBeatIndex = computed(() =>
  selectedStoryArc.value?.beats?.findIndex((beat) => beat.id === selectedStoryBeat.value?.id) ?? -1,
);
const linkedScenes = computed(() => {
  if (!selectedStoryBeat.value) return [];
  return props.beats.filter((scene) =>
    scene.id === selectedStoryBeat.value.scene || scene.storyBeat === selectedStoryBeat.value.id,
  );
});
const validationEntries = computed(() => errorEntries(props.errors));
const attachableScenes = computed(() => {
  const linkedIds = new Set(linkedScenes.value.map((scene) => scene.id));
  return props.beats.filter((scene) => !linkedIds.has(scene.id));
});
const attachRoomOptions = computed(() =>
  [...new Set(attachableScenes.value.map((scene) => scene.trigger?.room).filter(Boolean))]
    .sort()
    .map((id) => ({ id, label: labelFor(props.catalog?.world?.rooms, id) })),
);
const filteredAttachableScenes = computed(() =>
  attachableScenes.value
    .filter((scene) => !attachRoomFilter.value || scene.trigger?.room === attachRoomFilter.value)
    .filter((scene) => !attachUnattachedOnly.value || !scene.storyBeat),
);

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

watch(selection, () => {
  completionEditing.value = false;
  completionDraft.value = null;
  completionError.value = "";
});

watch(filteredAttachableScenes, (scenes) => {
  if (!attachDialog.value) return;
  if (scenes.some((scene) => scene.id === attachDialog.value.sceneId)) return;
  attachDialog.value.sceneId = scenes[0]?.id ?? "";
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

function selectCompletion(arcId) {
  if (editing.value && !window.confirm("Discard the title edit?")) return;
  editing.value = false;
  selection.value = { kind: "completion", arcId, beatId: "" };
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
  editId.value = item.id ?? "";
  editError.value = "";
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  editTitle.value = "";
  editId.value = "";
  editError.value = "";
}

function applyEdit() {
  const ids = { arcId: selectedStoryArc.value?.id, beatId: selectedStoryBeat.value?.id };
  const nextId = editId.value.trim();
  if (!ids.beatId) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextId)) {
      editError.value = "Use a kebab-case ID containing lowercase letters, numbers, and hyphens.";
      return;
    }
    if (storyArcs.value.some((arc) => arc.id === nextId && arc.id !== ids.arcId)) {
      editError.value = "That story arc ID already exists.";
      return;
    }
  }
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === ids.arcId);
    const target = ids.beatId ? arc?.beats?.find((item) => item.id === ids.beatId) : arc;
    if (target) target.title = editTitle.value.trim();
    if (!ids.beatId && arc && nextId !== ids.arcId) {
      arc.id = nextId;
      for (const storyArc of document.storyArcs ?? []) {
        if (storyArc.completion?.nextArc === ids.arcId) storyArc.completion.nextArc = nextId;
      }
      selection.value = { kind: "arc", arcId: nextId, beatId: "" };
    }
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

function completionSummary(arc) {
  if (arc.completion?.card?.heading) return arc.completion.card.heading;
  return arc.completion?.nextArc ? `Continue to ${arc.completion.nextArc}` : "No transition card";
}

function beginCompletionEdit() {
  const completion = selectedStoryArc.value?.completion ?? {};
  const card = completion.card ?? {};
  completionDraft.value = {
    nextArc: completion.nextArc ?? "",
    showCard: Boolean(completion.card),
    eyebrow: card.eyebrow ?? "",
    heading: card.heading ?? "",
    description: card.description ?? "",
    note: card.note ?? "",
    actionLabel: card.actionLabel ?? "Continue",
  };
  completionError.value = "";
  completionEditing.value = true;
}

function cancelCompletionEdit() {
  completionEditing.value = false;
  completionDraft.value = null;
  completionError.value = "";
}

function addCompletionCard() {
  if (!completionDraft.value) return;
  completionDraft.value.showCard = true;
}

function removeCompletionCard() {
  if (!completionDraft.value) return;
  completionDraft.value.showCard = false;
}

function applyCompletionEdit() {
  const arcId = selectedStoryArc.value?.id;
  const draft = completionDraft.value;
  if (!arcId || !draft) return;
  const fields = ["eyebrow", "heading", "description", "actionLabel"];
  if (draft.showCard && fields.some((field) => !draft[field].trim())) {
    completionError.value = "Fill in the day label, heading, description, and button label.";
    return;
  }
  updateDocument((document) => {
    const arc = document.storyArcs?.find((item) => item.id === arcId);
    if (!arc) return;
    const nextArc = draft.nextArc || null;
    const card = draft.showCard ? {
      eyebrow: draft.eyebrow.trim(),
      heading: draft.heading.trim(),
      description: draft.description.trim(),
      note: draft.note.trim() || null,
      actionLabel: draft.actionLabel.trim(),
    } : null;
    arc.completion = nextArc || card ? { nextArc, card } : null;
  });
  cancelCompletionEdit();
}

async function removeStoryBeat() {
  const arcId = selectedStoryArc.value?.id;
  const beatId = selectedStoryBeat.value?.id;
  if (!arcId || !beatId) return;
  const ok = await deleteConfirm.requestConfirm({
    eyebrow: "Delete beat",
    title: `Delete story beat “${beatId}”?`,
    message: "Linked scenes will not be deleted. They stay in the story area and can be reattached later.",
    confirmLabel: "Delete beat",
    danger: true,
  });
  if (!ok) return;
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

function requestAttachScene() {
  attachRoomFilter.value = "";
  attachUnattachedOnly.value = true;
  attachDialog.value = { sceneId: filteredAttachableScenes.value[0]?.id ?? "" };
}

function applyAttachScene() {
  if (!attachDialog.value?.sceneId) return;
  const scene = filteredAttachableScenes.value.find((item) => item.id === attachDialog.value.sceneId);
  if (!scene) return;
  emit("attach-scene", {
    arcId: selectedStoryArc.value?.id,
    beatId: selectedStoryBeat.value?.id,
    sceneId: scene.id,
    scene,
  });
  attachDialog.value = null;
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
  if (trigger.room) {
    const roomLabel = labelFor(props.catalog?.world?.rooms, trigger.room);
    return trigger.stand ? `${roomLabel} · ${trigger.stand}` : roomLabel;
  }
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
        <button type="button" class="sm add-btn" @click="addStoryArc">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
          </svg>
          Add arc
        </button>
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
            <li class="completion-row">
              <button
                type="button"
                class="completion-select"
                :class="{ selected: selection.kind === 'completion' && selection.arcId === arc.id }"
                @click="selectCompletion(arc.id)">
                <span class="beat-position">✓</span>
                <span class="beat-copy"><strong>Arc completion</strong><small>{{ completionSummary(arc) }}</small></span>
                <span class="scene-count">transition</span>
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
          <p class="label">{{ selectedStoryBeat ? "Story beat" : isSelectingCompletion ? "Arc completion" : "Story arc" }}</p>
          <h2>{{ selectedStoryBeat?.title || (isSelectingCompletion ? `${selectedStoryArc?.title || "Story arc"} completion` : selectedStoryArc?.title) || "Select an arc" }}</h2>
        </div>
        <div class="toolbar">
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <button type="button" class="sm muted" :disabled="!dirty" @click="$emit('revert')">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            Revert
          </button>
          <button type="button" class="sm muted" @click="$emit('reload')">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M20 4.5v5h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 14.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M4 19.5v-5h5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            Reload
          </button>
          <button type="button" class="sm success-btn" :disabled="!dirty || Boolean(parseError)" @click="$emit('save')">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 4h11l3 3v13H5V4z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round" />
              <path
                d="M8 4v5h8V4M8 20v-7h8v7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round" />
            </svg>
            Save all
          </button>
        </div>
      </header>

      <template v-if="selectedStoryArc">
        <form v-if="editing" class="title-editor" @submit.prevent="applyEdit">
          <label v-if="!selectedStoryBeat">ID <input v-model="editId" class="arc-id-input" autofocus></label>
          <label>{{ selectedStoryBeat ? "Title" : "Label" }} <input v-model="editTitle" :autofocus="Boolean(selectedStoryBeat)"></label>
          <p v-if="editError" class="field-error">{{ editError }}</p>
          <div class="toolbar">
            <button type="button" class="sm muted" @click="cancelEdit">Cancel</button>
            <button type="submit" class="sm success-btn">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Apply
            </button>
          </div>
        </form>

        <article v-else-if="isSelectingCompletion" class="object-detail">
          <template v-if="completionEditing && completionDraft">
            <form class="completion-editor" @submit.prevent="applyCompletionEdit">
              <p class="dialog-note">The final beat determines when this arc ends. This node chooses the next arc and what the player sees at the transition.</p>
              <label>Next story arc
                <select v-model="completionDraft.nextArc">
                  <option value="">End the story here</option>
                  <option v-for="arc in storyArcs.filter(arc => arc.id !== selectedStoryArc.id)" :key="arc.id" :value="arc.id">{{ arc.title || arc.id }}</option>
                </select>
              </label>
              <button
                v-if="completionDraft.showCard"
                type="button"
                class="sm danger"
                @click="removeCompletionCard">
                <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                </svg>
                Remove completion card
              </button>
              <button
                v-else
                type="button"
                class="sm add-btn"
                @click="addCompletionCard">
                <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                </svg>
                Add completion card
              </button>
              <template v-if="completionDraft.showCard">
                <label>Day or chapter label <input v-model="completionDraft.eyebrow"></label>
                <label>Heading <input v-model="completionDraft.heading"></label>
                <label>Description <textarea v-model="completionDraft.description" rows="4"></textarea></label>
                <label>Closing line <input v-model="completionDraft.note"></label>
                <label>Button label <input v-model="completionDraft.actionLabel"></label>
              </template>
              <p v-if="completionError" class="field-error">{{ completionError }}</p>
              <div class="toolbar">
                <button type="button" class="sm muted" @click="cancelCompletionEdit">Cancel</button>
                <button type="submit" class="sm success-btn">
                  <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Apply completion
                </button>
              </div>
            </form>
          </template>
          <template v-else>
            <div class="detail-actions">
              <button type="button" class="sm edit-btn" @click="beginCompletionEdit">
                <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                  <path d="M12.5 6.5 17.5 11.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                </svg>
                Edit completion
              </button>
            </div>
            <div v-if="selectedStoryArc.completion?.card" class="completion-preview">
              <StoryCompletionCard :card="selectedStoryArc.completion.card" />
            </div>
            <p v-else class="empty-note">No transition card is shown.</p>
          </template>
        </article>

        <article v-else-if="!selectedStoryBeat" class="object-detail">
          <div class="detail-actions">
            <button type="button" class="sm edit-btn" @click="beginEdit">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                <path d="M12.5 6.5 17.5 11.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              Edit arc
            </button>
            <button type="button" class="sm add-btn" @click="addStoryBeat">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
              Add beat
            </button>
          </div>
          <dl class="metadata">
            <div><dt>ID</dt><dd>{{ selectedStoryArc.id }}</dd></div>
          </dl>
        </article>

        <article v-else class="object-detail">
          <div class="detail-actions">
            <button type="button" class="sm edit-btn" @click="beginEdit">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                <path d="M12.5 6.5 17.5 11.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              Edit title
            </button>
            <button type="button" class="sm muted" @click="requestMove">Move beat</button>
            <button type="button" class="sm muted" :disabled="linkedScenes.length < 2" @click="requestSplit">Split beat</button>
            <button type="button" class="sm muted" :disabled="!attachableScenes.length" @click="requestAttachScene">Attach scene</button>
            <button type="button" class="sm add-btn" @click="addScene">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
              Add scene
            </button>
            <button type="button" class="sm danger" @click="removeStoryBeat">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
              </svg>
              Delete beat
            </button>
          </div>
          <dl class="metadata">
            <div><dt>ID</dt><dd>{{ selectedStoryBeat.id }}</dd></div>
          </dl>
          <section class="scenes-section">
            <header><div><p class="label">Linked content</p><h3>Scenes</h3></div><span>{{ linkedScenes.length }}</span></header>
            <ol v-if="linkedScenes.length" class="scene-list">
              <li v-for="scene in linkedScenes" :key="scene.id">
                <button type="button" class="scene-select" @click="$emit('select-scene', { arcId: selectedStoryArc.id, beatId: selectedStoryBeat.id, sceneId: scene.id })">
                  <strong>{{ scene.heading || scene.id }}</strong>
                  <span>{{ sceneLocation(scene) }}</span>
                  <p>{{ scene.text }}</p>
                  <small>Open in scene editor</small>
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
        <div class="toolbar">
          <button type="button" class="sm muted" @click="moveDialog = null">Cancel</button>
          <button type="submit" class="sm success-btn">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Move beat
          </button>
        </div>
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
        <div class="toolbar">
          <button type="button" class="sm muted" @click="splitDialog = null">Cancel</button>
          <button type="submit" class="sm success-btn">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Split beat
          </button>
        </div>
      </form>
    </div>
    <div v-if="attachDialog" class="dialog-backdrop" @click.self="attachDialog = null">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="attach-dialog-title" @submit.prevent="applyAttachScene">
        <p class="label">Existing content</p>
        <h2 id="attach-dialog-title">Attach scene</h2>
        <div class="attach-scene-filters">
          <label>Room
            <select v-model="attachRoomFilter" class="attach-room-filter">
              <option value="">Any room or location</option>
              <option v-for="room in attachRoomOptions" :key="room.id" :value="room.id">{{ room.label }}</option>
            </select>
          </label>
          <label class="check-row attach-unattached-filter">
            <input v-model="attachUnattachedOnly" type="checkbox">
            Only unattached scenes
          </label>
        </div>
        <p class="dialog-note">{{ filteredAttachableScenes.length }} matching scene{{ filteredAttachableScenes.length === 1 ? "" : "s" }}.</p>
        <label>Scene
          <select v-model="attachDialog.sceneId" class="attach-scene-select" :disabled="!filteredAttachableScenes.length">
            <option v-for="scene in filteredAttachableScenes" :key="scene.id" :value="scene.id">
              {{ scene.heading || scene.id }} — {{ sceneLocation(scene) }}{{ scene.storyBeat ? ` (currently ${scene.storyBeat})` : " (unattached)" }}
            </option>
          </select>
        </label>
        <p class="dialog-note">Attaching changes this scene's story beat. Its prose, trigger, choices, and other scene details stay unchanged.</p>
        <div class="toolbar">
          <button type="button" class="sm muted" @click="attachDialog = null">Cancel</button>
          <button type="submit" class="sm success-btn" :disabled="!attachDialog.sceneId">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Attach scene
          </button>
        </div>
      </form>
    </div>

    <ConfirmDialog
      :visible="deleteConfirm.state.visible"
      :eyebrow="deleteConfirm.state.eyebrow"
      :title="deleteConfirm.state.title"
      :message="deleteConfirm.state.message"
      :confirm-label="deleteConfirm.state.confirmLabel"
      :cancel-label="deleteConfirm.state.cancelLabel"
      :danger="deleteConfirm.state.danger"
      @confirm="deleteConfirm.accept"
      @cancel="deleteConfirm.dismiss"
    />
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
.arc-row-main.selected, .beat-select.selected, .completion-select.selected { background: #323b4a; box-shadow: inset 3px 0 #d9a441; }
.disclosure, .outline-select, .beat-select, .completion-select, .scene-select { border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.disclosure { padding: .65rem; }
.outline-select { display: flex; justify-content: space-between; gap: .5rem; padding: .7rem .35rem; width: 100%; }
.outline-select span, .scene-count { color: #9ba4b2; font-size: .78rem; }
.beat-list { margin: .15rem 0 .4rem 1.4rem; border-left: 1px solid #3b4555; }
.beat-select { width: 100%; display: grid; grid-template-columns: 1.8rem 1fr auto auto; align-items: center; gap: .5rem; padding: .65rem .6rem; border-radius: 6px; }
.completion-row { border-top: 1px dashed #4a5668; margin-top: .25rem; padding-top: .25rem; }
.completion-select { width: 100%; display: grid; grid-template-columns: 1.8rem 1fr auto; align-items: center; gap: .5rem; padding: .65rem .6rem; border-radius: 6px; }
.beat-position { color: #8e96a3; font-variant-numeric: tabular-nums; }
.beat-copy { display: grid; gap: .16rem; }
.beat-copy small { color: #8e96a3; }
.warning-badge { margin-right: .5rem; min-width: 1.35rem; border-radius: 99px; background: #8d4b42; color: white; text-align: center; font-size: .72rem; padding: .15rem .35rem; }
.builder-status, .empty-note { color: #aeb6c3; margin-top: .75rem; }
.dirty-pill { border-radius: 99px; background: #705826; color: #f5d98f; padding: .2rem .55rem; font-size: .75rem; }
.object-detail, .title-editor, .completion-editor { margin-top: 1rem; }
.title-editor, .completion-editor { display: grid; gap: .8rem; max-width: 42rem; }
.title-editor label, .completion-editor label { display: grid; gap: .4rem; }
.title-editor input, .completion-editor input, .completion-editor select, .completion-editor textarea { width: 100%; }
.check-row { display: flex !important; align-items: center; gap: .5rem !important; }
.metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; margin: 1rem 0; }
.metadata div { border: 1px solid #343d4d; border-radius: 7px; padding: .7rem; }
.metadata dt { color: #8e96a3; font-size: .75rem; }
.metadata dd { margin: .25rem 0 0; }
.completion-preview { display: grid; justify-items: center; margin-top: 1rem; }
.scenes-section { border-top: 1px solid #343d4d; padding-top: 1rem; }
.scene-list { display: grid; gap: .65rem; }
.scene-list li { border: 1px solid #343d4d; border-radius: 8px; overflow: hidden; }
.scene-select { display: grid; gap: .3rem; width: 100%; padding: .85rem; }
.scene-select span { color: #9ba4b2; font-size: .8rem; }
.scene-select p { color: #c7cdd7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.scene-select small { color: #d9a441; font-size: .74rem; }
.validation-list { margin-top: 1rem; }
.field-error { color: #f3a69d; margin-top: .4rem; }
.danger { color: #ffc0b8; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1rem; background: rgb(8 11 16 / .72); }
.dialog { width: min(32rem, 100%); max-height: calc(100vh - 2rem); overflow: auto; display: grid; gap: .85rem; border: 1px solid #566175; border-radius: 10px; background: #20252f; padding: 1.2rem; box-shadow: 0 18px 60px rgb(0 0 0 / .45); }
.dialog label { display: grid; min-width: 0; gap: .35rem; }
.dialog select { width: 100%; min-width: 0; }
.attach-scene-filters { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: .75rem; }
.attach-unattached-filter { grid-template-columns: auto 1fr !important; align-items: center; padding-bottom: .45rem; }
.dialog-note { color: #aeb6c3; font-size: .86rem; }
.split-preview { display: grid; gap: .45rem; border: 1px solid #343d4d; border-radius: 7px; padding: .7rem; color: #c7cdd7; }
@media (max-width: 900px) { .arc-panel { grid-template-columns: 1fr; height: auto; } .panel { max-height: none; } .metadata { grid-template-columns: 1fr; } }
</style>
