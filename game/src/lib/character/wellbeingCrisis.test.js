import { describe, expect, it } from "vitest";
import { characterWellbeingOverview } from "./panel.js";
import {
  hasRecoveredFromPreEmpty,
  isPreEmptyCrisisVital,
  listPreEmptyCrisisVitals,
  penultimateDisplayState,
  preEmptyCrisisMessage,
} from "./wellbeingCrisis.js";

function overviewWithStats(stats) {
  return characterWellbeingOverview({
    stats,
    definitions: {
      stats: [
        { id: "health", type: "meter", min: 0, max: 100, default: 100 },
        { id: "satiety", type: "meter", min: 0, max: 100, default: 100 },
        { id: "hydration", type: "meter", min: 0, max: 100, default: 100 },
        { id: "energy", type: "meter", min: 0, max: 100, default: 100 },
        { id: "composure", type: "meter", min: 0, max: 100, default: 100 },
      ],
    },
  });
}

describe("pre-empty wellbeing crisis", () => {
  it("identifies the penultimate display band", () => {
    const overview = overviewWithStats({ hydration: 100 });
    const hydration = overview.vitals.find((v) => v.id === "hydration");
    const pre = penultimateDisplayState(hydration);
    expect(pre?.state).toBe("Parched");
    expect(pre?.at).toBe(10);
  });

  it("flags hydration when parched, not when merely thirsty or dehydrated", () => {
    const parched = overviewWithStats({ hydration: 12 });
    const thirsty = overviewWithStats({ hydration: 35 });
    const empty = overviewWithStats({ hydration: 0 });

    const parchedVital = parched.vitals.find((v) => v.id === "hydration");
    const thirstyVital = thirsty.vitals.find((v) => v.id === "hydration");
    const emptyVital = empty.vitals.find((v) => v.id === "hydration");

    expect(parchedVital.state).toBe("Parched");
    expect(isPreEmptyCrisisVital(parchedVital)).toBe(true);
    expect(isPreEmptyCrisisVital(thirstyVital)).toBe(false);
    expect(isPreEmptyCrisisVital(emptyVital)).toBe(false);
  });

  it("flags satiety when hungry, not when starving", () => {
    const hungry = overviewWithStats({ satiety: 15 });
    const starving = overviewWithStats({ satiety: 0 });
    const hungryVital = hungry.vitals.find((v) => v.id === "satiety");
    const starvingVital = starving.vitals.find((v) => v.id === "satiety");

    expect(hungryVital.state).toBe("Hungry");
    expect(isPreEmptyCrisisVital(hungryVital)).toBe(true);
    expect(isPreEmptyCrisisVital(starvingVital)).toBe(false);
  });

  it("does not alert on energy or composure pre-empty bands", () => {
    const low = overviewWithStats({ energy: 5, composure: 3 });
    const energy = low.vitals.find((v) => v.id === "energy");
    const composure = low.vitals.find((v) => v.id === "composure");
    expect(isPreEmptyCrisisVital(energy)).toBe(false);
    expect(isPreEmptyCrisisVital(composure)).toBe(false);
  });

  it("lists crisis vitals and provides actionable messages", () => {
    const overview = overviewWithStats({ hydration: 12, satiety: 15 });
    const list = listPreEmptyCrisisVitals(overview);
    expect(list.map((v) => v.id).sort()).toEqual(["hydration", "satiety"]);
    expect(preEmptyCrisisMessage(list.find((v) => v.id === "hydration"))).toMatch(
      /beverage/i,
    );
    expect(preEmptyCrisisMessage(list.find((v) => v.id === "satiety"))).toMatch(
      /eat/i,
    );
  });

  it("treats recovery above the pre-empty threshold as recovered", () => {
    const parched = overviewWithStats({ hydration: 12 }).vitals.find(
      (v) => v.id === "hydration",
    );
    const hydrated = overviewWithStats({ hydration: 70 }).vitals.find(
      (v) => v.id === "hydration",
    );
    expect(hasRecoveredFromPreEmpty(parched)).toBe(false);
    expect(hasRecoveredFromPreEmpty(hydrated)).toBe(true);
  });
});
