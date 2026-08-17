<template>
  <Teleport to="body">
    <div
      class="binder-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="binder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="binder-dialog-title">
        <header>
          <p class="label">Examine</p>
          <h2 id="binder-dialog-title">{{ heading }}</h2>
        </header>
        <div class="binder-body">
          <p
            v-for="(para, index) in paragraphs"
            :key="index"
            v-html="para" />
        </div>
        <div class="binder-actions">
          <button
            v-if="canExamineCard"
            type="button"
            class="sm"
            @click="$emit('examine-card')">
            Examine the laminated card
          </button>
          <button
            v-if="canReadGuide"
            type="button"
            class="sm"
            @click="$emit('read-guide')">
            Read the operations guide
          </button>
          <button type="button" class="sm muted" @click="$emit('close')">
            Close
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";
import { proseParagraphHtml } from "../../lib/prose.js";

const props = defineProps({
  heading: { type: String, default: "The ops binder" },
  text: { type: String, default: "" },
  canExamineCard: { type: Boolean, default: false },
  canReadGuide: { type: Boolean, default: false },
});

defineEmits(["close", "examine-card", "read-guide"]);

const paragraphs = computed(() => proseParagraphHtml(props.text));
</script>

<style scoped>
.binder-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.binder-dialog {
  display: grid;
  gap: 0.85rem;
  width: min(38rem, 100%);
  padding: 1.1rem 1.25rem;
  border: 1px solid color-mix(in srgb, var(--color-cherenkov) 22%, #3a4558);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(32, 200, 251, 0.06) 0%, transparent 42%),
    linear-gradient(180deg, var(--color-bg-panel, #20252f) 0%, var(--color-bg-panel-deep, #1b2028) 100%);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
header h2,
header p {
  margin: 0;
}
.binder-body {
  display: grid;
  gap: 0.75rem;
  color: #c8cdd6;
  font-size: 0.94rem;
  line-height: 1.6;
}
.binder-body p {
  margin: 0;
}
.binder-body :deep(em) {
  font-style: italic;
}
.binder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}
</style>
