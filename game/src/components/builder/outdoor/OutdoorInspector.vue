<script setup>
import { computed, ref, watch } from "vue";
import FeatureInspector from "./FeatureInspector.vue";
import HexInspector from "./HexInspector.vue";
import LandmarkInspector from "./LandmarkInspector.vue";
import LinePointsEditor from "./LinePointsEditor.vue";
import LocationViewsSummary from "../LocationViewsSummary.vue";
import PassageInspector from "./PassageInspector.vue";
import RouteInspector from "./RouteInspector.vue";
import StandInspector from "./StandInspector.vue";
import RevisionHistoryPanel from "../RevisionHistoryPanel.vue";

const props = defineProps({
  selected: { type: Object, default: null },
  selectedType: { type: String, default: "" },
  selectedIsLine: { type: Boolean, default: false },
  selectedIsPlacement: { type: Boolean, default: false },
  landmarkDraft: { type: Object, default: null },
  landmarkEditDraft: { type: Object, default: null },
  landmarkEditDirty: { type: Boolean, default: false },
  standDraft: { type: Object, default: null },
  standEditDraft: { type: Object, default: null },
  standEditDirty: { type: Boolean, default: false },
  tool: { type: String, default: "select" },
  terrainKinds: { type: Array, required: true },
  routeKinds: { type: Array, required: true },
  featureLineKinds: { type: Array, required: true },
  passageKinds: { type: Array, required: true },
  allHexIds: { type: Array, required: true },
  errorMessages: { type: Array, required: true },
  auditSummary: { type: Object, default: null },
  invalidAuditEntries: { type: Array, required: true },
  warnings: { type: Array, required: true },
  storyBeats: { type: Array, default: () => [] },
  characterCatalog: { type: Object, required: true },
  artifactPlacements: { type: Array, required: true },
  showHistory: { type: Boolean, default: false },
  revisions: { type: Array, required: true },
  select: { type: Function, required: true },
  moveSelected: { type: Function, required: true },
  renameSelected: { type: Function, required: true },
  duplicateSelected: { type: Function, required: true },
  deleteSelected: { type: Function, required: true },
  saveLandmarkEdit: { type: Function, required: true },
  backToHexFromLandmark: { type: Function, required: true },
  saveStandEdit: { type: Function, required: true },
  backToHexFromStand: { type: Function, required: true },
  beginAddLandmark: { type: Function, required: true },
  confirmAddLandmark: { type: Function, required: true },
  cancelLandmarkDraft: { type: Function, required: true },
  beginAddStand: { type: Function, required: true },
  confirmAddStand: { type: Function, required: true },
  cancelStandDraft: { type: Function, required: true },
  addCascade: { type: Function, required: true },
  removeCascade: { type: Function, required: true },
  csv: { type: Function, required: true },
  setCsv: { type: Function, required: true },
  pointMode: { type: Function, required: true },
  setPointMode: { type: Function, required: true },
  removeBoothAt: { type: Function, required: true },
  ensureBoothAt: { type: Function, required: true },
  toggleAddPointMode: { type: Function, required: true },
  movePoint: { type: Function, required: true },
  removePoint: { type: Function, required: true },
  restoreRevision: { type: Function, required: true },
});

const emit = defineEmits([
  "open-location-beat",
  "open-artifact",
  "duplicate-artifact",
  "place-artifact",
  "remove-artifact-placement",
]);
const editing = ref(false);
const selectedArtifactItemId = ref("");
const placementFormOpen = ref(false);
const editingPlacementId = ref("");

watch(
  () => `${props.selectedType}:${props.selected?.id ?? ""}`,
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

const selectedTitle = computed(() => {
  if (!props.selected) return "";
  if (props.selectedType === "landmark") {
    return props.selected.landmark?.label || props.selected.landmark?.building || props.selected.id;
  }
  if (props.selectedType === "stand") {
    return props.standEditDraft?.label || props.selected.id;
  }
  return props.selected.label || props.selected.id;
});

function beatContextLabel(beat) {
  const match = beat.match ?? {};
  const details = [
    originHexPrefix(match.originHex),
    match.mapTransition ? `via ${match.mapTransition}` : "",
    match.transitionDirection || "",
  ].filter(Boolean);
  return details.join(" / ") || "Default hex beat";
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
  if (!props.selected || props.selectedType !== "hex") return null;
  return {
    locationMode: "outdoors",
    location: props.selected.id,
    label: "Hex beats",
  };
});

const associatedLocationBeats = computed(() => {
  if (!locationBeatTarget.value) return [];
  return props.storyBeats.filter((beat) =>
    beat.trigger?.place === "outdoors" && beat.trigger?.hex === locationBeatTarget.value.location,
  );
});

const placedArtifacts = computed(() => {
  if (!props.selected || props.selectedType !== "hex") return [];
  return props.artifactPlacements.filter((placement) => placement.hex === props.selected.id);
});

const currentStandOptions = computed(() =>
  props.selectedType === "hex" ? props.selected?.stands ?? [] : [],
);

const selectedLocationViews = computed(() =>
  props.selectedType === "stand"
    ? props.standEditDraft?.views ?? []
    : props.selected?.views ?? [],
);

function artifactLabel(id) {
  const item = props.characterCatalog.items.find((candidate) => candidate.id === id);
  return item?.label || id;
}

function standLabel(id) {
  const stand = currentStandOptions.value.find((candidate) => candidate.id === id);
  return stand?.label || id || "None";
}

function openPlacementForm() {
  selectedArtifactItemId.value = "";
  placementFormOpen.value = true;
}

function placeSelectedArtifact() {
  if (!props.selected || props.selectedType !== "hex" || !selectedArtifactItemId.value) return;
  emit("place-artifact", {
    hexId: props.selected.id,
    itemId: selectedArtifactItemId.value,
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
  emit("remove-artifact-placement", { id: placementId });
}

const summaryRows = computed(() => {
  const item = props.selected;
  if (!item) return [];
  if (props.selectedType === "hex") {
    return [
      ["ID", item.id],
      ["Terrain", item.terrain],
      ["Coordinates", `q ${item.q}, r ${item.r}`],
      ["Landmark", item.landmark?.label || item.landmark?.building || "None"],
      ["Stand points", String((item.stands ?? []).length)],
    ];
  }
  if (props.selectedType === "landmark") {
    return [
      ["ID", item.id],
      ["Cell", item.id],
      ["Building", item.landmark?.building || "None"],
      ["Icon", item.landmark?.icon || "None"],
      ["Offset", `${item.landmark?.dx ?? 0}, ${item.landmark?.dy ?? 0}`],
    ];
  }
  if (props.selectedType === "stand") {
    return [
      ["ID", props.standEditDraft?.id || item.id],
      ["Cell", item.id],
      ["Stand", props.standEditDraft?.id || ""],
      ["Anchor", props.standEditDraft?.anchor || "hex"],
      ["Position", props.standEditDraft?.anchor === "world"
        ? `${props.standEditDraft?.x ?? ""}, ${props.standEditDraft?.y ?? ""}`
        : `${props.standEditDraft?.dx ?? 0}, ${props.standEditDraft?.dy ?? 0}`],
    ];
  }
  if (props.selectedType === "route") {
    return [
      ["ID", item.id],
      ["Kind", item.kind],
      ["Points", String((item.points ?? []).length)],
      ["Smooth", item.smooth ? "Yes" : "No"],
    ];
  }
  if (props.selectedType === "feature" || props.selectedType === "passage") {
    return [
      ["ID", item.id],
      ["Kind", item.kind],
      ["Points", String((item.points ?? []).length)],
      ["Flow", item.flow || "None"],
      ["Smooth", item.smooth ? "Yes" : "No"],
    ];
  }
  return [["ID", item.id]];
});
</script>

<template>
  <aside class="inspector panel">
    <template v-if="selected">
      <div class="inspector-heading">
        <div>
          <p class="label">{{ selectedType }}</p>
          <h3>{{ selectedTitle }}</h3>
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
        <LocationViewsSummary
          :views="selectedLocationViews"
        />
        <div v-if="locationBeatTarget" class="beat-associations">
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
        <div v-if="selectedType === 'hex'" class="artifact-associations">
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
                @change="placeSelectedArtifact"
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
            @click="openPlacementForm"
          >
            Place artifact
          </button>
        </div>
      </section>

      <div v-if="editing" class="edit-toolbar">
        <div class="row-actions">
          <button class="sm muted" @click="moveSelected(-1)">Move up</button>
          <button class="sm muted" @click="moveSelected(1)">Move down</button>
        </div>
        <template v-if="selectedType === 'landmark'">
          <button class="sm" :disabled="!landmarkEditDirty" @click="saveLandmarkEdit">Save changes</button>
          <button class="sm muted" @click="backToHexFromLandmark">Back to cell</button>
        </template>
        <template v-else-if="selectedType === 'stand'">
          <button class="sm" :disabled="!standEditDirty" @click="saveStandEdit">Save changes</button>
          <button class="sm muted" @click="backToHexFromStand">Back to cell</button>
        </template>
        <template v-else>
          <button class="sm muted" @click="renameSelected">Rename</button>
          <button class="sm muted" @click="duplicateSelected">Duplicate object</button>
        </template>
        <button class="sm danger-outline" @click="deleteSelected">Delete</button>
      </div>

      <HexInspector
        v-if="editing && selectedType === 'hex'"
        :selected="selected"
        :terrain-kinds="terrainKinds"
        :landmark-draft="landmarkDraft"
        :stand-draft="standDraft"
        :select="select"
        :begin-add-landmark="beginAddLandmark"
        :confirm-add-landmark="confirmAddLandmark"
        :cancel-landmark-draft="cancelLandmarkDraft"
        :begin-add-stand="beginAddStand"
        :confirm-add-stand="confirmAddStand"
        :cancel-stand-draft="cancelStandDraft"
      />
      <LandmarkInspector
        v-else-if="editing && selectedType === 'landmark' && landmarkEditDraft"
        :landmark-edit-draft="landmarkEditDraft"
      />
      <StandInspector
        v-else-if="editing && selectedType === 'stand' && standEditDraft"
        :selected="selected"
        :stand-edit-draft="standEditDraft"
      />
      <RouteInspector
        v-else-if="editing && selectedType === 'route'"
        :selected="selected"
        :route-kinds="routeKinds"
      />
      <FeatureInspector
        v-else-if="editing && selectedType === 'feature'"
        :selected="selected"
        :feature-line-kinds="featureLineKinds"
        :add-cascade="addCascade"
        :remove-cascade="removeCascade"
      />
      <PassageInspector
        v-else-if="editing && selectedType === 'passage'"
        :selected="selected"
        :passage-kinds="passageKinds"
        :all-hex-ids="allHexIds"
        :csv="csv"
        :set-csv="setCsv"
        :point-mode="pointMode"
        :set-point-mode="setPointMode"
        :remove-booth-at="removeBoothAt"
        :ensure-booth-at="ensureBoothAt"
      />

      <LinePointsEditor
        v-if="editing && selectedIsLine"
        :selected="selected"
        :tool="tool"
        :all-hex-ids="allHexIds"
        :point-mode="pointMode"
        :set-point-mode="setPointMode"
        :toggle-add-point-mode="toggleAddPointMode"
        :move-point="movePoint"
        :remove-point="removePoint"
      />
    </template>
    <p v-else class="empty-note">Select an object from the map or object browser.</p>

    <p v-for="message in errorMessages.slice(0, 12)" :key="message" class="field-error">
      {{ message }}
    </p>
    <section v-if="auditSummary || warnings.length" class="diagnostics">
      <p v-if="auditSummary" :class="{ warning: auditSummary.invalid }">
        Movement audit:
        {{ auditSummary.invalid
          ? `${auditSummary.invalid} invalid case(s) out of ${auditSummary.total}.`
          : `passed ${auditSummary.total} cases.` }}
      </p>
      <ul v-if="invalidAuditEntries.length" class="audit-issues">
        <li v-for="entry in invalidAuditEntries.slice(0, 8)" :key="entry.id">
          <strong>{{ entry.label }}</strong>
          <span>{{ entry.reason || "Movement result did not match the audit expectation." }}</span>
        </li>
      </ul>
      <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
        {{ warning.path }}: {{ warning.message }}
      </p>
    </section>

    <RevisionHistoryPanel
      :visible="showHistory"
      title="World revisions"
      :revisions="revisions"
      @restore="restoreRevision"
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
.inspector h3 { margin: 0; }
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
.inspector input, .inspector textarea, .inspector select,
.inspector :deep(input), .inspector :deep(textarea), .inspector :deep(select) {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .45rem .55rem;
}
.inspector :deep(.point-tools button.active) { background: #49624f; border-color: #6f9b79; }
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
.inspector :deep(.hex-subitems) { display: grid; gap: .45rem; padding-top: .35rem; border-top: 1px solid #343d4d; }
.subitem-heading, .inspector :deep(.subitem-heading) { display: flex; align-items: center; justify-content: space-between; gap: .5rem; color: #bdc4ce; font-size: .82rem; }
.inspector :deep(.subitem-row) {
  display: grid;
  gap: .1rem;
  width: 100%;
  padding: .5rem .6rem;
  text-align: left;
  border: 1px solid #343d4d;
  border-radius: 7px;
  background: #1b2028;
}
.inspector :deep(.subitem-row span) { color: #8e96a3; font-size: .72rem; }
.inspector :deep(.draft-card) {
  display: grid;
  gap: .55rem;
  padding: .6rem;
  border: 1px solid #485267;
  border-radius: 8px;
  background: #1b2028;
}
.inspector :deep(.cascade-row) { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(4.5rem, .7fr) minmax(4.5rem, .7fr) auto; gap: .45rem; align-items: end; }
.inspector :deep(.check-field) { display: flex !important; align-items: center; }
.inspector :deep(.check-field input) { width: auto; }
.inspector :deep(fieldset) { display: grid; gap: .55rem; margin: 0; padding: .65rem; border: 1px solid #3b4557; border-radius: 8px; }
.inspector :deep(legend) { color: #8bc49a; }
.inspector :deep(.point-editor) { display: grid; gap: .4rem; padding: .5rem; border: 1px solid #343d4d; border-radius: 7px; background: #1b2028; }
.inspector :deep(.point-tools) { display: flex; justify-content: flex-end; }
.danger-outline, .inspector :deep(.danger-outline) { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.diagnostics { display: grid; gap: .4rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.diagnostics p { margin: 0; color: #aab2bd; font-size: .75rem; }
.audit-issues { display: grid; gap: .35rem; margin: 0; padding: 0; list-style: none; }
.audit-issues li { display: grid; gap: .15rem; padding: .45rem .55rem; border: 1px solid #704848; border-radius: 7px; background: #2c2024; }
.audit-issues strong { color: #ffd0d0; font-size: .78rem; }
.audit-issues span { color: #d8b5b5; font-size: .76rem; line-height: 1.35; }
.warning { color: #efcb83 !important; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.empty-note { color: #939ba7; }
</style>
