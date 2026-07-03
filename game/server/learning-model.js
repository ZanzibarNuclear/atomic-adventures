import { validateCharacterEffects } from "./character-reference-validation.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z0-9_]+(?:[.-][a-z0-9_]+)*$/;
const BLOCK_TYPES = new Set(["paragraph", "formula", "symbols", "examples", "diagram", "image"]);
const FRAME_KINDS = new Set(["content", "quiz"]);
const QUESTION_TYPES = new Set(["multiple-choice"]);

export function normalizeLearningDocument(input = {}) {
  const source = input && typeof input === "object" ? structuredClone(input) : {};
  return {
    id: text(source.id) || "learning-main",
    lessons: array(source.lessons).map((lesson, lessonIndex) => ({
      id: text(lesson.id),
      title: text(lesson.title),
      summary: nullableText(lesson.summary),
      order: finiteNumber(lesson.order, lessonIndex),
      published: lesson.published !== false,
      availableWhen: normalizeAvailability(lesson.availableWhen),
      completion: {
        awardTitle: nullableText(lesson.completion?.awardTitle),
        awardText: nullableText(lesson.completion?.awardText),
        effects: array(lesson.completion?.effects).map((effect) => structuredClone(effect)),
      },
      pages: normalizePages(lesson),
    })),
  };
}

export function validateLearningDocument(input, { character = null } = {}) {
  const learning = normalizeLearningDocument(input);
  const errors = {};
  const add = (path, message) => ((errors[path] ??= []).push(message));

  if (learning.id !== "learning-main") add("id", 'Learning document ID must be "learning-main".');
  const lessonIds = validateIds(learning.lessons, "lessons", add);
  learning.lessons.forEach((lesson, lessonIndex) => {
    const base = `lessons.${lessonIndex}`;
    if (!lesson.title) add(`${base}.title`, "Lesson title is required.");
    validateAvailability(lesson.availableWhen, `${base}.availableWhen`, add);
    validatePages(lesson.pages, `${base}.pages`, add);
    validateCharacterEffects(
      lesson.completion.effects,
      `${base}.completion.effects`,
      character,
      add,
      {
        unknownDomainMessage: (domain) => `Unknown completion effect domain "${domain || "missing"}".`,
        unknownReferenceMessage: (domain, id) => `Unknown completion effect reference "${id}" in ${domain}.`,
      },
    );
  });
  void lessonIds;
  return {
    learning,
    errors,
    warnings: [],
    valid: Object.keys(errors).length === 0,
  };
}

function normalizeAvailability(value = {}) {
  return {
    flags: normalizeGroup(value.flags),
    knowledge: normalizeGroup(value.knowledge),
  };
}

function normalizeGroup(value) {
  const source = Array.isArray(value) ? { all: value } : value ?? {};
  return {
    all: stringList(source.all),
    any: stringList(source.any),
    not: stringList(source.not),
  };
}

function validateAvailability(value, path, add) {
  for (const group of ["flags", "knowledge"]) {
    const pattern = group === "flags" ? FLAG_PATTERN : ID_PATTERN;
    for (const mode of ["all", "any", "not"]) {
      (value[group]?.[mode] ?? []).forEach((id, index) => {
        if (!pattern.test(id)) add(`${path}.${group}.${mode}.${index}`, "Use a valid ID.");
      });
    }
  }
}

function normalizePages(lesson = {}) {
  return array(lesson.pages).map((page, pageIndex) => normalizePage(page, pageIndex));
}

function normalizePage(page = {}, pageIndex = 0) {
  return {
    id: text(page.id) || `page-${pageIndex + 1}`,
    title: nullableText(page.title),
    frames: array(page.frames).map((frame, frameIndex) => normalizeFrame(frame, frameIndex)),
  };
}

function normalizeFrame(frame = {}, frameIndex = 0) {
  const kind = text(frame.kind) || "content";
  return {
    id: text(frame.id) || `frame-${frameIndex + 1}`,
    kind,
    title: nullableText(frame.title),
    blocks: array(frame.blocks).map((block) => normalizeBlock(block)),
    questions: array(frame.questions).map((question) => normalizeQuestion(question)),
  };
}

function normalizeBlock(block = {}) {
  const type = text(block.type) || "paragraph";
  return {
    type,
    body: nullableText(block.body),
    src: nullableText(block.src),
    alt: nullableText(block.alt),
    formula: nullableText(block.formula),
    caption: nullableText(block.caption),
    rows: array(block.rows).map((row) => ({
      symbol: text(row.symbol),
      meaning: text(row.meaning),
      units: nullableText(row.units),
    })),
    steps: stringList(block.steps),
    examples: array(block.examples).map((example) => ({
      title: text(example.title),
      givens: stringList(example.givens),
      result: text(example.result),
      explanation: nullableText(example.explanation),
    })),
  };
}

function validatePages(pages, path, add) {
  if (!pages.length) add(path, "Add at least one lesson page.");
  const pageIds = validateIds(pages, path, add);
  void pageIds;
  pages.forEach((page, pageIndex) => {
    const pageBase = `${path}.${pageIndex}`;
    if (!page.frames.length) add(`${pageBase}.frames`, "Add at least one frame.");
    validateIds(page.frames, `${pageBase}.frames`, add);
    page.frames.forEach((frame, frameIndex) => {
      const frameBase = `${pageBase}.frames.${frameIndex}`;
      if (!FRAME_KINDS.has(frame.kind)) add(`${frameBase}.kind`, "Choose a supported frame kind.");
      if (frame.kind === "content") {
        if (!frame.blocks.length) add(`${frameBase}.blocks`, "Add at least one content block.");
        frame.blocks.forEach((block, blockIndex) => validateBlock(block, `${frameBase}.blocks.${blockIndex}`, add));
      }
      if (frame.kind === "quiz") {
        if (!frame.questions.length) add(`${frameBase}.questions`, "Add at least one quiz question.");
        frame.questions.forEach((question, questionIndex) =>
          validateQuestion(question, `${frameBase}.questions.${questionIndex}`, add),
        );
      }
    });
  });
}

function validateBlock(block, path, add) {
  if (!BLOCK_TYPES.has(block.type)) add(`${path}.type`, "Choose a supported block type.");
  if (block.type === "paragraph" && !block.body) add(`${path}.body`, "Paragraph text is required.");
  if (block.type === "formula" && !block.formula) add(`${path}.formula`, "Formula text is required.");
  if (block.type === "symbols" && !block.rows.length) add(`${path}.rows`, "Add at least one symbol row.");
  if (block.type === "examples" && !block.examples.length) add(`${path}.examples`, "Add at least one example.");
  if (block.type === "diagram" && block.steps.length < 2) add(`${path}.steps`, "Add at least two diagram steps.");
  if (block.type === "image" && !block.src) add(`${path}.src`, "Image path is required.");
  if (block.type === "image" && !block.alt) add(`${path}.alt`, "Image alt text is required.");
}

function validateQuestion(question, path, add) {
  if (!ID_PATTERN.test(question.id)) add(`${path}.id`, "Use a kebab-case question ID.");
  if (!QUESTION_TYPES.has(question.type)) add(`${path}.type`, "Choose a supported question type.");
  if (!question.prompt) add(`${path}.prompt`, "Question prompt is required.");
  if (question.options.length < 2) add(`${path}.options`, "Add at least two answer options.");
  const optionIds = validateIds(question.options, `${path}.options`, add);
  if (question.correctOptionId && !optionIds.has(question.correctOptionId)) {
    add(`${path}.correctOptionId`, "Choose one of the answer options.");
  }
  if (!question.correctOptionId) add(`${path}.correctOptionId`, "Correct answer is required.");
}

function normalizeQuestion(question = {}) {
  return {
    id: text(question.id),
    type: text(question.type) || "multiple-choice",
    prompt: text(question.prompt),
    options: array(question.options).map((option) => ({
      id: text(option.id),
      label: text(option.label),
      feedback: nullableText(option.feedback),
    })),
    correctOptionId: text(question.correctOptionId),
  };
}

function validateIds(entries, path, add) {
  const ids = new Set();
  entries.forEach((entry, index) => {
    if (!ID_PATTERN.test(entry.id)) add(`${path}.${index}.id`, "Use a kebab-case ID.");
    if (ids.has(entry.id)) add(`${path}.${index}.id`, "IDs must be unique.");
    ids.add(entry.id);
  });
  return ids;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function nullableText(value) {
  const valueText = text(value);
  return valueText || null;
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(text).filter(Boolean);
  return [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
