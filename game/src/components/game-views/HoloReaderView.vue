<script setup>
import { computed } from "vue";
import { lessonCompleted } from "../../lib/learning/completion.js";
import LessonRenderer from "../learning/LessonRenderer.vue";

const props = defineProps({
  lessons: { type: Array, default: () => [] },
  selectedLessonId: { type: String, default: null },
  gameState: { type: Object, required: true },
  completionError: { type: String, default: "" },
});

const emit = defineEmits(["select-lesson", "complete-lesson", "return-to-map"]);

const selectedLesson = computed(() =>
  props.lessons.find((lesson) => lesson.id === props.selectedLessonId) ?? null,
);
const hasSelectedLesson = computed(() => Boolean(props.selectedLessonId));
const completed = computed(() =>
  selectedLesson.value ? lessonCompleted(props.gameState, selectedLesson.value.id) : false,
);
</script>

<template>
  <section class="holo-reader-view">
    <header class="reader-header">
      <div>
        <p class="eyebrow">Library holo-reader</p>
        <h1>{{ selectedLesson?.title ?? "Lesson catalog" }}</h1>
      </div>
      <button class="exit-button" type="button" @click="$emit('return-to-map')">Exit</button>
    </header>

    <section v-if="!hasSelectedLesson" class="lesson-browser">
      <p v-if="!lessons.length" class="empty-state">
        No holo-reader lessons are available from here yet.
      </p>
      <button
        v-for="lesson in lessons"
        :key="lesson.id"
        class="lesson-row"
        type="button"
        @click="$emit('select-lesson', lesson.id)">
        <span>
          <strong>{{ lesson.title }}</strong>
          <small>{{ lesson.summary }}</small>
        </span>
        <span class="lesson-meta">
          {{ lesson.timeMinutes ?? 30 }} min
          <span v-if="lessonCompleted(gameState, lesson.id)">Completed</span>
        </span>
      </button>
    </section>

    <section v-else-if="!selectedLesson" class="reader-error">
      <h2>Lesson unavailable</h2>
      <p>The selected lesson ID does not exist in learning content.</p>
      <button type="button" @click="$emit('select-lesson', null)">Back to catalog</button>
    </section>

    <LessonRenderer
      v-else
      :lesson="selectedLesson"
      :completed="completed"
      :completion-error="completionError"
      @pass-quiz="emit('complete-lesson', $event)">
      <template #award-actions>
          <button type="button" @click="$emit('return-to-map')">Finish lesson</button>
          <button type="button" class="ghost-button" @click="$emit('select-lesson', null)">Back to lessons</button>
      </template>
    </LessonRenderer>
  </section>
</template>

<style scoped>
.holo-reader-view {
  min-height: calc(100vh - 4rem);
  padding: 1.25rem clamp(1rem, 3vw, 2.25rem) 2rem;
  color: #e9f6f5;
  background:
    radial-gradient(circle at top left, rgba(40, 170, 160, 0.24), transparent 30rem),
    linear-gradient(135deg, #10151c, #172327 52%, #11151d);
}

.reader-header,
.lesson-browser {
  max-width: 1040px;
  margin: 0 auto;
}

.reader-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.reader-header h1 {
  margin: 0.1rem 0 0;
  font-size: clamp(1.7rem, 4vw, 3rem);
  letter-spacing: 0;
}

.eyebrow {
  margin: 0;
  color: #8bd8d2;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

button {
  border: 1px solid #6ebcb5;
  border-radius: 7px;
  background: #d7fff8;
  color: #082422;
  padding: 0.6rem 0.8rem;
  font-weight: 700;
}

.exit-button {
  background: transparent;
  color: #c8f7f1;
}

.lesson-browser {
  display: grid;
  gap: 0.75rem;
}

.empty-state {
  margin: 0;
  padding: 1rem;
  border: 1px solid rgba(139, 216, 210, 0.32);
  border-radius: 8px;
  background: rgba(8, 18, 24, 0.78);
  color: #c8f7f1;
}

.lesson-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  text-align: left;
  background: rgba(11, 24, 29, 0.78);
  color: #e9f6f5;
}

.lesson-row span:first-child {
  display: grid;
  gap: 0.25rem;
}

.lesson-row small,
.lesson-meta {
  color: #a9c7c3;
}

.lesson-meta {
  display: grid;
  gap: 0.25rem;
  justify-items: end;
  min-width: 8rem;
}

.reader-error {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid rgba(139, 216, 210, 0.32);
  border-radius: 8px;
  background: rgba(8, 18, 24, 0.78);
}

.ghost-button {
  background: transparent;
  color: #c8f7f1;
}

@media (max-width: 700px) {
  .reader-header,
  .lesson-row {
    display: grid;
  }

  .lesson-meta {
    justify-items: start;
  }
}
</style>
