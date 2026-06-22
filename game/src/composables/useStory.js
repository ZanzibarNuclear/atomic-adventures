import { computed, ref, unref, watch } from "vue";
import { hasFlag, setFlags } from "../lib/maps/composables/useFlags.js";
import { advanceGameTime } from "../lib/character/gameTime.js";

/**
 * Location-triggered narrative for the card between map and play panel.
 * First presentation: story text. Later presentations use revisit text when
 * authored. Choices remain available whenever the beat is active.
 */
export function useStory(storyData, ctx) {
  const { gameState, place, outdoor, indoor } = ctx;
  const beats = computed(() => unref(storyData)?.beats ?? {});
  const previousPlace = ref(place.value);

  /** Active story beat, including repeat visits. */
  const pendingBeat = ref(null);

  const showEndCard = computed(
    () =>
      hasFlag(gameState.flags, "day1.complete") &&
      !gameState.endCardDismissed,
  );

  const narrativeBeat = computed(() => pendingBeat.value);

  function beatSeen(id) {
    return gameState.storySeen.has(id);
  }

  function markSeen(id) {
    gameState.storySeen = new Set([...gameState.storySeen, id]);
  }

  function locationContext() {
    return {
      place: place.value,
      hex: outdoor.state.currentId,
      room: indoor.indoor.currentRoom,
      exteriorNode: indoor.indoor.exteriorNode,
    };
  }

  function triggerMatches(beat, loc, event) {
    const trigger = beat.trigger ?? {};
    if (trigger.event) {
      return event === trigger.event;
    }
    if (trigger.place && trigger.place !== loc.place) return false;
    if (trigger.hex && (loc.place !== "outdoors" || trigger.hex !== loc.hex)) {
      return false;
    }
    if (trigger.room && (loc.place !== "indoors" || trigger.room !== loc.room)) {
      return false;
    }
    if (trigger.exteriorNode) {
      if (loc.place !== "indoors" || trigger.exteriorNode !== loc.exteriorNode) {
        return false;
      }
    }
    if (trigger.flag && !hasFlag(gameState.flags, trigger.flag)) return false;
    return true;
  }

  function decorateChoices(choices = []) {
    return choices;
  }

  function displayText(beat, seen) {
    return seen && beat.revisit ? beat.revisit : beat.text;
  }

  function activeBeat(id, beat) {
    const seen = beatSeen(id);
    return {
      id,
      eyebrow: beat.eyebrow,
      heading: beat.heading,
      text: displayText(beat, seen),
      revisit: seen && Boolean(beat.revisit),
      choices: decorateChoices(beat.choices),
    };
  }

  function findBeat(loc, event = null) {
    for (const [id, beat] of Object.entries(beats.value)) {
      if (!triggerMatches(beat, loc, event)) continue;
      return activeBeat(id, beat);
    }
    return null;
  }

  function refreshNarrative(event = null) {
    if (pendingBeat.value || showEndCard.value) return;

    const loc = locationContext();
    const fresh = findBeat(loc, event);
    if (fresh) {
      pendingBeat.value = fresh;
      markSeen(fresh.id);
      return;
    }

    pendingBeat.value = null;
  }

  function findChoiceIndex(beat, dest) {
    if (!beat?.choices?.length) return -1;
    return beat.choices.findIndex((choice) => {
      if (dest.go_hex && choice.go_hex === dest.go_hex) return true;
      if (dest.go_room && choice.go_room === dest.go_room) return true;
      if (dest.enter && choice.enter) return true;
      return false;
    });
  }

  function atBeatTrigger(beat, loc) {
    const trigger = beat.trigger ?? {};
    if (trigger.event) return true;
    if (trigger.place && trigger.place !== loc.place) return false;
    if (trigger.hex) return loc.place === "outdoors" && trigger.hex === loc.hex;
    if (trigger.room) return loc.place === "indoors" && trigger.room === loc.room;
    if (trigger.exteriorNode) {
      return loc.place === "indoors" && trigger.exteriorNode === loc.exteriorNode;
    }
    return true;
  }

  function applyChoice(choiceIndex = 0) {
    const beat = pendingBeat.value;
    if (!beat) return;

    const choice = beat.choices?.[choiceIndex];
    if (!choice) return;
    if (choice.disabled) return;

    if (choice.go_hex && place.value === "outdoors") {
      if (!outdoor.canReachHex(choice.go_hex)) return;
    }
    if (choice.enter && place.value === "outdoors") {
      if (!outdoor.atBuildingEntrance) return;
    }

    if (choice.sets) setFlags(gameState.flags, choice.sets);
    if (choice.set_flags) setFlags(gameState.flags, choice.set_flags);
    if (Number(choice.timeMinutes) > 0 && gameState.clock) {
      const timeResult = advanceGameTime(
        gameState,
        Number(choice.timeMinutes),
        choice.activity ?? "light",
      );
      if (!timeResult.ok) return;
    }

    markSeen(beat.id);
    pendingBeat.value = null;

    const movesPlayer =
      (choice.go_hex && place.value === "outdoors") ||
      (choice.enter && place.value === "outdoors") ||
      (choice.go_room && place.value === "indoors");

    if (choice.go_hex && place.value === "outdoors") {
      outdoor.moveTo(choice.go_hex);
    } else if (choice.enter && place.value === "outdoors") {
      indoor.enterBuilding();
    } else if (choice.go_room && place.value === "indoors") {
      indoor.moveToRoom(choice.go_room);
    }

    if (!movesPlayer) refreshNarrative();
  }

  /** Map / travel UI — apply matching story choice when one advances to this destination. */
  function travelToHex(hexId) {
    const idx = findChoiceIndex(pendingBeat.value, { go_hex: hexId });
    if (idx >= 0) {
      applyChoice(idx);
      return;
    }
    if (!outdoor.canReachHex(hexId)) return;
    outdoor.moveTo(hexId);
  }

  function enterBuilding() {
    const idx = findChoiceIndex(pendingBeat.value, { enter: true });
    if (idx >= 0) {
      applyChoice(idx);
      return;
    }
    indoor.enterBuilding();
  }

  function travelToRoom(roomId) {
    const idx = findChoiceIndex(pendingBeat.value, { go_room: roomId });
    if (idx >= 0) {
      applyChoice(idx);
      return;
    }
    indoor.moveToRoom(roomId);
  }

  function dismissEndCard() {
    gameState.endCardDismissed = true;
  }

  watch(
    () => [
      place.value,
      outdoor.state.currentId,
      indoor.indoor.currentRoom,
      indoor.indoor.exteriorNode,
      [...gameState.flags].join("\0"),
      gameState.character?.revision ?? 0,
    ],
    () => {
      const loc = locationContext();
      const enteredIndoors =
        previousPlace.value === "outdoors" && place.value === "indoors";
      previousPlace.value = place.value;

      if (pendingBeat.value) {
        const beatDef = beats.value[pendingBeat.value.id];
        if (beatDef && atBeatTrigger(beatDef, loc)) return;
        pendingBeat.value = null;
      }

      if (enteredIndoors) {
        refreshNarrative("enter-building");
      } else {
        refreshNarrative();
      }
    },
    { flush: "post" },
  );

  watch(
    beats,
    () => {
      const loc = locationContext();
      const pendingId = pendingBeat.value?.id;
      if (pendingId) {
        const definition = beats.value[pendingId];
        pendingBeat.value = null;
        if (definition && atBeatTrigger(definition, loc)) {
          pendingBeat.value = activeBeat(pendingId, definition);
          return;
        }
      }
      refreshNarrative();
    },
    { flush: "post" },
  );

  return {
    narrativeBeat,
    pendingBeat,
    showEndCard,
    applyChoice,
    travelToHex,
    enterBuilding,
    travelToRoom,
    dismissEndCard,
    refreshNarrative,
  };
}
