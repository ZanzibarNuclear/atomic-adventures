import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createGameClock } from "./gameTime.js";
import { commitGameActivity } from "./gameActivity.js";

describe("timed story/world/simulation outcomes", () => {
  it("commits registered effects before advancing game time", () => {
    const gameState = {
      flags: new Set(),
      clock: createGameClock(),
      character: createCharacterState({
        items: [],
        stats: [{ id: "score", label: "Score", type: "integer", default: 0 }],
        knowledge: [], skills: [], quests: [], documents: [],
      }),
    };
    const result = commitGameActivity(gameState, {
      effects: [{ op: "stat.add", id: "score", value: 2 }],
      timeMinutes: 30,
      activity: "moderate",
    });
    expect(result.ok).toBe(true);
    expect(gameState.character.stats.score).toBe(2);
    expect(gameState.clock.elapsedMinutes).toBe(30);
  });
});
