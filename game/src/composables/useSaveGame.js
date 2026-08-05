import { ref } from "vue";
import { captureSnapshot, applySnapshot } from "./useGameState.js";
import {
  persistHydroEngineCheckpoint,
  refreshEngineFromHost,
} from "./useHydroFacility.js";
import {
  disposeOpsSession,
  resetOpsSessionState,
} from "../lib/simulations/energySim/index.js";

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
      // Best-effort: write engine checkpoint into host state and re-save
      if (ctx?.gameState) {
        void persistHydroEngineCheckpoint(ctx.gameState)
          .then(() => {
            const withEngine = captureSnapshot(ctx);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(withEngine));
            lastSavedAt.value = withEngine.savedAt;
          })
          .catch(() => {
            /* keep host-only save */
          });
      }
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
      disposeOpsSession();
      resetOpsSessionState();
      const ok = applySnapshot(snapshot, ctx);
      if (ok) {
        lastSavedAt.value = snapshot.savedAt ?? null;
        loadError.value = null;
        if (ctx?.gameState) {
          void refreshEngineFromHost(ctx.gameState, {
            durationSecs: ctx.gameState.facilities?.hydro?.online ? 25 : 1,
          }).catch(() => {
            /* console open will retry */
          });
        }
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
