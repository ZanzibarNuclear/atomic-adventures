import { describe, expect, it } from "vitest";
import {
  activeQuestSummaries,
  characterWellbeingOverview,
  characterTabs,
  formatStatValue,
  formatVitalValue,
  questSections,
  visibleCharacterStats,
  visibleInventoryGroups,
} from "./panel.js";

function character() {
  return {
    definitions: {
      panel: {
        tabs: ["overview", "inventory", "quests"],
        inventoryGroups: [
          { id: "tools", label: "Tools", order: 20 },
          { id: "keys", label: "Keys", order: 10 },
        ],
      },
      items: [
        { id: "key", label: "Key", group: "keys", visible: "when-acquired" },
        { id: "tool", label: "Tool", group: "tools", visible: "always" },
      ],
      stats: [
        { id: "health", label: "Health", order: 10, visible: "always", default: 100 },
        { id: "hidden", label: "Hidden", order: 20, visible: "hidden" },
      ],
      quests: [{ id: "restore", label: "Restore power", order: 10 }],
    },
    holdings: { items: { key: { quantity: 1 } } },
    stats: { health: 85 },
    quests: { restore: { status: "active" } },
  };
}

describe("character panel presentation", () => {
  it("uses authored tab order and filters visible stats", () => {
    const state = character();
    expect(characterTabs(state.definitions).map((tab) => tab.id)).toEqual([
      "overview",
      "inventory",
      "quests",
    ]);
    expect(visibleCharacterStats(state)).toEqual([
      expect.objectContaining({ id: "health", value: 85 }),
    ]);
  });

  it("groups acquired and always-visible inventory in authored order", () => {
    expect(visibleInventoryGroups(character())).toEqual([
      expect.objectContaining({
        id: "keys",
        items: [expect.objectContaining({ id: "key", quantity: 1 })],
      }),
      expect.objectContaining({
        id: "tools",
        items: [expect.objectContaining({ id: "tool", quantity: 0 })],
      }),
    ]);
  });

  it("summarizes only active or available quests", () => {
    expect(activeQuestSummaries(character()).map((quest) => quest.id)).toEqual(["restore"]);
  });

  it("groups quests by player-facing status with objective state", () => {
    const state = character();
    state.definitions.quests[0].objectives = [
      { id: "intake", label: "Clear intake", order: 10 },
    ];
    state.quests.restore.objectives = {
      intake: { status: "completed", count: 1 },
    };
    const sections = questSections(state);
    expect(sections.active[0]).toEqual(expect.objectContaining({
      id: "restore",
      objectives: [
        expect.objectContaining({
          id: "intake",
          state: { status: "completed", count: 1 },
        }),
      ],
    }));
  });

  it("formats floating point stat drift without noisy precision", () => {
    expect(formatStatValue({
      type: "meter",
      value: 40.300000000000125,
      max: 100,
    })).toBe("40.3 / 100");
    expect(formatStatValue({
      type: "meter",
      value: 55.599999999999866,
      max: 100,
    })).toBe("55.6 / 100");
    expect(formatStatValue({
      type: "meter",
      value: 100,
      max: 100,
    })).toBe("100 / 100");
  });

  it("presents wellbeing meters with higher values as better condition", () => {
    const state = character();
    state.definitions.stats.push(
      { id: "satiety", label: "Satiety", type: "meter", min: 0, max: 100, visible: "always" },
      { id: "hydration", label: "Hydration", type: "meter", min: 0, max: 100, visible: "always" },
    );
    state.stats.satiety = 65;
    state.stats.hydration = 30;

    const overview = characterWellbeingOverview(state);

    expect(overview.vitals).toEqual([
      expect.objectContaining({ id: "health", value: 85, state: "Healthy" }),
      expect.objectContaining({ id: "satiety", value: 65, state: "Fed" }),
      expect.objectContaining({ id: "hydration", value: 30, state: "Thirsty" }),
      expect.objectContaining({ id: "energy", value: 100, state: "Rested" }),
      expect.objectContaining({ id: "composure", value: 100, state: "Calm" }),
    ]);
    expect(formatVitalValue(overview.vitals[1])).toBe("Fed · 65 / 100");
  });

  it("uses authored display states for wellbeing vitals", () => {
    const state = character();
    state.definitions.stats.push({
      id: "energy",
      label: "Energy",
      type: "meter",
      min: 0,
      max: 100,
      visible: "always",
      displayStates: [
        { at: 90, state: "Charged", tone: "positive" },
        { at: 40, state: "Worn", tone: "warning" },
        { at: 5, state: "On fumes", tone: "error" },
        { at: 0, state: "Spent", tone: "error" },
      ],
    });
    state.stats.energy = 5;

    const overview = characterWellbeingOverview(state);

    expect(overview.vitals).toContainEqual(expect.objectContaining({
      id: "energy",
      value: 5,
      state: "On fumes",
      tone: "error",
    }));
  });

  it("uses words for clear condition states", () => {
    const overview = characterWellbeingOverview(character());

    expect(overview.conditions).toEqual([
      expect.objectContaining({ id: "injured", state: "No injuries", active: false }),
      expect.objectContaining({ id: "poisoned", state: "No poison", active: false }),
      expect.objectContaining({ id: "sick", state: "No sickness", active: false }),
    ]);
  });
});
