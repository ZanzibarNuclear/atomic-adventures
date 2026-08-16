<script setup>
import { ref } from "vue";

defineProps({
  entries: { type: Array, required: true },
  selectedTab: { type: String, required: true },
  compact: { type: Boolean, default: false },
});

const openIds = ref(new Set());

function entryLabel(entry) {
  return entry.label ?? entry.title ?? entry.id;
}

function isOpen(id) {
  return openIds.value.has(id);
}

function toggle(id) {
  const next = new Set(openIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  openIds.value = next;
}
</script>

<template>
  <ul v-if="entries.length" class="entry-list" :class="{ compact }">
    <li v-for="entry in entries" :key="entry.id">
      <button
        v-if="entry.description"
        type="button"
        class="entry-toggle"
        :aria-expanded="isOpen(entry.id)"
        :aria-controls="`knowledge-${entry.id}`"
        @click="toggle(entry.id)">
        <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M6 3.5 11 8 6 12.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
        <span>{{ entryLabel(entry) }}</span>
      </button>
      <span v-else class="entry-label">{{ entryLabel(entry) }}</span>
      <p
        v-if="entry.description && isOpen(entry.id)"
        :id="`knowledge-${entry.id}`"
        class="entry-description">
        {{ entry.description }}
      </p>
    </li>
  </ul>
  <p v-else class="empty-state">
    {{ selectedTab === "knowledge" ? "No knowledge acquired yet." : "Nothing to show here yet." }}
  </p>
</template>

<style scoped>
.entry-list {
  display: grid;
  gap: 0.15rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.entry-toggle,
.entry-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  min-width: 0;
  padding: 0.15rem 0;
  border: 0;
  background: transparent;
  color: #d7dde6;
  font: inherit;
  font-size: 0.86rem;
  line-height: 1.35;
  text-align: left;
}
.entry-toggle {
  cursor: pointer;
}
.entry-toggle:hover,
.entry-toggle:focus-visible {
  color: #eef1f5;
}
.entry-toggle:focus-visible {
  outline: 2px solid #6ea57b;
  outline-offset: 2px;
  border-radius: 4px;
}
.chevron {
  width: 0.7rem;
  height: 0.7rem;
  flex: 0 0 auto;
  color: #8f98a6;
  transform: rotate(0deg);
  transition: transform 0.15s ease;
}
.entry-toggle[aria-expanded="true"] .chevron {
  transform: rotate(90deg);
}
.entry-description {
  margin: 0 0 0.35rem 1.05rem;
  color: #8f98a6;
  font-size: 0.8rem;
  line-height: 1.4;
}
.empty-state {
  margin: 0;
  color: #8f98a6;
}
</style>
