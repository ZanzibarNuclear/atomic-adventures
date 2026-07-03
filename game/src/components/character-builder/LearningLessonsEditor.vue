<script setup>
import { computed, onMounted, ref, toRaw } from "vue";
import LessonRenderer from "../learning/LessonRenderer.vue";
import { storyApi } from "../../lib/storyApi.js";

const availabilityGroups = [
  { domain: "flags", label: "Flags" },
  { domain: "knowledge", label: "Knowledge" },
];
const availabilityModes = [
  { id: "all", label: "All required" },
  { id: "any", label: "Any one" },
  { id: "not", label: "Blocked by" },
];
const blockTypes = ["paragraph", "formula", "symbols", "examples", "diagram", "image"];
const frameKinds = [
  { id: "content", label: "Content" },
  { id: "quiz", label: "Quiz" },
];
const effectOps = [
  "item.add",
  "stat.add",
  "knowledge.acquire",
  "skill.add-evidence",
  "quest.start",
  "document.discover",
];

const draft = ref(null);
const version = ref(0);
const selectedId = ref("");
const status = ref("");
const statusTone = ref("info");
const errors = ref({});
const warnings = ref([]);
const saving = ref(false);

const lessons = computed(() =>
  [...(draft.value?.lessons ?? [])].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
);
const selectedLesson = computed(() =>
  draft.value?.lessons?.find((lesson) => lesson.id === selectedId.value) ?? null,
);
const errorMessages = computed(() =>
  Object.entries(errors.value).flatMap(([path, messages]) =>
    messages.map((message) => `${formatLearningErrorPath(path)}: ${message}`),
  ),
);

onMounted(loadLearning);

async function loadLearning() {
  try {
    const result = await storyApi("/api/learning");
    draft.value = structuredClone(result.learning);
    normalizeLearningDraft(draft.value);
    version.value = result.version;
    warnings.value = result.warnings ?? [];
    selectedId.value = draft.value.lessons?.[0]?.id ?? "";
    status.value = "";
    statusTone.value = "info";
    errors.value = {};
  } catch (error) {
    status.value = error.message;
    statusTone.value = "error";
  }
}

function selectLesson(id) {
  selectedId.value = id;
}

function addLesson() {
  const lessonsDraft = draft.value.lessons ??= [];
  const id = uniqueId("new-lesson", lessonsDraft);
  lessonsDraft.push({
    id,
    title: "New Lesson",
    summary: "",
    order: lessonsDraft.length * 10,
    published: true,
    availableWhen: { flags: { all: [] }, knowledge: { all: [] } },
    completion: { awardTitle: "Lesson complete", awardText: "", effects: [] },
    pages: [{
      id: "page-1",
      title: "Opening",
      frames: [
        {
          id: "opening",
          kind: "content",
          title: "Opening",
          blocks: [{ type: "paragraph", body: "" }],
          questions: [],
        },
        {
          id: "check",
          kind: "quiz",
          title: "Check Your Understanding",
          blocks: [],
          questions: [newQuestion("first-question")],
        },
      ],
    }],
  });
  selectedId.value = id;
}

async function saveLearning() {
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
    normalizeLearningDraft(draft.value);
    version.value = result.version;
    warnings.value = result.warnings ?? [];
    errors.value = {};
    status.value = `Saved learning version ${result.version}.`;
    statusTone.value = "success";
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

function setList(target, key, value) {
  target[key] = value.split(",").map((item) => item.trim()).filter(Boolean);
}

function addPage() {
  const pages = selectedLesson.value.pages ??= [];
  const id = uniqueId("page", pages);
  pages.push({ id, title: "New page", frames: [newFrame("content")] });
}

function removePage(index) {
  selectedLesson.value.pages.splice(index, 1);
}

function movePage(index, delta) {
  moveEntry(selectedLesson.value.pages, index, delta);
}

function addFrame(page, kind = "content") {
  page.frames ??= [];
  page.frames.push(newFrame(kind, page.frames));
}

function removeFrame(page, index) {
  page.frames.splice(index, 1);
}

function moveFrame(page, index, delta) {
  moveEntry(page.frames, index, delta);
}

function addBlock(frame, type = "paragraph") {
  frame.blocks ??= [];
  frame.blocks.push(newBlock(type));
}

function removeBlock(frame, index) {
  frame.blocks.splice(index, 1);
}

function moveBlock(frame, index, delta) {
  moveEntry(frame.blocks, index, delta);
}

function replaceBlock(frame, index, type) {
  frame.blocks.splice(index, 1, newBlock(type));
}

function addSymbolRow(block) {
  block.rows ??= [];
  block.rows.push({ symbol: "", meaning: "", units: "" });
}

function addExample(block) {
  block.examples ??= [];
  block.examples.push({ title: "Example", givens: [], result: "", explanation: "" });
}

function addDiagramStep(block) {
  block.steps ??= [];
  block.steps.push("New step");
}

function addQuestion(frame) {
  const questions = frame.questions ??= [];
  const id = uniqueId("question", questions);
  questions.push(newQuestion(id));
}

function removeQuestion(frame, index) {
  frame.questions.splice(index, 1);
}

function addOption(question) {
  question.options ??= [];
  const id = uniqueId("option", question.options);
  question.options.push({ id, label: "", feedback: "" });
}

function removeOption(question, index) {
  const [removed] = question.options.splice(index, 1);
  if (question.correctOptionId === removed?.id) {
    question.correctOptionId = question.options[0]?.id ?? "";
  }
}

function addEffect() {
  selectedLesson.value.completion.effects.push({ op: "knowledge.acquire", id: "" });
}

function removeEffect(index) {
  selectedLesson.value.completion.effects.splice(index, 1);
}

function normalizeLearningDraft(learning) {
  learning.lessons ??= [];
  learning.lessons.forEach(ensureLessonShape);
}

function ensureLessonShape(lesson) {
  lesson.published = lesson.published !== false;
  lesson.availableWhen ??= {};
  for (const { domain } of availabilityGroups) {
    lesson.availableWhen[domain] ??= {};
    for (const { id } of availabilityModes) lesson.availableWhen[domain][id] ??= [];
  }
  lesson.completion ??= {};
  lesson.completion.effects ??= [];
  lesson.pages = normalizeLessonPages(lesson);
}

function normalizeLessonPages(lesson) {
  const pages = lesson.pages?.length ? lesson.pages : legacyPages(lesson);
  delete lesson.sections;
  delete lesson.quiz;
  pages.forEach((page, pageIndex) => {
    page.id ||= `page-${pageIndex + 1}`;
    page.title ??= "";
    page.frames ??= [];
    page.frames.forEach((frame, frameIndex) => {
      frame.id ||= `frame-${frameIndex + 1}`;
      frame.kind ||= "content";
      frame.title ??= "";
      frame.blocks ??= [];
      frame.questions ??= [];
      frame.blocks.forEach(ensureBlockShape);
      frame.questions.forEach(ensureQuestionShape);
    });
  });
  return pages;
}

function legacyPages(lesson) {
  const frames = (lesson.sections ?? []).map((section, index) => ({
    id: `section-${index + 1}`,
    kind: "content",
    title: section.title ?? "",
    blocks: [legacyBlock(section)],
    questions: [],
  }));
  if (lesson.quiz?.length) {
    frames.push({
      id: "quiz",
      kind: "quiz",
      title: "Check Your Understanding",
      blocks: [],
      questions: lesson.quiz,
    });
  }
  return [{ id: "page-1", title: "", frames }];
}

function legacyBlock(section) {
  return {
    ...section,
    type: section.type === "text" ? "paragraph" : section.type,
  };
}

function ensureBlockShape(block) {
  block.type ||= "paragraph";
  block.rows ??= [];
  block.examples ??= [];
  block.steps ??= [];
}

function ensureQuestionShape(question) {
  question.type ||= "multiple-choice";
  question.options ??= [];
}

function newFrame(kind = "content", siblings = []) {
  const id = uniqueId(kind === "quiz" ? "quiz" : "frame", siblings);
  return kind === "quiz"
    ? { id, kind: "quiz", title: "Check Your Understanding", blocks: [], questions: [newQuestion("question")] }
    : { id, kind: "content", title: "New frame", blocks: [newBlock("paragraph")], questions: [] };
}

function newBlock(type = "paragraph") {
  if (type === "formula") return { type, formula: "", caption: "" };
  if (type === "symbols") return { type, rows: [{ symbol: "", meaning: "", units: "" }] };
  if (type === "examples") return { type, examples: [{ title: "Example", givens: [], result: "", explanation: "" }] };
  if (type === "diagram") return { type, steps: ["First step", "Second step"] };
  if (type === "image") return { type, src: "", alt: "", caption: "" };
  return { type: "paragraph", body: "" };
}

function newQuestion(id) {
  return {
    id,
    type: "multiple-choice",
    prompt: "",
    options: [
      { id: "a", label: "", feedback: "" },
      { id: "b", label: "", feedback: "" },
    ],
    correctOptionId: "a",
  };
}

function moveEntry(entries, index, delta) {
  const next = index + delta;
  if (next < 0 || next >= entries.length) return;
  const [entry] = entries.splice(index, 1);
  entries.splice(next, 0, entry);
}

function formatLearningErrorPath(path) {
  const parts = String(path).split(".");
  if (parts[0] !== "lessons") return labelizePath(parts);
  const lessonIndex = Number(parts[1]);
  const lesson = draft.value?.lessons?.[lessonIndex];
  const label = lesson?.title || lesson?.id || `Lesson ${lessonIndex + 1}`;
  if (parts.length <= 2) return label;
  if (parts[2] === "pages") {
    const pageIndex = Number(parts[3]);
    const page = lesson?.pages?.[pageIndex];
    const pageLabel = page?.title || page?.id || `Page ${pageIndex + 1}`;
    if (parts[4] !== "frames") return `${label} / ${pageLabel} / ${labelizePath(parts.slice(4))}`;

    const frameIndex = Number(parts[5]);
    const frame = page?.frames?.[frameIndex];
    const frameLabel = frame?.title || frame?.id || `Frame ${frameIndex + 1}`;
    if (parts[6] === "blocks") {
      const blockIndex = Number(parts[7]);
      const block = frame?.blocks?.[blockIndex];
      return `${label} / ${pageLabel} / ${frameLabel} / ${block?.type || `Block ${blockIndex + 1}`} / ${labelizePath(parts.slice(8))}`;
    }
    if (parts[6] === "questions") {
      const questionIndex = Number(parts[7]);
      const question = frame?.questions?.[questionIndex];
      const questionLabel = question?.id || `Question ${questionIndex + 1}`;
      if (parts[8] === "options") {
        const optionIndex = Number(parts[9]);
        const option = question?.options?.[optionIndex];
        return `${label} / ${pageLabel} / ${frameLabel} / ${questionLabel} / ${option?.id || `Option ${optionIndex + 1}`} / ${labelizePath(parts.slice(10))}`;
      }
      return `${label} / ${pageLabel} / ${frameLabel} / ${questionLabel} / ${labelizePath(parts.slice(8))}`;
    }
    return `${label} / ${pageLabel} / ${frameLabel} / ${labelizePath(parts.slice(6))}`;
  }
  if (parts[2] === "completion" && parts[3] === "effects") {
    const effectIndex = Number(parts[4]);
    const effect = lesson?.completion?.effects?.[effectIndex];
    return `${label} / Completion effect ${effectIndex + 1}${effect?.op ? ` (${effect.op})` : ""} / ${labelizePath(parts.slice(5))}`;
  }
  if (parts[2] === "availableWhen") {
    return `${label} / Availability / ${labelizePath(parts.slice(3))}`;
  }
  return `${label} / ${labelizePath(parts.slice(2))}`;
}

function labelizePath(parts) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/([A-Z])/g, " $1").replace(/-/g, " "))
    .join(" / ");
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
          <label class="check-field">
            <input v-model="selectedLesson.published" type="checkbox">
            Published in holo-reader
          </label>
          <label>Award title<input v-model="selectedLesson.completion.awardTitle"></label>
          <label>Award text<input v-model="selectedLesson.completion.awardText"></label>
        </div>

        <section class="form-card">
          <div class="section-heading">
            <h3>Availability</h3>
          </div>
          <div class="availability-grid">
            <label
              v-for="group in availabilityGroups.flatMap((domain) => availabilityModes.map((mode) => ({ ...domain, mode })))"
              :key="`${group.domain}-${group.mode.id}`">
              {{ group.label }} - {{ group.mode.label }}
              <input
                :value="selectedLesson.availableWhen[group.domain][group.mode.id].join(', ')"
                @input="setList(selectedLesson.availableWhen[group.domain], group.mode.id, $event.target.value)">
            </label>
          </div>
        </section>

        <section class="form-card">
          <div class="section-heading">
            <h3>Completion effects</h3>
            <button type="button" class="sm muted" @click="addEffect">Add effect</button>
          </div>
          <div v-if="!selectedLesson.completion.effects.length" class="empty-inline">
            No completion effects yet.
          </div>
          <div
            v-for="(effect, index) in selectedLesson.completion.effects"
            :key="index"
            class="effect-row">
            <label>Operation
              <select v-model="effect.op">
                <option v-for="op in effectOps" :key="op" :value="op">{{ op }}</option>
              </select>
            </label>
            <label>Catalog ID<input v-model="effect.id"></label>
            <label v-if="effect.op === 'item.add'">Quantity<input v-model.number="effect.quantity" type="number" min="1"></label>
            <label v-if="effect.op === 'stat.add'">Value<input v-model.number="effect.value" type="number"></label>
            <label v-if="effect.op === 'skill.add-evidence'">Evidence<input v-model="effect.evidence"></label>
            <label v-if="effect.op === 'skill.add-evidence'">Value<input v-model.number="effect.value" type="number" min="1"></label>
            <button type="button" class="sm danger" @click="removeEffect(index)">Remove</button>
          </div>
        </section>

        <section class="form-card">
          <div class="section-heading">
            <h3>Pages</h3>
            <button type="button" class="sm muted" @click="addPage">Add page</button>
          </div>
          <article
            v-for="(page, pageIndex) in selectedLesson.pages"
            :key="page.id || pageIndex"
            class="nested-card page-editor">
            <div class="section-heading">
              <h4>Page {{ pageIndex + 1 }}</h4>
              <div class="row-actions">
                <button type="button" class="sm muted" :disabled="pageIndex === 0" @click="movePage(pageIndex, -1)">Up</button>
                <button type="button" class="sm muted" :disabled="pageIndex === selectedLesson.pages.length - 1" @click="movePage(pageIndex, 1)">Down</button>
                <button type="button" class="sm danger" @click="removePage(pageIndex)">Remove</button>
              </div>
            </div>
            <div class="field-grid">
              <label>Page ID<input v-model="page.id"></label>
              <label>Title<input v-model="page.title"></label>
            </div>

            <div class="nested-list">
              <div class="section-heading">
                <h5>Frames</h5>
                <div class="row-actions">
                  <button type="button" class="sm muted" @click="addFrame(page, 'content')">Add content frame</button>
                  <button type="button" class="sm muted" @click="addFrame(page, 'quiz')">Add quiz frame</button>
                </div>
              </div>
              <article
                v-for="(frame, frameIndex) in page.frames"
                :key="frame.id || frameIndex"
                class="nested-card frame-editor">
                <div class="section-heading">
                  <h5>Frame {{ frameIndex + 1 }}</h5>
                  <div class="row-actions">
                    <button type="button" class="sm muted" :disabled="frameIndex === 0" @click="moveFrame(page, frameIndex, -1)">Up</button>
                    <button type="button" class="sm muted" :disabled="frameIndex === page.frames.length - 1" @click="moveFrame(page, frameIndex, 1)">Down</button>
                    <button type="button" class="sm danger" @click="removeFrame(page, frameIndex)">Remove</button>
                  </div>
                </div>
                <div class="field-grid">
                  <label>Frame ID<input v-model="frame.id"></label>
                  <label>Kind
                    <select v-model="frame.kind">
                      <option v-for="kind in frameKinds" :key="kind.id" :value="kind.id">{{ kind.label }}</option>
                    </select>
                  </label>
                  <label>Title<input v-model="frame.title"></label>
                </div>

                <div v-if="frame.kind === 'content'" class="nested-list">
                  <div class="section-heading">
                    <h5>Blocks</h5>
                    <button type="button" class="sm muted" @click="addBlock(frame)">Add block</button>
                  </div>
                  <article
                    v-for="(block, blockIndex) in frame.blocks"
                    :key="blockIndex"
                    class="example-editor block-editor">
                    <div class="section-heading">
                      <h5>Block {{ blockIndex + 1 }}</h5>
                      <div class="row-actions">
                        <button type="button" class="sm muted" :disabled="blockIndex === 0" @click="moveBlock(frame, blockIndex, -1)">Up</button>
                        <button type="button" class="sm muted" :disabled="blockIndex === frame.blocks.length - 1" @click="moveBlock(frame, blockIndex, 1)">Down</button>
                        <button type="button" class="sm danger" @click="removeBlock(frame, blockIndex)">Remove</button>
                      </div>
                    </div>
                    <label>Type
                      <select :value="block.type" @change="replaceBlock(frame, blockIndex, $event.target.value)">
                        <option v-for="type in blockTypes" :key="type" :value="type">{{ type }}</option>
                      </select>
                    </label>

                    <label v-if="block.type === 'paragraph'">Paragraph<textarea v-model="block.body" rows="4"></textarea></label>
                    <label v-if="block.type === 'formula'">Formula<textarea v-model="block.formula" rows="2"></textarea></label>
                    <label v-if="block.type === 'formula'">Caption<textarea v-model="block.caption" rows="2"></textarea></label>
                    <div v-if="block.type === 'image'" class="field-grid">
                      <label>Image path<input v-model="block.src" placeholder="/learning/hydro/example.png"></label>
                      <label>Alt text<input v-model="block.alt"></label>
                      <label>Caption<textarea v-model="block.caption" rows="2"></textarea></label>
                    </div>

                    <div v-if="block.type === 'diagram'" class="nested-list">
                      <div class="section-heading">
                        <h5>Diagram steps</h5>
                        <button type="button" class="sm muted" @click="addDiagramStep(block)">Add step</button>
                      </div>
                      <div v-for="(step, stepIndex) in block.steps" :key="stepIndex" class="symbol-row">
                        <label>Step<input v-model="block.steps[stepIndex]"></label>
                        <button type="button" class="sm danger" @click="block.steps.splice(stepIndex, 1)">Remove</button>
                      </div>
                    </div>

                    <div v-if="block.type === 'symbols'" class="nested-list">
                      <div class="section-heading">
                        <h5>Symbol rows</h5>
                        <button type="button" class="sm muted" @click="addSymbolRow(block)">Add row</button>
                      </div>
                      <div v-for="(row, rowIndex) in block.rows" :key="rowIndex" class="symbol-row">
                        <label>Symbol<input v-model="row.symbol"></label>
                        <label>Meaning<input v-model="row.meaning"></label>
                        <label>Units<input v-model="row.units"></label>
                        <button type="button" class="sm danger" @click="block.rows.splice(rowIndex, 1)">Remove</button>
                      </div>
                    </div>

                    <div v-if="block.type === 'examples'" class="nested-list">
                      <div class="section-heading">
                        <h5>Examples</h5>
                        <button type="button" class="sm muted" @click="addExample(block)">Add example</button>
                      </div>
                      <article v-for="(example, exampleIndex) in block.examples" :key="exampleIndex" class="example-editor">
                        <div class="section-heading">
                          <h5>Example {{ exampleIndex + 1 }}</h5>
                          <button type="button" class="sm danger" @click="block.examples.splice(exampleIndex, 1)">Remove</button>
                        </div>
                        <label>Title<input v-model="example.title"></label>
                        <label>Givens
                          <input
                            :value="example.givens.join(', ')"
                            @input="setList(example, 'givens', $event.target.value)">
                        </label>
                        <label>Result<input v-model="example.result"></label>
                        <label>Explanation<textarea v-model="example.explanation" rows="3"></textarea></label>
                      </article>
                    </div>
                  </article>
                </div>

                <div v-if="frame.kind === 'quiz'" class="nested-list">
                  <div class="section-heading">
                    <h5>Questions</h5>
                    <button type="button" class="sm muted" @click="addQuestion(frame)">Add question</button>
                  </div>
                  <article
                    v-for="(question, questionIndex) in frame.questions"
                    :key="questionIndex"
                    class="example-editor">
                    <div class="section-heading">
                      <h5>Question {{ questionIndex + 1 }}</h5>
                      <button type="button" class="sm danger" @click="removeQuestion(frame, questionIndex)">Remove</button>
                    </div>
                    <div class="field-grid">
                      <label>ID<input v-model="question.id"></label>
                      <label>Correct answer
                        <select v-model="question.correctOptionId">
                          <option v-for="option in question.options" :key="option.id" :value="option.id">
                            {{ option.id || "Untitled option" }}
                          </option>
                        </select>
                      </label>
                    </div>
                    <label>Prompt<textarea v-model="question.prompt" rows="3"></textarea></label>
                    <div class="nested-list">
                      <div class="section-heading">
                        <h5>Answer options</h5>
                        <button type="button" class="sm muted" @click="addOption(question)">Add option</button>
                      </div>
                      <div v-for="(option, optionIndex) in question.options" :key="optionIndex" class="option-row">
                        <label>ID<input v-model="option.id"></label>
                        <label>Label<input v-model="option.label"></label>
                        <label>Feedback<textarea v-model="option.feedback" rows="2"></textarea></label>
                        <button type="button" class="sm danger" @click="removeOption(question, optionIndex)">Remove</button>
                      </div>
                    </div>
                  </article>
                </div>
              </article>
            </div>
          </article>
        </section>

        <section class="lesson-preview">
          <div class="section-heading">
            <div>
              <p class="label">Preview</p>
              <h3>{{ selectedLesson.title || "Untitled lesson" }}</h3>
            </div>
          </div>
          <LessonRenderer :lesson="selectedLesson" preview>
            <template #award-actions>
              <span class="preview-note">Preview only</span>
            </template>
          </LessonRenderer>
        </section>
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

.form-card,
.nested-card,
.example-editor {
  display: grid;
  gap: 0.75rem;
  border: 1px solid #303949;
  border-radius: 7px;
  background: #151a22;
  padding: 0.75rem;
}

.nested-card,
.example-editor {
  background: #121720;
}

.section-heading,
.row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.section-heading h3,
.section-heading h4,
.section-heading h5 {
  margin: 0;
}

.availability-grid,
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.effect-row,
.symbol-row,
.option-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 0.6rem;
}

.option-row {
  grid-template-columns: minmax(4rem, 7rem) minmax(10rem, 1fr) minmax(14rem, 1.4fr) auto;
}

.nested-list {
  display: grid;
  gap: 0.6rem;
}

.empty-inline {
  color: #9aa7b6;
  font-size: 0.92rem;
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

.danger {
  border-color: #7d3642;
  background: #351920;
  color: #ffd4dc;
}

.lesson-preview {
  display: grid;
  gap: 0.5rem;
  border: 1px solid #2f6a67;
  border-radius: 7px;
  background:
    linear-gradient(135deg, rgba(40, 170, 160, 0.16), rgba(8, 18, 24, 0.7)),
    #10151c;
  padding: 0.75rem;
}

.preview-note {
  color: #c8f7f1;
  font-weight: 700;
}

@media (max-width: 900px) {
  .lesson-grid,
  .availability-grid,
  .field-grid,
  .effect-row,
  .symbol-row,
  .option-row {
    grid-template-columns: 1fr;
  }
}
</style>
