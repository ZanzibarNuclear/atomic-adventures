<script setup>
import { computed, ref, watch } from "vue";

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

const editing = ref(false);
const showingFlags = ref(false);

watch(
  () => props.choice?.id,
  () => {
    editing.value = false;
    showingFlags.value = false;
  },
);

const title = computed(() => {
  const text = String(props.choice?.text ?? "").trim();
  return text || "Untitled choice";
});

const summaryParts = computed(() => {
  const choice = props.choice;
  const parts = [];
  const dest = props.destinationType(choice);

  if (dest === "hex" && choice.go_hex) {
    parts.push({ key: "dest", label: "Outdoor move", detail: catalogLabel("hexes", choice.go_hex) });
  } else if (dest === "room" && choice.go_room) {
    parts.push({ key: "dest", label: "Indoor move", detail: catalogLabel("rooms", choice.go_room) });
  } else if (dest === "exterior" && choice.go_exterior_node) {
    parts.push({
      key: "dest",
      label: "Exterior path",
      detail: catalogLabel("exteriorNodes", choice.go_exterior_node),
    });
  } else if (dest === "enter" && choice.enter) {
    parts.push({
      key: "dest",
      label: "Enter building",
      detail: catalogLabel("buildings", choice.enter),
    });
  } else if (dest === "view" && choice.view?.kind) {
    const viewDetail = [
      choice.view.kind,
      choice.view.focus || choice.view.id || null,
    ].filter(Boolean).join(" · ");
    parts.push({ key: "dest", label: "Stage view", detail: viewDetail });
  } else {
    parts.push({ key: "dest", label: "No movement", detail: null });
  }

  const flags = choice.set_flags ?? [];
  if (flags.length) {
    parts.push({
      key: "flags",
      label: flags.length === 1 ? "Flag" : "Flags",
      detail: flags.join(", "),
    });
  }

  if (choice.timeUntil) {
    parts.push({
      key: "time",
      label: "Sleep until",
      detail: `day +${choice.timeUntil.dayOffset ?? 0}, minute ${choice.timeUntil.minuteOfDay ?? 0} · ${choice.activity || "resting"}`,
    });
  } else if (Number(choice.timeMinutes) > 0) {
    parts.push({
      key: "time",
      label: "Time",
      detail: `${choice.timeMinutes} min · ${choice.activity || "light"}`,
    });
  }

  const milestones = choice.grantMilestones ?? [];
  if (milestones.length) {
    parts.push({ key: "milestones", label: "Milestones", detail: milestones.join(", ") });
  }

  const passages = [
    choice.openPassage && `open ${choice.openPassage}`,
    choice.closePassage && `close ${choice.closePassage}`,
    choice.crossPassage && `cross ${choice.crossPassage}`,
  ].filter(Boolean);
  if (passages.length) {
    parts.push({ key: "passage", label: "Passage", detail: passages.join(", ") });
  }

  return parts;
});

function catalogLabel(collection, id) {
  const list = props.catalog?.world?.[collection] ?? [];
  const entry = list.find((item) => item.id === id);
  if (!entry) return id;
  return entry.label && entry.label !== id ? `${entry.label} (${id})` : id;
}

function enableTimeUntil(choice) {
  choice.timeMinutes = 0;
  choice.timeUntil = { day: null, dayOffset: 1, minuteOfDay: 420 };
  choice.activity = "resting";
}

function disableTimeUntil(choice) {
  choice.timeUntil = null;
}

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
  <article class="choice-editor" :class="{ editing }">
    <div class="choice-toolbar">
      <strong class="choice-title" :title="title">{{ title }}</strong>
      <div class="choice-actions">
        <button
          type="button"
          class="icon-btn muted"
          title="Move up"
          aria-label="Move choice up"
          @click="$emit('move', -1)">
          ↑
        </button>
        <button
          type="button"
          class="icon-btn muted"
          title="Move down"
          aria-label="Move choice down"
          @click="$emit('move', 1)">
          ↓
        </button>
        <button
          type="button"
          class="icon-btn muted"
          :title="editing ? 'Done editing' : 'Edit choice'"
          :aria-label="editing ? 'Done editing choice' : 'Edit choice'"
          :aria-pressed="editing"
          @click="editing = !editing">
          <svg v-if="!editing" class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round" />
            <path
              d="M12.5 6.5 17.5 11.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round" />
          </svg>
          <svg v-else class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 12h14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round" />
            <path
              d="M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn danger"
          title="Remove choice"
          aria-label="Remove choice"
          @click="$emit('remove')">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="!editing" class="choice-summary">
      <p
        v-for="part in summaryParts"
        :key="part.key"
        class="summary-line">
        <span class="summary-label">{{ part.label }}</span>
        <span v-if="part.detail" class="summary-detail">{{ part.detail }}</span>
      </p>
    </div>

    <div v-else class="choice-form">
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
      <div class="form-footer">
        <button type="button" class="sm" @click="editing = false">Done</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.choice-editor {
  display: grid;
  gap: 0.55rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  padding: 0.7rem 0.75rem;
  background: #1b2028;
}

.choice-editor.editing {
  border-color: color-mix(in srgb, var(--color-cherenkov, #20c8fb) 35%, #343d4d);
}

.choice-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.choice-title {
  min-width: 0;
  font-size: 0.95rem;
  color: #eef3fb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.choice-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: 0 0 auto;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #485267;
  background: #2a3342;
  color: #d5dce6;
  cursor: pointer;
}

.icon-btn.muted {
  background: #2a3342;
  border-color: #5a6a82;
  color: #e4eaf3;
}

.icon-btn.muted:hover {
  background: #354356;
  border-color: #7a8eaa;
}

.icon-btn.danger {
  background: color-mix(in srgb, #c45c5c 18%, #2a303a);
  border-color: color-mix(in srgb, #e07a7a 55%, #556176);
  color: #ffb4b4;
}

.icon-btn.danger:hover {
  background: color-mix(in srgb, #c45c5c 32%, #2f3a4d);
  border-color: #e07a7a;
  color: #ffd0d0;
}

.icon-btn[aria-pressed="true"] {
  border-color: var(--color-cherenkov, #20c8fb);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-cherenkov, #20c8fb) 28%, transparent);
}

.icon {
  width: 1rem;
  height: 1rem;
  display: block;
}

.choice-summary {
  display: grid;
  gap: 0.28rem;
}

.summary-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
}

.summary-label {
  color: #8f98a6;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.72rem;
  font-weight: 600;
  min-width: 5.5rem;
}

.summary-detail {
  color: #c8d0db;
  min-width: 0;
  word-break: break-word;
}

.choice-form {
  display: grid;
  gap: 0.65rem;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
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
