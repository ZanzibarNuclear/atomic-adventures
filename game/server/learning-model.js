import { validateCharacterEffects } from "./character-reference-validation.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z0-9_]+(?:[.-][a-z0-9_]+)*$/;
const ACTIVITIES = new Set(["resting", "light", "moderate", "strenuous"]);
const SECTION_TYPES = new Set(["text", "formula", "symbols", "examples"]);
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
      tags: stringList(lesson.tags),
      availableWhen: normalizeAvailability(lesson.availableWhen),
      timeMinutes: finiteNumber(lesson.timeMinutes, 30),
      activity: text(lesson.activity) || "light",
      completion: {
        awardTitle: nullableText(lesson.completion?.awardTitle),
        awardText: nullableText(lesson.completion?.awardText),
        effects: array(lesson.completion?.effects).map((effect) => structuredClone(effect)),
      },
      sections: array(lesson.sections).map((section) => normalizeSection(section)),
      quiz: array(lesson.quiz).map((question) => normalizeQuestion(question)),
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
    if (lesson.timeMinutes < 0) add(`${base}.timeMinutes`, "Lesson time cannot be negative.");
    if (!ACTIVITIES.has(lesson.activity)) add(`${base}.activity`, "Choose a supported activity profile.");
    validateAvailability(lesson.availableWhen, `${base}.availableWhen`, add);
    if (!lesson.sections.length) add(`${base}.sections`, "Add at least one lesson section.");
    lesson.sections.forEach((section, sectionIndex) => {
      const sectionBase = `${base}.sections.${sectionIndex}`;
      if (!SECTION_TYPES.has(section.type)) add(`${sectionBase}.type`, "Choose a supported section type.");
      if (!section.title && section.type !== "formula") add(`${sectionBase}.title`, "Section title is required.");
      if (section.type === "text" && !section.body) add(`${sectionBase}.body`, "Section body is required.");
      if (section.type === "formula" && !section.formula) add(`${sectionBase}.formula`, "Formula text is required.");
      if (section.type === "symbols" && !section.rows.length) add(`${sectionBase}.rows`, "Add at least one symbol row.");
      if (section.type === "examples" && !section.examples.length) add(`${sectionBase}.examples`, "Add at least one example.");
    });
    if (!lesson.quiz.length) add(`${base}.quiz`, "Add at least one quiz question.");
    lesson.quiz.forEach((question, questionIndex) => {
      const questionBase = `${base}.quiz.${questionIndex}`;
      if (!ID_PATTERN.test(question.id)) add(`${questionBase}.id`, "Use a kebab-case question ID.");
      if (!QUESTION_TYPES.has(question.type)) add(`${questionBase}.type`, "Choose a supported question type.");
      if (!question.prompt) add(`${questionBase}.prompt`, "Question prompt is required.");
      if (question.options.length < 2) add(`${questionBase}.options`, "Add at least two answer options.");
      const optionIds = validateIds(question.options, `${questionBase}.options`, add);
      if (question.correctOptionId && !optionIds.has(question.correctOptionId)) {
        add(`${questionBase}.correctOptionId`, "Choose one of the answer options.");
      }
      if (!question.correctOptionId) add(`${questionBase}.correctOptionId`, "Correct answer is required.");
    });
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

function normalizeSection(section = {}) {
  const type = text(section.type) || "text";
  return {
    type,
    title: nullableText(section.title),
    body: nullableText(section.body),
    formula: nullableText(section.formula),
    caption: nullableText(section.caption),
    rows: array(section.rows).map((row) => ({
      symbol: text(row.symbol),
      meaning: text(row.meaning),
      units: nullableText(row.units),
    })),
    examples: array(section.examples).map((example) => ({
      title: text(example.title),
      givens: stringList(example.givens),
      result: text(example.result),
      explanation: nullableText(example.explanation),
    })),
  };
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
