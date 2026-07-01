<script setup>
defineProps({
  choice: { type: Object, required: true },
  index: { type: Number, required: true },
  catalog: { type: Object, required: true },
  errors: { type: Object, default: () => ({}) },
  destinationType: { type: Function, required: true },
});

defineEmits([
  "move",
  "remove",
  "set-csv",
  "set-destination-type",
  "set-view-kind",
]);

function enableTimeUntil(choice) {
  choice.timeMinutes = 0;
  choice.timeUntil = { day: null, dayOffset: 1, minuteOfDay: 420 };
  choice.activity = "resting";
}

function disableTimeUntil(choice) {
  choice.timeUntil = null;
}
</script>

<template>
  <article class="choice-editor">
    <div class="choice-toolbar">
      <strong>Choice {{ index + 1 }}</strong>
      <div>
        <button type="button" class="sm muted" @click="$emit('move', -1)">↑</button>
        <button type="button" class="sm muted" @click="$emit('move', 1)">↓</button>
        <button type="button" class="sm muted" @click="$emit('remove')">Remove</button>
      </div>
    </div>
    <label>Label<input v-model="choice.text" /></label>
    <div class="field-grid">
      <label>Sets
        <input
          :value="choice.sets.join(', ')"
          @input="$emit('set-csv', { choice, key: 'sets', event: $event })"
        />
      </label>
      <label>Set flags
        <input
          :value="choice.set_flags.join(', ')"
          @input="$emit('set-csv', { choice, key: 'set_flags', event: $event })"
        />
      </label>
    </div>
    <details>
      <summary>Time cost</summary>
      <div class="field-grid">
        <label>Game minutes<input v-model.number="choice.timeMinutes" type="number" min="0" :disabled="Boolean(choice.timeUntil)"></label>
        <label>Activity
          <select v-model="choice.activity">
            <option>resting</option><option>light</option>
            <option>moderate</option><option>strenuous</option>
          </select>
        </label>
      </div>
      <label class="inline-check">
        <input
          type="checkbox"
          :checked="Boolean(choice.timeUntil)"
          @change="$event.target.checked ? enableTimeUntil(choice) : disableTimeUntil(choice)"
        >
        Sleep until a clock time
      </label>
      <div v-if="choice.timeUntil" class="field-grid">
        <label>Day offset
          <input v-model.number="choice.timeUntil.dayOffset" type="number" min="0">
        </label>
        <label>Minute of day
          <input v-model.number="choice.timeUntil.minuteOfDay" type="number" min="0" max="1439">
        </label>
      </div>
      <p v-for="message in errors[`choices.${index}.timeMinutes`] ?? []" :key="message" class="field-error">{{ message }}</p>
      <p v-for="message in errors[`choices.${index}.timeUntil.minuteOfDay`] ?? []" :key="message" class="field-error">{{ message }}</p>
    </details>
    <label>Action
      <select
        :value="destinationType(choice)"
        @change="$emit('set-destination-type', { choice, type: $event.target.value })"
      >
        <option value="">Do nothing</option>
        <option value="hex">Outdoor move</option>
        <option value="room">Indoor move</option>
        <option value="exterior">Exterior path move</option>
        <option value="enter">Enter building</option>
        <option value="view">Open stage view</option>
      </select>
    </label>
    <select v-if="choice.go_hex" v-model="choice.go_hex">
      <option v-for="hex in catalog.world.hexes" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
    </select>
    <select v-if="choice.go_room" v-model="choice.go_room">
      <option v-for="room in catalog.world.rooms" :key="room.id" :value="room.id">{{ room.label }} ({{ room.id }})</option>
    </select>
    <select v-if="choice.go_exterior_node" v-model="choice.go_exterior_node">
      <option v-for="node in catalog.world.exteriorNodes" :key="node.id" :value="node.id">{{ node.label }} ({{ node.id }})</option>
    </select>
    <select v-if="choice.enter" v-model="choice.enter">
      <option v-for="item in catalog.world.buildings" :key="item.id" :value="item.id">{{ item.label }}</option>
    </select>
    <div v-if="choice.view" class="field-grid">
      <label>Stage view
        <select
          :value="choice.view.kind"
          @change="$emit('set-view-kind', { choice, kind: $event.target.value })"
        >
          <option value="inventory">Inventory</option>
          <option value="character-stats">Character stats</option>
          <option value="lesson">Holo-reader lesson</option>
        </select>
      </label>
      <label v-if="choice.view.kind === 'character-stats'">Focus
        <input v-model="choice.view.focus" placeholder="health" />
      </label>
      <label v-if="choice.view.kind === 'lesson'">Lesson
        <select v-model="choice.view.id">
          <option value="">Choose a lesson</option>
          <option
            v-for="lesson in catalog.learning?.lessons ?? []"
            :key="lesson.id"
            :value="lesson.id">
            {{ lesson.title }} ({{ lesson.id }})
          </option>
        </select>
      </label>
    </div>
    <p v-for="message in errors[`choices.${index}.destination`] ?? []" :key="message" class="field-error">{{ message }}</p>
    <p v-for="message in errors[`choices.${index}.view.kind`] ?? []" :key="message" class="field-error">{{ message }}</p>
  </article>
</template>

<style scoped>
.choice-editor {
  display: grid;
  gap: 0.65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  padding: 0.75rem;
  background: #1b2028;
}

.choice-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

label {
  display: grid;
  gap: 0.25rem;
}

.inline-check {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.inline-check input {
  width: auto;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 6px;
  background: #171b22;
  color: #dbe2ea;
  padding: 0.45rem;
}

.field-error {
  color: #ff9e9e;
  font-size: 0.78rem;
  margin: 0.2rem 0 0;
}

@media (max-width: 900px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
