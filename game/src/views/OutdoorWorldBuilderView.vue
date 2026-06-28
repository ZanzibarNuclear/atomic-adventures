<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BuilderPageHeader from "../components/builder/BuilderPageHeader.vue";
import BuilderStatusBanner from "../components/builder/BuilderStatusBanner.vue";
import UnsavedChangesDialog from "../components/builder/UnsavedChangesDialog.vue";
import OutdoorCanvasPanel from "../components/builder/outdoor/OutdoorCanvasPanel.vue";
import OutdoorInspector from "../components/builder/outdoor/OutdoorInspector.vue";
import OutdoorObjectBrowser from "../components/builder/outdoor/OutdoorObjectBrowser.vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import {
  buildMapMovementAudit,
  movementAuditSummary,
} from "../lib/maps/debug/mapMovementAudit.js";
import { useDirtyDocumentNavigation } from "../composables/useDirtyDocumentNavigation.js";
import { useOutdoorBuilderSelection } from "../composables/useOutdoorBuilderSelection.js";
import { useOutdoorWorldBuilderDocument } from "../composables/useOutdoorWorldBuilderDocument.js";
import { useWorldBuilderCamera } from "../composables/useWorldBuilderCamera.js";
import { useWorldContent } from "../composables/useWorldContent.js";

const PASSAGE_KINDS = new Set(["gate", "hole", "bridge", "ford", "stair"]);
const ROUTE_KINDS = ["road", "drive", "path", "trail"];
const FEATURE_LINE_KINDS = ["river", "fence", "cliff", "ravine"];
const TERRAIN_KINDS = ["forest", "clearing", "gorge", "rock", "water"];
const { refresh: refreshSharedWorld } = useWorldContent();
const builderFlags = new Set();
const router = useRouter();

const selectedKey = ref("");
const selectedHandleId = ref(null);
const tool = ref("select");
const search = ref("");
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const canvasView = ref("map");
const landmarkDraft = ref(null);
const landmarkEditDraft = ref(null);
const standDraft = ref(null);
const standEditDraft = ref(null);
let resizeObserver = null;

const emptyWorld = {
  orientation: "pointy",
  size: 44,
  start: null,
  journey: [],
  hexes: [],
  features: [],
  routes: [],
};
const outdoor = useOutdoorWorld(emptyWorld);
const worldCamera = useWorldBuilderCamera();
const {
  mapHost,
  panning,
  zoomAction,
  viewBoxString,
  editHandleScale,
  onWheel,
  startPan,
  stopPan,
} = worldCamera;

const {
  loaded,
  draftMeta,
  status,
  errors,
  warnings,
  yamlPreview,
  revisions,
  showHistory,
  renames,
  auditEntries,
  auditSummary,
  currentWorld,
  dirty,
  dumpYaml,
  loadWorld,
  discardWorld,
  revertWorld,
  saveWorld,
  loadHistory,
  restoreRevision,
} = useOutdoorWorldBuilderDocument({
  outdoor,
  refreshSharedWorld,
  runMovementAudit,
  hasSelection: () => Boolean(selectedKey.value),
  selectInitial: (start) => {
    selectedKey.value = start ? `hex:${start}` : "";
  },
});
const navigation = useDirtyDocumentNavigation({
  dirty,
  router,
  save: () => saveWorld(),
  discard: discardWorld,
  onError: (error) => {
    status.value = error.message ?? "Could not finish changing workspaces.";
  },
});
const errorMessages = computed(() =>
  Object.entries(errors.value).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);
const invalidAuditEntries = computed(() =>
  auditEntries.value.filter((entry) => entry.status === "invalid"),
);
const allHexIds = computed(() => outdoor.editableHexes.map((hex) => hex.id));
const allHexSet = computed(() => new Set(allHexIds.value));
const {
  selected,
  selectedType,
  landmarkEditDirty,
  standEditDirty,
  selectedIsLine,
  selectedIsPlacement,
  editMode,
  editHandles,
  builderEdit,
  filteredGroups,
  select,
  selectFeature,
  onHandleMove,
  onBuilderMapClick,
  toggleAddPointMode,
  beginAddStand,
  confirmAddStand,
  cancelStandDraft,
  beginAddLandmark,
  confirmAddLandmark,
  cancelLandmarkDraft,
  saveLandmarkEdit,
  backToHexFromLandmark,
  saveStandEdit,
  backToHexFromStand,
  addHex,
  addRoute,
  addBarrier,
  addCascade,
  removeCascade,
  addPassage,
  duplicateSelected,
  deleteSelected,
  renameSelected,
  moveSelected,
  pointMode,
  csv,
  setCsv,
  setPointMode,
  ensureBoothAt,
  removeBoothAt,
  removePoint,
  movePoint,
  focusSelection,
} = useOutdoorBuilderSelection({
  outdoor,
  passageKinds: PASSAGE_KINDS,
  draftMeta,
  renames,
  currentWorld,
  status,
  selectedKey,
  selectedHandleId,
  tool,
  search,
  landmarkDraft,
  landmarkEditDraft,
  standDraft,
  standEditDraft,
  focusPoint: (point) => worldCamera.focusPoint(point),
});

onMounted(async () => {
  try {
    await loadWorld();
    await nextTick();
    fitMap();
    resizeObserver = new ResizeObserver(() => fitMap(false));
    if (mapHost.value) resizeObserver.observe(mapHost.value);
  } catch (error) {
    status.value = error.message;
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopPan();
});

watch(
  () => selectedKey.value,
  async () => {
    if (zoomAction.value !== "focus") return;
    await nextTick();
    focusSelection();
  },
);

function runMovementAudit(showStatus = true) {
  try {
    auditEntries.value = buildMapMovementAudit(currentWorld.value);
    auditSummary.value = movementAuditSummary(auditEntries.value);
    if (showStatus) {
      status.value = auditSummary.value.invalid
        ? `Movement audit: ${auditSummary.value.invalid} invalid case(s).`
        : `Movement audit passed ${auditSummary.value.total} cases.`;
    }
    return auditSummary.value;
  } catch (error) {
    auditEntries.value = [];
    auditSummary.value = { total: 0, valid: 0, blocked: 0, invalid: 1 };
    if (showStatus) status.value = `Movement audit could not run: ${error.message}`;
    return auditSummary.value;
  }
}

function fitMap(updateCamera = true) {
  worldCamera.fitMap({
    hexes: outdoor.editableHexes,
    routes: outdoor.editableRoutes,
    features: outdoor.editableFeatures,
    size: outdoor.size,
  }, updateCamera);
}

function applyZoomAction(event) {
  worldCamera.applyZoomAction(event, {
    fit: () => fitMap(),
    focus: focusSelection,
  });
}

function setMapHost(element) {
  mapHost.value = element;
  if (resizeObserver && element) resizeObserver.observe(element);
}

</script>

<template>
  <main class="world-builder">
    <BuilderPageHeader title="World Builder">
      <template #tabs>
        <slot name="workspace-switcher" />
      </template>
      <template #actions>
        <button class="sm muted" @click="leftCollapsed = !leftCollapsed">{{ leftCollapsed ? "Show objects" : "Hide objects" }}</button>
        <button class="sm muted" @click="rightCollapsed = !rightCollapsed">{{ rightCollapsed ? "Show inspector" : "Hide inspector" }}</button>
        <button class="sm muted" :disabled="!dirty" @click="revertWorld">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveWorld">Save world</button>
      </template>
    </BuilderPageHeader>

    <BuilderStatusBanner
      :status="status"
      :dirty="Boolean(dirty)"
      dirty-message="Unsaved world changes"
    />

    <div
      class="world-workspace"
      :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
    >
      <OutdoorObjectBrowser
        v-if="!leftCollapsed"
        v-model:search="search"
        :groups="filteredGroups"
        :selected-key="selectedKey"
        @add-hex="addHex"
        @add-route="addRoute"
        @add-barrier="addBarrier"
        @add-passage="addPassage"
        @add-landmark="beginAddLandmark"
        @select="select($event.type, $event.id)"
      />

      <OutdoorCanvasPanel
        v-model:canvas-view="canvasView"
        v-model:zoom-action="zoomAction"
        v-model:selected-handle-id="selectedHandleId"
        :loaded="Boolean(loaded)"
        :selected="selected"
        :selected-is-placement="selectedIsPlacement"
        :selected-is-line="selectedIsLine"
        :draft-start="draftMeta.start"
        :outdoor="outdoor"
        :all-hex-ids="allHexIds"
        :all-hex-set="allHexSet"
        :builder-flags="builderFlags"
        :builder-edit="builderEdit"
        :edit-mode="editMode"
        :edit-handles="editHandles"
        :tool="tool"
        :view-box-string="viewBoxString"
        :edit-handle-scale="editHandleScale"
        :audit-entries="auditEntries"
        :panning="Boolean(panning)"
        :yaml-text="dirty ? dumpYaml(currentWorld) : yamlPreview"
        @canvas-mounted="setMapHost"
        @zoom-action="applyZoomAction"
        @run-movement-audit="runMovementAudit()"
        @wheel="onWheel"
        @pointerdown="startPan"
        @select="select($event.type, $event.id)"
        @select-feature="selectFeature"
        @waypoint-move="onHandleMove"
        @builder-map-click="onBuilderMapClick"
      />

      <OutdoorInspector
        v-if="!rightCollapsed"
        :selected="selected"
        :selected-type="selectedType"
        :selected-is-line="selectedIsLine"
        :selected-is-placement="selectedIsPlacement"
        :landmark-draft="landmarkDraft"
        :landmark-edit-draft="landmarkEditDraft"
        :landmark-edit-dirty="landmarkEditDirty"
        :stand-draft="standDraft"
        :stand-edit-draft="standEditDraft"
        :stand-edit-dirty="standEditDirty"
        :tool="tool"
        :terrain-kinds="TERRAIN_KINDS"
        :route-kinds="ROUTE_KINDS"
        :feature-line-kinds="FEATURE_LINE_KINDS"
        :passage-kinds="[...PASSAGE_KINDS]"
        :all-hex-ids="allHexIds"
        :error-messages="errorMessages"
        :audit-summary="auditSummary"
        :invalid-audit-entries="invalidAuditEntries"
        :warnings="warnings"
        :show-history="showHistory"
        :revisions="revisions"
        :select="select"
        :move-selected="moveSelected"
        :rename-selected="renameSelected"
        :duplicate-selected="duplicateSelected"
        :delete-selected="deleteSelected"
        :save-landmark-edit="saveLandmarkEdit"
        :back-to-hex-from-landmark="backToHexFromLandmark"
        :save-stand-edit="saveStandEdit"
        :back-to-hex-from-stand="backToHexFromStand"
        :begin-add-landmark="beginAddLandmark"
        :confirm-add-landmark="confirmAddLandmark"
        :cancel-landmark-draft="cancelLandmarkDraft"
        :begin-add-stand="beginAddStand"
        :confirm-add-stand="confirmAddStand"
        :cancel-stand-draft="cancelStandDraft"
        :add-cascade="addCascade"
        :remove-cascade="removeCascade"
        :csv="csv"
        :set-csv="setCsv"
        :point-mode="pointMode"
        :set-point-mode="setPointMode"
        :remove-booth-at="removeBoothAt"
        :ensure-booth-at="ensureBoothAt"
        :toggle-add-point-mode="toggleAddPointMode"
        :move-point="movePoint"
        :remove-point="removePoint"
        :restore-revision="restoreRevision"
      />
    </div>

    <UnsavedChangesDialog
      :visible="navigation.promptVisible.value"
      label="Unsaved world changes"
      title="Save before leaving World Builder?"
      message="Save the draft, discard it, or return to the map without changing workspaces."
      :saving="navigation.saving.value"
      @save="navigation.saveAndContinue"
      @discard="navigation.discardAndContinue"
      @keep="navigation.keepEditing"
    />
  </main>
</template>

<style scoped>
.world-builder { padding: .85rem; }
.world-workspace {
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr) minmax(290px, 350px);
  gap: .75rem;
  height: calc(100vh - 12rem);
  min-height: 528px;
  margin-top: .75rem;
}
.world-workspace.left-collapsed { grid-template-columns: minmax(440px, 1fr) minmax(290px, 350px); }
.world-workspace.right-collapsed { grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr); }
.world-workspace.left-collapsed.right-collapsed { grid-template-columns: 1fr; }
@media (max-width: 1050px) {
  .world-workspace, .world-workspace.left-collapsed, .world-workspace.right-collapsed {
    grid-template-columns: 220px minmax(420px, 1fr);
    height: auto;
  }
  .inspector { grid-column: 1 / -1; max-height: none; }
}
@media (max-width: 720px) {
  .world-workspace, .world-workspace.left-collapsed, .world-workspace.right-collapsed {
    grid-template-columns: 1fr;
  }
  .inspector { grid-column: auto; }
}
</style>
