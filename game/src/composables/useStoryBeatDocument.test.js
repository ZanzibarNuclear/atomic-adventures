import { describe, expect, it, vi } from "vitest";
import { useStoryBeatDocument } from "./useStoryBeatDocument.js";
import { storyApi } from "../lib/storyApi.js";

vi.mock("../lib/storyApi.js", () => ({
  storyApi: vi.fn(),
}));

function createDocument() {
  return useStoryBeatDocument({
    areaId: "part-i",
    getCurrentLocation: () => ({ mode: "outdoors", location: "gate-woods" }),
    getSelectedLocationKey: () => "outdoors:gate-woods",
    getBeatsForLocation: () => [],
    createEmptyBeat: () => ({}),
    suggestedId: () => "new-beat",
  });
}

describe("useStoryBeatDocument", () => {
  it("keeps a loaded beat with choice effects clean and selectable", async () => {
    storyApi.mockResolvedValueOnce({
      beat: {
        id: "gate-woods-untangle",
        version: 1,
        once: true,
        heading: "There is a Way",
        text: "Vines hold the gate shut.",
        modes: ["story"],
        trigger: { place: "outdoors", hex: "gate-woods" },
        match: {},
        time: { days: [] },
        conditions: {},
        choices: [{
          id: "untangle-vines",
          order: 0,
          text: "Untangle the vine from the gate",
          timeMinutes: 0,
          activity: "light",
          set_flags: ["story.gate.untangled"],
          effects: [],
          grantMilestones: [],
        }],
      },
    });
    const document = createDocument();

    await document.loadBeat("gate-woods-untangle");

    expect(document.selectedBeatId.value).toBe("gate-woods-untangle");
    expect(document.draft.value.id).toBe("gate-woods-untangle");
    expect(document.dirty.value).toBe(false);
  });
});
