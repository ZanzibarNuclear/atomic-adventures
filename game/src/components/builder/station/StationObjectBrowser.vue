<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  search: { type: String, default: "" },
  groups: { type: Array, default: () => [] },
  selectedKey: { type: String, default: "" },
});

defineEmits(["update:search", "add", "select"]);

const expandedGroups = ref(new Set());
const isSearching = computed(() => props.search.trim().length > 0);
const visibleGroups = computed(() =>
  isSearching.value ? props.groups.filter((group) => group.items.length) : props.groups,
);

function groupKey(group) {
  return group.source ?? group.label;
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

function itemTitle(item) {
  return item.label || item.id;
}

function itemMeta(item) {
  return [
    item.id,
    item.kind,
  ].filter(Boolean).join(" · ");
}
</script>

<template>
  <aside class="object-browser panel">
    <input
      :value="search"
      placeholder="Search station objects..."
      @input="$emit('update:search', $event.target.value)"
    />
    <div class="create-grid">
      <button class="sm" @click="$emit('add', 'rooms')">+ Room</button>
      <button class="sm" @click="$emit('add', 'doors')">+ Door</button>
      <button class="sm" @click="$emit('add', 'paths')">+ Path</button>
      <button class="sm" @click="$emit('add', 'nodes')">+ Node</button>
      <button class="sm" @click="$emit('add', 'exits')">+ Map transition</button>
      <button class="sm" @click="$emit('add', 'links')">+ Connection</button>
      <button class="sm" @click="$emit('add', 'switches')">+ Switch</button>
      <button class="sm" @click="$emit('add', 'stands')">+ Stand</button>
    </div>
    <p v-if="isSearching && !visibleGroups.length" class="empty-note">No matching objects.</p>
    <section v-for="group in visibleGroups" :key="group.source" class="object-group">
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
          :key="`${item.source}:${item.id}`"
          class="object-item"
          :class="{ active: selectedKey === `${item.source}:${item.id}` }"
          @click="$emit('select', { source: item.source, id: item.id })"
        >
          <strong>{{ itemTitle(item) }}</strong>
          <span>{{ itemMeta(item) }}</span>
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
