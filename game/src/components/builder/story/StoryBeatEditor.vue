<script setup>
import { computed, nextTick, ref, watch } from "vue";
import RevisionHistoryPanel from "../RevisionHistoryPanel.vue";
import FlagListEditor from "./FlagListEditor.vue";
import StoryChoiceEditor from "./StoryChoiceEditor.vue";

const props = defineProps({
  draft: { type: Object, default: null },
  dirty: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  status: { type: String, default: "" },
  errors: { type: Object, default: () => ({}) },
  catalog: { type: Object, required: true },
  draftIsOutdoorHexBeat: { type: Boolean, default: false },
  showRevisions: { type: Boolean, default: false },
  revisions: { type: Array, default: () => [] },
  destinationType: { type: Function, required: true },
  selectedLocation: { type: String, default: "" },
  originHexOptions: { type: Array, default: () => [] },
  milestones: { type: Array, default: () => [] },
  flagIds: { type: Array, default: () => [] },
  /** Story-arc beat options: { id, label, arcTitle? }[] */
  storyBeatOptions: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "save",
  "revert",
  "history",
  "delete",
  "add-choice",
  "move-choice",
  "remove-choice",
  "set-csv",
  "set-destination-type",
  "set-view-kind",
  "restore-revision",
  "new-milestone",
  "set-milestone",
]);

const activeTab = ref("story");
const selectedOriginHex = ref("");
const editingLocationCriteria = ref(false);
const editingFlagCriteria = ref(false);
const editingTimeCriteria = ref(false);
const deleteConfirmOpen = ref(false);
/** Choice id that should open in edit mode (typically a just-added blank choice). */
const editingChoiceId = ref(null);

function selectTab(tab) {
  activeTab.value = tab;
  if (tab === "history" && !props.isNew && props.draft) {
    emit("history");
  }
}

function requestDelete() {
  if (props.isNew || !props.draft) return;
  deleteConfirmOpen.value = true;
}

function confirmDelete() {
  deleteConfirmOpen.value = false;
  emit("delete");
}

function addChoiceAndEdit() {
  emit("add-choice");
  nextTick(() => {
    const last = props.draft?.choices?.at(-1);
    editingChoiceId.value = last?.id ?? null;
  });
}

const selectedOriginHexes = computed(() =>
  Array.isArray(props.draft?.match?.originHex)
    ? props.draft.match.originHex
    : props.draft?.match?.originHex
      ? [props.draft.match.originHex]
      : [],
);

const availableOriginHexOptions = computed(() => {
  const selected = new Set(selectedOriginHexes.value);
  return props.originHexOptions.filter((hex) => !selected.has(hex.id));
});

const locationCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const match = props.draft.match ?? {};
  const summary = [];
  if (selectedOriginHexes.value.length) {
    summary.push(`Origin: ${selectedOriginHexes.value.map(hexLabel).join(", ")}`);
  }
  if (match.mapTransition) {
    summary.push(`Map transition: ${transitionLabel(match.mapTransition)}`);
  }
  if (match.transitionDirection) {
    summary.push(`Direction: ${directionLabel(match.transitionDirection)}`);
  }
  return summary;
});

const timeCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const time = props.draft.time ?? {};
  const summary = [];
  if (Array.isArray(time.days) && time.days.length) summary.push(`Day #: ${time.days.join(", ")}`);
  if (time.dayFrom != null) summary.push(`Day from: ${time.dayFrom}`);
  if (time.dayTo != null) summary.push(`Day to: ${time.dayTo}`);
  if (time.phase) summary.push(`Time of day: ${time.phase}`);
  if (time.elapsedFrom != null) summary.push(`Elapsed from: ${time.elapsedFrom}`);
  if (time.elapsedTo != null) summary.push(`Elapsed to: ${time.elapsedTo}`);
  if (time.afterMilestone) summary.push(`After: ${time.afterMilestone}`);
  if (time.beforeMilestone) summary.push(`Before: ${time.beforeMilestone}`);
  return summary;
});

const flagCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const flags = props.draft.conditions?.flags ?? {};
  const summary = [];
  if (Array.isArray(flags.all) && flags.all.length) summary.push(`Requires: ${flags.all.join(", ")}`);
  if (Array.isArray(flags.not) && flags.not.length) summary.push(`Absent: ${flags.not.join(", ")}`);
  return summary;
});

/** Beat picker options, including an orphan value still set on the scene. */
const storyBeatSelectOptions = computed(() => {
  const options = Array.isArray(props.storyBeatOptions) ? [...props.storyBeatOptions] : [];
  const current = props.draft?.storyBeat;
  if (current && !options.some((beat) => beat.id === current)) {
    options.unshift({
      id: current,
      label: `${current} (not in loaded arcs)`,
      arcTitle: null,
    });
  }
  return options;
});

const storyBeatOptionGroups = computed(() => {
  const groups = new Map();
  for (const beat of storyBeatSelectOptions.value) {
    const key = beat.arcTitle || "Story beats";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(beat);
  }
  return [...groups.entries()].map(([title, beats]) => ({ title, beats }));
});

function setStoryBeat(event) {
  if (!props.draft) return;
  const value = String(event?.target?.value ?? "").trim();
  props.draft.storyBeat = value || null;
}

const roomStandOptions = computed(() => {
  const roomId = props.draft?.trigger?.room;
  if (!roomId) return [];
  const room = (props.catalog?.world?.rooms ?? []).find((entry) => entry.id === roomId);
  return room?.stands ?? [];
});

watch(
  () => props.selectedLocation,
  () => {
    activeTab.value = "story";
    selectedOriginHex.value = "";
    editingLocationCriteria.value = false;
    editingFlagCriteria.value = false;
    editingTimeCriteria.value = false;
  },
);

watch(
  () => props.draft,
  () => {
    selectedOriginHex.value = "";
    editingLocationCriteria.value = false;
    editingFlagCriteria.value = false;
    editingTimeCriteria.value = false;
    editingChoiceId.value = null;
    if (activeTab.value === "history") {
      if (props.isNew || !props.draft) activeTab.value = "story";
      else emit("history");
    }
  },
);

function fieldError(path) {
  return props.errors[path]?.join(" ");
}

function setDayList(event) {
  props.draft.time.days = event.target.value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function setFlagList(group, value) {
  props.draft.conditions ??= {};
  props.draft.conditions.flags ??= { all: [], not: [] };
  props.draft.conditions.flags[group] = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
}

function milestoneLabel(id) {
  const milestone = props.milestones.find((item) => item.id === id);
  return milestone ? `${milestone.label} (${milestone.id})` : id;
}

function ensureOriginHexList() {
  props.draft.match.originHex = selectedOriginHexes.value;
}

function addOriginHex() {
  const id = selectedOriginHex.value;
  if (!id) return;
  ensureOriginHexList();
  if (!props.draft.match.originHex.includes(id)) {
    props.draft.match.originHex = [...props.draft.match.originHex, id];
  }
  selectedOriginHex.value = "";
}

function removeOriginHex(id) {
  ensureOriginHexList();
  props.draft.match.originHex = props.draft.match.originHex.filter((originId) => originId !== id);
}

function hexLabel(id) {
  const hex = props.catalog.world.hexes.find((item) => item.id === id);
  return hex ? `${hex.label} (${hex.id})` : id;
}

function transitionLabel(id) {
  const transition = (props.catalog.world.mapTransitions ?? []).find((item) => item.id === id);
  return transition ? `${transition.label} (${transition.id})` : id;
}

function directionLabel(value) {
  if (value === "toLocal") return "To local map";
  if (value === "toRegional") return "To regional map";
  return value;
}

function modeEnabled(mode) {
  return Array.isArray(props.draft?.modes) && props.draft.modes.includes(mode);
}

function setModeEnabled(mode, enabled) {
  if (!props.draft) return;
  const current = new Set(Array.isArray(props.draft.modes) ? props.draft.modes : []);
  if (enabled) current.add(mode);
  else current.delete(mode);
  props.draft.modes = [...current];
}
</script>

<template>
  <section class="builder-form-column panel">
    <div v-if="!draft" class="empty-editor">
      Select a scene or create a new one for this location.
    </div>
    <form v-else @submit.prevent="$emit('save')">
      <div class="form-toolbar">
        <div>
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <span v-else class="saved-pill">Saved</span>
        </div>
        <div class="toolbar-actions">
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
          <button
            v-if="!isNew"
            type="button"
            class="sm muted danger"
            @click="requestDelete">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round" />
            </svg>
            Delete
          </button>
          <button type="submit" class="sm success-btn" :disabled="!dirty">
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
            Save
          </button>
        </div>
      </div>

      <p v-if="status" class="builder-status">{{ status }}</p>
      <p v-for="message in errors.trigger ?? []" :key="message" class="field-error">{{ message }}</p>

      <div class="editor-tabs" role="tablist" aria-label="Scene editor sections">
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'story' }"
          role="tab"
          :aria-selected="activeTab === 'story'"
          @click="selectTab('story')"
        >
          Scene
        </button>
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'criteria' }"
          role="tab"
          :aria-selected="activeTab === 'criteria'"
          @click="selectTab('criteria')"
        >
          Criteria
        </button>
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'choices' }"
          role="tab"
          :aria-selected="activeTab === 'choices'"
          @click="selectTab('choices')"
        >
          Choices
        </button>
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'history' }"
          role="tab"
          :aria-selected="activeTab === 'history'"
          :disabled="isNew || !draft"
          @click="selectTab('history')"
        >
          History
        </button>
      </div>

      <div v-show="activeTab === 'story'" class="tab-panel" role="tabpanel">
        <div class="field-grid">
          <label>Scene ID
            <input v-model="draft.id" />
            <span v-if="fieldError('id')" class="field-error">{{ fieldError("id") }}</span>
          </label>
          <label>Eyebrow<input v-model="draft.eyebrow" /></label>
          <label>Heading<input v-model="draft.heading" /></label>
        </div>

        <label>Scene prose
          <textarea v-model="draft.text" rows="10" />
          <span v-if="fieldError('text')" class="field-error">{{ fieldError("text") }}</span>
        </label>
        <label>Revisit prose<textarea v-model="draft.revisit" rows="5" /></label>
      </div>

      <div v-show="activeTab === 'criteria'" class="tab-panel" role="tabpanel">
        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Mode and story beat</h3>
          </div>
          <div class="mode-grid">
            <label class="check-row">
              <input
                type="checkbox"
                :checked="modeEnabled('story')"
                @change="setModeEnabled('story', $event.target.checked)"
              />
              Story mode
            </label>
            <label class="check-row">
              <input
                type="checkbox"
                :checked="modeEnabled('open-world')"
                @change="setModeEnabled('open-world', $event.target.checked)"
              />
              Open-world mode
            </label>
            <label class="span-all">Story beat
              <select
                :value="draft.storyBeat ?? ''"
                @change="setStoryBeat"
              >
                <option value="">None (optional)</option>
                <optgroup
                  v-for="group in storyBeatOptionGroups"
                  :key="group.title"
                  :label="group.title"
                >
                  <option
                    v-for="beat in group.beats"
                    :key="beat.id"
                    :value="beat.id"
                  >
                    {{ beat.label }}
                  </option>
                </optgroup>
              </select>
              <span v-if="!storyBeatOptions.length" class="field-hint">
                Load story arcs to pick a beat ID from the list.
              </span>
              <span v-if="fieldError('storyBeat')" class="field-error">{{ fieldError("storyBeat") }}</span>
            </label>
            <label
              v-if="draft.trigger?.place === 'indoors' && draft.trigger?.room"
              class="span-all">
              Stand (leave blank for whole room)
              <select
                :value="draft.trigger.stand ?? ''"
                @change="draft.trigger.stand = $event.target.value || null">
                <option value="">Whole room (any stand)</option>
                <option
                  v-for="stand in roomStandOptions"
                  :key="stand.id"
                  :value="stand.id">
                  {{ stand.label || stand.id }} ({{ stand.id }})
                </option>
              </select>
              <span v-if="fieldError('trigger.stand')" class="field-error">{{ fieldError("trigger.stand") }}</span>
            </label>
          </div>
        </section>

        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Location based</h3>
            <button
              type="button"
              class="sm"
              :class="editingLocationCriteria ? 'success-btn' : 'edit-btn'"
              :aria-pressed="editingLocationCriteria"
              @click="editingLocationCriteria = !editingLocationCriteria"
            >
              <svg v-if="!editingLocationCriteria" class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
                <path
                  d="M12.5 6.5 17.5 11.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round" />
              </svg>
              <svg v-else class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12.5 9.5 17 19 7.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              {{ editingLocationCriteria ? "Done" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingLocationCriteria" class="criteria-readonly">
            <span
              v-for="item in locationCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!locationCriteriaSummary.length" class="empty-origin-list">No location criteria.</p>
          </div>

          <div v-else class="field-grid">
            <label v-if="draftIsOutdoorHexBeat" class="span-all">Origin hexes
              <div class="origin-picker">
                <div v-if="selectedOriginHexes.length" class="selected-origin-list">
                  <span v-for="hexId in selectedOriginHexes" :key="hexId" class="origin-chip">
                    {{ hexLabel(hexId) }}
                    <button type="button" class="chip-remove" :aria-label="`Remove origin hex ${hexId}`" @click="removeOriginHex(hexId)">x</button>
                  </span>
                </div>
                <p v-else class="empty-origin-list">Default: any adjacent origin.</p>
                <div class="origin-add-row">
                  <select v-model="selectedOriginHex">
                    <option value="">Specify an origin...</option>
                    <option v-for="hex in availableOriginHexOptions" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
                  </select>
                  <button type="button" class="sm add-btn" :disabled="!selectedOriginHex" @click="addOriginHex">
                    <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 5v14M5 12h14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.9"
                        stroke-linecap="round" />
                    </svg>
                    Add
                  </button>
                </div>
              </div>
              <span v-if="fieldError('match.originHex')" class="field-error">{{ fieldError("match.originHex") }}</span>
            </label>
            <label>Map transition
              <select v-model="draft.match.mapTransition">
                <option :value="null">Default</option>
                <option
                  v-for="transition in catalog.world.mapTransitions"
                  :key="transition.id"
                  :value="transition.id"
                >
                  {{ transition.label }} ({{ transition.id }})
                </option>
              </select>
              <span v-if="fieldError('match.mapTransition')" class="field-error">{{ fieldError("match.mapTransition") }}</span>
            </label>
            <label>Transition direction
              <select v-model="draft.match.transitionDirection">
                <option :value="null">Any direction</option>
                <option value="toLocal">To local map</option>
                <option value="toRegional">To regional map</option>
              </select>
              <span v-if="fieldError('match.transitionDirection')" class="field-error">{{ fieldError("match.transitionDirection") }}</span>
            </label>
          </div>
        </section>

        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Flag based</h3>
            <button
              type="button"
              class="sm"
              :class="editingFlagCriteria ? 'success-btn' : 'edit-btn'"
              :aria-pressed="editingFlagCriteria"
              @click="editingFlagCriteria = !editingFlagCriteria"
            >
              <svg v-if="!editingFlagCriteria" class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
                <path
                  d="M12.5 6.5 17.5 11.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round" />
              </svg>
              <svg v-else class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12.5 9.5 17 19 7.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              {{ editingFlagCriteria ? "Done" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingFlagCriteria" class="criteria-readonly">
            <span
              v-for="item in flagCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!flagCriteriaSummary.length" class="empty-origin-list">No flag criteria.</p>
          </div>

          <div v-else class="field-grid">
            <div class="span-all">
              <FlagListEditor
                :model-value="draft.conditions?.flags?.all ?? []"
                :flag-ids="flagIds"
                label="Required flags"
                placeholder="gate.inspected"
                @update:model-value="setFlagList('all', $event)"
              />
              <span v-if="fieldError('conditions.flags.all')" class="field-error">{{ fieldError("conditions.flags.all") }}</span>
            </div>
            <div class="span-all">
              <FlagListEditor
                :model-value="draft.conditions?.flags?.not ?? []"
                :flag-ids="flagIds"
                label="Absent flags"
                placeholder="gate.opened"
                @update:model-value="setFlagList('not', $event)"
              />
              <span v-if="fieldError('conditions.flags.not')" class="field-error">{{ fieldError("conditions.flags.not") }}</span>
            </div>
          </div>
        </section>

        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Time based</h3>
            <button
              type="button"
              class="sm"
              :class="editingTimeCriteria ? 'success-btn' : 'edit-btn'"
              :aria-pressed="editingTimeCriteria"
              @click="editingTimeCriteria = !editingTimeCriteria"
            >
              <svg v-if="!editingTimeCriteria" class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
                <path
                  d="M12.5 6.5 17.5 11.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round" />
              </svg>
              <svg v-else class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12.5 9.5 17 19 7.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              {{ editingTimeCriteria ? "Done" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingTimeCriteria" class="criteria-readonly">
            <span
              v-for="item in timeCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!timeCriteriaSummary.length" class="empty-origin-list">No time criteria.</p>
          </div>

          <div v-else class="field-grid">
            <label>Day #
              <input
                :value="draft.time.days.join(', ')"
                placeholder="1, 2"
                @input="setDayList"
              />
              <span v-if="fieldError('time.days')" class="field-error">{{ fieldError("time.days") }}</span>
            </label>
            <label>Time of day
              <select v-model="draft.time.phase">
                <option :value="null">Any</option>
                <option value="morning">morning</option>
                <option value="afternoon">afternoon</option>
                <option value="evening">evening</option>
                <option value="night">night</option>
              </select>
              <span v-if="fieldError('time.phase')" class="field-error">{{ fieldError("time.phase") }}</span>
            </label>
            <label>After milestone
              <select
                :value="draft.time.afterMilestone ?? ''"
                @change="$event.target.value === '__new__' ? $emit('new-milestone', { field: 'afterMilestone' }) : $emit('set-milestone', { field: 'afterMilestone', value: $event.target.value || null })"
              >
                <option value="">Any</option>
                <option v-for="milestone in milestones" :key="milestone.id" :value="milestone.id">
                  {{ milestone.label }} ({{ milestone.id }})
                </option>
                <option value="__new__">New milestone...</option>
              </select>
              <span v-if="draft.time.afterMilestone && !milestones.some((item) => item.id === draft.time.afterMilestone)" class="field-hint">
                {{ milestoneLabel(draft.time.afterMilestone) }}
              </span>
            </label>
            <label>Before milestone
              <select
                :value="draft.time.beforeMilestone ?? ''"
                @change="$event.target.value === '__new__' ? $emit('new-milestone', { field: 'beforeMilestone' }) : $emit('set-milestone', { field: 'beforeMilestone', value: $event.target.value || null })"
              >
                <option value="">Any</option>
                <option v-for="milestone in milestones" :key="milestone.id" :value="milestone.id">
                  {{ milestone.label }} ({{ milestone.id }})
                </option>
                <option value="__new__">New milestone...</option>
              </select>
              <span v-if="draft.time.beforeMilestone && !milestones.some((item) => item.id === draft.time.beforeMilestone)" class="field-hint">
                {{ milestoneLabel(draft.time.beforeMilestone) }}
              </span>
            </label>
          </div>
        </section>
      </div>

      <div v-show="activeTab === 'choices'" class="tab-panel" role="tabpanel">
        <fieldset>
          <legend>Scene choices</legend>
          <StoryChoiceEditor
            v-for="(choice, index) in draft.choices"
            :key="choice.id"
            :choice="choice"
            :index="index"
            :catalog="catalog"
            :errors="errors"
            :destination-type="destinationType"
            :flag-ids="flagIds"
            :start-editing="editingChoiceId === choice.id"
            @move="$emit('move-choice', { index, delta: $event })"
            @remove="$emit('remove-choice', index)"
            @set-csv="$emit('set-csv', $event)"
            @set-destination-type="$emit('set-destination-type', $event)"
            @set-view-kind="$emit('set-view-kind', $event)"
          />
          <div class="add-choice-row">
            <button type="button" class="sm add-btn" @click="addChoiceAndEdit">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round" />
              </svg>
              Add choice
            </button>
          </div>
        </fieldset>
      </div>

      <div v-show="activeTab === 'history'" class="tab-panel" role="tabpanel">
        <RevisionHistoryPanel
          class="revision-panel"
          :visible="true"
          title="Revision history"
          :revisions="revisions"
          @restore="$emit('restore-revision', $event)"
        />
      </div>
    </form>

    <div
      v-if="deleteConfirmOpen"
      class="confirm-backdrop"
      role="presentation"
      @click.self="deleteConfirmOpen = false">
      <section
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-scene-title">
        <p class="confirm-eyebrow">Delete scene</p>
        <h2 id="delete-scene-title">Delete “{{ draft?.id }}”?</h2>
        <p class="confirm-message">
          This removes the scene from the story area. Its revision history will remain available.
        </p>
        <div class="confirm-actions">
          <button type="button" class="sm muted danger" @click="confirmDelete">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round" />
            </svg>
            Delete
          </button>
          <button type="button" class="sm muted" @click="deleteConfirmOpen = false">Cancel</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid #343d4d;
  border-radius: 12px;
  background: #20252f;
  padding: 1rem;
  min-width: 0;
}

.add-choice-row {
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
}

.criteria-card-header > button[aria-pressed="true"] {
  box-shadow: 0 0 0 1px color-mix(in srgb, #6fd391 35%, transparent);
}

.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(8 12 18 / 0.55);
}

.confirm-dialog {
  width: min(28rem, 100%);
  padding: 1.1rem 1.15rem;
  border: 1px solid #4a5568;
  border-radius: 10px;
  background: #1b212b;
  color: #e8edf5;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.4);
}

.confirm-eyebrow {
  margin: 0 0 0.3rem;
  color: #ffb4b4;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.confirm-dialog h2 {
  margin: 0 0 0.55rem;
  font-size: 1.15rem;
  color: #f4f7fb;
}

.confirm-message {
  margin: 0 0 1rem;
  color: #b7c0cc;
  line-height: 1.45;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
}

.builder-form-column form,
.tab-panel,
fieldset {
  display: grid;
  gap: 0.8rem;
}

.form-toolbar,
.toolbar-actions,
.editor-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.toolbar-actions {
  justify-content: flex-end;
  gap: 0.45rem;
}

.editor-tabs {
  justify-content: flex-start;
  gap: 0.35rem;
  padding: 0.25rem;
  border: 1px solid #343d4d;
  border-radius: 9px;
  background: #171b22;
}

.editor-tabs button {
  border-color: transparent;
  background: transparent;
  color: #b8c0cc;
}

.editor-tabs button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7ef;
}

label {
  display: grid;
  gap: 0.35rem;
  color: #bfc5cf;
  font-size: 0.82rem;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.5rem 0.6rem;
  font: inherit;
}

textarea {
  resize: vertical;
  line-height: 1.5;
}

.criteria-card {
  display: grid;
  gap: 0.75rem;
  border: 1px solid #3b4557;
  border-radius: 8px;
  background: #1b2029;
  padding: 0.85rem;
}

.criteria-card-header,
.criteria-readonly {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.criteria-card-header {
  justify-content: space-between;
}

.criteria-card-header h3 {
  margin: 0;
  color: #e5ecf5;
  font-size: 0.98rem;
}

.criteria-readonly {
  flex-wrap: wrap;
  min-width: 0;
}

.summary-chip {
  border: 1px solid #465268;
  border-radius: 999px;
  background: #171b22;
  color: #c9d1dc;
  padding: 0.15rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid #3d485b;
  border-radius: 7px;
  background: #171b22;
  padding: 0.5rem 0.6rem;
}
.check-row input {
  width: auto;
}

.span-all {
  grid-column: 1 / -1;
}

.origin-picker {
  display: grid;
  gap: 0.55rem;
}

.selected-origin-list,
.origin-add-row {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  align-items: center;
}

.origin-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}

.origin-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #526072;
  border-radius: 999px;
  background: #242c38;
  color: #eef1f5;
  padding: 0.25rem 0.3rem 0.25rem 0.6rem;
}

.chip-remove {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  padding: 0;
  display: inline-grid;
  place-items: center;
  line-height: 1;
}

.empty-origin-list {
  margin: 0;
  color: #9aa4b5;
  font-size: 0.8rem;
}

fieldset {
  border: 1px solid #3b4557;
  border-radius: 9px;
  padding: 0.85rem;
}

legend {
  color: #8bc49a;
  padding: 0 0.35rem;
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

.builder-status {
  color: #9fc7ff;
  margin: 0;
}

.field-error {
  color: #ff9e9e;
  font-size: 0.78rem;
  margin: 0.2rem 0 0;
}

.field-hint {
  color: #aeb5c0;
  font-size: 0.78rem;
  margin: 0.2rem 0 0;
}

.revision-panel {
  display: grid;
  gap: 0.4rem;
}

.empty-editor {
  color: #9aa0ac;
  padding: 3rem 1rem;
  text-align: center;
}

@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .mode-grid {
    grid-template-columns: 1fr;
  }

  .origin-add-row {
    grid-template-columns: 1fr;
  }
}
</style>
