<script setup>
defineProps({
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
</script>

<template>
  <aside class="object-browser panel">
    <input
      :value="search"
      placeholder="Search world objects..."
      @input="$emit('update:search', $event.target.value)"
    />
    <div class="create-grid">
      <button class="sm" @click="$emit('add-hex')">+ Hex</button>
      <button class="sm" @click="$emit('add-route')">+ Route</button>
      <button class="sm" @click="$emit('add-barrier')">+ Barrier</button>
      <button class="sm" @click="$emit('add-passage')">+ Passage</button>
      <button class="sm" @click="$emit('add-landmark')">+ Landmark</button>
    </div>
    <section v-for="group in groups" :key="group.label" class="object-group">
      <h3>{{ group.label }} <span>{{ group.items.length }}</span></h3>
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

.object-group {
  margin-top: 0.9rem;
}

.object-group h3 {
  display: flex;
  justify-content: space-between;
  margin: 0 0 0.35rem;
  color: #aeb5c0;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.object-group h3 span {
  color: #6f7787;
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
