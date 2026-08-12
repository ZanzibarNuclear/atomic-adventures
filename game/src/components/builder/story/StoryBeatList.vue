<script setup>
defineProps({
  selectedLocation: { type: String, default: "" },
  beats: { type: Array, default: () => [] },
  selectedBeatId: { type: String, default: "" },
  canDuplicate: { type: Boolean, default: false },
  warnings: { type: Array, default: () => [] },
});

defineEmits(["new", "duplicate", "select"]);

function originHexLabel(value) {
  const origins = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value
        ? [value]
        : [];
  return origins.join(", ");
}

function originHexPrefix(value) {
  const label = originHexLabel(value);
  return label ? `from ${label}` : "";
}

function flagCriteriaLabel(beat) {
  const flags = beat?.conditions?.flags ?? {};
  const labels = [];
  if (Array.isArray(flags.all) && flags.all.length) labels.push(`requires ${flags.all.join(", ")}`);
  if (Array.isArray(flags.not) && flags.not.length) labels.push(`absent ${flags.not.join(", ")}`);
  return labels.join(" / ");
}

function standLabel(beat) {
  const stand = beat?.trigger?.stand;
  return stand ? `stand ${stand}` : "";
}
</script>

<template>
  <section class="builder-list-column panel">
    <div class="section-heading">
      <div>
        <p class="label">Selected location</p>
        <h2>{{ selectedLocation }}</h2>
      </div>
      <div class="section-heading-actions">
        <button type="button" class="sm add-btn" @click="$emit('new')">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round" />
          </svg>
          New scene
        </button>
        <button
          type="button"
          class="sm muted duplicate-btn"
          :disabled="!canDuplicate"
          title="Duplicate selected scene"
          @click="$emit('duplicate')">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="8"
              y="8"
              width="11"
              height="11"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7" />
            <path
              d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round" />
          </svg>
          Duplicate
        </button>
      </div>
    </div>
    <button
      v-for="beat in beats"
      :key="beat.id"
      class="beat-list-item"
      :class="{ active: selectedBeatId === beat.id }"
      @click="$emit('select', beat.id)"
    >
      <strong>{{ beat.heading || beat.id }}</strong>
      <span>{{ beat.id }}</span>
      <small v-if="standLabel(beat)">{{ standLabel(beat) }}</small>
      <small v-if="originHexPrefix(beat.match?.originHex)">{{ originHexPrefix(beat.match.originHex) }}</small>
      <small v-if="beat.match?.mapTransition">
        map transition {{ beat.match.mapTransition }}
      </small>
      <small v-if="beat.match?.transitionDirection">
        {{ beat.match.transitionDirection === "toLocal" ? "to local map" : "to regional map" }}
      </small>
      <small v-if="flagCriteriaLabel(beat)">{{ flagCriteriaLabel(beat) }}</small>
    </button>
    <p v-if="!beats.length" class="empty-note">No scenes are attached here yet.</p>
    <p v-for="warning in warnings" :key="warning" class="builder-warning">{{ warning }}</p>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #20252f;
  padding: 0.85rem;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.label {
  color: #8e96a3;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.beat-list-item {
  display: grid;
  width: 100%;
  gap: 0.15rem;
  margin-top: 0.5rem;
  text-align: left;
}

.beat-list-item.active {
  background: #49624f;
  border-color: #6f9b79;
}

.empty-note,
.builder-warning {
  color: #aeb5c0;
  font-size: 0.9rem;
}

.builder-warning {
  color: #ffc66d;
}
</style>
