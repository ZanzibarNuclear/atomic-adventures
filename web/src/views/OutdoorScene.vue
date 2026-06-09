<template>
  <section class="stage" :class="{ expanded }">
    <HexMap
      :map-data="outdoor.displayMapData"
      :route-models="outdoor.routeModels"
      :feature-models="outdoor.featureModels"
      :current-hex="outdoor.state.currentId"
      :discovered="outdoor.discoveredList"
      :mode="outdoor.mode"
      :expanded="expanded"
      :builder-view="builderView"
      :builder-edit="hexBuilder.builderEdit"
      :edit-mode="hexBuilder.editMode"
      :edit-handles="hexBuilder.editHandles"
      :edit-kind="hexBuilder.editParsed?.line?.kind ?? 'path'"
      :selected-handle-id="hexBuilder.selectedHandleId"
      :add-point-mode="hexBuilder.addPointMode"
      :stand-override="outdoor.standOverride"
      :avatar-instant="!!outdoor.state.barrierStand"
      @hex-click="outdoor.moveTo"
      @building-enter="indoor.enterBuilding"
      @select-handle="hexBuilder.onSelectHandle"
      @waypoint-move="hexBuilder.onWaypointMove"
      @builder-map-click="hexBuilder.onBuilderMapClick" />
  </section>

  <HudPanel>
    <LocationBlock
      :title="
        outdoor.currentHexData.landmark?.name ?? outdoor.currentHexData.id
      "
      :blurb="outdoor.currentHexData.landmark?.blurb ?? ''">
      <p v-if="outdoor.atGatePuzzle" class="puzzle-hint">
        Puzzle — find a way through the gate to continue.
      </p>
      <p v-if="outdoor.atBuildingEntrance" class="puzzle-hint">
        Click the utility station on the map to go inside.
      </p>
      <button
        v-if="outdoor.atBuildingEntrance"
        class="enter-btn"
        @click="indoor.enterBuilding()">
        Enter the {{ indoor.building.name }} 🚪
      </button>
    </LocationBlock>

    <TravelOptions label="Follow a route">
      <button
        v-for="m in outdoor.moves"
        :key="m.routeId + m.toHexId"
        class="route-btn"
        :class="'k-' + m.kind"
        :disabled="outdoor.traveling"
        @click="outdoor.moveTo(m.toHexId)">
        Take {{ m.routeName }} {{ m.label }}
        <span class="dest">→ {{ outdoor.nameOf(m.toHexId) }}</span>
      </button>
      <button
        v-for="o in outdoor.offRoad"
        :key="'off-' + o.toHexId"
        class="route-btn off"
        :disabled="outdoor.traveling"
        @click="outdoor.moveTo(o.toHexId)">
        Go off-road {{ o.label }}
        <span v-if="o.blockedBy" class="barrier-hint">· {{ o.blockedBy }}</span>
        <span class="dest">→ ?</span>
      </button>
    </TravelOptions>

    <MapControls>
      <button class="visit-station-btn" @click="indoor.visitStation">
        Visit {{ indoor.building.name }} 🏭
      </button>
      <button :disabled="outdoor.traveling" @click="outdoor.autoTravel">
        Auto-travel main path ⏩
      </button>
      <button @click="$emit('reset')">Reset</button>
      <button @click="$emit('update:expanded', !expanded)">
        {{ expanded ? "Collapse map" : "Expand map ⤢" }}
      </button>
    </MapControls>

    <ModePillGroup
      group-label="View"
      :model-value="outdoor.mode"
      :options="viewModes"
      :checkbox="{ label: 'builder' }"
      :checkbox-value="builderView"
      @update:model-value="outdoor.mode = $event"
      @update:checkbox-value="$emit('update:builderView', $event)" />

    <HexMapBuilderPanel
      v-if="builderView"
      :editable-items="hexBuilder.editableItems"
      :edit-selection="hexBuilder.editSelection"
      :edit-mode="hexBuilder.editMode"
      :edit-parsed="hexBuilder.editParsed"
      :edit-handles="hexBuilder.editHandles"
      :selected-handle-id="hexBuilder.selectedHandleId"
      :add-point-mode="hexBuilder.addPointMode"
      :stand-anchored-to-landmark="hexBuilder.standAnchoredToLandmark"
      :export-status="hexBuilder.exportStatus"
      :has-landmark-marker="hexBuilder.hasLandmarkMarker"
      @update:edit-selection="hexBuilder.editSelection = $event"
      @update:add-point-mode="hexBuilder.addPointMode = $event"
      @toggle-smooth="hexBuilder.toggleSmooth"
      @toggle-stand-anchor="hexBuilder.toggleStandAnchor"
      @delete-point="hexBuilder.deleteSelectedPoint"
      @export="onExport" />

    <p class="progress">
      Discovered {{ outdoor.discoveredList.length }} /
      {{ outdoor.mapData.hexes.length }} hexes
    </p>
  </HudPanel>
</template>

<script setup>
import HexMap from "../components/HexMap.vue";
import HudPanel from "../components/hud/HudPanel.vue";
import LocationBlock from "../components/hud/LocationBlock.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import MapControls from "../components/hud/MapControls.vue";
import ModePillGroup from "../components/hud/ModePillGroup.vue";
import HexMapBuilderPanel from "../components/builder/HexMapBuilderPanel.vue";

const props = defineProps({
  outdoor: { type: Object, required: true },
  hexBuilder: { type: Object, required: true },
  indoor: { type: Object, required: true },
  builderView: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
});

defineEmits(["reset", "update:expanded", "update:builderView"]);

const viewModes = [
  { value: "slice", label: "slice" },
  { value: "explored", label: "explored" },
  { value: "full", label: "full" },
];

function onExport(key) {
  const hb = props.hexBuilder;
  if (key === "download") hb.downloadYaml();
  else if (key === "reset") hb.resetMapBuilder();
  else hb.copyYaml(key);
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
.puzzle-hint {
  margin: 0.35rem 0 0;
  color: #d4a84b;
  font-size: 0.9rem;
}
.enter-btn {
  margin-top: 0.6rem;
  align-self: flex-start;
  background: #3a5a3f;
  border-color: #4e7a55;
}
.enter-btn:hover {
  background: #46694c;
}
.visit-station-btn {
  background: #3a4a5a;
  border-color: #5a7088;
}
.visit-station-btn:hover {
  background: #465a6e;
}
.barrier-hint {
  color: #a89878;
  font-size: 0.85em;
  text-transform: capitalize;
}
.progress {
  margin: 0;
  color: #6f7787;
  font-size: 0.85rem;
}
</style>
