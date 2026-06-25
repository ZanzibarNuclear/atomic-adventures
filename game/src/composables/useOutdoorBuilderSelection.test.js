import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { useOutdoorBuilderSelection } from "./useOutdoorBuilderSelection.js";

vi.mock("../lib/storyApi.js", () => ({
  storyApi: vi.fn(async () => ({ references: [] })),
}));

function makeOutdoor() {
  return useOutdoorWorld({
    orientation: "pointy",
    size: 44,
    start: "camp",
    journey: ["camp"],
    hexes: [
      {
        id: "camp",
        q: 0,
        r: 0,
        terrain: "forest",
        label: "Camp",
        landmark: { label: "Radio mast", icon: "R" },
        stands: [{ id: "gate", label: "Gate", at: { dx: 0.1, dy: 0 } }],
      },
      { id: "ridge", q: 1, r: 0, terrain: "rock" },
    ],
    routes: [
      {
        id: "camp-road",
        kind: "path",
        points: [{ hex: "camp", dx: 0, dy: 0 }, { hex: "ridge", dx: 0, dy: 0 }],
      },
    ],
    features: [
      {
        id: "camp-gate",
        kind: "gate",
        hex: "camp",
        at: { hex: "camp", dx: 0, dy: 0 },
        boothAt: { hex: "camp", dx: 0.2, dy: 0 },
      },
      {
        id: "fence",
        kind: "fence",
        points: [{ hex: "camp", dx: -0.2, dy: 0 }, { hex: "ridge", dx: 0, dy: 0 }],
      },
    ],
  });
}

function makeSelection(overrides = {}) {
  const outdoor = overrides.outdoor ?? makeOutdoor();
  const draftMeta = ref({ start: "camp", journey: ["camp", "ridge"] });
  const status = ref("");
  const selection = useOutdoorBuilderSelection({
    outdoor,
    passageKinds: new Set(["gate", "hole", "bridge", "ford", "stair"]),
    draftMeta,
    renames: ref([]),
    currentWorld: computed(() => ({
      ...draftMeta.value,
      hexes: outdoor.editableHexes,
      routes: outdoor.editableRoutes,
      features: outdoor.editableFeatures,
    })),
    status,
    selectedKey: ref(""),
    selectedHandleId: ref(null),
    tool: ref("select"),
    search: ref(""),
    landmarkDraft: ref(null),
    landmarkEditDraft: ref(null),
    standDraft: ref(null),
    standEditDraft: ref(null),
    ...overrides,
  });
  return { outdoor, draftMeta, status, selection };
}

describe("useOutdoorBuilderSelection", () => {
  it("selects nested outdoor objects and filters object-browser groups", () => {
    const search = ref("gate");
    const { selection } = makeSelection({ search });

    expect(selection.filteredGroups.value.find((group) => group.type === "stand").items)
      .toEqual([
        expect.objectContaining({ id: "camp:gate", label: "Gate" }),
      ]);

    selection.select("stand", "camp:gate");

    expect(selection.selectedType.value).toBe("stand");
    expect(selection.selected.value.id).toBe("camp");
    expect(selection.standEditDirty.value).toBe(false);
  });

  it("adds world objects around the current placement selection", () => {
    const { outdoor, selection } = makeSelection();

    selection.select("hex", "camp");
    selection.addRoute();
    selection.addBarrier();
    selection.addPassage();

    expect(outdoor.editableRoutes.at(-1)).toMatchObject({
      id: "new-route",
      kind: "path",
      points: [{ hex: "camp", dx: -0.25, dy: 0 }, { hex: "camp", dx: 0.25, dy: 0 }],
    });
    expect(outdoor.editableFeatures.find((feature) => feature.id === "new-barrier")).toMatchObject({
      kind: "fence",
    });
    expect(outdoor.editableFeatures.find((feature) => feature.id === "camp-gate-2")).toMatchObject({
      kind: "gate",
      hex: "camp",
      at: { hex: "camp", dx: 0, dy: 0 },
    });
  });

  it("renames hexes and cascades local outdoor references", async () => {
    vi.stubGlobal("window", {
      prompt: vi.fn(() => "base-camp"),
      confirm: vi.fn(() => true),
    });
    const renames = ref([]);
    const { outdoor, draftMeta, status, selection } = makeSelection({ renames });

    selection.select("hex", "camp");
    await selection.renameSelected();

    expect(outdoor.editableHexes[0].id).toBe("base-camp");
    expect(draftMeta.value.start).toBe("base-camp");
    expect(draftMeta.value.journey).toEqual(["base-camp", "ridge"]);
    expect(outdoor.editableRoutes[0].points[0].hex).toBe("base-camp");
    expect(outdoor.editableFeatures[0].hex).toBe("base-camp");
    expect(outdoor.editableFeatures[0].at.hex).toBe("base-camp");
    expect(outdoor.editableFeatures[0].boothAt.hex).toBe("base-camp");
    expect(outdoor.editableFeatures[1].points[0].hex).toBe("base-camp");
    expect(renames.value).toEqual([{ kind: "hex", from: "camp", to: "base-camp" }]);
    expect(status.value).toBe("");

    vi.unstubAllGlobals();
  });
});
