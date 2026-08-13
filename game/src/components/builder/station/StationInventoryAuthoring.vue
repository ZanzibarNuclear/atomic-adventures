<script setup>
import { computed } from "vue";
import CharacterEffectsEditor from "../CharacterEffectsEditor.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  characterCatalog: { type: Object, required: true },
  selection: { type: Object, default: null },
});

const selectedRoomId = computed(() => {
  if (props.selection?.source === "rooms") return props.selection.id;
  return props.selection?.entity?.room ?? null;
});

const selectedRoom = computed(() =>
  props.draft.rooms.find((room) => room.id === selectedRoomId.value),
);

const roomPickups = computed(() =>
  (props.draft.pickups ?? [])
    .map((pickup, index) => ({ pickup, index }))
    .filter(({ pickup }) => pickup.room === selectedRoomId.value),
);

const roomActions = computed(() =>
  (props.draft.actions ?? []).filter((action) => action.room === selectedRoomId.value),
);

function addPickup() {
  const item = props.characterCatalog.items[0];
  const room = selectedRoom.value;
  if (!item || !room) return;
  const used = new Set((props.draft.pickups ?? []).map((pickup) => pickup.id));
  let id = `${item.id}-pickup`;
  let suffix = 2;
  while (used.has(id)) id = `${item.id}-pickup-${suffix++}`;
  props.draft.pickups ??= [];
  props.draft.pickups.push({
    id,
    room: room.id,
    item: item.id,
    label: item.label,
  });
}

function removePickup(index) {
  props.draft.pickups.splice(index, 1);
}

function actionRequirementIds(action, domain) {
  const value = action.require?.[domain];
  if (Array.isArray(value)) return value.map((entry) => typeof entry === "string" ? entry : entry.id);
  return (value?.all ?? []).map((entry) => typeof entry === "string" ? entry : entry.id);
}

function setActionRequirementIds(action, domain, event) {
  action.require ??= {};
  action.require[domain] = [...event.target.selectedOptions].map((option) => option.value);
}

function ensureActionEffects(action) {
  action.effects ??= [];
  return action.effects;
}
</script>

<template>
  <details class="inventory-authoring">
    <summary>Item placements</summary>
    <p v-if="!selectedRoomId" class="empty-note">Select a room to edit its item placements.</p>
    <p v-else-if="!roomPickups.length" class="empty-note">No item placements in {{ selectedRoom?.label ?? selectedRoomId }}.</p>
    <article v-for="{ pickup, index } in roomPickups" :key="pickup.id" class="reference-card form-section">
      <div class="section-heading">
        <h4>Placement</h4>
        <code>{{ pickup.id }}</code>
      </div>
      <label>Placement ID<input v-model="pickup.id"></label>
      <label>Label<input v-model="pickup.label"></label>
      <label>Room
        <select v-model="pickup.room">
          <option v-for="room in draft.rooms" :key="room.id" :value="room.id">
            {{ room.label }} ({{ room.id }})
          </option>
        </select>
      </label>
      <label>Character item
        <select v-model="pickup.item">
          <option v-for="item in characterCatalog.items" :key="item.id" :value="item.id">
            {{ item.label }} ({{ item.id }})
          </option>
        </select>
      </label>
      <button type="button" class="sm danger-outline" @click="removePickup(index)">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
        </svg>
        Remove placement
      </button>
    </article>
    <button type="button" class="sm add-btn" :disabled="!selectedRoom" @click="addPickup">
      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
      </svg>
      Add item placement
    </button>
  </details>

  <details class="inventory-authoring">
    <summary>Interaction character rules</summary>
    <p v-if="!selectedRoomId" class="empty-note">Select a room to edit its interaction character rules.</p>
    <p v-else-if="!roomActions.length" class="empty-note">No interaction character rules in {{ selectedRoom?.label ?? selectedRoomId }}.</p>
    <article v-for="action in roomActions" :key="action.id" class="reference-card form-section">
      <div class="section-heading">
        <h4>{{ action.label }}</h4>
        <code>{{ action.id }}</code>
      </div>
      <label>Required items
        <select
          multiple
          :value="actionRequirementIds(action, 'items')"
          @change="setActionRequirementIds(action, 'items', $event)">
          <option v-for="item in characterCatalog.items" :key="item.id" :value="item.id">
            {{ item.label }} ({{ item.id }})
          </option>
        </select>
      </label>
      <label>Required knowledge
        <select
          multiple
          :value="actionRequirementIds(action, 'knowledge')"
          @change="setActionRequirementIds(action, 'knowledge', $event)">
          <option
            v-for="entry in characterCatalog.knowledge"
            :key="entry.id"
            :value="entry.id">
            {{ entry.label }} ({{ entry.id }})
          </option>
        </select>
      </label>
      <CharacterEffectsEditor
        :effects="ensureActionEffects(action)"
        :character-catalog="characterCatalog"
        add-label="Add character effect" />
    </article>
  </details>
</template>

<style scoped>
.inventory-authoring {
  margin-top: 0.2rem;
}

.reference-card {
  margin-top: 0.6rem;
}

.empty-note {
  color: #939ba7;
  font-size: 0.82rem;
}

label {
  display: grid;
  gap: 0.3rem;
  color: #bdc4ce;
  font-size: 0.8rem;
}

input,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.45rem 0.55rem;
}
</style>
