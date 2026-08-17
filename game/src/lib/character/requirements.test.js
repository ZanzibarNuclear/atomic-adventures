import { describe, expect, it } from "vitest";
import { characterHasSkill, evaluateRequirements, normalizeRequirements } from "./requirements.js";

const character = {
  holdings: { items: { key: { quantity: 1 }, ration: { quantity: 2 } } },
  stats: { health: 80 },
  knowledge: { hydro: {} },
  skills: { operator: { rank: 2, evidence: { days: 5 } } },
  quests: { restore: { status: "active" } },
  documents: { manual: {} },
};

describe("character requirements", () => {
  it("normalizes flag and item shorthand", () => {
    expect(normalizeRequirements({ all: ["ready"], items: ["key"] })).toMatchObject({
      flags: { all: ["ready"], any: [], not: [] },
      items: { all: [{ id: "key", quantity: 1, access: "carried" }] },
    });
  });

  it("evaluates mixed character domains", () => {
    const result = evaluateRequirements({
      flags: { all: ["ready"], not: ["blocked"] },
      items: { all: [{ id: "ration", quantity: 2 }] },
      stats: [{ id: "health", op: "gte", value: 50 }],
      knowledge: { all: ["hydro"] },
      skills: [{ id: "operator", op: "gte", rank: 2 }],
      evidence: [{ skill: "operator", id: "days", op: "gte", value: 5 }],
      quests: [{ id: "restore", status: "active" }],
      documents: { all: ["manual"] },
    }, { character, flags: new Set(["ready"]) });
    expect(result).toMatchObject({ ok: true, reasons: [] });
  });

  it("distinguishes carried and nearby physical item access", () => {
    const state = {
      ...character,
      holdings: {
        holders: {
          "character:zanzibar": { id: "character:zanzibar", kind: "character" },
          "vehicle:ebuggy": { id: "vehicle:ebuggy", kind: "vehicle" },
        },
        stacks: {},
        instances: {
          "cutter-1": { item: "cutter", holder: "vehicle:ebuggy" },
        },
      },
    };

    expect(evaluateRequirements({
      items: { all: [{ id: "cutter", access: "carried" }] },
    }, { character: state }).ok).toBe(false);
    expect(evaluateRequirements({
      items: { all: [{ id: "cutter", access: "nearby" }] },
    }, { character: state, nearbyHolderIds: ["vehicle:ebuggy"] }).ok).toBe(true);
  });

  it("returns structured reasons without mutating state", () => {
    const before = structuredClone(character);
    const result = evaluateRequirements({
      items: { all: [{ id: "key", quantity: 2 }] },
      stats: [{ id: "health", op: "gt", value: 90 }],
      knowledge: { all: ["solar"] },
    }, { character, flags: new Set() });
    expect(result.ok).toBe(false);
    expect(result.reasons.map((reason) => reason.domain)).toEqual(["items", "stats", "knowledge"]);
    expect(character).toEqual(before);
  });

  it("treats acquired skills as rank gates", () => {
    expect(characterHasSkill(character, "operator", 2)).toBe(true);
    expect(characterHasSkill(character, "operator", 3)).toBe(false);
    expect(characterHasSkill(character, "missing")).toBe(false);
  });
});
