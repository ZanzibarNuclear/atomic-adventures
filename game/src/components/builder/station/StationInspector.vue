<script setup>
import { computed } from "vue";
import RevisionHistoryPanel from "../RevisionHistoryPanel.vue";
import DoorInspector from "./DoorInspector.vue";
import ExteriorNodeInspector from "./ExteriorNodeInspector.vue";
import FixtureInspector from "./FixtureInspector.vue";
import LinkInspector from "./LinkInspector.vue";
import PathInspector from "./PathInspector.vue";
import RoomInspector from "./RoomInspector.vue";
import RoomStandInspector from "./RoomStandInspector.vue";
import StationInventoryAuthoring from "./StationInventoryAuthoring.vue";
import TransitionInspector from "./TransitionInspector.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, default: null },
  selectedHandleId: { type: String, default: null },
  selectedPathNode: { type: Object, default: null },
  rollDoorRoom: { type: Object, default: null },
  addMode: { type: String, default: null },
  characterCatalog: { type: Object, required: true },
  errors: { type: Object, required: true },
  warnings: { type: Array, required: true },
  auditResult: { type: Object, default: null },
  showHistory: { type: Boolean, default: false },
  revisions: { type: Array, required: true },
});

const emit = defineEmits([
  "move-selected",
  "rename-selected",
  "duplicate-selected",
  "delete-selected",
  "toggle-path-add-mode",
  "remove-selected-path-handle",
  "run-indoor-audit",
  "restore-revision",
]);

const errorMessages = computed(() =>
  Object.entries(props.errors).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);

const fixedSelectionSources = new Set(["fixtures", "walls", "links"]);

function selectionEyebrow(source) {
  return source === "exits" ? "map transition" : source;
}

</script>

<template>
  <aside class="inspector panel">
    <template v-if="selection">
      <div>
        <p class="label">{{ selectionEyebrow(selection.source) }}</p>
        <h3>{{ selection.id }}</h3>
      </div>
      <div class="row-actions">
        <button class="sm muted" @click="emit('move-selected', -1)">↑</button>
        <button class="sm muted" @click="emit('move-selected', 1)">↓</button>
        <button class="sm muted" :disabled="fixedSelectionSources.has(selection.source)" @click="emit('rename-selected')">Rename</button>
        <button class="sm muted" :disabled="fixedSelectionSources.has(selection.source)" @click="emit('duplicate-selected')">Duplicate</button>
        <button class="sm danger-outline" :disabled="['fixtures', 'walls'].includes(selection.source)" @click="emit('delete-selected')">Delete</button>
      </div>

      <RoomInspector
        v-if="selection.source === 'rooms'"
        :draft="draft"
        :selection="selection"
      />

      <DoorInspector
        v-else-if="selection.source === 'doors'"
        :draft="draft"
        :selection="selection"
        :character-catalog="characterCatalog"
        :roll-door-room="rollDoorRoom"
      />

      <PathInspector
        v-else-if="selection.source === 'paths'"
        :draft="draft"
        :selection="selection"
        :selected-handle-id="selectedHandleId"
        :selected-path-node="selectedPathNode"
        :add-mode="addMode"
        @toggle-path-add-mode="emit('toggle-path-add-mode', $event)"
        @remove-selected-path-handle="emit('remove-selected-path-handle')"
      />

      <ExteriorNodeInspector
        v-else-if="selection.source === 'nodes'"
        :draft="draft"
        :selection="selection"
      />

      <TransitionInspector
        v-else-if="selection.source === 'exits'"
        :draft="draft"
        :selection="selection"
      />

      <FixtureInspector
        v-else-if="['fixtures', 'walls'].includes(selection.source)"
        :selection="selection"
      />

      <LinkInspector
        v-else-if="selection.source === 'links'"
        :draft="draft"
        :selection="selection"
      />

      <RoomStandInspector
        v-else-if="selection.source === 'stands'"
        :draft="draft"
        :selection="selection"
      />
    </template>
    <p v-else class="empty-note">Select a room, door, path, node, or transition.</p>

    <StationInventoryAuthoring
      :draft="draft"
      :character-catalog="characterCatalog"
      :selection="selection"
    />

    <p v-for="message in errorMessages.slice(0, 12)" :key="message" class="field-error">
      {{ message }}
    </p>
    <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
      {{ warning.path }}: {{ warning.message }}
    </p>
    <section class="audit-panel">
      <button class="sm muted" @click="emit('run-indoor-audit')">Run traversal audit</button>
      <template v-if="auditResult && !auditResult.valid">
        <p v-if="auditResult.unreachableRooms.length">
          Unreachable rooms: {{ auditResult.unreachableRooms.join(", ") }}
        </p>
        <p v-if="auditResult.unreachableExteriorNodes.length">
          Unreachable exterior nodes: {{ auditResult.unreachableExteriorNodes.join(", ") }}
        </p>
      </template>
    </section>
    <RevisionHistoryPanel
      :visible="showHistory"
      title="Building revisions"
      :revisions="revisions"
      @restore="emit('restore-revision', $event)"
    />
  </aside>
</template>

<style scoped>
.panel { min-width: 0; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; padding: .75rem; }
.inspector { overflow: auto; display: grid; align-content: start; gap: .7rem; }
.inspector h3 { margin: 0; }
.inspector input, .inspector textarea, .inspector select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .45rem .55rem;
}
.inspector label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .8rem; }
.row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
button.active { background: #49624f; border-color: #6f9b79; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
.empty-note { color: #939ba7; }
.read-only-note, .audit-panel p { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
.audit-panel { display: grid; gap: .4rem; padding-top: .65rem; border-top: 1px solid #343d4d; }
.field-error { color: #ff9e9e; font-size: .78rem; }
.warning { color: #efcb83; font-size: .78rem; }
</style>
