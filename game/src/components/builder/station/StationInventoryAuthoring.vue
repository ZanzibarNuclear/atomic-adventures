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

const roomActions = computed(() =>
  (props.draft.actions ?? []).filter((action) => action.room === selectedRoomId.value),
);

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
  <section class="rules-authoring">
    <p class="label">Interaction character rules</p>
    <p v-if="!selectedRoomId" class="empty-note">Select a room to edit its interaction character rules.</p>
    <p v-else-if="!roomActions.length" class="empty-note">
      No interaction character rules in {{ selectedRoom?.label ?? selectedRoomId }}.
    </p>
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
  </section>
</template>

<style scoped>
.rules-authoring {
  display: grid;
  gap: 0.65rem;
}

.reference-card {
  margin-top: 0.15rem;
}

.empty-note {
  margin: 0;
  color: #939ba7;
  font-size: 0.82rem;
}

.label {
  margin: 0;
  color: #8e96a3;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
