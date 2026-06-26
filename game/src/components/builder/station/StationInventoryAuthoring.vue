<script setup>
import CharacterEffectsEditor from "../CharacterEffectsEditor.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  characterCatalog: { type: Object, required: true },
});

function addPickup() {
  const item = props.characterCatalog.items[0];
  const room = props.draft.rooms[0];
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
    <article v-for="(pickup, index) in draft.pickups ?? []" :key="pickup.id" class="reference-card">
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
      <button class="sm danger-outline" @click="removePickup(index)">Remove placement</button>
    </article>
    <button class="sm" @click="addPickup">Add item placement</button>
  </details>

  <details class="inventory-authoring">
    <summary>Interaction character rules</summary>
    <article v-for="action in draft.actions ?? []" :key="action.id" class="reference-card">
      <strong>{{ action.label }} <small>{{ action.id }}</small></strong>
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
  display: grid;
  gap: 0.45rem;
  margin-top: 0.6rem;
  padding: 0.65rem;
  border: 1px solid #394454;
  border-radius: 8px;
  background: #181d25;
}

.reference-card small {
  color: #8f98a6;
  font-weight: 400;
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
