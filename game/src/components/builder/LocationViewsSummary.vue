<script setup>
import { computed } from "vue";
import { publicAssetPath } from "../../lib/maps/locationMedia.js";

const props = defineProps({
  views: { type: Array, default: () => [] },
  title: { type: String, default: "Location views" },
});

const imageViews = computed(() =>
  props.views
    .filter((view) => view?.kind === "image" && view.src)
    .map((view) => ({
      ...view,
      label: view.label || view.id || "Location view",
      alt: view.alt || view.label || view.id || "Location view",
    })),
);
</script>

<template>
  <div v-if="imageViews.length" class="location-view-associations">
    <p class="label">{{ title }}</p>
    <ul>
      <li v-for="view in imageViews" :key="view.id || view.src">
        <article class="location-view-card">
          <img :src="publicAssetPath(view.src)" :alt="view.alt">
          <div>
            <strong>{{ view.label }}</strong>
            <span>{{ view.id }} / {{ view.src }}</span>
            <p v-if="view.alt">{{ view.alt }}</p>
          </div>
        </article>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.location-view-associations {
  display: grid;
  gap: .65rem;
  padding-top: .65rem;
  border-top: 1px solid #343d4d;
}
.location-view-associations p {
  margin: 0;
}
.location-view-associations ul {
  display: grid;
  gap: .45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.location-view-card {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: .6rem;
  align-items: start;
  padding: .5rem;
  border: 1px solid #394457;
  border-radius: 7px;
  background: #202733;
}
.location-view-card img {
  width: 100%;
  aspect-ratio: 1672 / 941;
  display: block;
  object-fit: cover;
  border: 1px solid #303a4b;
  border-radius: 6px;
  background: #111820;
}
.location-view-card div {
  min-width: 0;
  display: grid;
  gap: .18rem;
}
.location-view-card strong {
  color: #eef1f5;
  font-size: .8rem;
}
.location-view-card span {
  color: #9da7b5;
  font-size: .72rem;
  overflow-wrap: anywhere;
}
.location-view-card p {
  color: #bdc4ce;
  font-size: .74rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
</style>
