import { lessonAvailable } from "./availability.js";

export const HOLO_READER_STAND_ID = "holo-reader";
export const HOLO_READER_BROWSER_ACTION_ID = "lesson-browser:holo-reader";
export const HOLO_READER_HIDDEN_TAG = "holo-hidden";

export function availableHoloReaderLessons(lessons = [], {
  flags = new Set(),
  character = null,
} = {}) {
  return lessons
    .filter((lesson) => !lesson.tags?.includes(HOLO_READER_HIDDEN_TAG))
    .filter((lesson) => lessonAvailable(lesson, { flags, character }))
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
}

export function buildHoloReaderActions({
  place,
  currentStand,
  lessons = [],
  flags = new Set(),
  character = null,
  stationPowerOn = false,
} = {}) {
  if (place !== "indoors") return [];
  if (currentStand !== HOLO_READER_STAND_ID) return [];
  if (!stationPowerOn) return [];
  if (!availableHoloReaderLessons(lessons, { flags, character }).length) return [];
  return [{
    id: HOLO_READER_BROWSER_ACTION_ID,
    label: "Browse holo-reader lessons",
    kind: "lesson",
  }];
}
