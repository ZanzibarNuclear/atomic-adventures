<script setup>
import { computed, ref, watch } from "vue";
import MathMarkdown from "./MathMarkdown.vue";

const props = defineProps({
  lesson: { type: Object, required: true },
  completed: { type: Boolean, default: false },
  completionError: { type: String, default: "" },
  preview: { type: Boolean, default: false },
});

const emit = defineEmits(["pass-quiz"]);

const selectedAnswers = ref({});
const answeredQuestions = ref({});
const previewPassed = ref(false);
const completionEmitted = ref(false);
const currentPageIndex = ref(0);

const pages = computed(() => lessonPages(props.lesson));
const currentPage = computed(() => pages.value[currentPageIndex.value] ?? pages.value[0] ?? null);
const questions = computed(() =>
  pages.value.flatMap((page) =>
    page.frames
      .filter((frame) => frame.kind === "quiz")
      .flatMap((frame) => frame.questions ?? []),
  ),
);
const allRequiredChecksPassed = computed(() =>
  Boolean(questions.value.length) && questions.value.every((question) =>
    answeredQuestions.value[question.id] === true
      && selectedAnswers.value[question.id] === question.correctOptionId,
  ),
);
const showAward = computed(() => props.completed || previewPassed.value);
const canGoBack = computed(() => currentPageIndex.value > 0);
const canGoNext = computed(() => currentPageIndex.value < pages.value.length - 1);

watch(() => props.lesson?.id, () => {
  selectedAnswers.value = {};
  answeredQuestions.value = {};
  previewPassed.value = false;
  completionEmitted.value = false;
  currentPageIndex.value = 0;
});

watch(pages, (nextPages) => {
  if (currentPageIndex.value >= nextPages.length) currentPageIndex.value = Math.max(0, nextPages.length - 1);
});

function chooseAnswer(questionId, optionId) {
  selectedAnswers.value = {
    ...selectedAnswers.value,
    [questionId]: optionId,
  };
  answeredQuestions.value = {
    ...answeredQuestions.value,
    [questionId]: false,
  };
}

function selectedOption(question) {
  return question.options?.find((option) => option.id === selectedAnswers.value[question.id]) ?? null;
}

function questionCorrect(question) {
  return answeredQuestions.value[question.id] === true
    && selectedAnswers.value[question.id] === question.correctOptionId;
}

function submitAnswer(question) {
  if (!selectedAnswers.value[question.id]) return;
  answeredQuestions.value = {
    ...answeredQuestions.value,
    [question.id]: true,
  };
  if (!allRequiredChecksPassed.value) return;
  if (props.preview) previewPassed.value = true;
  if (!props.preview && !completionEmitted.value) {
    completionEmitted.value = true;
    emit("pass-quiz", props.lesson.id);
  }
}

function previousPage() {
  if (canGoBack.value) currentPageIndex.value -= 1;
}

function nextPage() {
  if (canGoNext.value) currentPageIndex.value += 1;
}

function lessonPages(lesson) {
  return (lesson?.pages ?? []).map((page, pageIndex) => ({
    id: page.id || `page-${pageIndex + 1}`,
    title: page.title ?? null,
    frames: (page.frames ?? []).map((frame, frameIndex) => ({
      id: frame.id || `frame-${frameIndex + 1}`,
      kind: frame.kind || "content",
      title: frame.title ?? null,
      blocks: frame.blocks ?? [],
      questions: frame.questions ?? [],
    })),
  }));
}
</script>

<template>
  <article class="lesson-content" :class="{ preview }">
    <header v-if="pages.length > 1" class="page-header">
      <div>
        <p class="eyebrow">Page {{ currentPageIndex + 1 }} of {{ pages.length }}</p>
        <h2 v-if="currentPage?.title">{{ currentPage.title }}</h2>
      </div>
    </header>

    <template v-if="currentPage">
      <section
        v-for="frame in currentPage.frames"
        :key="frame.id"
        class="lesson-frame"
        :class="`frame-${frame.kind}`">
        <template v-if="frame.kind === 'quiz'">
          <p class="eyebrow">Check your understanding</p>
          <h2 v-if="frame.title">{{ frame.title }}</h2>
          <article
            v-for="(question, questionIndex) in frame.questions"
            :key="question.id"
            class="quiz-question">
            <h3><MathMarkdown :source="`${questionIndex + 1}. ${question.prompt}`" inline /></h3>
            <div class="answers">
              <label
                v-for="option in question.options"
                :key="option.id"
                :class="{ selected: selectedAnswers[question.id] === option.id }">
                <input
                  type="radio"
                  :name="`${lesson.id}-${question.id}`"
                  :checked="selectedAnswers[question.id] === option.id"
                  :value="option.id"
                  @change="chooseAnswer(question.id, option.id)">
                <span><MathMarkdown :source="option.label" inline /></span>
              </label>
            </div>
            <button type="button" :disabled="!selectedAnswers[question.id]" @click="submitAnswer(question)">
              Check answer
            </button>
            <p
              v-if="answeredQuestions[question.id] && selectedOption(question)"
              class="feedback"
              :class="{ correct: questionCorrect(question) }">
              <MathMarkdown :source="selectedOption(question).feedback" inline />
            </p>
          </article>
        </template>

        <template v-else>
          <h2 v-if="frame.title">{{ frame.title }}</h2>
          <div
            v-for="(block, blockIndex) in frame.blocks"
            :key="`${block.type}-${blockIndex}`"
            class="lesson-block"
            :class="`block-${block.type}`">
            <MathMarkdown v-if="block.type === 'paragraph' && block.body" :source="block.body" />
            <div v-if="block.type === 'formula' && block.formula" class="formula">
              <MathMarkdown :source="block.formula" />
            </div>
            <div v-if="block.caption && block.type !== 'image'" class="caption">
              <MathMarkdown :source="block.caption" />
            </div>

            <figure v-if="block.type === 'image'" class="lesson-image">
              <img :src="block.src" :alt="block.alt">
              <figcaption v-if="block.caption">
                <MathMarkdown :source="block.caption" />
              </figcaption>
            </figure>

            <table v-if="block.type === 'symbols'">
              <thead>
                <tr><th>Symbol</th><th>Meaning</th><th>Units</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in block.rows" :key="row.symbol">
                  <td><MathMarkdown :source="row.symbol" inline /></td>
                  <td>{{ row.meaning }}</td>
                  <td><MathMarkdown :source="row.units" inline /></td>
                </tr>
              </tbody>
            </table>

            <ol v-if="block.type === 'diagram'" class="flow-diagram" :aria-label="frame.title">
              <li v-for="step in block.steps" :key="step">
                <span>{{ step }}</span>
              </li>
            </ol>

            <div v-if="block.type === 'examples'" class="examples">
              <section v-for="example in block.examples" :key="example.title" class="example">
                <h3>{{ example.title }}</h3>
                <ul>
                  <li v-for="given in example.givens" :key="given"><MathMarkdown :source="given" inline /></li>
                </ul>
                <p class="result"><MathMarkdown :source="example.result" inline /></p>
                <MathMarkdown v-if="example.explanation" :source="example.explanation" />
              </section>
            </div>
          </div>
        </template>
      </section>
    </template>

    <nav v-if="pages.length > 1" class="page-controls" aria-label="Lesson pages">
      <button type="button" class="ghost-button" :disabled="!canGoBack" @click="previousPage">Back</button>
      <span>Page {{ currentPageIndex + 1 }} of {{ pages.length }}</span>
      <button type="button" :disabled="!canGoNext" @click="nextPage">Next</button>
    </nav>

    <section v-if="showAward" class="award">
      <p class="eyebrow">Certificate unlocked</p>
      <h2>{{ lesson.completion?.awardTitle ?? "Lesson complete" }}</h2>
      <p>{{ lesson.completion?.awardText }}</p>
      <div class="award-actions">
        <slot name="award-actions"></slot>
      </div>
    </section>
    <p v-if="completionError" class="reader-error-text">{{ completionError }}</p>
  </article>
</template>

<style scoped>
.lesson-content {
  max-width: 1040px;
  margin: 0 auto;
  color: #e9f6f5;
}

.lesson-content.preview {
  max-width: none;
}

.page-header,
.lesson-frame,
.award {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid rgba(139, 216, 210, 0.32);
  border-radius: 8px;
  background: rgba(8, 18, 24, 0.78);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header h2 {
  margin: 0.1rem 0 0;
}

.lesson-block + .lesson-block {
  margin-top: 0.85rem;
}

.award {
  border-color: rgba(143, 240, 164, 0.55);
  background:
    linear-gradient(135deg, rgba(143, 240, 164, 0.14), rgba(139, 216, 210, 0.06)),
    rgba(8, 18, 24, 0.82);
}

.award-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.eyebrow {
  margin: 0;
  color: #8bd8d2;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.caption {
  color: #a9c7c3;
}

.lesson-image {
  margin: 0;
}

.lesson-image img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: 1px solid rgba(139, 216, 210, 0.24);
  border-radius: 8px;
}

.lesson-image figcaption {
  margin-top: 0.55rem;
  color: #a9c7c3;
}

.lesson-frame h2,
.quiz-question h3,
.award h2 {
  margin: 0 0 0.65rem;
}

.formula {
  overflow-x: auto;
  padding: 1rem;
  border: 1px solid rgba(139, 216, 210, 0.24);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(191, 252, 245, 0.08), rgba(7, 18, 21, 0.86)),
    #071215;
  color: #dffffb;
  font-size: clamp(1.45rem, 3vw, 2.2rem);
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
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

.flow-diagram {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow-diagram li {
  position: relative;
  display: grid;
  align-items: center;
  min-height: 3.5rem;
  padding: 0.7rem 1.9rem 0.7rem 0.8rem;
  border: 1px solid rgba(139, 216, 210, 0.34);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(139, 216, 210, 0.15), rgba(22, 65, 77, 0.4)),
    rgba(255, 255, 255, 0.05);
  color: #effffb;
  font-weight: 700;
}

.flow-diagram li:not(:last-child)::after {
  content: "->";
  position: absolute;
  right: 0.45rem;
  color: #8bd8d2;
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

.quiz-question + .quiz-question {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(139, 216, 210, 0.24);
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

.page-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem 0;
  color: #a9c7c3;
}

.page-controls span {
  font-weight: 700;
}

button {
  border: 1px solid #6ebcb5;
  border-radius: 7px;
  background: #d7fff8;
  color: #082422;
  padding: 0.6rem 0.8rem;
  font-weight: 700;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ghost-button {
  background: transparent;
  color: #c8f7f1;
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
</style>
