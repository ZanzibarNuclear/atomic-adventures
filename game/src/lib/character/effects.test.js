import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { applyEffectsAtomically } from "./effects.js";
import { itemQuantity } from "./holdings.js";

const definitions = {
  items: [
    { id: "key", carrying: "unique", maxQuantity: 1 },
    { id: "ration", carrying: "stack", maxQuantity: 5 },
  ],
  stats: [{ id: "health", default: 100, min: 0, max: 100 }],
  knowledge: [{ id: "hydro" }],
  skills: [{
    id: "operator",
    maxRank: 3,
    order: 10,
    practice: {
      evidence: [
        { id: "days", label: "Operating days", target: 2 },
        { id: "repairs", label: "Repairs", target: 1 },
      ],
      awards: [
        { rank: 1, earnedText: "Introduced", require: { knowledge: { all: ["hydro"] } } },
        { rank: 2, earnedText: "Practiced", require: { evidence: [{ id: "days", op: "gte", value: 2 }] } },
        {
          rank: 3,
          earnedText: "Qualified",
          require: {
            evidence: [
              { id: "days", op: "gte", value: 2 },
              { id: "repairs", op: "gte", value: 1 },
            ],
          },
        },
      ],
    },
  }],
  quests: [{
    id: "restore",
    autoComplete: true,
    objectives: [
      { id: "intake", label: "Clear intake" },
      { id: "days", label: "Operate", target: 2 },
    ],
  }],
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
    expect(itemQuantity(character.holdings, "ration")).toBe(2);
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
    expect(itemQuantity(character.holdings, "key")).toBe(0);
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

  it("awards skill ranks deterministically after knowledge and evidence commit", () => {
    const character = createCharacterState(definitions);
    const result = applyEffectsAtomically([
      { op: "knowledge.acquire", id: "hydro" },
      { op: "skill.add-evidence", id: "operator", evidence: "days", value: 2 },
      { op: "skill.add-evidence", id: "operator", evidence: "repairs", value: 1 },
    ], { character, now: () => "earned-now" });

    expect(result.ok).toBe(true);
    expect(character.skills.operator.rank).toBe(3);
    expect(character.skills.operator.awards).toEqual({
      1: { earnedAt: "earned-now", badge: null, earnedText: "Introduced" },
      2: { earnedAt: "earned-now", badge: null, earnedText: "Practiced" },
      3: { earnedAt: "earned-now", badge: null, earnedText: "Qualified" },
    });
  });

  it("stamps an acquire award badge and does not grant empty-require awards early", () => {
    const character = createCharacterState({
      ...definitions,
      skills: [{
        id: "purify",
        maxRank: 1,
        practice: {
          awards: [{
            rank: 1,
            earnedText: "Learned to purify tap water",
            badge: "badges/water-purification.webp",
            require: {},
          }],
        },
      }],
    });

    expect(applyEffectsAtomically([
      { op: "knowledge.acquire", id: "hydro" },
    ], { character, now: () => "too-soon" }).ok).toBe(true);
    expect(character.skills.purify).toBeUndefined();

    expect(applyEffectsAtomically([
      { op: "skill.acquire", id: "purify" },
    ], { character, now: () => "earned-now" }).ok).toBe(true);
    expect(character.skills.purify.rank).toBe(1);
    expect(character.skills.purify.awards).toEqual({
      1: {
        earnedAt: "earned-now",
        badge: "badges/water-purification.webp",
        earnedText: "Learned to purify tap water",
      },
    });
  });

  it("does not count a one-time evidence event twice", () => {
    const character = createCharacterState(definitions);
    const effect = {
      op: "skill.add-evidence",
      id: "operator",
      evidence: "repairs",
      value: 1,
      once: true,
      event: "penstock-leak-a",
    };

    expect(applyEffectsAtomically([effect], { character }).ok).toBe(true);
    expect(applyEffectsAtomically([effect], { character }).ok).toBe(true);
    expect(character.skills.operator.evidence.repairs).toBe(1);
  });

  it("validates quest transitions and auto-completes finished objectives", () => {
    const character = createCharacterState(definitions);
    expect(applyEffectsAtomically([
      { op: "quest.complete-objective", id: "restore", objective: "intake" },
    ], { character }).ok).toBe(false);

    expect(applyEffectsAtomically([
      { op: "quest.start", id: "restore" },
      { op: "quest.complete-objective", id: "restore", objective: "intake" },
      { op: "quest.advance-objective", id: "restore", objective: "days", value: 1 },
      { op: "quest.advance-objective", id: "restore", objective: "days", value: 1 },
    ], { character, now: () => "quest-now" }).ok).toBe(true);

    expect(character.quests.restore.status).toBe("completed");
    expect(character.quests.restore.objectives.days).toEqual({
      status: "completed",
      count: 2,
    });
    expect(character.quests.restore.completedAt).toBe("quest-now");
    expect(applyEffectsAtomically([
      { op: "quest.start", id: "restore" },
    ], { character }).ok).toBe(false);
  });
});
