import { describe, expect, it } from "vitest";
import { useGameView } from "./useGameView.js";

describe("useGameView", () => {
  it("switches views without carrying view payload into the map", () => {
    const gameView = useGameView();

    expect(gameView.isMapView.value).toBe(true);
    expect(gameView.openView("closeup", { fixture: "ebuggy" })).toBe(true);
    expect(gameView.activeView.value).toEqual({
      kind: "closeup",
      payload: { fixture: "ebuggy" },
      blocking: false,
    });

    expect(gameView.returnToMap()).toBe(true);
    expect(gameView.activeView.value).toEqual({
      kind: "map",
      payload: null,
      blocking: false,
    });
  });

  it("opens focused stage views with payloads", () => {
    const gameView = useGameView();

    expect(gameView.openInventory({ kind: "inventory" })).toBe(true);
    expect(gameView.activeView.value).toEqual({
      kind: "inventory",
      payload: { kind: "inventory" },
      blocking: false,
    });

    expect(gameView.openCharacterStats({ kind: "character-stats", focus: "health" })).toBe(true);
    expect(gameView.activeView.value.payload).toEqual({
      kind: "character-stats",
      focus: "health",
    });
  });


  it("keeps a blocking view open unless the caller explicitly forces exit", () => {
    const gameView = useGameView();

    gameView.openView("simulation", { id: "hydro-startup" }, { blocking: true });
    expect(gameView.openCharacter()).toBe(false);
    expect(gameView.returnToMap()).toBe(false);
    expect(gameView.activeView.value.kind).toBe("simulation");

    expect(gameView.returnToMap({ force: true })).toBe(true);
    expect(gameView.isMapView.value).toBe(true);
  });

  it("rejects unregistered view kinds", () => {
    const gameView = useGameView();
    expect(() => gameView.openView("mystery")).toThrow('Unknown game view "mystery".');
  });
});
