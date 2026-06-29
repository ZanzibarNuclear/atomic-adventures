import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStoryBeatDocument } from "./useStoryBeatDocument.js";
import { storyApi } from "../lib/storyApi.js";

vi.mock("../lib/storyApi.js", () => ({
  storyApi: vi.fn(),
}));

const beat = {
  id: "origin",
  version: 1,
  heading: "Origin",
  text: "Story text",
  trigger: { place: "outdoors", hex: "origin" },
  match: { originHex: null, localExit: null, mapTransition: null, transitionDirection: null },
  choices: [],
};

function createDocument(getBeatsForLocation = () => [beat]) {
  let location = { mode: "outdoors", location: "origin" };
  const document = useStoryBeatDocument({
    areaId: "part-i",
    getCurrentLocation: () => location,
    getSelectedLocationKey: () => `${location.mode}:${location.location}`,
    getBeatsForLocation,
    createEmptyBeat: () => ({
      id: "",
      heading: "",
      text: "",
      trigger: { place: "outdoors", hex: location.location },
      match: { originHex: null, localExit: null, mapTransition: null, transitionDirection: null },
      choices: [],
    }),
    suggestedId: () => location.location,
  });
  return { document, setLocation: (next) => { location = next; } };
}

describe("useStoryBeatDocument", () => {
  beforeEach(() => {
    storyApi.mockReset();
  });

  it("loads the beat list and opens the first beat for the current location", async () => {
    storyApi.mockImplementation(async (url) => {
      if (url === "/api/story/areas/part-i/beats") return [beat];
      if (url === "/api/story/areas/part-i/beats/origin") return { beat };
      throw new Error(`Unexpected URL ${url}`);
    });
    const { document } = createDocument();

    await document.loadBeats();

    expect(document.beats.value).toEqual([beat]);
    expect(document.selectedBeatId.value).toBe("origin");
    expect(document.draft.value.heading).toBe("Origin");
    expect(document.dirty.value).toBe(false);
  });

  it("creates a new draft and saves it through the story API", async () => {
    storyApi.mockImplementation(async (url, options = {}) => {
      if (url === "/api/story/areas/part-i/beats") {
        if (options.method === "POST") {
          const submitted = JSON.parse(options.body);
          return { beat: { ...submitted, version: 1 } };
        }
        return [];
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const { document } = createDocument();

    document.beginNewBeat();
    expect(document.dirty.value).toBe(true);
    document.draft.value.heading = "New heading";
    const saved = await document.saveBeat();

    expect(saved).toBe(true);
    expect(storyApi).toHaveBeenCalledWith("/api/story/areas/part-i/beats", expect.objectContaining({
      method: "POST",
    }));
    expect(document.selectedBeatId.value).toBe("origin");
    expect(document.status.value).toBe("Saved revision 1.");
    expect(document.dirty.value).toBe(false);
  });

  it("tracks nested field edits after a clean beat loads", async () => {
    storyApi.mockImplementation(async (url) => {
      if (url === "/api/story/areas/part-i/beats/origin") return { beat };
      throw new Error(`Unexpected URL ${url}`);
    });
    const { document } = createDocument();

    await document.openFirstBeatForSelectedLocation();
    expect(document.dirty.value).toBe(false);

    document.draft.value.text = "Updated story text";

    expect(document.dirty.value).toBe(true);
  });

  it("clears the selected draft when the current location has no beats", async () => {
    storyApi.mockImplementation(async (url) => {
      if (url === "/api/story/areas/part-i/beats/origin") return { beat };
      throw new Error(`Unexpected URL ${url}`);
    });
    const { document, setLocation } = createDocument((mode, location) =>
      location === "origin" ? [beat] : [],
    );

    await document.openFirstBeatForSelectedLocation();
    setLocation({ mode: "exterior", location: "north-east-corner" });
    await document.openFirstBeatForSelectedLocation();

    expect(document.draft.value).toBe(null);
    expect(document.selectedBeatId.value).toBe("");
    expect(document.dirty.value).toBe(false);
  });

  it("does not mark equivalent empty editable defaults as dirty", async () => {
    storyApi.mockImplementation(async (url) => {
      if (url === "/api/story/areas/part-i/beats/origin") {
        return {
          beat: {
            id: "origin",
            version: 1,
            heading: null,
            text: "Story text",
            trigger: { place: "outdoors", hex: "origin" },
            choices: [],
          },
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const { document } = createDocument();

    await document.openFirstBeatForSelectedLocation();
    document.draft.value.heading = "";
    document.draft.value.revisit = "";

    expect(document.dirty.value).toBe(false);
  });
});
