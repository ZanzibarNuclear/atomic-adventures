import { describe, expect, it } from "vitest";
import { evaluateRequirements, normalizeRequirements } from "./requirements.js";

const character = {
  holdings: { items: { key: { quantity: 1 }, ration: { quantity: 2 } } },
  stats: { health: 80 },
  knowledge: { hydro: {} },
  skills: { operator: { rank: 2, evidence: { days: 5 } } },
  quests: { restore: { status: "active" } },
  documents: { manual: {} },
};

describe("character requirements", () => {
  it("normalizes legacy flags and item arrays", () => {
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
});
