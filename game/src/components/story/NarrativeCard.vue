<template>
  <section v-if="beat" class="narrative-card" aria-live="polite">
    <h2 v-if="beat.heading" class="narrative-heading">{{ beat.heading }}</h2>
    <div class="narrative-body">
      <p
        v-for="(para, i) in paragraphs"
        :key="i"
        v-html="para" />
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";
import { proseParagraphHtml } from "../../lib/prose.js";

const props = defineProps({
  beat: { type: Object, default: null },
});

const paragraphs = computed(() => proseParagraphHtml(props.beat?.text));
</script>

<style scoped>
.narrative-card {
  margin-bottom: 0.55rem;
  padding: 1.1rem 1.25rem;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-cherenkov) 22%, #3a4558);
  background:
    linear-gradient(180deg, rgba(32, 200, 251, 0.06) 0%, transparent 42%),
    linear-gradient(180deg, var(--color-bg-panel) 0%, var(--color-bg-panel-deep) 100%);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(32, 200, 251, 0.08);
}
.narrative-heading {
  margin: 0 0 0.75rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-cherenkov);
  line-height: 1.3;
}
.narrative-body {
  line-height: 1.6;
  color: #c8cdd6;
  font-size: 0.94rem;
}
.narrative-body p {
  margin: 0;
}
.narrative-body p + p {
  margin-top: 0.85rem;
}
.narrative-body em {
  font-style: italic;
}
.narrative-body strong {
  font-weight: 650;
  color: #dce3ee;
}
</style>
