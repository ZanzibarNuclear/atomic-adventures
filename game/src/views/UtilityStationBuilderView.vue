<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storyApi } from "../lib/storyApi.js";
import BuilderPageHeader from "../components/builder/BuilderPageHeader.vue";
import BuilderStatusBanner from "../components/builder/BuilderStatusBanner.vue";
import ConfirmDialog from "../components/builder/ConfirmDialog.vue";
import UnsavedChangesDialog from "../components/builder/UnsavedChangesDialog.vue";
import StationCanvasPanel from "../components/builder/station/StationCanvasPanel.vue";
import StationInspector from "../components/builder/station/StationInspector.vue";
import StationObjectBrowser from "../components/builder/station/StationObjectBrowser.vue";
import { useBuildingBuilderDocument } from "../composables/useBuildingBuilderDocument.js";
import { useConfirmDialog } from "../composables/useConfirmDialog.js";
import { useDirtyDocumentNavigation } from "../composables/useDirtyDocumentNavigation.js";
import { useGridBuilderSelection } from "../composables/useGridBuilderSelection.js";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import {
  listAllGridEditable,
  listEditableRoomsWithStands,
} from "../lib/maps/composables/useGridBuilder.js";
import { auditIndoorBuilding } from "../lib/maps/testing/indoorBuildingAudit.js";
import { useResizableSplit } from "../composables/useResizableSplit.js";

const router = useRouter();
const confirmDialog = useConfirmDialog();
const emptyUtilityStation = {
  id: "utility-station",
  label: "Utility Station",
  cell: 64,
  levels: [],
  rooms: [],
  doors: [],
  links: [],
  switches: [],
  fixtures: [],
  exterior: { nodes: [], paths: [] },
};
const level = ref(emptyUtilityStation.exterior?.level ?? emptyUtilityStation.levels?.at(-1)?.id ?? "");
const search = ref("");
const viewportMode = ref("fit-all");
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const { ratio: inspectorRatio, onHandlePointerDown } = useResizableSplit({
  storageKey: "builder.utility-station.inspectorRatio",
  defaultRatio: 0.5,
});
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
  addRoomStand,
  duplicateSelected,
  deleteSelected,
  moveSelected,
  renameSelected,
} = useGridBuilderSelection({
  draft,
  level,
  status,
  renames,
  requestConfirm: confirmDialog.requestConfirm,
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
    return !term || `${item.id} ${item.label} ${item.source} ${item.kind ?? ""}`.toLowerCase().includes(term);
  }),
);
const groupedItems = computed(() => {
  const term = search.value.trim().toLowerCase();
  const matches = (item) =>
    !term ||
    `${item.id} ${item.label} ${item.source} ${item.kind ?? ""}`.toLowerCase().includes(term);
  const roomItems = listEditableRoomsWithStands(draft.value, level.value)
    .map((room) => ({
      ...room,
      children: (room.children ?? []).filter(matches),
    }))
    .filter((room) => matches(room) || room.children.length > 0);

  return [
    { source: "rooms", label: "Rooms", items: roomItems },
    { source: "doors", label: "Doors" },
    { source: "paths", label: "Exterior paths" },
    { source: "nodes", label: "Exterior nodes" },
    { source: "exits", label: "Map transitions" },
    { source: "fixtures", label: "Fixtures" },
    { source: "links", label: "Room connections" },
    { source: "switches", label: "Switches" },
  ].map((group) =>
    group.source === "rooms"
      ? group
      : {
          ...group,
          items: editableItems.value.filter((item) => item.source === group.source),
        },
  );
});
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

function openArtifact({ catalog = "items", id = "", duplicate = false } = {}) {
  if (!id) return;
  void router.push({
    path: "/builder/content",
    query: {
      mode: "artifacts",
      catalog,
      id,
      ...(duplicate ? { duplicate: "1" } : {}),
    },
  });
}

function duplicateArtifact(payload) {
  openArtifact({ ...payload, duplicate: true });
}

</script>

<template>
  <main class="station-builder">
    <BuilderPageHeader title="World Builder">
      <template #tabs>
        <slot name="workspace-switcher" />
      </template>
      <template #actions>
        <button type="button" class="sm muted" @click="leftCollapsed = !leftCollapsed">
          {{ leftCollapsed ? "Show objects" : "Hide objects" }}
        </button>
        <button type="button" class="sm muted" @click="rightCollapsed = !rightCollapsed">
          {{ rightCollapsed ? "Show inspector" : "Hide inspector" }}
        </button>
        <button type="button" class="sm muted" :disabled="!dirty" @click="revertDraft">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Revert
        </button>
        <button type="button" class="sm muted" @click="loadHistory">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
          </svg>
          History
        </button>
        <button type="button" class="sm success-btn" :disabled="!dirty" @click="saveDraft">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h11l3 3v13H5V4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
            <path d="M8 4v5h8V4M8 20v-7h8v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
          </svg>
          Save building
        </button>
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

      <div class="map-inspector-split">
        <div
          class="split-map"
          :style="rightCollapsed
            ? { flexGrow: 1, flexBasis: 0 }
            : { flexGrow: 1 - inspectorRatio, flexBasis: 0 }"
        >
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
            :audit-result="auditResult"
            @toggle-geometry-editing="toggleGeometryEditing"
            @select-item="selectItem($event.source, $event.id)"
            @grid-handle-move="onHandleMove"
            @builder-map-click="onMapClick"
            @stand-click="selectStand"
            @run-traversal-audit="runIndoorAudit"
          />
        </div>

        <div
          v-if="!rightCollapsed"
          class="split-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize map and inspector"
          tabindex="0"
          @pointerdown="onHandlePointerDown"
        />

        <StationInspector
          v-if="!rightCollapsed"
          class="split-inspector"
          :style="{ flexGrow: inspectorRatio, flexBasis: 0 }"
          :draft="draft"
          :selection="selection"
          :selected-handle-id="selectedHandleId"
          :selected-path-node="selectedPathNode"
          :roll-door-room="rollDoorRoom"
          :add-mode="addMode"
          :character-catalog="characterCatalog"
          :errors="errors"
          :warnings="warnings"
          :story-beats="storyBeats"
          :show-history="showHistory"
          :revisions="revisions"
          @move-selected="moveSelected"
          @rename-selected="renameSelected"
          @duplicate-selected="duplicateSelected"
          @delete-selected="deleteSelected"
          @select-item="selectItem($event.source, $event.id)"
          @add-room-stand="addRoomStand($event)"
          @open-location-beat="openLocationBeat"
          @toggle-path-add-mode="togglePathAddMode"
          @remove-selected-path-handle="removeSelectedPathHandle"
          @open-transition-beat="openTransitionBeat"
          @open-artifact="openArtifact"
          @duplicate-artifact="duplicateArtifact"
          @restore-revision="restoreRevision"
        />
      </div>
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

    <ConfirmDialog
      :visible="confirmDialog.state.visible"
      :eyebrow="confirmDialog.state.eyebrow"
      :title="confirmDialog.state.title"
      :message="confirmDialog.state.message"
      :confirm-label="confirmDialog.state.confirmLabel"
      :cancel-label="confirmDialog.state.cancelLabel"
      :danger="confirmDialog.state.danger"
      @confirm="confirmDialog.accept"
      @cancel="confirmDialog.dismiss"
    />
  </main>
</template>

<style scoped>
.station-builder {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: .85rem;
}
.tool-group, .canvas-toolbar, .row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.inspector h3 { margin: 0; }
.station-workspace {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: .75rem;
  min-height: 0;
  margin-top: .75rem;
}
.station-workspace.left-collapsed { grid-template-columns: minmax(0, 1fr); }
.station-workspace.right-collapsed .map-inspector-split { gap: 0; }
.map-inspector-split {
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 0;
}
.split-map {
  min-width: 12rem;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.split-map > :deep(*) {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
.split-inspector {
  min-width: 16rem;
  min-height: 0;
}
.split-handle {
  flex: 0 0 8px;
  margin: 0 2px;
  border-radius: 999px;
  background: #2c3442;
  cursor: col-resize;
  touch-action: none;
  align-self: stretch;
}
.split-handle:hover,
.split-handle:focus-visible {
  background: #5b6f92;
  outline: none;
}
.panel { min-width: 0; min-height: 0; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: .75rem; }
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
.empty-note { color: #939ba7; }
.read-only-note { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
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
  .station-workspace, .station-workspace.left-collapsed {
    grid-template-columns: 220px minmax(0, 1fr);
    overflow: auto;
  }
  .map-inspector-split {
    flex-direction: column;
  }
  .split-handle {
    display: none;
  }
  .split-map,
  .split-inspector {
    flex: 1 1 auto;
    min-height: 22rem;
  }
}
@media (max-width: 720px) {
  .station-workspace, .station-workspace.left-collapsed { grid-template-columns: 1fr; }
}
</style>
