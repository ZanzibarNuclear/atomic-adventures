import { describe, expect, it } from "vitest";
import {
  resolveIndoorLocationMedia,
  resolveOutdoorLocationMedia,
} from "./locationMedia.js";

describe("location media resolution", () => {
  it("uses stand images before room images indoors", () => {
    const indoor = {
      indoor: { currentRoom: "conference", currentStand: "table" },
      building: {
        roomById: {
          conference: {
            id: "conference",
            views: [{
              id: "room",
              kind: "image",
              src: "views/conference-room-cool-doorway.png",
            }],
            stands: [{
              id: "table",
              at: { x: 0, y: 0 },
              views: [{
                id: "table",
                kind: "image",
                src: "views/library-square-holoreaders-a.png",
              }],
            }],
          },
        },
      },
    };

    expect(resolveIndoorLocationMedia(indoor)).toMatchObject({
      key: "indoors:conference:stand:table",
      scope: "stand",
      views: [{ id: "table" }],
    });
  });

  it("falls back to room images when the indoor stand has none", () => {
    const indoor = {
      indoor: { currentRoom: "conference", currentStand: "table" },
      building: {
        roomById: {
          conference: {
            id: "conference",
            views: [{
              id: "room",
              kind: "image",
              src: "views/conference-room-cool-doorway.png",
            }],
            stands: [{ id: "table", at: { x: 0, y: 0 } }],
          },
        },
      },
    };

    expect(resolveIndoorLocationMedia(indoor)).toMatchObject({
      key: "indoors:conference",
      scope: "room",
      views: [{ id: "room" }],
    });
  });

  it("uses matched outdoor stand images before hex images", () => {
    const outdoor = {
      size: 44,
      state: { stand: { x: 10, y: 12 } },
      currentHexData: {
        id: "utility-yard",
        q: 0,
        r: 0,
        views: [{
          id: "yard",
          kind: "image",
          src: "views/garage-large-bay.png",
        }],
        stands: [{
          id: "door",
          at: { x: 10, y: 12 },
          views: [{
            id: "door",
            kind: "image",
            src: "views/conference-room-cool-doorway.png",
          }],
        }],
      },
    };

    expect(resolveOutdoorLocationMedia(outdoor)).toMatchObject({
      key: "outdoors:utility-yard:stand:door",
      scope: "stand",
      views: [{ id: "door" }],
    });
  });

  it("selects a location image that matches the gate's open state", () => {
    const outdoor = {
      size: 44,
      state: { stand: { x: 0, y: 0 } },
      passageMarkerStates: { "compound-gate": true },
      currentHexData: {
        id: "gate-woods",
        q: 0,
        r: 0,
        views: [
          { id: "closed", kind: "image", src: "views/closed.png", when: { passage: "compound-gate", open: false } },
          { id: "open", kind: "image", src: "views/open.png", when: { passage: "compound-gate", open: true } },
        ],
      },
    };

    expect(resolveOutdoorLocationMedia(outdoor)).toMatchObject({
      views: [{ id: "open" }],
    });
  });

  it("ignores non-image and source-less views", () => {
    const indoor = {
      indoor: { currentRoom: "library", currentStand: null },
      building: {
        roomById: {
          library: {
            id: "library",
            views: [
              { id: "document", kind: "document", src: "views/library-cool-doorway.png" },
              { id: "missing", kind: "image", src: "" },
            ],
          },
        },
      },
    };

    expect(resolveIndoorLocationMedia(indoor)).toBe(null);
  });
});
