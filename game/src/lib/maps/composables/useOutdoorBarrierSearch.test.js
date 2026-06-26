import { describe, expect, it } from "vitest";
import { reactive, ref } from "vue";
import { useOutdoorBarrierSearch } from "./useOutdoorBarrierSearch.js";

function createSearch(overrides = {}) {
  const state = reactive({
    currentId: "origin",
    discoveredOpenings: [],
    atBarrier: null,
    lastBlocked: null,
    lastSearch: null,
    ...overrides.state,
  });
  const editableFeatures = ref(overrides.features ?? [
    { id: "hidden-hole", kind: "hole", hex: "origin", visibility: "hidden", at: { x: 0, y: 0 } },
  ]);
  const travelBarrierCtx = ref(overrides.ctx ?? {
    barriers: [{ kind: "fence", a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }],
  });
  const search = useOutdoorBarrierSearch({
    state,
    editableFeatures,
    travelBarrierCtx,
    size: ref(44),
    hexAtPoint: overrides.hexAtPoint ?? (() => "origin"),
  });
  return { state, search };
}

describe("useOutdoorBarrierSearch", () => {
  it("finds hidden openings and records search results", () => {
    const { state, search } = createSearch({ state: { atBarrier: "fence" } });

    expect(search.canSearchHere()).toBe(true);
    expect(search.searchBarrier()).toEqual(["hidden-hole"]);

    expect(state.discoveredOpenings).toEqual(["hidden-hole"]);
    expect(state.lastSearch).toEqual({
      kind: "fence",
      found: ["hidden-hole"],
      foundKinds: ["hole"],
    });
  });

  it("allows searching an undiscovered fence even when no opening is currently known", () => {
    const { search } = createSearch({
      features: [],
      hexAtPoint: (point) => point.x >= -10 && point.x <= 10 ? "origin" : null,
    });

    expect(search.searchableOpenings()).toEqual([]);
    expect(search.canSearchHere()).toBe(true);
    expect(search.barrierCutsCurrentHex("fence")).toBe(true);
  });
});
