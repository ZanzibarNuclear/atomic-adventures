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
  const hexById = ref(overrides.hexById ?? {
    origin: { id: "origin" },
  });
  const search = useOutdoorBarrierSearch({
    state,
    editableFeatures,
    travelBarrierCtx,
    size: ref(44),
    hexAtPoint: overrides.hexAtPoint ?? (() => "origin"),
    hexById,
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

  it("allows searching a stream that cuts the hex even when not standing at it", () => {
    const { search, state } = createSearch({
      features: [],
      ctx: {
        barriers: [{ kind: "stream", a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }],
      },
      hexAtPoint: (point) => point.x >= -10 && point.x <= 10 ? "origin" : null,
    });

    expect(search.barrierCutsCurrentHex("stream")).toBe(true);
    expect(search.availableSearchKinds()).toEqual(["stream"]);
    expect(search.canSearchHere()).toBe(true);

    search.searchBarrier("stream");
    expect(state.lastSearch).toEqual({
      kind: "stream",
      found: [],
      foundKinds: [],
    });
  });

  it("offers fence and stream searches independently when both cut the hex", () => {
    const { search } = createSearch({
      features: [
        { id: "hidden-ford", kind: "ford", hex: "origin", visibility: "hidden", at: { x: 0, y: 0 } },
      ],
      ctx: {
        barriers: [
          { kind: "fence", a: { x: -10, y: -5 }, b: { x: 10, y: -5 } },
          { kind: "stream", a: { x: -10, y: 5 }, b: { x: 10, y: 5 } },
        ],
      },
      hexAtPoint: () => "origin",
    });

    expect(search.availableSearchKinds()).toEqual(["fence", "stream"]);
    expect(search.searchBarrier("stream")).toEqual(["hidden-ford"]);
  });

  it("suppresses automated barrier search when the hex opts out", () => {
    const { search } = createSearch({
      features: [
        { id: "hidden-ford", kind: "ford", hex: "origin", visibility: "hidden", at: { x: 0, y: 0 } },
      ],
      state: { atBarrier: "stream" },
      ctx: {
        barriers: [{ kind: "stream", a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }],
      },
      hexById: {
        origin: { id: "origin", suppressBarrierSearch: true },
      },
      hexAtPoint: () => "origin",
    });

    expect(search.canSearchHere()).toBe(false);
    expect(search.availableSearchKinds()).toEqual([]);
  });
});