import { describe, expect, it } from "vitest";
import {
  isRoomLightsOn,
  isRoomLightSwitchClosed,
  lightFixtureForRoom,
  normalizeRoomLighting,
  roomLightAction,
  setRoomLightSwitch,
  toggleRoomLightSwitch,
} from "./roomLights.js";

const building = {
  rooms: [
    {
      id: "conference",
      label: "Conference Room",
      lighting: {
        enabled: true,
        style: "recessed",
        label: "Conference Room lights",
        switchNote: "Wall switch by the kitchen door.",
        nearDoor: "conference-kitchen",
      },
    },
  ],
  roomById: {
    conference: {
      id: "conference",
      label: "Conference Room",
      lighting: {
        enabled: true,
        style: "recessed",
        label: "Conference Room lights",
        switchNote: "Wall switch by the kitchen door.",
        nearDoor: "conference-kitchen",
      },
    },
  },
  poweredObjects: [],
};

describe("room light switches", () => {
  it("reads lighting from the room detail", () => {
    const fixture = lightFixtureForRoom(building, "conference");
    expect(fixture).toMatchObject({
      room: "conference",
      style: "recessed",
      source: "room",
      nearDoor: "conference-kitchen",
    });
    expect(normalizeRoomLighting({ enabled: false })).toBe(null);
  });

  it("defaults to open (off) and only lights when power and switch are closed", () => {
    const facility = { lightSwitches: {} };
    expect(isRoomLightSwitchClosed(facility, "conference")).toBe(false);
    expect(isRoomLightsOn(facility, "conference", true)).toBe(false);
    setRoomLightSwitch(facility, "conference", true);
    expect(isRoomLightSwitchClosed(facility, "conference")).toBe(true);
    expect(isRoomLightsOn(facility, "conference", true)).toBe(true);
    expect(isRoomLightsOn(facility, "conference", false)).toBe(false);
  });

  it("toggles and builds play actions for rooms with lighting", () => {
    const facility = { lightSwitches: {} };
    // Power out: ambiguous flip only — does not reveal switch position.
    expect(roomLightAction(building, facility, "conference", false)).toMatchObject({
      id: "room-lights:flip:conference",
      label: "Flip the light switch",
    });
    toggleRoomLightSwitch(facility, "conference");
    expect(roomLightAction(building, facility, "conference", false)).toMatchObject({
      id: "room-lights:flip:conference",
      label: "Flip the light switch",
    });

    // Power on: turn on / turn off based on effective lights.
    setRoomLightSwitch(facility, "conference", false);
    expect(roomLightAction(building, facility, "conference", true)).toMatchObject({
      id: "room-lights:on:conference",
      label: "Turn on the lights",
    });
    toggleRoomLightSwitch(facility, "conference");
    expect(roomLightAction(building, facility, "conference", true)).toMatchObject({
      id: "room-lights:off:conference",
      label: "Turn off the lights",
    });
    expect(roomLightAction(building, facility, "kitchen", true)).toBe(null);
  });

  it("still accepts legacy poweredObjects lights", () => {
    const legacy = {
      rooms: [],
      roomById: {},
      poweredObjects: [
        { id: "kitchen-lights", kind: "lights", room: "kitchen", label: "Kitchen lights", style: "strip" },
      ],
    };
    expect(lightFixtureForRoom(legacy, "kitchen")).toMatchObject({
      room: "kitchen",
      source: "poweredObject",
      style: "strip",
    });
  });
});
