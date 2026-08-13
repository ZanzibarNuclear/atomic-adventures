<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  search: { type: String, default: "" },
  groups: { type: Array, default: () => [] },
  selectedKey: { type: String, default: "" },
});

defineEmits([
  "update:search",
  "add-hex",
  "add-route",
  "add-barrier",
  "add-passage",
  "add-landmark",
  "select",
]);

const ADD_ACTIONS = [
  { event: "add-hex", label: "Hex" },
  { event: "add-route", label: "Route" },
  { event: "add-barrier", label: "Barrier" },
  { event: "add-passage", label: "Passage" },
  { event: "add-landmark", label: "Landmark" },
];

const expandedGroups = ref(new Set());
const isSearching = computed(() => props.search.trim().length > 0);
const visibleGroups = computed(() =>
  isSearching.value ? props.groups.filter((group) => group.items.length) : props.groups,
);

function groupKey(group) {
  return group.type ?? group.label;
}

function isExpanded(group) {
  return isSearching.value || expandedGroups.value.has(groupKey(group));
}

function toggleGroup(group) {
  const next = new Set(expandedGroups.value);
  const key = groupKey(group);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedGroups.value = next;
}
</script>

<template>
  <aside class="object-browser panel">
    <input
      :value="search"
      placeholder="Search world objects..."
      @input="$emit('update:search', $event.target.value)"
    />
    <div class="create-grid">
      <button
        v-for="action in ADD_ACTIONS"
        :key="action.event"
        type="button"
        class="sm add-btn"
        @click="$emit(action.event)"
      >
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
        {{ action.label }}
      </button>
    </div>
    <p v-if="isSearching && !visibleGroups.length" class="empty-note">No matching objects.</p>
    <section v-for="group in visibleGroups" :key="group.label" class="object-group">
      <button
        type="button"
        class="group-toggle"
        :aria-expanded="isExpanded(group)"
        @click="toggleGroup(group)"
      >
        <span class="group-title">
          <span class="arrow" aria-hidden="true">{{ isExpanded(group) ? "▾" : "▸" }}</span>
          {{ group.label }}
        </span>
        <span class="count">{{ group.items.length }}</span>
      </button>
      <div v-if="isExpanded(group)" class="object-list">
        <button
          v-for="item in group.items"
          :key="`${group.type}:${item.id}`"
          class="object-item"
          :class="{ active: selectedKey === `${group.type}:${item.id}` }"
          @click="$emit('select', { type: group.type, id: item.id })"
        >
          <strong>{{ item.label || item.landmark?.label || item.id }}</strong>
          <span>{{ item.id }}<template v-if="item.kind"> · {{ item.kind }}</template></span>
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #20252f;
  padding: 0.75rem;
}

.object-browser {
  overflow: auto;
}

.object-browser input {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 6px;
  background: #171b22;
  color: #dbe2ea;
  padding: 0.45rem;
}

.create-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.create-grid .add-btn {
  justify-content: flex-start;
  text-align: left;
  font-size: 0.78rem;
  padding: 0.35rem 0.45rem;
}

.empty-note {
  margin: 0.8rem 0 0;
  color: #939ba7;
  font-size: 0.82rem;
}

.object-group {
  margin-top: 0.9rem;
}

.group-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.2rem 0;
  border: 0;
  background: transparent;
  color: #aeb5c0;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
}

.group-toggle:hover {
  color: #eef1f5;
}

.group-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.35rem;
}

.arrow {
  width: 0.8rem;
  color: #8bc49a;
  letter-spacing: 0;
}

.count {
  color: #6f7787;
}

.object-list {
  margin-top: 0.35rem;
}

.object-item {
  display: grid;
  width: 100%;
  gap: 0.1rem;
  margin-top: 0.25rem;
  text-align: left;
  background: #252b35;
}

.object-item span {
  color: #8e96a3;
  font-size: 0.72rem;
}

.object-item.active {
  background: #49624f;
  border-color: #6f9b79;
}
</style>
