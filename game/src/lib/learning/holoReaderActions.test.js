import { describe, expect, it } from "vitest";
import {
  HOLO_READER_BROWSER_ACTION_ID,
  availableHoloReaderLessons,
  buildHoloReaderActions,
} from "./holoReaderActions.js";

const lesson = {
  id: "hydro-power-intro",
  title: "Hydro Power, Water You Waiting For?",
  order: 10,
  availableWhen: {
    flags: { all: ["hub.hydro_online"], any: [], not: [] },
    knowledge: { all: [], any: [], not: [] },
  },
};

describe("holo-reader launch actions", () => {
  it("hides the browser action when the powered lesson is unavailable", () => {
    const actions = buildHoloReaderActions({
      place: "indoors",
      currentStand: "holo-reader",
      lessons: [lesson],
      flags: new Set(),
      stationPowerOn: false,
    });

    expect(actions).toEqual([]);
  });

  it("hides the browser action when station power is off even if a lesson forgets its own requirement", () => {
    const actions = buildHoloReaderActions({
      place: "indoors",
      currentStand: "holo-reader",
      lessons: [{ ...lesson, availableWhen: {} }],
      flags: new Set(),
      stationPowerOn: false,
    });

    expect(actions).toEqual([]);
  });

  it("shows the browser action when seated at the powered holo-reader", () => {
    const actions = buildHoloReaderActions({
      place: "indoors",
      currentStand: "holo-reader",
      lessons: [lesson],
      flags: new Set(["hub.hydro_online"]),
      stationPowerOn: true,
    });

    expect(actions.map((action) => action.id)).toEqual([HOLO_READER_BROWSER_ACTION_ID]);
  });

  it("sorts available lessons by authored order", () => {
    const lessons = [
      { ...lesson, id: "second", order: 20 },
      { ...lesson, id: "first", order: 10 },
    ];

    expect(availableHoloReaderLessons(lessons, {
      flags: new Set(["hub.hydro_online"]),
    }).map((entry) => entry.id)).toEqual(["first", "second"]);
  });
});
