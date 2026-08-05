/**
 * Registered lesson interactions for Holo-Reader content blocks.
 * Content may only reference ids listed here — never arbitrary component paths.
 */

import HydroPenstockLab from "../../components/learning/interactions/HydroPenstockLab.vue";

/** @type {Record<string, { id: string, label: string, component: object }>} */
export const LESSON_INTERACTIONS = Object.freeze({
  "hydro-penstock-lab": {
    id: "hydro-penstock-lab",
    label: "Penstock configuration lab",
    component: HydroPenstockLab,
  },
});

/**
 * @param {string|null|undefined} interactionId
 * @returns {{ id: string, label: string, component: object }|null}
 */
export function resolveLessonInteraction(interactionId) {
  if (!interactionId) return null;
  return LESSON_INTERACTIONS[String(interactionId)] ?? null;
}

export function isRegisteredInteractionId(interactionId) {
  return Boolean(resolveLessonInteraction(interactionId));
}

export function registeredInteractionIds() {
  return Object.keys(LESSON_INTERACTIONS);
}
