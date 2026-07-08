import { commitGameActivity } from "../character/gameActivity.js";

export function lessonCompleted(gameState, lessonId) {
  return Boolean(gameState.lessons?.[lessonId]?.completedAt);
}

export function completeLesson(gameState, lesson, { now = () => new Date().toISOString() } = {}) {
  if (!lesson?.id) return { ok: false, error: "Lesson ID is required." };
  gameState.lessons ??= {};
  if (lessonCompleted(gameState, lesson.id)) {
    return { ok: true, alreadyCompleted: true };
  }
  const result = commitGameActivity(gameState, {
    effects: lesson.completion?.effects ?? [],
    now,
  });
  if (!result.ok) return result;
  gameState.lessons[lesson.id] = {
    completedAt: now(),
  };
  return { ok: true, completedAt: gameState.lessons[lesson.id].completedAt };
}
