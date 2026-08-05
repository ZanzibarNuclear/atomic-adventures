<template>
  <div v-if="hasContent" class="status-lines">
    <p
      v-for="(line, index) in statusLines"
      :key="`status-${index}-${line}`"
      class="status-line"
    >
      {{ line }}
    </p>
    <p
      v-for="message in messageItems"
      :key="`msg-${message.id}`"
      class="status-line message-line"
      :class="toneClass(message.tone)"
    >
      {{ message.text }}
    </p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { usePlayMessages } from "../../composables/usePlayMessages.js";

const props = defineProps({
  /** Ongoing situational status (vitals, power, lights, etc.). */
  lines: { type: Array, default: () => [] },
  /**
   * When true (default), also show the shared play-message bus.
   * Set false if a surface wants only explicit lines.
   */
  includeMessages: { type: Boolean, default: true },
});

const { messages } = usePlayMessages();

const statusLines = computed(() =>
  (props.lines ?? []).map((line) => String(line ?? "").trim()).filter(Boolean),
);

const messageItems = computed(() =>
  props.includeMessages ? messages.value : [],
);

const hasContent = computed(
  () => statusLines.value.length > 0 || messageItems.value.length > 0,
);

function toneClass(tone) {
  const t = String(tone || "notice");
  return t === "notice" ? "tone-notice" : `tone-${t}`;
}
</script>

<style scoped>
.status-lines {
  margin-bottom: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--color-cherenkov) 14%, #5a5d60);
  border-radius: 12px;
  background: #454749;
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 var(--color-cherenkov-soft);
}
.status-line {
  margin: 0;
  line-height: 1.6;
  color: #c8cdd6;
  font-size: 0.94rem;
}
.status-line + .status-line {
  margin-top: 0.85rem;
}
.message-line.tone-notice {
  color: #e2e6ee;
}
.message-line.tone-warning {
  color: #efcb83;
}
.message-line.tone-error {
  color: #ffb5b5;
}
</style>
