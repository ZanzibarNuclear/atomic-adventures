<script setup>
import { computed } from "vue";
import { publicAssetPath } from "../../lib/maps/locationMedia.js";

const props = defineProps({
  media: { type: Object, default: null },
  mode: { type: String, default: "map" },
  selectedIndex: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(["show-map", "show-image", "previous-image", "next-image"]);

const views = computed(() => props.media?.views ?? []);
const hasImages = computed(() => views.value.length > 0);
const activeIndex = computed(() =>
  views.value.length
    ? Math.min(Math.max(0, props.selectedIndex), views.value.length - 1)
    : 0,
);
const activeView = computed(() => views.value[activeIndex.value] ?? null);
const showingImage = computed(() => props.mode === "image" && Boolean(activeView.value));
</script>

<template>
  <div class="location-stage-frame" :class="{ 'showing-image': showingImage }">
    <slot v-if="!showingImage" />
    <figure v-else class="location-image">
      <img
        :src="publicAssetPath(activeView.src)"
        :alt="activeView.alt || activeView.label || activeView.id"
      >
      <figcaption v-if="views.length > 1 || activeView.label">
        <span>{{ activeView.label || activeView.id }}</span>
        <span v-if="views.length > 1">{{ activeIndex + 1 }} / {{ views.length }}</span>
      </figcaption>
    </figure>

    <button
      v-if="hasImages"
      type="button"
      class="stage-mode-toggle"
      :aria-label="showingImage ? 'Show map' : 'Show location image'"
      :title="showingImage ? 'Show map' : 'Show location image'"
      :disabled="busy"
      @click="showingImage ? emit('show-map') : emit('show-image')">
      <svg v-if="showingImage" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z" />
        <circle cx="12" cy="13.5" r="3.2" />
      </svg>
    </button>

    <template v-if="showingImage && views.length > 1">
      <button
        type="button"
        class="carousel-btn previous"
        aria-label="Previous location image"
        @click="emit('previous-image')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        class="carousel-btn next"
        aria-label="Next location image"
        @click="emit('next-image')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.location-stage-frame {
  position: relative;
  min-height: 18rem;
}
.location-stage-frame :deep(svg) {
  display: block;
}
.location-image {
  position: relative;
  margin: 0;
  overflow: hidden;
  min-height: 18rem;
  aspect-ratio: 1672 / 941;
  border: 1px solid #364257;
  border-radius: 8px;
  background: #10151c;
}
.location-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.location-image figcaption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  gap: .75rem;
  padding: .55rem .7rem;
  background: linear-gradient(to top, rgba(8, 12, 18, .78), rgba(8, 12, 18, .08));
  color: #f3f6f8;
  font-size: .78rem;
}
.stage-mode-toggle,
.carousel-btn {
  position: absolute;
  z-index: 5;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid rgba(232, 238, 244, .55);
  background: rgba(16, 21, 28, .72);
  color: #f4f7fa;
  line-height: 1;
  box-shadow: 0 0.2rem 0.65rem rgba(0, 0, 0, .28);
}
.stage-mode-toggle:hover:not(:disabled),
.carousel-btn:hover:not(:disabled) {
  background: rgba(32, 41, 52, .88);
}
.stage-mode-toggle {
  top: .65rem;
  left: .65rem;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 999px;
}
.stage-mode-toggle svg {
  grid-area: 1 / 1;
  width: 1.28rem;
  height: 1.28rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.carousel-btn {
  top: 50%;
  width: 2.45rem;
  height: 3.5rem;
  border-radius: 999px;
  transform: translateY(-50%);
}
.carousel-btn.previous { left: .65rem; }
.carousel-btn.next { right: .65rem; }
.carousel-btn svg {
  grid-area: 1 / 1;
  width: 1.7rem;
  height: 1.7rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 680px) {
  .location-stage-frame,
  .location-image {
    min-height: 14rem;
  }
}
</style>
