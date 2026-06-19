import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { applyEffectsAtomically } from "./effects.js";

const definitions = {
  items: [
    { id: "key", carrying: "unique", maxQuantity: 1 },
    { id: "ration", carrying: "stack", maxQuantity: 5 },
  ],
  stats: [{ id: "health", default: 100, min: 0, max: 100 }],
  knowledge: [{ id: "hydro" }],
  skills: [{ id: "operator", maxRank: 3 }],
  quests: [{ id: "restore" }],
  documents: [{ id: "manual" }],
};

describe("character effects", () => {
  it("commits mixed effects atomically", () => {
    const character = createCharacterState(definitions);
    const flags = new Set();
    const result = applyEffectsAtomically([
      { op: "item.add", id: "ration", quantity: 2 },
      { op: "stat.add", id: "health", value: -15 },
      { op: "knowledge.acquire", id: "hydro" },
      { op: "skill.add-evidence", id: "operator", evidence: "days", value: 1 },
      { op: "quest.start", id: "restore" },
      { op: "document.mark-read", id: "manual" },
      { op: "flag.set", id: "ready" },
    ], { character, flags, now: () => "2026-06-19T00:00:00.000Z" });

    expect(result.ok).toBe(true);
    expect(character.holdings.items.ration.quantity).toBe(2);
    expect(character.stats.health).toBe(85);
    expect(character.skills.operator.evidence.days).toBe(1);
    expect(character.quests.restore.status).toBe("active");
    expect(character.documents.manual.readAt).toBe("2026-06-19T00:00:00.000Z");
    expect(flags.has("ready")).toBe(true);
  });

  it("rolls back every domain when a later effect fails", () => {
    const character = createCharacterState(definitions);
    const flags = new Set(["existing"]);
    const result = applyEffectsAtomically([
      { op: "item.add", id: "key", quantity: 1 },
      { op: "flag.set", id: "ready" },
      { op: "item.remove", id: "ration", quantity: 1 },
    ], { character, flags });

    expect(result.ok).toBe(false);
    expect(character.inventory.has("key")).toBe(false);
    expect([...flags]).toEqual(["existing"]);
  });

  it("validates references, quantities, ranks, and clamps numeric stats", () => {
    const character = createCharacterState(definitions);
    expect(applyEffectsAtomically([
      { op: "stat.add", id: "health", value: 50 },
    ], { character }).ok).toBe(true);
    expect(character.stats.health).toBe(100);

    expect(applyEffectsAtomically([
      { op: "skill.set-rank", id: "operator", rank: 4 },
    ], { character }).ok).toBe(false);
    expect(applyEffectsAtomically([
      { op: "item.add", id: "missing", quantity: 1 },
    ], { character }).ok).toBe(false);
  });
});
