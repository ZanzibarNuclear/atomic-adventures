<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  choice: { type: Object, required: true },
  index: { type: Number, required: true },
  catalog: { type: Object, required: true },
  errors: { type: Object, default: () => ({}) },
  destinationType: { type: Function, required: true },
  flagIds: { type: Array, default: () => [] },
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

const showingFlags = ref(false);

const flagTree = computed(() => {
  const root = { children: new Map(), terminal: false };
  for (const id of props.flagIds) {
    const parts = String(id).split(".").map((part) => part.trim()).filter(Boolean);
    if (!parts.length) continue;
    let node = root;
    for (const part of parts) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map(), terminal: false });
      node = node.children.get(part);
    }
    node.terminal = true;
  }
  return mapChildren(root);
});

const flagRows = computed(() => flattenTree(flagTree.value));

function mapChildren(node, prefix = "") {
  return [...node.children.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, child]) => {
      const id = prefix ? `${prefix}.${label}` : label;
      return {
        id,
        label,
        terminal: child.terminal,
        children: mapChildren(child, id),
      };
    });
}

function flattenTree(nodes, depth = 0) {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
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
      <label>Set flags
        <input
          :value="choice.set_flags.join(', ')"
          @input="$emit('set-csv', { choice, key: 'set_flags', event: $event })"
        />
      </label>
      <div class="flag-browser">
        <button type="button" class="link-button" @click="showingFlags = !showingFlags">
          {{ showingFlags ? "Hide flags" : "Browse flags" }}
        </button>
        <div v-if="showingFlags" class="flag-popover" role="dialog" aria-label="Defined story flags">
          <p v-if="!flagRows.length" class="empty-inline">No flags defined yet.</p>
          <ul v-else class="flag-tree">
            <li
              v-for="node in flagRows"
              :key="node.id"
              :style="{ paddingLeft: `${node.depth * 0.85}rem` }"
            >
              <code :title="node.id">{{ node.label }}</code>
              <span v-if="node.terminal" class="flag-leaf" title="Complete flag ID">flag</span>
            </li>
          </ul>
        </div>
      </div>
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
    <details>
      <summary>Progression effects</summary>
      <div class="field-grid">
        <label>Grant milestones
          <input
            :value="(choice.grantMilestones ?? []).join(', ')"
            @input="$emit('set-csv', { choice, key: 'grantMilestones', event: $event })"
          />
        </label>
        <label>Open passage
          <input v-model="choice.openPassage" placeholder="compound-gate" />
        </label>
        <label>Close passage
          <input v-model="choice.closePassage" placeholder="compound-gate" />
        </label>
        <label>Cross passage
          <input v-model="choice.crossPassage" placeholder="compound-gate" />
        </label>
      </div>
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
  align-items: end;
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

.flag-browser {
  position: relative;
  min-height: 2.4rem;
}

.link-button {
  border: 0;
  padding: 0;
  color: #8ebeff;
  background: transparent;
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.flag-popover {
  position: absolute;
  z-index: 20;
  right: 0;
  top: 1.8rem;
  width: min(26rem, 80vw);
  max-height: 22rem;
  overflow: auto;
  border: 1px solid #4a5568;
  border-radius: 8px;
  padding: 0.75rem;
  background: #10141b;
  box-shadow: 0 18px 45px rgb(0 0 0 / 0.35);
}

.flag-tree {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.flag-tree code {
  color: #e7edf7;
  font-size: 0.82rem;
}

.flag-leaf {
  margin-left: 0.35rem;
  color: #98d6b3;
  font-size: 0.72rem;
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
