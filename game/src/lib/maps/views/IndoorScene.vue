<template>
  <section class="stage" :class="{ expanded }">
    <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
  </section>

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
        v-if="indoor.worldMapExit"
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
      :pickups="indoor.roomPickups"
      @pickup="indoor.tryPickup" />

    <ActionsPanel
      :actions="indoor.availableActions"
      @action="indoor.performAction" />

    <p v-if="indoor.powerOn" class="power-status">
      Station power is on — roll-up doors, outlets, holo-readers, and kitchen
      gear are live.
    </p>

    <div v-if="indoor.roomSwitches.length" class="switches">
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
      @update:model-value="indoor.indoor.viewLevel = $event" />

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
import { isManualEnablerActive } from "../composables/useDoors.js";
import IndoorMapStage from "../components/IndoorMapStage.vue";
import HudPanel from "../components/hud/HudPanel.vue";
import LocationBlock from "../components/hud/LocationBlock.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import InventoryPanel from "../components/hud/InventoryPanel.vue";
import PickupsPanel from "../components/hud/PickupsPanel.vue";
import ActionsPanel from "../components/hud/ActionsPanel.vue";
import DoorControls from "../components/hud/DoorControls.vue";
import ModePillGroup from "../components/hud/ModePillGroup.vue";
import MapControls from "../components/hud/MapControls.vue";

const props = defineProps({
  indoor: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
});

defineEmits(["update:expanded"]);

const floorOptions = computed(() =>
  props.indoor.levelsTopDown.map((lv) => ({
    value: lv.id,
    label: lv.name,
  })),
);

const mapStageProps = computed(() => ({
  building: props.indoor.building,
  currentRoom: props.indoor.indoor.currentRoom ?? "",
  exteriorNode: props.indoor.indoor.exteriorNode,
  avatarWaypoint: props.indoor.indoor.avatarWaypoint,
  discovered: [...props.indoor.indoor.discovered],
  revealed: [...props.indoor.indoor.revealed],
  level: props.indoor.indoor.viewLevel,
  standLevel: props.indoor.indoor.level,
  reachableRooms: props.indoor.reachableRooms,
  reachableExteriorNodes: props.indoor.reachableExteriorNodes,
  doorStates: props.indoor.indoor.doorState,
  expanded: props.expanded,
  interactableDoorIds: props.indoor.interactableDoorIds,
  reachableExitDoors: props.indoor.reachableExitDoors,
  hydroDiscovered: props.indoor.hydroDiscovered ?? false,
}));

const mapStageListeners = computed(() => ({
  "room-click": props.indoor.moveToRoom,
  "exterior-node-click": props.indoor.moveToExteriorNode,
  "door-click": props.indoor.tryToggleDoor,
  "exit-click": props.indoor.exitViaDoor,
}));
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
.power-status {
  margin: 0.75rem 0 0;
  color: #8bc49a;
  font-size: 0.9rem;
}
</style>
