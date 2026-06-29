import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import {
  advanceGameTime,
  createGameClock,
  formatGameClock,
  formatGameDate,
  formatGameTimestamp,
} from "./gameTime.js";

function state() {
  return {
    flags: new Set(),
    clock: createGameClock(),
    character: createCharacterState({
      items: [],
      stats: [
        {
          id: "health", label: "Health", type: "meter", default: 100, min: 0, max: 100,
        },
        {
          id: "hunger", label: "Hunger", type: "meter", default: 35, min: 0, max: 100,
          drift: { perGameHour: { resting: 1.5, light: 3, moderate: 5, strenuous: 8 } },
          thresholds: [{
            at: 40,
            effectsPerGameHour: [{ op: "stat.add", id: "health", value: -2 }],
          }],
        },
      ],
      knowledge: [], skills: [], quests: [], documents: [],
    }),
  };
}

describe("authored game time", () => {
  it("advances the clock and applies activity-specific drift", () => {
    const gameState = state();
    expect(advanceGameTime(gameState, 60, "moderate").ok).toBe(true);
    expect(gameState.character.stats.hunger).toBeCloseTo(40);
    expect(gameState.clock).toMatchObject({ elapsedMinutes: 60, minuteOfDay: 780, day: 1 });
    expect(formatGameClock(gameState.clock)).toBe("Day 1 · 1:00 PM");
    expect(formatGameDate(gameState.clock)).toBe("Tuesday, July 2, 2126");
    expect(formatGameTimestamp(gameState.clock)).toBe("Tuesday, July 2, 2126 · 1:00 PM");
  });

  it("projects story days onto the future calendar", () => {
    expect(formatGameTimestamp(createGameClock())).toBe("Tuesday, July 2, 2126 · 12:00 PM");
    expect(formatGameDate(createGameClock({ day: 2 }))).toBe("Wednesday, July 3, 2126");
  });

  it("produces the same result for equivalent large and small advances", () => {
    const large = state();
    const small = state();
    advanceGameTime(large, 180, "strenuous");
    for (let index = 0; index < 180; index += 1) {
      advanceGameTime(small, 1, "strenuous");
    }
    expect(large.character.stats.hunger).toBeCloseTo(small.character.stats.hunger);
    expect(large.character.stats.health).toBeCloseTo(small.character.stats.health);
    expect(large.clock).toEqual(small.clock);
  });

  it("rejects wall-clock-like or unknown activity input without mutation", () => {
    const gameState = state();
    const before = structuredClone(gameState.clock);
    expect(advanceGameTime(gameState, 60, "sleeping").ok).toBe(false);
    expect(gameState.clock).toEqual(before);
  });
});
