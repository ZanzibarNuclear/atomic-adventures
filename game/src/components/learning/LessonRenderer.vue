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

const selectedAnswer = ref("");
const answered = ref(false);
const previewPassed = ref(false);

const question = computed(() => props.lesson?.quiz?.[0] ?? null);
const selectedOption = computed(() =>
  question.value?.options?.find((option) => option.id === selectedAnswer.value) ?? null,
);
const sectionLinks = computed(() =>
  (props.lesson?.sections ?? [])
    .map((section, index) => ({
      id: `lesson-section-${index + 1}`,
      label: section.title || `Section ${index + 1}`,
    }))
    .filter((section) => section.label),
);
const correct = computed(() =>
  answered.value && selectedAnswer.value === question.value?.correctOptionId,
);
const showAward = computed(() => props.completed || previewPassed.value);

watch(() => props.lesson?.id, () => {
  selectedAnswer.value = "";
  answered.value = false;
  previewPassed.value = false;
});

function chooseAnswer(optionId) {
  selectedAnswer.value = optionId;
  answered.value = false;
}

function submitAnswer() {
  if (!selectedAnswer.value) return;
  answered.value = true;
  if (selectedAnswer.value !== question.value?.correctOptionId) return;
  if (props.preview) {
    previewPassed.value = true;
  } else {
    emit("pass-quiz", props.lesson.id);
  }
}
</script>

<template>
  <article class="lesson-content" :class="{ preview }">
    <nav v-if="sectionLinks.length > 3" class="section-nav" aria-label="Lesson sections">
      <a v-for="section in sectionLinks" :key="section.id" :href="`#${section.id}`">
        {{ section.label }}
      </a>
    </nav>

    <section
      v-for="(section, index) in lesson.sections"
      :key="`${section.type}-${index}`"
      :id="sectionLinks[index]?.id"
      class="lesson-section"
      :class="`section-${section.type}`">
      <h2 v-if="section.title">{{ section.title }}</h2>
      <MathMarkdown v-if="section.body" :source="section.body" />
      <div v-if="section.formula" class="formula">
        <MathMarkdown :source="section.formula" />
      </div>
      <div v-if="section.caption" class="caption">
        <MathMarkdown :source="section.caption" />
      </div>

      <table v-if="section.type === 'symbols'">
        <thead>
          <tr><th>Symbol</th><th>Meaning</th><th>Units</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in section.rows" :key="row.symbol">
            <td><MathMarkdown :source="row.symbol" inline /></td>
            <td>{{ row.meaning }}</td>
            <td><MathMarkdown :source="row.units" inline /></td>
          </tr>
        </tbody>
      </table>

      <div v-if="section.type === 'examples'" class="examples">
        <section v-for="example in section.examples" :key="example.title" class="example">
          <h3>{{ example.title }}</h3>
          <ul>
              <li v-for="given in example.givens" :key="given"><MathMarkdown :source="given" inline /></li>
            </ul>
          <p class="result"><MathMarkdown :source="example.result" inline /></p>
          <MathMarkdown v-if="example.explanation" :source="example.explanation" />
        </section>
      </div>
    </section>

    <section v-if="question" class="quiz">
      <p class="eyebrow">Check your understanding</p>
      <h2><MathMarkdown :source="question.prompt" inline /></h2>
      <div class="answers">
        <label
          v-for="option in question.options"
          :key="option.id"
          :class="{ selected: selectedAnswer === option.id }">
          <input
            type="radio"
            :checked="selectedAnswer === option.id"
            :value="option.id"
            @change="chooseAnswer(option.id)">
          <span><MathMarkdown :source="option.label" inline /></span>
        </label>
      </div>
      <button type="button" :disabled="!selectedAnswer" @click="submitAnswer">
        Check answer
      </button>
      <p v-if="answered && selectedOption" class="feedback" :class="{ correct }">
        <MathMarkdown :source="selectedOption.feedback" inline />
      </p>
    </section>

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

.lesson-section,
.quiz,
.award {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid rgba(139, 216, 210, 0.32);
  border-radius: 8px;
  background: rgba(8, 18, 24, 0.78);
}

.section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1rem;
}

.section-nav a {
  border: 1px solid rgba(139, 216, 210, 0.32);
  border-radius: 999px;
  background: rgba(8, 18, 24, 0.78);
  color: #c8f7f1;
  padding: 0.35rem 0.55rem;
  font-size: 0.86rem;
  text-decoration: none;
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

.lesson-section h2,
.quiz h2,
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

button {
  border: 1px solid #6ebcb5;
  border-radius: 7px;
  background: #d7fff8;
  color: #082422;
  padding: 0.6rem 0.8rem;
  font-weight: 700;
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
