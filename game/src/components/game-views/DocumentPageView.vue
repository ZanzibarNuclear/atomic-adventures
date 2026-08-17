<template>
  <section class="document-page-view" aria-label="Operations guide">
    <header class="page-chrome">
      <div>
        <p class="label">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <button type="button" class="done-button" @click="$emit('return-to-map')">Done</button>
    </header>
    <article class="page-sheet">
      <p
        v-for="(para, index) in paragraphs"
        :key="index"
        v-html="para" />
    </article>
  </section>
</template>

<script setup>
import { computed } from "vue";
import { proseParagraphHtml } from "../../lib/prose.js";

const props = defineProps({
  documents: { type: Array, default: () => [] },
  payload: { type: Object, default: () => ({}) },
});

defineEmits(["return-to-map"]);

const documentEntry = computed(() =>
  props.documents.find((entry) => entry.id === props.payload?.id) ?? null,
);
const eyebrow = computed(() => documentEntry.value?.group || "Manual");
const title = computed(() =>
  documentEntry.value?.title || "Untitled document",
);
const paragraphs = computed(() =>
  proseParagraphHtml(documentEntry.value?.body || "This page is blank."),
);
</script>

<style scoped>
.document-page-view {
  min-height: calc(100vh - 4rem);
  padding: 1.25rem clamp(1rem, 3vw, 2.25rem) 2rem;
  background:
    radial-gradient(circle at 16% 14%, rgba(32, 200, 251, 0.08), transparent 25rem),
    linear-gradient(145deg, #151a22, #1d232c 52%, #14181f);
  color: #e8edf5;
}
.page-chrome {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  max-width: 46rem;
  margin: 0 auto 1rem;
}
.page-chrome .label {
  margin: 0;
  color: #8faed6;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.page-chrome h2 {
  margin: 0.2rem 0 0;
  font-size: 1.35rem;
}
.done-button {
  flex: 0 0 auto;
}
.page-sheet {
  display: grid;
  gap: 0.9rem;
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.25rem 1.4rem;
  border: 1px solid #3f4c63;
  border-radius: 10px;
  background: #1b2028;
  color: #c8cdd6;
  font-size: 0.96rem;
  line-height: 1.65;
}
.page-sheet p {
  margin: 0;
}
.page-sheet :deep(em) {
  font-style: italic;
}
.page-sheet :deep(strong) {
  color: #e8edf5;
  font-weight: 650;
}
</style>
