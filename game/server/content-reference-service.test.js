import { describe, expect, it, vi } from "vitest";
import {
  collectWorldHexReferences,
  ContentReferenceService,
} from "./content-reference-service.js";

describe("ContentReferenceService", () => {
  it("collects authored world references to a hex", () => {
    const world = {
      start: "origin",
      journey: ["origin", "north"],
      routes: [{ points: [{ hex: "origin" }] }],
      features: [
        {
          hex: "origin",
          at: { hex: "origin" },
          points: [{ hex: "north" }, { hex: "origin" }],
        },
      ],
    };

    expect(collectWorldHexReferences(world, "origin")).toEqual([
      { kind: "world", path: "start" },
      { kind: "world", path: "journey.0" },
      { kind: "world", path: "routes.0.points.0.hex" },
      { kind: "world", path: "features.0.hex" },
      { kind: "world", path: "features.0.at.hex" },
      { kind: "world", path: "features.0.points.1.hex" },
    ]);
  });

  it("combines world and story references for hex rename previews", () => {
    const storyRepository = {
      findHexReferences: vi.fn(() => [{ kind: "story", path: "trigger.hex" }]),
    };
    const service = new ContentReferenceService({ storyRepository });

    const preview = service.previewHexRename({ start: "origin" }, "origin", "camp");

    expect(preview.references).toEqual([
      { kind: "world", path: "start" },
      { kind: "story", path: "trigger.hex" },
    ]);
  });
});
