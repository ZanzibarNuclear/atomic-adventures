<script setup>
import { computed, ref, watch } from "vue";
import { lessonCompleted } from "../../lib/learning/completion.js";

const props = defineProps({
  lessons: { type: Array, default: () => [] },
  selectedLessonId: { type: String, default: null },
  gameState: { type: Object, required: true },
  completionError: { type: String, default: "" },
});

const emit = defineEmits(["select-lesson", "complete-lesson", "return-to-map"]);

const selectedAnswer = ref("");
const answered = ref(false);

const selectedLesson = computed(() =>
  props.lessons.find((lesson) => lesson.id === props.selectedLessonId) ?? null,
);
const hasSelectedLesson = computed(() => Boolean(props.selectedLessonId));
const question = computed(() => selectedLesson.value?.quiz?.[0] ?? null);
const selectedOption = computed(() =>
  question.value?.options?.find((option) => option.id === selectedAnswer.value) ?? null,
);
const correct = computed(() =>
  answered.value && selectedAnswer.value === question.value?.correctOptionId,
);
const completed = computed(() =>
  selectedLesson.value ? lessonCompleted(props.gameState, selectedLesson.value.id) : false,
);

watch(() => props.selectedLessonId, () => {
  selectedAnswer.value = "";
  answered.value = false;
});

function submitAnswer() {
  if (!selectedAnswer.value) return;
  answered.value = true;
  if (selectedAnswer.value === question.value?.correctOptionId) {
    emit("complete-lesson", selectedLesson.value.id);
  }
}
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

    <article v-else class="lesson-content">
      <section
        v-for="(section, index) in selectedLesson.sections"
        :key="`${section.type}-${index}`"
        class="lesson-section"
        :class="`section-${section.type}`">
        <h2 v-if="section.title">{{ section.title }}</h2>
        <p v-if="section.body">{{ section.body }}</p>
        <div v-if="section.formula" class="formula">{{ section.formula }}</div>
        <p v-if="section.caption" class="caption">{{ section.caption }}</p>

        <table v-if="section.type === 'symbols'">
          <thead>
            <tr><th>Symbol</th><th>Meaning</th><th>Units</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in section.rows" :key="row.symbol">
              <td>{{ row.symbol }}</td>
              <td>{{ row.meaning }}</td>
              <td>{{ row.units }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="section.type === 'examples'" class="examples">
          <section v-for="example in section.examples" :key="example.title" class="example">
            <h3>{{ example.title }}</h3>
            <ul>
              <li v-for="given in example.givens" :key="given">{{ given }}</li>
            </ul>
            <p class="result">{{ example.result }}</p>
            <p v-if="example.explanation">{{ example.explanation }}</p>
          </section>
        </div>
      </section>

      <section v-if="question" class="quiz">
        <p class="eyebrow">Check your understanding</p>
        <h2>{{ question.prompt }}</h2>
        <div class="answers">
          <label
            v-for="option in question.options"
            :key="option.id"
            :class="{ selected: selectedAnswer === option.id }">
            <input v-model="selectedAnswer" type="radio" :value="option.id">
            <span>{{ option.label }}</span>
          </label>
        </div>
        <button type="button" :disabled="!selectedAnswer" @click="submitAnswer">
          Check answer
        </button>
        <p v-if="answered && selectedOption" class="feedback" :class="{ correct }">
          {{ selectedOption.feedback }}
        </p>
      </section>

      <section v-if="completed" class="award">
        <p class="eyebrow">Knowledge acquired</p>
        <h2>{{ selectedLesson.completion?.awardTitle ?? "Lesson complete" }}</h2>
        <p>{{ selectedLesson.completion?.awardText }}</p>
        <button type="button" @click="$emit('return-to-map')">Rejoin the world</button>
      </section>
      <p v-if="completionError" class="reader-error-text">{{ completionError }}</p>
    </article>
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
.lesson-browser,
.lesson-content {
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
.caption,
.lesson-meta {
  color: #a9c7c3;
}

.lesson-meta {
  display: grid;
  gap: 0.25rem;
  justify-items: end;
  min-width: 8rem;
}

.lesson-section,
.quiz,
.award,
.reader-error {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid rgba(139, 216, 210, 0.32);
  border-radius: 8px;
  background: rgba(8, 18, 24, 0.78);
}

.lesson-section h2,
.quiz h2,
.award h2 {
  margin: 0 0 0.65rem;
}

.formula {
  overflow-x: auto;
  padding: 0.8rem;
  border-radius: 6px;
  background: #071215;
  color: #bffcf5;
  font: 700 1.35rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.55rem;
  border-bottom: 1px solid rgba(139, 216, 210, 0.24);
  text-align: left;
  vertical-align: top;
}

.examples {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.75rem;
}

.example {
  padding: 0.8rem;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.05);
}

.example h3,
.example p {
  margin-top: 0;
}

.result {
  color: #c8f7f1;
  font-weight: 700;
}

.answers {
  display: grid;
  gap: 0.5rem;
  margin: 0.8rem 0;
}

.answers label {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  padding: 0.6rem;
  border: 1px solid rgba(139, 216, 210, 0.28);
  border-radius: 7px;
}

.answers label.selected {
  border-color: #8bd8d2;
  background: rgba(139, 216, 210, 0.1);
}

.feedback {
  color: #ffd38a;
  font-weight: 700;
}

.feedback.correct {
  color: #8ff0a4;
}

.reader-error-text {
  color: #ffb2b2;
  font-weight: 700;
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
