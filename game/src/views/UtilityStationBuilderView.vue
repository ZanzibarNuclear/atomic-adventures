<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storyApi } from "../lib/storyApi.js";
import BuilderPageHeader from "../components/builder/BuilderPageHeader.vue";
import BuilderStatusBanner from "../components/builder/BuilderStatusBanner.vue";
import UnsavedChangesDialog from "../components/builder/UnsavedChangesDialog.vue";
import StationCanvasPanel from "../components/builder/station/StationCanvasPanel.vue";
import StationInspector from "../components/builder/station/StationInspector.vue";
import StationObjectBrowser from "../components/builder/station/StationObjectBrowser.vue";
import { useBuildingBuilderDocument } from "../composables/useBuildingBuilderDocument.js";
import { useDirtyDocumentNavigation } from "../composables/useDirtyDocumentNavigation.js";
import { useGridBuilderSelection } from "../composables/useGridBuilderSelection.js";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import {
  listAllGridEditable,
} from "../lib/maps/composables/useGridBuilder.js";
import { auditIndoorBuilding } from "../lib/maps/testing/indoorBuildingAudit.js";

const router = useRouter();
const emptyUtilityStation = {
  id: "utility-station",
  label: "Utility Station",
  cell: 64,
  levels: [],
  rooms: [],
  doors: [],
  links: [],
  fixtures: [],
  exterior: { nodes: [], paths: [] },
};
const level = ref(emptyUtilityStation.exterior?.level ?? emptyUtilityStation.levels?.at(-1)?.id ?? "");
const search = ref("");
const viewportMode = ref("fit-all");
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const characterCatalog = ref({
  items: [], stats: [], knowledge: [], skills: [], quests: [], documents: [],
});
const storyBeats = ref([]);

function resetDocumentUi() {
  resetSelectionMode();
}

const {
  draft,
  loaded,
  status,
  errors,
  warnings,
  revisions,
  showHistory,
  renames,
  auditResult,
  doorStates,
  dirty,
  discardDraft,
  revertDraft,
  applyLoaded,
  saveDraft,
  loadHistory,
  restoreRevision,
} = useBuildingBuilderDocument({
  emptyBuilding: emptyUtilityStation,
  buildingId: "utility-station",
  level,
  buildDoorState: (buildingDraft) =>
    buildInitialDoorState(buildingDraft.id, buildBuilding(buildingDraft)),
  onDocumentReset: resetDocumentUi,
});

const building = computed(() => buildBuilding(draft.value));
const {
  selectedKey,
  selectedHandleId,
  geometryEditing,
  addMode,
  selection,
  editMode,
  cell,
  editHandles,
  canEditGeometry,
  selectedPathNode,
  rollDoorRoom,
  resetSelectionMode,
  selectItem,
  toggleGeometryEditing,
  togglePathAddMode,
  onHandleMove,
  onMapClick,
  removeSelectedPathHandle,
  addObject,
  duplicateSelected,
  deleteSelected,
  moveSelected,
  renameSelected,
} = useGridBuilderSelection({
  draft,
  level,
  status,
  renames,
  previewRename: async ({ kind, from, to }) => {
    const preview = await storyApi(
      "/api/world/buildings/utility-station/rename-preview",
      {
        method: "POST",
        body: JSON.stringify({
          kind,
          from,
          to,
          building: draft.value,
        }),
      },
    );
    return preview.references ?? [];
  },
});
const navigation = useDirtyDocumentNavigation({
  dirty,
  router,
  save: () => saveDraft(),
  discard: discardDraft,
  onError: (error) => {
    status.value = error.message ?? "Could not finish changing workspaces.";
  },
});
const allRoomIds = computed(() => building.value.rooms.map((room) => room.id));
const allExteriorIds = computed(() => building.value.exterior.nodes.map((node) => node.id));
const editableItems = computed(() =>
  listAllGridEditable(draft.value, level.value).filter((item) => {
    const term = search.value.trim().toLowerCase();
    return !term || `${item.id} ${item.label} ${item.source}`.toLowerCase().includes(term);
  }),
);
const groupedItems = computed(() => [
  { source: "rooms", label: "Rooms" },
  { source: "doors", label: "Doors" },
  { source: "paths", label: "Exterior paths" },
  { source: "nodes", label: "Exterior nodes" },
  { source: "exits", label: "Map transitions" },
  { source: "fixtures", label: "Fixtures" },
  { source: "walls", label: "Visual walls" },
  { source: "links", label: "Room connections" },
  { source: "stands", label: "Room stands" },
].map((group) => ({
  ...group,
  items: editableItems.value.filter((item) => item.source === group.source),
})));
onMounted(async () => {
  try {
    const [buildingResult, catalogResult, beatsResult] = await Promise.all([
      storyApi("/api/world/buildings/utility-station"),
      storyApi("/api/catalog"),
      storyApi("/api/story/areas/part-i/beats"),
    ]);
    applyLoaded(buildingResult);
    characterCatalog.value = catalogResult.character ?? characterCatalog.value;
    storyBeats.value = beatsResult;
  } catch (error) {
    status.value = error.message;
  }
});

function selectStand({ roomId, standId }) {
  if (standId.startsWith("door:")) {
    selectItem("doors", standId.slice("door:".length));
    return;
  }
  selectItem("stands", `${roomId}/${standId}`);
}

function runIndoorAudit() {
  auditResult.value = auditIndoorBuilding(draft.value);
  status.value = auditResult.value.valid
    ? `Indoor audit passed: ${auditResult.value.roomCount} rooms and ${auditResult.value.exteriorNodeCount} exterior nodes are connected.`
    : `Indoor audit found ${auditResult.value.unreachableRooms.length} unreachable room(s) and ${auditResult.value.unreachableExteriorNodes.length} unreachable exterior node(s).`;
}

function openTransitionBeat({
  transitionId,
  direction,
  locationMode,
  location,
  beatId = "",
  create = false,
}) {
  if (!transitionId || !direction || !locationMode || !location) return;
  void router.push({
    path: "/builder/story",
    query: {
      mode: locationMode,
      location,
      mapTransition: transitionId,
      transitionDirection: direction,
      ...(beatId ? { beat: beatId } : {}),
      ...(create ? { create: "1" } : {}),
    },
  });
}

function openLocationBeat({
  locationMode,
  location,
  beatId = "",
  create = false,
}) {
  if (!locationMode || !location) return;
  void router.push({
    path: "/builder/story",
    query: {
      mode: locationMode,
      location,
      ...(beatId ? { beat: beatId } : {}),
      ...(create ? { create: "1" } : {}),
    },
  });
}

</script>

<template>
  <main class="station-builder">
    <BuilderPageHeader title="World Builder">
      <template #tabs>
        <slot name="workspace-switcher" />
      </template>
      <template #actions>
        <button class="sm muted" @click="leftCollapsed = !leftCollapsed">
          {{ leftCollapsed ? "Show objects" : "Hide objects" }}
        </button>
        <button class="sm muted" @click="rightCollapsed = !rightCollapsed">
          {{ rightCollapsed ? "Show inspector" : "Hide inspector" }}
        </button>
        <button class="sm muted" :disabled="!dirty" @click="revertDraft">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveDraft">Save building</button>
      </template>
    </BuilderPageHeader>

    <BuilderStatusBanner
      :status="status"
      :dirty="Boolean(dirty)"
      dirty-message="Unsaved utility station changes"
    />

    <div
      class="station-workspace"
      :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
    >
      <StationObjectBrowser
        v-if="!leftCollapsed"
        v-model:search="search"
        :groups="groupedItems"
        :selected-key="selectedKey"
        @add="addObject"
        @select="selectItem($event.source, $event.id)"
      />

      <StationCanvasPanel
        v-model:level="level"
        v-model:viewport-mode="viewportMode"
        v-model:selected-handle-id="selectedHandleId"
        :loaded="loaded"
        :building="building"
        :selection="selection"
        :all-room-ids="allRoomIds"
        :all-exterior-ids="allExteriorIds"
        :geometry-editing="geometryEditing"
        :can-edit-geometry="canEditGeometry"
        :door-states="doorStates"
        :edit-mode="editMode"
        :edit-handles="editHandles"
        :add-mode="addMode"
        @toggle-geometry-editing="toggleGeometryEditing"
        @select-item="selectItem($event.source, $event.id)"
        @grid-handle-move="onHandleMove"
        @builder-map-click="onMapClick"
        @stand-click="selectStand"
      />

      <StationInspector
        v-if="!rightCollapsed"
        :draft="draft"
        :selection="selection"
        :selected-handle-id="selectedHandleId"
        :selected-path-node="selectedPathNode"
        :roll-door-room="rollDoorRoom"
        :add-mode="addMode"
        :character-catalog="characterCatalog"
        :errors="errors"
        :warnings="warnings"
        :audit-result="auditResult"
        :story-beats="storyBeats"
        :show-history="showHistory"
        :revisions="revisions"
        @move-selected="moveSelected"
        @rename-selected="renameSelected"
        @duplicate-selected="duplicateSelected"
        @delete-selected="deleteSelected"
        @open-location-beat="openLocationBeat"
        @toggle-path-add-mode="togglePathAddMode"
        @remove-selected-path-handle="removeSelectedPathHandle"
        @run-indoor-audit="runIndoorAudit"
        @open-transition-beat="openTransitionBeat"
        @restore-revision="restoreRevision"
      />
    </div>

    <UnsavedChangesDialog
      :visible="navigation.promptVisible.value"
      label="Unsaved utility station changes"
      title="Leave this map workspace?"
      message="Save the draft, discard it, or return to the map without changing workspaces."
      :saving="navigation.saving.value"
      @save="navigation.saveAndContinue"
      @discard="navigation.discardAndContinue"
      @keep="navigation.keepEditing"
    />
  </main>
</template>

<style scoped>
.station-builder { padding: .85rem; }
.tool-group, .canvas-toolbar, .row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.inspector h3 { margin: 0; }
.station-workspace {
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr) minmax(290px, 350px);
  gap: .75rem;
  height: calc(100vh - 13rem);
  min-height: 560px;
  margin-top: .75rem;
}
.station-workspace.left-collapsed { grid-template-columns: minmax(440px, 1fr) minmax(290px, 350px); }
.station-workspace.right-collapsed { grid-template-columns: minmax(220px, 270px) minmax(440px, 1fr); }
.station-workspace.left-collapsed.right-collapsed { grid-template-columns: 1fr; }
.panel { min-width: 0; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: .75rem; }
.inspector { overflow: auto; }
.inspector input, .inspector textarea, .inspector select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .45rem .55rem;
}
button.active { background: #49624f; border-color: #6f9b79; }
.inspector { display: grid; align-content: start; gap: .7rem; }
.inspector label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .8rem; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.empty-note { color: #939ba7; }
.read-only-note, .audit-panel p { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
.audit-panel { display: grid; gap: .4rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.warning { color: #efcb83; font-size: .78rem; }
.history { display: grid; gap: .4rem; }
.revision-item { text-align: left; font-size: .76rem; }
.unsaved-backdrop {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
  padding: 1rem; background: rgba(8, 10, 14, .72); backdrop-filter: blur(3px);
}
.unsaved-dialog {
  width: min(32rem, 100%); padding: 1.25rem; border: 1px solid #4a566b;
  border-radius: 12px; background: #202630; box-shadow: 0 18px 48px rgba(0, 0, 0, .45);
}
.unsaved-dialog h2 { margin: .25rem 0 .65rem; font-size: 1.15rem; }
@media (max-width: 1050px) {
  .station-workspace, .station-workspace.left-collapsed, .station-workspace.right-collapsed {
    grid-template-columns: 220px minmax(420px, 1fr); height: auto;
  }
  .inspector { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .station-workspace, .station-workspace.left-collapsed, .station-workspace.right-collapsed { grid-template-columns: 1fr; }
  .inspector { grid-column: auto; }
}
</style>
