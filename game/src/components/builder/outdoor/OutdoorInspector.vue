<script setup>
import { computed, ref, watch } from "vue";
import FeatureInspector from "./FeatureInspector.vue";
import HexInspector from "./HexInspector.vue";
import LandmarkInspector from "./LandmarkInspector.vue";
import LinePointsEditor from "./LinePointsEditor.vue";
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

const editing = ref(false);

watch(
  () => `${props.selectedType}:${props.selected?.id ?? ""}`,
  () => {
    editing.value = false;
  },
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

const summaryRows = computed(() => {
  const item = props.selected;
  if (!item) return [];
  if (props.selectedType === "hex") {
    return [
      ["Terrain", item.terrain],
      ["Coordinates", `q ${item.q}, r ${item.r}`],
      ["Landmark", item.landmark?.label || item.landmark?.building || "None"],
      ["Stand points", String((item.stands ?? []).length)],
    ];
  }
  if (props.selectedType === "landmark") {
    return [
      ["Cell", item.id],
      ["Building", item.landmark?.building || "None"],
      ["Icon", item.landmark?.icon || "None"],
      ["Offset", `${item.landmark?.dx ?? 0}, ${item.landmark?.dy ?? 0}`],
    ];
  }
  if (props.selectedType === "stand") {
    return [
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
      ["Kind", item.kind],
      ["Points", String((item.points ?? []).length)],
      ["Smooth", item.smooth ? "Yes" : "No"],
    ];
  }
  if (props.selectedType === "feature" || props.selectedType === "passage") {
    return [
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
          <button class="sm muted" @click="duplicateSelected">Duplicate</button>
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
