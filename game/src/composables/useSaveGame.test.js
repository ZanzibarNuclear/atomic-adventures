/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  SAVE_SLOT_IDS,
  migrateLegacySaveIfNeeded,
  useSaveGame,
} from "./useSaveGame.js";

const LEGACY_KEY = "atomic-adventures:save:v1";
const ACTIVE_KEY = "atomic-adventures:save:active-slot";

function slotKey(id) {
  return `atomic-adventures:save:slot:${id}`;
}

beforeEach(() => {
  localStorage.clear();
});

describe("useSaveGame multi-slot", () => {
  it("migrates a legacy single save into slot 1 and removes the old key", () => {
    const legacy = { version: 12, savedAt: "2026-01-01T00:00:00.000Z", outdoor: {} };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));

    expect(migrateLegacySaveIfNeeded()).toBe(true);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(slotKey(1)))).toEqual(legacy);
    expect(localStorage.getItem(ACTIVE_KEY)).toBe("1");
  });

  it("does not overwrite an existing slot 1 when migrating legacy", () => {
    const slot1 = { version: 12, savedAt: "newer" };
    const legacy = { version: 12, savedAt: "older" };
    localStorage.setItem(slotKey(1), JSON.stringify(slot1));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));

    migrateLegacySaveIfNeeded();
    expect(JSON.parse(localStorage.getItem(slotKey(1)))).toEqual(slot1);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("keeps three independent slots; clearing one does not clear others", () => {
    localStorage.setItem(slotKey(1), JSON.stringify({ savedAt: "a" }));
    localStorage.setItem(slotKey(2), JSON.stringify({ savedAt: "b" }));
    localStorage.setItem(slotKey(3), JSON.stringify({ savedAt: "c" }));

    const save = useSaveGame();
    expect(save.hasAnySave()).toBe(true);
    expect(save.listSlots().map((s) => s.occupied)).toEqual([true, true, true]);

    save.clearSave(2);
    expect(save.hasSave(1)).toBe(true);
    expect(save.hasSave(2)).toBe(false);
    expect(save.hasSave(3)).toBe(true);
    expect(localStorage.getItem(slotKey(2))).toBeNull();
    expect(JSON.parse(localStorage.getItem(slotKey(1))).savedAt).toBe("a");
  });

  it("tracks the active slot across setActiveSlot", () => {
    const save = useSaveGame();
    expect(save.activeSlot.value).toBe(1);
    save.setActiveSlot(3);
    expect(save.activeSlot.value).toBe(3);
    expect(localStorage.getItem(ACTIVE_KEY)).toBe("3");

    const again = useSaveGame();
    expect(again.activeSlot.value).toBe(3);
  });

  it("exposes three slot ids", () => {
    expect(SAVE_SLOT_IDS).toEqual([1, 2, 3]);
  });

  it("reports the first open game and when all are occupied", () => {
    const save = useSaveGame();
    expect(save.firstOpenSlot()).toBe(1);
    expect(save.allSlotsOccupied()).toBe(false);

    localStorage.setItem(slotKey(1), JSON.stringify({ savedAt: "a" }));
    localStorage.setItem(slotKey(2), JSON.stringify({ savedAt: "b" }));
    // revision bump via clear/setActive
    save.setActiveSlot(1);
    expect(save.firstOpenSlot()).toBe(3);

    localStorage.setItem(slotKey(3), JSON.stringify({ savedAt: "c" }));
    save.setActiveSlot(2);
    expect(save.firstOpenSlot()).toBe(null);
    expect(save.allSlotsOccupied()).toBe(true);
  });
});
