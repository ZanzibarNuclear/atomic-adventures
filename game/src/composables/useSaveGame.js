import { ref } from "vue";
import { captureSnapshot, applySnapshot } from "./useGameState.js";

const STORAGE_KEY = "atomic-adventures:save:v1";

export function useSaveGame() {
  const lastSavedAt = ref(null);
  const loadError = ref(null);

  function hasSave() {
    try {
      return localStorage.getItem(STORAGE_KEY) != null;
    } catch {
      return false;
    }
  }

  function save(ctx) {
    try {
      const snapshot = captureSnapshot(ctx);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      lastSavedAt.value = snapshot.savedAt;
      loadError.value = null;
      return true;
    } catch (err) {
      loadError.value = err?.message ?? "Save failed";
      return false;
    }
  }

  function load(ctx) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      const ok = applySnapshot(snapshot, ctx);
      if (ok) {
        lastSavedAt.value = snapshot.savedAt ?? null;
        loadError.value = null;
      }
      return ok;
    } catch (err) {
      loadError.value = err?.message ?? "Load failed";
      return false;
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      lastSavedAt.value = null;
      loadError.value = null;
    } catch {
      /* ignore */
    }
  }

  return {
    lastSavedAt,
    loadError,
    hasSave,
    save,
    load,
    clearSave,
  };
}
