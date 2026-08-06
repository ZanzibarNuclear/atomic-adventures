import { computed, ref } from "vue";
import { captureSnapshot, applySnapshot } from "./useGameState.js";
import {
  persistHydroEngineCheckpoint,
  refreshEngineFromHost,
} from "./useHydroFacility.js";
import {
  disposeOpsSession,
  resetOpsSessionState,
} from "../lib/simulations/energySim/index.js";

/** Legacy single-slot key (migrated into slot 1). */
const LEGACY_STORAGE_KEY = "atomic-adventures:save:v1";
const ACTIVE_SLOT_KEY = "atomic-adventures:save:active-slot";
const SLOT_KEY_PREFIX = "atomic-adventures:save:slot:";

export const SAVE_SLOT_COUNT = 3;
export const SAVE_SLOT_IDS = Object.freeze([1, 2, 3]);

function slotStorageKey(slotId) {
  return `${SLOT_KEY_PREFIX}${slotId}`;
}

function normalizeSlotId(slotId) {
  const n = Number(slotId);
  return SAVE_SLOT_IDS.includes(n) ? n : null;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readActiveSlotId() {
  try {
    const id = normalizeSlotId(localStorage.getItem(ACTIVE_SLOT_KEY));
    return id ?? 1;
  } catch {
    return 1;
  }
}

function writeActiveSlotId(slotId) {
  const id = normalizeSlotId(slotId) ?? 1;
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(id));
  } catch {
    /* ignore */
  }
  return id;
}

function snapshotMeta(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    savedAt: snapshot.savedAt ?? null,
    playMode: snapshot.playMode ?? null,
  };
}

/**
 * One-time migration: move the pre-slots single save into slot 1.
 * Leaves an empty legacy key removed so we do not re-migrate.
 */
export function migrateLegacySaveIfNeeded() {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy == null) return false;
    const slot1 = localStorage.getItem(slotStorageKey(1));
    if (slot1 == null) {
      localStorage.setItem(slotStorageKey(1), legacy);
      writeActiveSlotId(1);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function readSlotSnapshot(slotId) {
  const id = normalizeSlotId(slotId);
  if (!id) return null;
  return readJson(slotStorageKey(id));
}

function slotOccupied(slotId) {
  try {
    return localStorage.getItem(slotStorageKey(slotId)) != null;
  } catch {
    return false;
  }
}

/**
 * Multi-slot player save (localStorage). Three independent game states;
 * one is active for Save / current play session.
 */
export function useSaveGame() {
  migrateLegacySaveIfNeeded();

  const activeSlot = ref(readActiveSlotId());
  const lastSavedAt = ref(null);
  const loadError = ref(null);
  /** Bumps when storage slots change so listSlots stays reactive. */
  const revision = ref(0);

  function bump() {
    revision.value += 1;
  }

  function setActiveSlot(slotId) {
    activeSlot.value = writeActiveSlotId(slotId);
    bump();
  }

  const slots = computed(() => {
    revision.value; // dependency
    return SAVE_SLOT_IDS.map((id) => {
      const snapshot = readSlotSnapshot(id);
      const meta = snapshotMeta(snapshot);
      return {
        id,
        occupied: snapshot != null,
        savedAt: meta?.savedAt ?? null,
        playMode: meta?.playMode ?? null,
        active: id === activeSlot.value,
      };
    });
  });

  function hasSave(slotId = activeSlot.value) {
    const id = normalizeSlotId(slotId) ?? activeSlot.value;
    return slotOccupied(id);
  }

  function hasAnySave() {
    return SAVE_SLOT_IDS.some((id) => slotOccupied(id));
  }

  /** First game with no saved data, or null if all three are occupied. */
  function firstOpenSlot() {
    return SAVE_SLOT_IDS.find((id) => !slotOccupied(id)) ?? null;
  }

  function allSlotsOccupied() {
    return SAVE_SLOT_IDS.every((id) => slotOccupied(id));
  }

  function listSlots() {
    return slots.value;
  }

  function refreshActiveMeta() {
    const snapshot = readSlotSnapshot(activeSlot.value);
    lastSavedAt.value = snapshot?.savedAt ?? null;
  }

  refreshActiveMeta();

  function writeSlot(slotId, snapshot) {
    const id = normalizeSlotId(slotId);
    if (!id) throw new Error("Invalid save slot");
    writeJson(slotStorageKey(id), snapshot);
    bump();
  }

  function save(ctx, slotId = activeSlot.value) {
    const id = normalizeSlotId(slotId) ?? activeSlot.value;
    try {
      const snapshot = captureSnapshot(ctx);
      writeSlot(id, snapshot);
      setActiveSlot(id);
      lastSavedAt.value = snapshot.savedAt;
      loadError.value = null;
      // Best-effort: write engine checkpoint into host state and re-save
      if (ctx?.gameState) {
        void persistHydroEngineCheckpoint(ctx.gameState)
          .then(() => {
            const withEngine = captureSnapshot(ctx);
            writeSlot(id, withEngine);
            if (activeSlot.value === id) {
              lastSavedAt.value = withEngine.savedAt;
            }
            ctx.onSaveComplete?.();
          })
          .catch(() => {
            /* keep host-only save */
            ctx.onSaveComplete?.();
          });
      } else {
        ctx?.onSaveComplete?.();
      }
      return true;
    } catch (err) {
      loadError.value = err?.message ?? "Save failed";
      return false;
    }
  }

  function load(ctx, slotId = activeSlot.value) {
    const id = normalizeSlotId(slotId) ?? activeSlot.value;
    try {
      const snapshot = readSlotSnapshot(id);
      if (!snapshot) {
        loadError.value = `Game ${id} has no save`;
        return false;
      }
      disposeOpsSession();
      resetOpsSessionState();
      const ok = applySnapshot(snapshot, ctx);
      if (ok) {
        setActiveSlot(id);
        lastSavedAt.value = snapshot.savedAt ?? null;
        loadError.value = null;
        if (ctx?.gameState) {
          void refreshEngineFromHost(ctx.gameState, {
            durationSecs: ctx.gameState.facilities?.hydro?.online ? 25 : 1,
          }).catch(() => {
            /* console open will retry */
          });
        }
      } else {
        loadError.value = `Could not restore Game ${id}`;
      }
      return ok;
    } catch (err) {
      loadError.value = err?.message ?? "Load failed";
      return false;
    }
  }

  /**
   * Clear a slot. Does not change other slots.
   * If the cleared slot is active, lastSavedAt is cleared for the session.
   */
  function clearSave(slotId = activeSlot.value) {
    const id = normalizeSlotId(slotId) ?? activeSlot.value;
    try {
      localStorage.removeItem(slotStorageKey(id));
      if (activeSlot.value === id) {
        lastSavedAt.value = null;
      }
      loadError.value = null;
      bump();
    } catch {
      /* ignore */
    }
  }

  return {
    activeSlot,
    lastSavedAt,
    loadError,
    slots,
    hasSave,
    hasAnySave,
    firstOpenSlot,
    allSlotsOccupied,
    listSlots,
    setActiveSlot,
    save,
    load,
    clearSave,
  };
}
