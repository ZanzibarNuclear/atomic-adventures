import { computed, ref } from "vue";

export const GAME_VIEW_KINDS = Object.freeze([
  "map",
  "inventory",
  "character-stats",
  "character",
  "closeup",
  "lesson",
  "document",
  "console",
  "simulation",
]);

function normalizeView(view, payload = null, blocking = false) {
  if (!GAME_VIEW_KINDS.includes(view)) {
    throw new Error(`Unknown game view "${view}".`);
  }
  return {
    kind: view,
    payload: payload && typeof payload === "object" ? { ...payload } : null,
    blocking: view !== "map" && blocking === true,
  };
}

export function useGameView() {
  const activeView = ref(normalizeView("map"));
  const isMapView = computed(() => activeView.value.kind === "map");
  const isCharacterView = computed(() => activeView.value.kind === "character");

  function openView(kind, payload = null, options = {}) {
    if (activeView.value.blocking && options.force !== true) return false;
    activeView.value = normalizeView(kind, payload, options.blocking);
    return true;
  }

  function returnToMap(options = {}) {
    return openView("map", null, options);
  }

  function openCharacter(payload = null) {
    return openView("character", payload);
  }

  function openInventory(payload = null) {
    return openView("inventory", payload);
  }

  function openCharacterStats(payload = null) {
    return openView("character-stats", payload);
  }

  return {
    activeView,
    isMapView,
    isCharacterView,
    openView,
    openCharacter,
    openInventory,
    openCharacterStats,
    returnToMap,
  };
}
