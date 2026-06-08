<template>
  <BuilderPanel class="builder-sidebar">
    <span class="label">Grid builder</span>
    <select
      :value="gridEditSelection"
      class="builder-select"
      @change="$emit('update:gridEditSelection', $event.target.value)">
      <optgroup label="Paths">
        <option
          v-for="item in gridEditableItems.filter((i) => i.source === 'paths')"
          :key="item.id"
          :value="`${item.source}:${item.id}`">
          {{ item.label }}
        </option>
      </optgroup>
      <optgroup label="Rooms">
        <option
          v-for="item in gridEditableItems.filter((i) => i.source === 'rooms')"
          :key="item.id"
          :value="`${item.source}:${item.id}`">
          {{ item.label }}
        </option>
      </optgroup>
      <optgroup label="Doors">
        <option
          v-for="item in gridEditableItems.filter((i) => i.source === 'doors')"
          :key="item.id"
          :value="`${item.source}:${item.id}`">
          {{ item.label }}
        </option>
      </optgroup>
      <optgroup label="Nodes">
        <option
          v-for="item in gridEditableItems.filter((i) => i.source === 'nodes')"
          :key="item.id"
          :value="`${item.source}:${item.id}`">
          {{ item.label }}
        </option>
      </optgroup>
      <optgroup label="World map exits">
        <option
          v-for="item in gridEditableItems.filter((i) => i.source === 'exits')"
          :key="item.id"
          :value="`${item.source}:${item.id}`">
          {{ item.label }}
        </option>
      </optgroup>
    </select>

    <BuilderLineActions
      v-if="gridEditMode === 'line'"
      :smooth="gridEditParsed?.entity?.smooth"
      add-point-label="click to add waypoint"
      add-point-hint="Orange waypoint on the nearest cyan segment, at the click location."
      add-node-label="click to add node"
      add-node-hint="Green stand spot on the route (walk stop + label). Inserted on the nearest segment between existing nodes."
      delete-point-label="Delete waypoint"
      delete-node-label="Delete node"
      :add-point-mode="gridAddPointMode"
      :add-node-mode="gridAddNodeMode"
      :can-delete-point="!!gridSelectedHandleId?.startsWith('point-')"
      :can-delete-node="!!gridSelectedPathNodeId && !gridSelectedPathNode?.door"
      @toggle-smooth="$emit('toggle-smooth')"
      @update:add-point-mode="$emit('update:gridAddPointMode', $event)"
      @update:add-node-mode="$emit('update:gridAddNodeMode', $event)"
      @delete-point="$emit('delete-point')"
      @delete-node="$emit('delete-node')" />

    <PathNodePropsEditor
      v-if="gridEditMode === 'line' && gridSelectedPathNode"
      :node="gridSelectedPathNode"
      @update-label="$emit('update-path-node-label', gridSelectedPathNode.id, $event)" />

    <RoomPropsEditor
      v-if="gridEditMode === 'room'"
      :room="gridEditParsed.entity"
      :room-id="gridEditParsed.id"
      @update-name="$emit('update-room-name', gridEditParsed.id, $event)"
      @update-rect="$emit('update-room-rect', gridEditParsed.id, $event)" />

    <DoorPropsEditor
      v-if="gridEditMode === 'door'"
      :door="gridEditParsed.entity"
      :door-id="gridEditParsed.id"
      :roll-door-room="gridRollDoorRoom"
      @update-at="
        (x, y) => $emit('update-door-at', gridEditParsed.id, x, y)
      "
      @update-vertical="$emit('update-door-vertical', gridEditParsed.id, $event)"
      @update-roll="$emit('update-roll-door', gridEditParsed.id, $event)" />

    <StandaloneNodePropsEditor
      v-if="gridEditMode === 'node'"
      :node="gridEditParsed.entity"
      :node-id="gridEditParsed.id"
      @update-label="$emit('update-node-label', gridEditParsed.id, $event)"
      @update-at="
        (x, y) => $emit('update-node-at', gridEditParsed.id, x, y)
      " />

    <ExitPropsEditor
      v-if="gridEditMode === 'exit'"
      :exit="gridEditParsed.entity"
      :map-at="exitMapAt"
      @update-map-at="
        (x, y) => $emit('update-exit-map-at', gridEditParsed.id, x, y)
      "
      @reset-map-at="$emit('reset-exit-map-at', gridEditParsed.id)" />

    <div class="builder-actions playtest">
      <span class="label">Playtest</span>
      <button class="sm" @click="$emit('open-all-doors')">Open all doors</button>
      <button class="sm" @click="$emit('close-all-doors')">Close all doors</button>
    </div>

    <p class="builder-hint">
      <template v-if="gridEditMode === 'line'">
        Pink = smoothed path preview. Cyan dashed = control polygon. Orange
        handles = curve waypoints; green = path nodes (stand spots). Use “click
        to add waypoint” or “click to add node” below.
      </template>
      <template v-else-if="gridEditMode === 'room'">
        Drag purple center to move; yellow corners to resize. Click a room on the
        map to select it.
      </template>
      <template v-else-if="gridEditMode === 'door'">
        <template v-if="gridEditParsed?.entity?.kind === 'man'">
          Drag the green handle to reposition the man door.
        </template>
        <template v-else>
          Adjust roll-up edge and span in the panel — position follows room
          geometry.
        </template>
      </template>
      <template v-else-if="gridEditMode === 'node'">
        Drag the green handle to move an exterior stand spot.
      </template>
      <template v-else-if="gridEditMode === 'exit'">
        Click the ⬡ marker to select it, then drag the green handle (or edit
        Map X/Y). Exits do not leave the building while builder is on.
      </template>
    </p>

    <p class="builder-hint builder-export-note">
      Paste each section into <code>utility-station.yaml</code>, replacing the
      matching block. Save the file and the map reloads automatically.
    </p>

    <BuilderExportBar
      :buttons="exportButtons"
      :status="gridExportStatus"
      @action="$emit('export', $event)" />
  </BuilderPanel>
</template>

<script setup>
import { computed } from "vue";
import { getExitMapAt } from "../../composables/useGridBuilder.js";
import BuilderPanel from "./BuilderPanel.vue";
import BuilderLineActions from "./BuilderLineActions.vue";
import BuilderExportBar from "./BuilderExportBar.vue";
import RoomPropsEditor from "./props/RoomPropsEditor.vue";
import DoorPropsEditor from "./props/DoorPropsEditor.vue";
import PathNodePropsEditor from "./props/PathNodePropsEditor.vue";
import StandaloneNodePropsEditor from "./props/StandaloneNodePropsEditor.vue";
import ExitPropsEditor from "./props/ExitPropsEditor.vue";

const props = defineProps({
  gridEditableItems: { type: Array, required: true },
  gridEditSelection: { type: String, default: "" },
  gridEditMode: { type: String, default: null },
  gridEditParsed: { type: Object, default: null },
  gridAddPointMode: { type: Boolean, default: false },
  gridAddNodeMode: { type: Boolean, default: false },
  gridSelectedHandleId: { type: String, default: null },
  gridSelectedPathNodeId: { type: String, default: null },
  gridSelectedPathNode: { type: Object, default: null },
  gridRollDoorRoom: { type: Object, default: null },
  gridExportStatus: { type: String, default: "" },
});

defineEmits([
  "update:gridEditSelection",
  "update:gridAddPointMode",
  "update:gridAddNodeMode",
  "toggle-smooth",
  "delete-point",
  "delete-node",
  "update-path-node-label",
  "update-room-name",
  "update-room-rect",
  "update-door-at",
  "update-door-vertical",
  "update-roll-door",
  "update-node-label",
  "update-node-at",
  "update-exit-map-at",
  "reset-exit-map-at",
  "open-all-doors",
  "close-all-doors",
  "export",
]);

const exitMapAt = computed(() =>
  props.gridEditParsed?.entity
    ? getExitMapAt(props.gridEditParsed.entity)
    : { x: 0, y: 0 },
);

const exportButtons = [
  { key: "rooms", label: "Copy rooms" },
  { key: "doors", label: "Copy doors" },
  { key: "exits", label: "Copy exits" },
  { key: "exterior", label: "Copy exterior" },
  { key: "all", label: "Copy all" },
  { key: "download", label: "Download" },
  { key: "reset", label: "Reset", muted: true },
];
</script>

<style scoped>
.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.builder-sidebar {
  max-height: min(58vh, 560px);
  overflow-y: auto;
}
@media (max-width: 720px) {
  .builder-sidebar {
    max-height: none;
  }
}
.builder-select {
  width: 100%;
  max-width: 420px;
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.88rem;
}
.builder-actions.playtest {
  flex-direction: column;
  align-items: stretch;
}
.builder-hint {
  margin: 0;
  color: #8a919e;
  font-size: 0.82rem;
  line-height: 1.45;
}
</style>
