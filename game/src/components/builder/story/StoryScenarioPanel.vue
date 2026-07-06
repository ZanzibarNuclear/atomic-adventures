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

const emit = defineEmits(["update:documentText", "save", "revert", "reload"]);

const parsed = computed(() => {
  try {
    return JSON.parse(props.documentText || "{}");
  } catch {
    return null;
  }
});

const scenarios = computed(() => Array.isArray(parsed.value?.scenarios) ? parsed.value.scenarios : []);
const parseError = computed(() => parsed.value ? "" : "Storyline JSON is not valid.");
const selectedScenarioId = ref("");
const selectedStepId = ref("");
const selectedScenario = computed(() =>
  scenarios.value.find((scenario) => scenario.id === selectedScenarioId.value) ?? scenarios.value[0] ?? null,
);
const selectedStep = computed(() =>
  selectedScenario.value?.steps?.find((step) => step.id === selectedStepId.value) ??
  selectedScenario.value?.steps?.[0] ??
  null,
);
const world = computed(() => props.catalog?.world ?? {});
const character = computed(() => props.catalog?.character ?? {});
const learning = computed(() => props.catalog?.learning ?? {});
const beatOptions = computed(() =>
  props.beats.map((beat) => ({
    id: beat.id,
    label: beat.heading || beat.id,
    detail: [beat.modes?.join(", "), beat.storylineStep].filter(Boolean).join(" / "),
  })),
);
const lessonOptions = computed(() => learning.value.lessons ?? []);
const documentOptions = computed(() => character.value.documents ?? []);
const itemOptions = computed(() => character.value.items ?? []);
const currentCompletionFamily = computed(() => completionFamily(selectedStep.value?.completesWhen));
const previewActions = computed(() => {
  const step = selectedStep.value;
  const allowed = step?.allowed ?? {};
  const movement = movementPreviewActions(allowed.movement ?? {}, world.value);
  return [
    ...movement,
    ...actionList(allowed.storyForwardActions, "Story-continuing"),
    ...actionList(allowed.optionalActions, "Optional"),
  ];
});

watch(scenarios, (items) => {
  if (!items.length) {
    selectedScenarioId.value = "";
    selectedStepId.value = "";
    return;
  }
  if (!items.some((scenario) => scenario.id === selectedScenarioId.value)) {
    selectedScenarioId.value = items[0].id;
  }
}, { immediate: true });

watch(selectedScenario, (scenario) => {
  const steps = scenario?.steps ?? [];
  if (!steps.length) {
    selectedStepId.value = "";
    return;
  }
  if (!steps.some((step) => step.id === selectedStepId.value)) {
    selectedStepId.value = steps[0].id;
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

function updateScenario(key, value) {
  const scenarioId = selectedScenario.value?.id;
  updateDocument((document) => {
    const scenario = document.scenarios?.find((item) => item.id === scenarioId);
    if (scenario) scenario[key] = value || null;
  });
}

function updateStep(key, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const step = findStep(document, ids);
    if (step) step[key] = value || null;
  });
}

function updateAllowed(path, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const step = findStep(document, ids);
    if (!step) return;
    step.allowed ??= {};
    step.allowed.movement ??= {};
    const [section, key] = path.split(".");
    if (section === "movement") step.allowed.movement[key] = value;
    else step.allowed[path] = value;
  });
}

function updateCompletionFamily(family) {
  const ids = currentIds();
  updateDocument((document) => {
    const step = findStep(document, ids);
    if (!step) return;
    step.completesWhen = defaultCompletion(family);
  });
}

function updateCompletion(path, value) {
  const ids = currentIds();
  updateDocument((document) => {
    const step = findStep(document, ids);
    if (!step) return;
    step.completesWhen ??= {};
    const parts = path.split(".");
    let cursor = step.completesWhen;
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
    const step = findStep(document, ids);
    if (!step) return;
    step.allowed ??= {};
    step.allowed.stageViews ??= [];
    step.allowed.stageViews[index] ??= { kind: "inventory" };
    step.allowed.stageViews[index][key] = value || null;
  });
}

function addStageView() {
  const ids = currentIds();
  updateDocument((document) => {
    const step = findStep(document, ids);
    if (!step) return;
    step.allowed ??= {};
    step.allowed.stageViews ??= [];
    step.allowed.stageViews.push({ kind: "inventory" });
  });
}

function removeStageView(index) {
  const ids = currentIds();
  updateDocument((document) => {
    const step = findStep(document, ids);
    step?.allowed?.stageViews?.splice(index, 1);
  });
}

function currentIds() {
  return { scenarioId: selectedScenario.value?.id, stepId: selectedStep.value?.id };
}

function findStep(document, { scenarioId, stepId }) {
  return document.scenarios
    ?.find((scenario) => scenario.id === scenarioId)
    ?.steps
    ?.find((step) => step.id === stepId);
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
</script>

<template>
  <section class="scenario-panel">
    <div class="scenario-summary panel">
      <div class="scenario-heading">
        <div>
          <p class="label">Storyline</p>
          <h2>Scenarios</h2>
        </div>
        <div class="scenario-actions">
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <span v-else class="saved-pill">Saved</span>
          <button type="button" class="sm muted" @click="$emit('reload')">Reload</button>
        </div>
      </div>
      <p v-if="status" class="builder-status">{{ status }}</p>
      <p v-if="parseError" class="field-error">{{ parseError }}</p>
      <ul v-if="scenarios.length" class="scenario-list">
        <li v-for="scenario in scenarios" :key="scenario.id" class="scenario-card">
          <div>
            <strong>{{ scenario.label || scenario.id }}</strong>
            <span>{{ scenario.id }}</span>
          </div>
          <dl>
            <div>
              <dt>Start</dt>
              <dd>{{ scenario.startStep || "none" }}</dd>
            </div>
            <div>
              <dt>Steps</dt>
              <dd>{{ scenario.steps?.length ?? 0 }}</dd>
            </div>
          </dl>
          <ol v-if="scenario.steps?.length" class="step-list">
            <li
              v-for="step in scenario.steps"
              :key="step.id"
              :class="{ active: scenario.id === selectedScenario?.id && step.id === selectedStep?.id }"
              @click="selectedScenarioId = scenario.id; selectedStepId = step.id"
            >
              <span>{{ step.id }}</span>
              <small>{{ step.objective }}</small>
            </li>
          </ol>
        </li>
      </ul>
      <p v-else class="empty-note">No scenarios found in this document.</p>
    </div>

    <form class="scenario-editor panel" @submit.prevent="$emit('save')">
      <div class="scenario-heading">
        <div>
          <p class="label">Structured scenario editor</p>
          <h2>{{ selectedStep?.id || selectedScenario?.id || "Document" }}</h2>
        </div>
        <div class="scenario-actions">
          <button type="button" class="sm muted" :disabled="!dirty" @click="$emit('revert')">Revert</button>
          <button type="submit" class="sm" :disabled="!dirty || Boolean(parseError)">Save</button>
        </div>
      </div>

      <div v-if="selectedScenario" class="structured-editor">
        <fieldset>
          <legend>Scenario</legend>
          <label>
            Label
            <input :value="selectedScenario.label" @input="updateScenario('label', $event.target.value)">
          </label>
          <label>
            Start step
            <select :value="selectedScenario.startStep" @change="updateScenario('startStep', $event.target.value)">
              <option v-for="step in selectedScenario.steps ?? []" :key="step.id" :value="step.id">{{ step.id }}</option>
            </select>
          </label>
        </fieldset>

        <fieldset v-if="selectedStep">
          <legend>Step</legend>
          <label>
            Objective
            <textarea
              class="compact-textarea"
              :value="selectedStep.objective"
              rows="2"
              @input="updateStep('objective', $event.target.value)"
            />
          </label>
          <label>
            Associated beat
            <select :value="selectedStep.beat || ''" @change="updateStep('beat', $event.target.value)">
              <option value="">None</option>
              <option v-for="beat in beatOptions" :key="beat.id" :value="beat.id">
                {{ beat.label }} ({{ beat.id }}){{ beat.detail ? ` - ${beat.detail}` : "" }}
              </option>
            </select>
          </label>
          <div class="two-col">
            <label>
              Next step
              <select :value="selectedStep.next || ''" @change="updateStep('next', $event.target.value)">
                <option value="">None</option>
                <option v-for="step in selectedScenario.steps ?? []" :key="step.id" :value="step.id">{{ step.id }}</option>
              </select>
            </label>
            <label>
              Next scenario
              <select :value="selectedStep.nextScenario || ''" @change="updateStep('nextScenario', $event.target.value)">
                <option value="">None</option>
                <option v-for="scenario in scenarios" :key="scenario.id" :value="scenario.id">{{ scenario.label || scenario.id }}</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset v-if="selectedStep">
          <legend>Allowed movement</legend>
          <div class="two-col">
            <label>
              Hexes
              <select multiple :value="selectedStep.allowed?.movement?.hexes ?? []" @change="updateAllowed('movement.hexes', selectedOptions($event))">
                <option v-for="hex in world.hexes ?? []" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
              </select>
            </label>
            <label>
              Rooms
              <select multiple :value="selectedStep.allowed?.movement?.rooms ?? []" @change="updateAllowed('movement.rooms', selectedOptions($event))">
                <option v-for="room in world.rooms ?? []" :key="room.id" :value="room.id">{{ room.label }} ({{ room.id }})</option>
              </select>
            </label>
            <label>
              Exterior nodes
              <select multiple :value="selectedStep.allowed?.movement?.exteriorNodes ?? []" @change="updateAllowed('movement.exteriorNodes', selectedOptions($event))">
                <option v-for="node in world.exteriorNodes ?? []" :key="node.id" :value="node.id">{{ node.label }} ({{ node.id }})</option>
              </select>
            </label>
            <label>
              Transitions
              <select multiple :value="selectedStep.allowed?.movement?.transitions ?? []" @change="updateAllowed('movement.transitions', selectedOptions($event))">
                <option v-for="transition in world.mapTransitions ?? []" :key="transition.id" :value="transition.id">{{ transition.label }} ({{ transition.id }})</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset v-if="selectedStep">
          <legend>Actions and views</legend>
          <label>
            Story-continuing actions
            <input :value="csv(selectedStep.allowed?.storyForwardActions)" @input="updateAllowed('storyForwardActions', csvList($event.target.value))">
          </label>
          <label>
            Optional actions
            <input :value="csv(selectedStep.allowed?.optionalActions)" @input="updateAllowed('optionalActions', csvList($event.target.value))">
          </label>
          <div class="stage-view-row" v-for="(view, index) in selectedStep.allowed?.stageViews ?? []" :key="index">
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

        <fieldset v-if="selectedStep">
          <legend>Completion</legend>
          <label>
            Predicate
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
            :value="selectedStep.completesWhen?.flag || ''"
            @input="updateCompletion('flag', $event.target.value)"
          >
          <div v-else-if="currentCompletionFamily === 'location'" class="two-col">
            <label>
              Hex
              <select :value="selectedStep.completesWhen?.location?.hex || ''" @change="updateCompletion('location.hex', $event.target.value)">
                <option value="">None</option>
                <option v-for="hex in world.hexes ?? []" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
              </select>
            </label>
            <label>
              Room
              <select :value="selectedStep.completesWhen?.location?.room || ''" @change="updateCompletion('location.room', $event.target.value)">
                <option value="">None</option>
                <option v-for="room in world.rooms ?? []" :key="room.id" :value="room.id">{{ room.label }} ({{ room.id }})</option>
              </select>
            </label>
          </div>
          <div v-else-if="currentCompletionFamily === 'holding'" class="two-col">
            <label>
              Item
              <select :value="selectedStep.completesWhen?.holding?.item || ''" @change="updateCompletion('holding.item', $event.target.value)">
                <option value="">None</option>
                <option v-for="item in itemOptions" :key="item.id" :value="item.id">{{ item.label || item.id }}</option>
              </select>
            </label>
            <label>
              Holder
              <input :value="selectedStep.completesWhen?.holding?.holder || ''" @input="updateCompletion('holding.holder', $event.target.value)">
            </label>
          </div>
          <div v-else-if="currentCompletionFamily === 'lesson'" class="two-col">
            <label>
              Lesson
              <select :value="selectedStep.completesWhen?.lesson?.id || ''" @change="updateCompletion('lesson.id', $event.target.value)">
                <option value="">None</option>
                <option v-for="lesson in lessonOptions" :key="lesson.id" :value="lesson.id">{{ lesson.title || lesson.id }}</option>
              </select>
            </label>
            <label>
              Status
              <select :value="selectedStep.completesWhen?.lesson?.status || 'completed'" @change="updateCompletion('lesson.status', $event.target.value)">
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
          <label v-else-if="currentCompletionFamily === 'facility'">
            Facility predicate JSON
            <input
              :value="JSON.stringify(selectedStep.completesWhen?.facility ?? {})"
              @input="updateFacilityPredicate($event.target.value)"
            >
          </label>
        </fieldset>

        <fieldset v-if="selectedStep">
          <legend>Player-facing preview</legend>
          <ul v-if="previewActions.length" class="preview-list">
            <li v-for="action in previewActions" :key="`${action.group}:${action.id}`">
              <span>{{ action.group }}</span>
              <strong>{{ action.label }}</strong>
              <small>{{ action.id }}</small>
            </li>
          </ul>
          <p v-else class="empty-note">No preview actions for this step.</p>
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
.scenario-panel {
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
.scenario-heading,
.scenario-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.scenario-actions {
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
.scenario-list,
.step-list {
  display: grid;
  gap: 0.7rem;
  padding: 0;
  margin: 1rem 0 0;
  list-style: none;
}
.scenario-card {
  display: grid;
  gap: 0.55rem;
  border: 1px solid #3d485b;
  border-radius: 8px;
  background: #1b2029;
  padding: 0.75rem;
}
.scenario-card strong,
.scenario-card span,
.step-list span {
  display: block;
}
.scenario-card span,
.step-list small,
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
.step-list li {
  border-top: 1px solid #313a49;
  padding-top: 0.5rem;
  cursor: pointer;
}
.step-list li.active {
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
  .scenario-panel {
    grid-template-columns: 1fr;
  }
  .two-col,
  .stage-view-row,
  .preview-list li {
    grid-template-columns: 1fr;
  }
}
</style>
