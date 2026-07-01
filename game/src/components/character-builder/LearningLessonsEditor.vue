<script setup>
import { computed, onMounted, ref, toRaw } from "vue";
import { storyApi } from "../../lib/storyApi.js";

const draft = ref(null);
const version = ref(0);
const selectedId = ref("");
const status = ref("");
const statusTone = ref("info");
const errors = ref({});
const warnings = ref([]);
const sectionsText = ref("");
const quizText = ref("");
const effectsText = ref("");
const saving = ref(false);

const lessons = computed(() =>
  [...(draft.value?.lessons ?? [])].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
);
const selectedLesson = computed(() =>
  draft.value?.lessons?.find((lesson) => lesson.id === selectedId.value) ?? null,
);
const errorMessages = computed(() =>
  Object.entries(errors.value).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);

onMounted(loadLearning);

async function loadLearning() {
  try {
    const result = await storyApi("/api/learning");
    draft.value = structuredClone(result.learning);
    version.value = result.version;
    warnings.value = result.warnings ?? [];
    selectedId.value = draft.value.lessons?.[0]?.id ?? "";
    syncLessonJson();
    status.value = "";
    statusTone.value = "info";
    errors.value = {};
  } catch (error) {
    status.value = error.message;
    statusTone.value = "error";
  }
}

function selectLesson(id) {
  commitLessonJson();
  selectedId.value = id;
  syncLessonJson();
}

function syncLessonJson() {
  const lesson = selectedLesson.value;
  sectionsText.value = JSON.stringify(lesson?.sections ?? [], null, 2);
  quizText.value = JSON.stringify(lesson?.quiz ?? [], null, 2);
  effectsText.value = JSON.stringify(lesson?.completion?.effects ?? [], null, 2);
}

function commitLessonJson() {
  const lesson = selectedLesson.value;
  if (!lesson) return true;
  try {
    lesson.sections = JSON.parse(sectionsText.value || "[]");
    lesson.quiz = JSON.parse(quizText.value || "[]");
    lesson.completion.effects = JSON.parse(effectsText.value || "[]");
    errors.value = {};
    return true;
  } catch (error) {
    status.value = `Lesson JSON is invalid: ${error.message}`;
    statusTone.value = "error";
    return false;
  }
}

function addLesson() {
  commitLessonJson();
  const lessonsDraft = draft.value.lessons ??= [];
  const id = uniqueId("new-lesson", lessonsDraft);
  lessonsDraft.push({
    id,
    title: "New Lesson",
    summary: "",
    order: lessonsDraft.length * 10,
    tags: [],
    availableWhen: { flags: { all: [] }, knowledge: { all: [] } },
    timeMinutes: 30,
    activity: "light",
    completion: { awardTitle: "Lesson complete", awardText: "", effects: [] },
    sections: [{ type: "text", title: "Opening", body: "" }],
    quiz: [{
      id: "first-question",
      type: "multiple-choice",
      prompt: "",
      options: [
        { id: "a", label: "", feedback: "" },
        { id: "b", label: "", feedback: "" },
      ],
      correctOptionId: "a",
    }],
  });
  selectedId.value = id;
  syncLessonJson();
}

async function saveLearning() {
  if (!commitLessonJson()) return;
  saving.value = true;
  try {
    const result = await storyApi("/api/learning", {
      method: "PUT",
      body: JSON.stringify({
        learning: toRaw(draft.value),
        expectedVersion: version.value,
      }),
    });
    draft.value = structuredClone(result.learning);
    version.value = result.version;
    warnings.value = result.warnings ?? [];
    errors.value = {};
    status.value = `Saved learning version ${result.version}.`;
    statusTone.value = "success";
    syncLessonJson();
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.message;
    statusTone.value = "error";
  } finally {
    saving.value = false;
  }
}

function setCsv(target, key, value) {
  target[key] = value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueId(base, entries) {
  const used = new Set(entries.map((entry) => entry.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}
</script>

<template>
  <section class="learning-editor panel">
    <div class="learning-toolbar">
      <div>
        <p class="label">Learning content</p>
        <h2>Lessons</h2>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="sm muted" @click="loadLearning">Reload</button>
        <button type="button" class="sm" @click="addLesson">Add lesson</button>
        <button type="button" class="sm" :disabled="saving || !draft" @click="saveLearning">Save lessons</button>
      </div>
    </div>

    <p v-if="status" class="status" :class="`status-${statusTone}`">{{ status }}</p>
    <ul v-if="errorMessages.length" class="message-list">
      <li v-for="message in errorMessages" :key="message">{{ message }}</li>
    </ul>
    <ul v-if="warnings.length" class="message-list warnings">
      <li v-for="warning in warnings" :key="`${warning.path}-${warning.message}`">
        {{ warning.path }}: {{ warning.message }}
      </li>
    </ul>

    <div v-if="draft" class="lesson-grid">
      <aside class="lesson-list">
        <button
          v-for="lesson in lessons"
          :key="lesson.id"
          type="button"
          :class="{ active: lesson.id === selectedId }"
          @click="selectLesson(lesson.id)">
          <strong>{{ lesson.title || lesson.id }}</strong>
          <small>{{ lesson.id }}</small>
        </button>
      </aside>

      <section v-if="selectedLesson" class="lesson-form">
        <div class="field-grid">
          <label>ID<input v-model="selectedLesson.id"></label>
          <label>Title<input v-model="selectedLesson.title"></label>
          <label>Summary<input v-model="selectedLesson.summary"></label>
          <label>Order<input v-model.number="selectedLesson.order" type="number"></label>
          <label>Time minutes<input v-model.number="selectedLesson.timeMinutes" type="number" min="0"></label>
          <label>Activity
            <select v-model="selectedLesson.activity">
              <option>resting</option>
              <option>light</option>
              <option>moderate</option>
              <option>strenuous</option>
            </select>
          </label>
          <label>Tags
            <input
              :value="selectedLesson.tags.join(', ')"
              @input="setCsv(selectedLesson, 'tags', $event.target.value)">
          </label>
          <label>Required flags
            <input
              :value="selectedLesson.availableWhen?.flags?.all?.join(', ') ?? ''"
              @input="selectedLesson.availableWhen.flags.all = $event.target.value.split(',').map((item) => item.trim()).filter(Boolean)">
          </label>
          <label>Award title<input v-model="selectedLesson.completion.awardTitle"></label>
          <label>Award text<input v-model="selectedLesson.completion.awardText"></label>
        </div>

        <label>Completion effects JSON
          <textarea v-model="effectsText" rows="4"></textarea>
        </label>
        <label>Sections JSON
          <textarea v-model="sectionsText" rows="16"></textarea>
        </label>
        <label>Quiz JSON
          <textarea v-model="quizText" rows="12"></textarea>
        </label>
      </section>
    </div>
  </section>
</template>

<style scoped>
.learning-editor {
  display: grid;
  gap: 0.8rem;
}

.learning-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.lesson-grid {
  display: grid;
  grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
  gap: 1rem;
}

.lesson-list {
  display: grid;
  align-content: start;
  gap: 0.5rem;
}

.lesson-list button {
  display: grid;
  gap: 0.2rem;
  text-align: left;
  border: 1px solid #3b4658;
  border-radius: 7px;
  background: #181d25;
  color: #dbe2ea;
  padding: 0.55rem;
}

.lesson-list button.active {
  border-color: #79d1c8;
}

.lesson-list small {
  color: #9aa7b6;
}

.lesson-form {
  display: grid;
  gap: 0.75rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

label {
  display: grid;
  gap: 0.25rem;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 6px;
  background: #171b22;
  color: #dbe2ea;
  padding: 0.45rem;
}

textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.4;
}

.message-list {
  margin: 0;
  color: #ffb2b2;
}

.warnings {
  color: #ffd38a;
}

@media (max-width: 900px) {
  .lesson-grid,
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
