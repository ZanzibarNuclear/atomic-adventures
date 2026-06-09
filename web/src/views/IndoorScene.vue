<template>
  <div :class="{ 'grid-builder-workspace': builderView }">
    <section class="stage" :class="{ expanded, 'builder-stage': builderView }">
      <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
    </section>

    <GridBuilderSidebar
      v-if="builderView"
      :grid-editable-items="gridBuilder.gridEditableItems"
      :grid-edit-selection="gridBuilder.gridEditSelection"
      :grid-edit-mode="gridBuilder.gridEditMode"
      :grid-edit-parsed="gridBuilder.gridEditParsed"
      :grid-add-point-mode="gridBuilder.gridAddPointMode"
      :grid-add-node-mode="gridBuilder.gridAddNodeMode"
      :grid-selected-handle-id="gridBuilder.gridSelectedHandleId"
      :grid-selected-path-node-id="gridBuilder.gridSelectedPathNodeId"
      :grid-selected-path-node="gridBuilder.gridSelectedPathNode"
      :grid-roll-door-room="gridBuilder.gridRollDoorRoom"
      :grid-export-status="gridBuilder.gridExportStatus"
      @update:grid-edit-selection="gridBuilder.gridEditSelection = $event"
      @update:grid-add-point-mode="gridBuilder.gridAddPointMode = $event"
      @update:grid-add-node-mode="gridBuilder.gridAddNodeMode = $event"
      @toggle-smooth="gridBuilder.toggleGridSmooth"
      @delete-point="gridBuilder.deleteGridSelectedPoint"
      @delete-node="gridBuilder.deleteGridSelectedPathNode"
      @update-path-node-label="onPathNodeLabel"
      @update-room-name="onRoomName"
      @update-room-rect="onRoomRect"
      @update-door-at="onDoorAt"
      @update-door-vertical="onDoorVertical"
      @update-roll-door="onRollDoor"
      @update-node-label="onNodeLabel"
      @update-node-at="onNodeAt"
      @update-exit-map-at="onExitMapAt"
      @reset-exit-map-at="onResetExitMapAt"
      @open-all-doors="indoor.openAllInteriorDoors"
      @close-all-doors="indoor.closeAllInteriorDoors"
      @export="onGridExport" />
  </div>

  <HudPanel>
    <LocationBlock
      :label="indoor.building.name"
      :title="
        indoor.currentExteriorNode?.label ??
        indoor.currentRoomData?.name ??
        indoor.currentRoomData?.id ??
        ''
      "
      :blurb="
        indoor.currentRoomData?.blurb ??
        (indoor.currentExteriorNode
          ? 'Walk the footpath — click green dots to move. Any ⬡ map marker (or the button below) takes you to the hex travel map.'
          : '')
      ">
      <button
        v-if="indoor.worldMapExit && !builderView"
        class="world-map-btn"
        @click="indoor.exitViaDoor(indoor.worldMapExit.doorId)">
        {{ indoor.worldMapExit.label }}
      </button>
      <p
        v-else-if="
          !indoor.indoor.exteriorNode &&
          indoor.reachableExitDoors.length &&
          !indoor.worldMapExit
        "
        class="puzzle-hint">
        Open an exterior door to unlock travel to the world map.
      </p>
      <p
        v-if="
          !indoor.indoor.exteriorNode &&
          indoor.reachableExitDoors.length &&
          indoor.indoor.currentRoom
        "
        class="puzzle-hint">
        Open the exterior door, then step out to the footpath (Move or green dot)
        or use the ⬡ map marker for the world map.
      </p>
      <p v-if="indoor.exitTravelHint" class="puzzle-hint">
        {{ indoor.exitTravelHint }}
      </p>
    </LocationBlock>

    <TravelOptions>
      <button
        v-for="m in indoor.indoorMoves"
        :key="indoor.moveKey(m)"
        class="route-btn"
        :class="
          'k-' +
          (m.kind === 'door' ? 'path' : m.kind === 'path' ? 'trail' : 'road')
        "
        :disabled="indoor.indoor.moving"
        @click="indoor.applyIndoorMove(m)">
        Go {{ m.label }}
        <span class="dest"
          >→
          {{
            m.toExteriorNode
              ? m.toName
              : m.onSpiral ||
                  indoor.isDestinationNamed(m.toRoomId, indoor.indoorVisibility)
                ? m.toName
                : "?"
          }}</span
        >
      </button>
    </TravelOptions>

    <InventoryPanel :items="indoor.carriedItems" />

    <PickupsPanel
      v-if="!builderView"
      :pickups="indoor.roomPickups"
      @pickup="indoor.tryPickup" />

    <div v-if="indoor.roomSwitches.length && !builderView" class="switches">
      <span class="label">Garage controls</span>
      <div v-for="sw in indoor.roomSwitches" :key="sw.id" class="switch-row">
        <button class="sm" @click="indoor.toggleManualRelease(sw.door)">
          {{
            isManualEnablerActive(sw.door, indoor.indoor.facility)
              ? "Engage motor"
              : sw.label
          }}
        </button>
      </div>
    </div>

    <DoorControls
      :doors="indoor.nearbyDoors"
      :building="indoor.building"
      :door-state="indoor.indoor.doorState"
      :facility="indoor.indoor.facility"
      :inventory="indoor.indoor.inventory"
      :player-room-id="indoor.playerRoomId"
      :door-state-for="indoor.doorStateFor"
      :door-lock-hint="indoor.doorLockHint"
      :can-toggle-door-lock="indoor.canToggleDoorLock"
      @break-lock="indoor.tryBreakLock"
      @toggle-lock="indoor.tryToggleLock"
      @toggle-door="indoor.tryToggleDoor" />

    <ModePillGroup
      group-label="Floor"
      :model-value="indoor.indoor.viewLevel"
      :options="floorOptions"
      :checkbox="{ label: 'builder' }"
      :checkbox-value="builderView"
      @update:model-value="indoor.indoor.viewLevel = $event"
      @update:checkbox-value="$emit('update:builderView', $event)" />

    <MapControls>
      <button @click="indoor.exitBuilding">← Step outside</button>
      <button @click="indoor.resetIndoor">Reset</button>
      <button @click="$emit('update:expanded', !expanded)">
        {{ expanded ? "Collapse map" : "Expand map ⤢" }}
      </button>
    </MapControls>

    <p class="progress">
      Explored {{ indoor.indoor.discovered.size }} /
      {{ indoor.building.rooms.length }} rooms
    </p>
  </HudPanel>
</template>

<script setup>
import { computed } from "vue";
import {
  setNodeLabel,
  setRoomName,
  setRoomRect,
  setDoorAt,
  setRollDoorProps,
  setNodeAt,
  setExitMapAt,
} from "../composables/useGridBuilder.js";
import { isManualEnablerActive } from "../composables/useDoors.js";
import IndoorMapStage from "../components/IndoorMapStage.vue";
import GridBuilderSidebar from "../components/builder/GridBuilderSidebar.vue";
import HudPanel from "../components/hud/HudPanel.vue";
import LocationBlock from "../components/hud/LocationBlock.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import InventoryPanel from "../components/hud/InventoryPanel.vue";
import PickupsPanel from "../components/hud/PickupsPanel.vue";
import DoorControls from "../components/hud/DoorControls.vue";
import ModePillGroup from "../components/hud/ModePillGroup.vue";
import MapControls from "../components/hud/MapControls.vue";

const props = defineProps({
  indoor: { type: Object, required: true },
  gridBuilder: { type: Object, required: true },
  builderView: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
});

defineEmits(["update:expanded", "update:builderView"]);

const floorOptions = computed(() =>
  props.indoor.levelsTopDown.map((lv) => ({
    value: lv.id,
    label: lv.name,
  })),
);

const mapStageProps = computed(() => {
  const base = {
    building: props.indoor.building,
    currentRoom: props.indoor.indoor.currentRoom ?? "",
    exteriorNode: props.indoor.indoor.exteriorNode,
    discovered: [...props.indoor.indoor.discovered],
    revealed: [...props.indoor.indoor.revealed],
    level: props.indoor.indoor.viewLevel,
    standLevel: props.indoor.indoor.level,
    reachableRooms: props.indoor.reachableRooms,
    reachableExteriorNodes: props.indoor.reachableExteriorNodes,
    doorStates: props.indoor.indoor.doorState,
    builderView: props.builderView,
    expanded: props.expanded,
    interactableDoorIds: props.indoor.interactableDoorIds,
    reachableExitDoors: props.indoor.reachableExitDoors,
    hydroDiscovered: props.indoor.flags?.['hydro.discovered'] ?? false,
  };
  if (!props.builderView) return base;
  const gb = props.gridBuilder;
  return {
    ...base,
    builderEdit: gb.gridBuilderEdit,
    editMode: gb.gridEditMode,
    editHandles: gb.gridEditHandles,
    selectedHandleId: gb.gridSelectedHandleId,
    selectedItemId: gb.gridEditParsed?.id ?? "",
    addPointMode: gb.gridAddPointMode || gb.gridAddNodeMode,
    mapClickMode: gb.gridAddNodeMode
      ? "node"
      : gb.gridAddPointMode
        ? "point"
        : null,
  };
});

const mapStageListeners = computed(() => {
  const base = {
    "room-click": props.indoor.moveToRoom,
    "exterior-node-click": props.indoor.moveToExteriorNode,
    "door-click": props.indoor.tryToggleDoor,
    "exit-click": props.indoor.exitViaDoor,
  };
  if (!props.builderView) return base;
  const gb = props.gridBuilder;
  return {
    ...base,
    "select-handle": (id) => {
      gb.gridSelectedHandleId = id;
    },
    "grid-handle-move": gb.onGridHandleMove,
    "builder-map-click": gb.onGridBuilderMapClick,
    "select-item": gb.onGridSelectItem,
  };
});

function onPathNodeLabel(nodeId, label) {
  setNodeLabel(props.indoor.editableBuildingData, nodeId, label);
}

function onRoomName(roomId, name) {
  setRoomName(props.indoor.editableBuildingData, roomId, name);
}

function onRoomRect(roomId, patch) {
  setRoomRect(props.indoor.editableBuildingData, roomId, patch);
}

function onDoorAt(doorId, x, y) {
  setDoorAt(props.indoor.editableBuildingData, doorId, x, y);
}

function onDoorVertical(doorId, vertical) {
  const door = props.indoor.editableBuildingData.doors?.find(
    (d) => d.id === doorId,
  );
  if (door) door.vertical = vertical;
}

function onRollDoor(doorId, patch) {
  setRollDoorProps(props.indoor.editableBuildingData, doorId, patch);
}

function onNodeLabel(nodeId, label) {
  setNodeLabel(props.indoor.editableBuildingData, nodeId, label);
}

function onNodeAt(nodeId, x, y) {
  setNodeAt(props.indoor.editableBuildingData, nodeId, x, y);
}

function onExitMapAt(exitId, x, y) {
  setExitMapAt(props.indoor.editableBuildingData, exitId, x, y);
}

function onResetExitMapAt(exitId) {
  const exit = props.indoor.editableBuildingData.exits?.find(
    (e) => e.id === exitId,
  );
  if (exit) exit.mapAt = undefined;
}

function onGridExport(key) {
  const gb = props.gridBuilder;
  if (key === "download") gb.downloadGridYaml();
  else if (key === "reset") gb.resetGridBuilder();
  else gb.copyGridYaml(key);
}
</script>

<style scoped>
.stage {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.stage.expanded {
  display: block;
}
.grid-builder-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) min(320px, 28%);
  gap: 1rem;
  align-items: start;
  margin-bottom: 1.5rem;
}
.builder-stage {
  min-width: 0;
}
@media (max-width: 720px) {
  .grid-builder-workspace {
    grid-template-columns: 1fr;
  }
}
.puzzle-hint {
  margin: 0.35rem 0 0;
  color: #d4a84b;
  font-size: 0.9rem;
}
.world-map-btn {
  margin-top: 0.6rem;
  align-self: flex-start;
  background: #3d5a4a;
  border-color: #5a8870;
}
.world-map-btn:hover {
  background: #4a7560;
}
.switches {
  margin-top: 0.75rem;
}
.switch-row {
  margin-top: 0.35rem;
}
.progress {
  margin: 0;
  color: #6f7787;
  font-size: 0.85rem;
}
</style>
