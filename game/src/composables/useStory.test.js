import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { useStory } from "./useStory.js";
import { createCharacterState, markCharacterChanged } from "./useCharacterState.js";
import { addItem } from "../lib/character/holdings.js";

function harness(initialStory, {
  withCharacter = false,
  withClock = false,
  moveTo = () => {},
  moveToExteriorNode = () => {},
  initialPlace = "outdoors",
  initialRoom = null,
  initialExteriorNode = null,
  initialOriginHex = null,
  initialLocalExit = null,
  initialMapTransition = null,
  initialTransitionDirection = null,
  initialClock = { elapsedMinutes: 0, minuteOfDay: 8 * 60, day: 1 },
  openStageView = () => {},
} = {}) {
  const story = ref(initialStory);
  const place = ref(initialPlace);
  const gameState = reactive({
    flags: new Set(),
    storySeen: new Set(),
    endCardDismissed: false,
    ...(withClock ? {
      clock: { ...initialClock },
    } : {}),
    ...(withCharacter ? {
      character: createCharacterState({
        items: [
          { id: "key", label: "Key", carrying: "unique", maxQuantity: 1 },
          { id: "tool", label: "Tool", carrying: "unique", maxQuantity: 1 },
        ],
        stats: [],
        knowledge: [],
        skills: [],
        quests: [],
        documents: [],
      }),
    } : {}),
  });
  const outdoor = {
    state: reactive({
      currentId: "origin",
      previousId: initialOriginHex,
      localExit: initialLocalExit,
      mapTransition: initialMapTransition,
      transitionDirection: initialTransitionDirection,
    }),
    canReachHex: () => true,
    moveTo,
    atBuildingEntrance: false,
  };
  const indoor = {
    indoor: reactive({ currentRoom: initialRoom, exteriorNode: initialExteriorNode }),
    enterBuilding: () => {},
    moveToRoom: () => {},
    moveToExteriorNode,
  };
  return {
    story,
    gameState,
    outdoor,
    indoor,
    place,
    api: useStory(story, { gameState, place, outdoor, indoor, openStageView }),
  };
}

const beat = {
  heading: "Original",
  text: "Original text",
  trigger: { place: "outdoors", hex: "origin" },
  choices: [{ text: "Continue" }],
};

describe("useStory reactive content", () => {
  it("updates a pending beat in place when content changes", async () => {
    const { story, api } = harness({ beats: { intro: beat } });
    api.refreshNarrative();
    expect(api.pendingBeat.value.heading).toBe("Original");
    story.value = { beats: { intro: { ...beat, heading: "Edited", text: "Edited text" } } };
    await nextTick();
    expect(api.pendingBeat.value.heading).toBe("Edited");
    expect(api.pendingBeat.value.text).toBe("Edited text");
  });

  it("updates a pending beat when live content changes", async () => {
    const { story, api } = harness({ beats: { intro: beat } });
    api.refreshNarrative();
    story.value = {
      beats: {
        intro: {
          ...beat,
          heading: "Edited again",
        },
      },
    };
    await nextTick();
    expect(api.pendingBeat.value.heading).toBe("Edited again");
  });

  it("marks a beat seen when it is presented", () => {
    const passiveBeat = {
      ...beat,
      choices: [],
      revisit: "Return text",
    };
    const { api, gameState } = harness({ beats: { intro: passiveBeat } });

    api.refreshNarrative();

    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(gameState.storySeen.has("intro")).toBe(true);
  });

  it("shows revisit text and keeps choices after leaving and returning to a seen beat", async () => {
    const revisitBeat = {
      ...beat,
      choices: [{ text: "Try the trail again", go_hex: "east-pines" }],
      revisit: "Return text",
    };
    const { api, outdoor } = harness({ beats: { intro: revisitBeat } });

    api.refreshNarrative();
    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(api.pendingBeat.value.choices[0].text).toBe("Try the trail again");

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    expect(api.narrativeBeat.value).toBeNull();

    outdoor.state.currentId = "origin";
    await nextTick();
    expect(api.narrativeBeat.value.text).toBe("Return text");
    expect(api.narrativeBeat.value.revisit).toBe(true);
    expect(api.pendingBeat.value.choices[0].text).toBe("Try the trail again");
  });

  it("shows story text again on return when no revisit text is defined", async () => {
    const { api, outdoor, gameState } = harness({ beats: { ambient: beat } });

    api.refreshNarrative();
    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(gameState.storySeen.has("ambient")).toBe(true);

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    outdoor.state.currentId = "origin";
    await nextTick();

    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(api.narrativeBeat.value.revisit).toBe(false);
  });

  it("does not suppress a seen beat with choices", async () => {
    const choiceBeat = {
      ...beat,
      choices: [{ text: "Continue" }],
    };
    const { api, outdoor, gameState } = harness({ beats: { ambient: choiceBeat } });

    api.refreshNarrative();
    api.applyChoice(0);

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    outdoor.state.currentId = "origin";
    await nextTick();

    expect(gameState.storySeen.has("ambient")).toBe(true);
    expect(api.pendingBeat.value.id).toBe("ambient");
    expect(api.pendingBeat.value.choices[0].text).toBe("Continue");
  });

  it("ignores legacy beat requirements", () => {
    const gatedBeat = {
      ...beat,
      require: { items: ["key"] },
      choices: [
        { text: "Continue" },
      ],
    };
    const { api } = harness({ beats: { gated: gatedBeat } }, {
      withCharacter: true,
    });

    api.refreshNarrative();
    expect(api.pendingBeat.value.id).toBe("gated");
    expect(api.pendingBeat.value.choices[0].disabled).toBeUndefined();
  });

  it("keeps a legacy required beat visible after character revision changes", async () => {
    const gatedBeat = {
      ...beat,
      require: { items: ["key"] },
    };
    const { api, gameState } = harness({ beats: { gated: gatedBeat } }, {
      withCharacter: true,
    });

    api.refreshNarrative();
    expect(api.pendingBeat.value.id).toBe("gated");

    addItem(gameState.character.holdings, gameState.character.definitions, "key");
    markCharacterChanged(gameState.character);
    await nextTick();

    expect(api.pendingBeat.value.id).toBe("gated");
  });

  it("commits choice flags before movement", () => {
    let flagSetDuringMove = false;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Set the flag and go",
        sets: ["story.flagged"],
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      moveTo: () => {
        flagSetDuringMove = setup.gameState.flags.has("story.flagged");
      },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(flagSetDuringMove).toBe(true);
    expect(setup.gameState.storySeen.has("effect")).toBe(true);
  });

  it("advances choice time before movement", () => {
    let minutesDuringMove = 0;
    let moveOptions = null;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Spend time and go",
        timeMinutes: 5,
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      withClock: true,
      withCharacter: true,
      moveTo: (_hexId, options) => {
        minutesDuringMove = setup.gameState.clock.elapsedMinutes;
        moveOptions = options;
      },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(minutesDuringMove).toBe(5);
    expect(moveOptions).toEqual({ suppressDefaultTime: true });
    expect(setup.gameState.storySeen.has("effect")).toBe(true);
  });

  it("does not suppress default outdoor movement time when a story move has no authored time", () => {
    let moveOptions = null;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Go now",
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      withClock: true,
      withCharacter: true,
      moveTo: (_hexId, options) => {
        moveOptions = options;
      },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(setup.gameState.clock.elapsedMinutes).toBe(0);
    expect(moveOptions).toEqual({ suppressDefaultTime: false });
  });

  it("uses beat time criteria to select the matching room beat", () => {
    const setup = harness({
      beats: {
        "library-default": {
          text: "The library is quiet.",
          trigger: { place: "indoors", room: "library" },
          choices: [],
        },
        "library-evening": {
          text: "The sun is setting through the library windows.",
          trigger: { place: "indoors", room: "library" },
          time: { days: [1], phase: "evening" },
          choices: [],
        },
      },
    }, {
      withClock: true,
      initialPlace: "indoors",
      initialRoom: "library",
      initialClock: { day: 1, minuteOfDay: 18 * 60, elapsedMinutes: 10 * 60 },
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("library-evening");
  });

  it("advances sleep-until choice time and refreshes to the Day 2 library beat", () => {
    const setup = harness({
      beats: {
        "library-arrival": {
          text: "Zanzi reaches the library as the last light fades.",
          trigger: { place: "indoors", room: "library" },
          time: { days: [1], phase: "evening", beforeMilestone: "library.sleep-1" },
          choices: [{
            text: "Sleep in the soft seating",
            timeUntil: { dayOffset: 1, minuteOfDay: 7 * 60 },
            activity: "resting",
            sets: ["library.sleep-1", "day-2.started"],
          }],
        },
        "library-wakeup": {
          text: "Morning light spills across the library.",
          trigger: { place: "indoors", room: "library" },
          time: { days: [2], phase: "morning", afterMilestone: "library.sleep-1" },
          choices: [],
        },
      },
    }, {
      withClock: true,
      withCharacter: true,
      initialPlace: "indoors",
      initialRoom: "library",
      initialClock: { day: 1, minuteOfDay: 19 * 60, elapsedMinutes: 11 * 60 },
    });

    setup.api.refreshNarrative();
    expect(setup.api.pendingBeat.value.id).toBe("library-arrival");

    setup.api.applyChoice(0);

    expect(setup.gameState.clock).toMatchObject({
      day: 2,
      minuteOfDay: 7 * 60,
      elapsedMinutes: 23 * 60,
    });
    expect(setup.gameState.flags.has("library.sleep-1")).toBe(true);
    expect(setup.api.pendingBeat.value.id).toBe("library-wakeup");
    expect(setup.api.pendingBeat.value.text).toBe("Morning light spills across the library.");
  });

  it("opens a stage view from a story choice without dismissing the beat", () => {
    const opened = [];
    const viewBeat = {
      ...beat,
      choices: [{
        text: "Check your inventory",
        view: { kind: "inventory" },
      }],
    };
    const setup = harness({ beats: { intro: viewBeat } }, {
      openStageView: (view) => opened.push(view),
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(opened).toEqual([{ kind: "inventory" }]);
    expect(setup.api.pendingBeat.value.id).toBe("intro");
    expect(setup.gameState.storySeen.has("intro")).toBe(true);
  });

  it("shows the exterior-node beat after switching from world to local view", async () => {
    const setup = harness({
      beats: {
        "large-bay-roll-front": {
          text: "Roll-up door prose.",
          trigger: { place: "indoors", exteriorNode: "large-bay-roll-front" },
          choices: [],
        },
        "map-switch-event": {
          heading: "Map switch",
          text: "This event should not be shown automatically.",
          trigger: { event: "map-switch" },
          choices: [],
        },
      },
    }, {
      initialPlace: "outdoors",
    });

    setup.indoor.indoor.exteriorNode = "large-bay-roll-front";
    setup.place.value = "indoors";
    await nextTick();

    expect(setup.api.pendingBeat.value.id).toBe("large-bay-roll-front");
  });

  it("can still show an explicit event beat when code requests one", () => {
    const setup = harness({
      beats: {
        "garage-front-entrance": {
          heading: "At the garage",
          text: "Garage arrival prose.",
          trigger: { place: "indoors", exteriorNode: "garage-front-entrance" },
          choices: [],
        },
        "explicit-event": {
          heading: "Special event",
          text: "Event prose.",
          trigger: { event: "custom-event" },
          choices: [],
        },
      },
    }, {
      initialPlace: "indoors",
      initialExteriorNode: "garage-front-entrance",
    });

    setup.api.refreshNarrative("custom-event");

    expect(setup.api.pendingBeat.value.id).toBe("explicit-event");
  });

  it("prefers an origin-specific outdoor beat over the default hex beat", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          heading: "Default yard",
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-from-flats": {
          heading: "Riverbank approach",
          text: "The riverbank path brings you in by the intake.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "the-flats",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-from-flats");
  });

  it("falls back to the default outdoor beat when origin-specific beats do not match", () => {
    const setup = harness({
      beats: {
        "utility-yard-from-flats": {
          text: "The riverbank path brings you in by the intake.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats" },
          choices: [],
        },
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "west-slope",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-default");
  });

  it("shows no outdoor beat when only nonmatching origin-specific beats exist", () => {
    const setup = harness({
      beats: {
        "utility-yard-from-flats": {
          text: "The riverbank path brings you in by the intake.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "west-slope",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value).toBeNull();
  });

  it("uses revisit prose for the selected origin-specific beat", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-from-flats": {
          text: "The riverbank path brings you in by the intake.",
          revisit: "You are back by the intake approach.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "the-flats",
    });

    setup.gameState.storySeen.add("utility-yard-from-flats");
    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-from-flats");
    expect(setup.api.pendingBeat.value.text).toBe("You are back by the intake approach.");
    expect(setup.api.pendingBeat.value.revisit).toBe(true);
  });

  it("uses a map-transition beat after returning from a local map", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-from-flats": {
          text: "The riverbank path brings you in by the intake.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats" },
          choices: [],
        },
        "utility-yard-from-garage": {
          text: "You are standing in front of the garage doors.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { localExit: "garage-exit" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: null,
      initialLocalExit: "garage-exit",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-from-garage");
  });

  it("uses a map-transition beat after entering a local map", () => {
    const setup = harness({
      beats: {
        "large-bay-default": {
          text: "You are near the side of the large bay.",
          trigger: { place: "indoors", exteriorNode: "large-bay-man-front" },
          choices: [],
        },
        "large-bay-from-transition": {
          text: "The path from the pines ends at the large bay door.",
          trigger: { place: "indoors", exteriorNode: "large-bay-man-front" },
          match: { mapTransition: "man-door-path", transitionDirection: "toLocal" },
          choices: [],
        },
      },
    }, {
      initialPlace: "indoors",
      initialExteriorNode: "large-bay-man-front",
      initialMapTransition: "man-door-path",
      initialTransitionDirection: "toLocal",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("large-bay-from-transition");
  });

  it("lets one beat match origin entry or local exit depending on the action", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-action-specific": {
          text: "You arrive at the utility yard from a familiar approach.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats", localExit: "garage-exit" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "the-flats",
      initialLocalExit: null,
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-action-specific");

    setup.api.pendingBeat.value = null;
    setup.outdoor.state.previousId = "west-slope";
    setup.outdoor.state.localExit = "garage-exit";
    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-action-specific");
  });

  it("ignores origin-specific criteria during local-exit selection", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-from-flats-and-garage": {
          text: "You are standing in front of the garage doors.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats", localExit: "garage-exit" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "west-slope",
      initialLocalExit: "garage-exit",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-from-flats-and-garage");
  });

  it("does not treat local-exit-only beats as defaults during inter-hex entry", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-from-garage": {
          text: "You are standing in front of the garage doors.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { localExit: "garage-exit" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: "the-flats",
      initialLocalExit: null,
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-default");
  });

  it("does not keep using an origin-specific beat after a local exit clears origin", () => {
    const setup = harness({
      beats: {
        "utility-yard-default": {
          text: "The utility station is just ahead.",
          trigger: { place: "outdoors", hex: "origin" },
          choices: [],
        },
        "utility-yard-from-flats": {
          text: "The riverbank path brings you in by the intake.",
          trigger: { place: "outdoors", hex: "origin" },
          match: { originHex: "the-flats" },
          choices: [],
        },
      },
    }, {
      initialOriginHex: null,
      initialLocalExit: "garage-exit",
    });

    setup.api.refreshNarrative();

    expect(setup.api.pendingBeat.value.id).toBe("utility-yard-default");
  });

  it("moves to an exterior node from an indoor story choice", () => {
    let movedTo = null;
    const exteriorBeat = {
      heading: "Outside",
      text: "The path bends around the station.",
      trigger: { place: "indoors", exteriorNode: "large-bay-roll-front" },
      choices: [{
        text: "Look for a way in",
        go_exterior_node: "north-east-corner",
      }],
    };
    const setup = harness({ beats: { exterior: exteriorBeat } }, {
      initialPlace: "indoors",
      initialExteriorNode: "large-bay-roll-front",
      moveToExteriorNode: (id) => { movedTo = id; },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(movedTo).toBe("north-east-corner");
    expect(setup.gameState.storySeen.has("exterior")).toBe(true);
  });
});
