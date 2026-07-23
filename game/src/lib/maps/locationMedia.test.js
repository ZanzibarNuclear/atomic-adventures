import { describe, expect, it } from "vitest";
import {
  evaluateViewWhen,
  normalizeViewWhen,
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
      state: { stand: { x: 0, y: 0 }, passageStates: { "compound-gate": true } },
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

  it("filters indoor room images by effective room lights (power + switch)", () => {
    const room = {
      id: "conference",
      views: [
        {
          id: "dark",
          kind: "image",
          src: "views/conference-room-lights-out.jpg",
          when: { roomLights: "off" },
        },
        {
          id: "lit",
          kind: "image",
          src: "views/conference-room-lights-on.jpg",
          when: { roomLights: "on" },
        },
      ],
    };
    const indoor = {
      indoor: {
        currentRoom: "conference",
        currentStand: null,
        facility: { hydroOnline: true, lightSwitches: {} },
      },
      facility: { hydroOnline: true, lightSwitches: {} },
      flags: new Set(["hub.hydro_online"]),
      building: { roomById: { conference: room } },
    };

    // Power on, switch open → dark
    expect(resolveIndoorLocationMedia(indoor).views.map((view) => view.id)).toEqual(["dark"]);

    indoor.facility.lightSwitches = { conference: true };
    indoor.indoor.facility.lightSwitches = { conference: true };
    expect(resolveIndoorLocationMedia(indoor).views.map((view) => view.id)).toEqual(["lit"]);

    indoor.facility.hydroOnline = false;
    indoor.indoor.facility.hydroOnline = false;
    indoor.flags = new Set();
    expect(resolveIndoorLocationMedia(indoor).views.map((view) => view.id)).toEqual(["dark"]);
  });

  it("normalizes legacy passage when and facility online aliases", () => {
    expect(normalizeViewWhen({ passage: "compound-gate", open: false })).toEqual({
      passage: "compound-gate",
      open: false,
    });
    expect(normalizeViewWhen({ facility: { "hydro.online": true }, all: ["a"] })).toEqual({
      all: ["a"],
      stationPower: "online",
    });
    expect(evaluateViewWhen({ stationPower: "offline" }, { stationPowerOnline: false })).toBe(true);
    expect(evaluateViewWhen({ stationPower: "offline" }, { stationPowerOnline: true })).toBe(false);
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
