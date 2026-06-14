import { computed, ref, watch } from "vue";
import { hasFlag, requireSatisfied, setFlags } from "../lib/maps/composables/useFlags.js";

/**
 * Location-triggered narrative for the card between map and play panel.
 * Milestone beats acknowledge once; revisit text shows on return.
 */
export function useStory(storyData, ctx) {
  const { gameState, place, outdoor, indoor } = ctx;
  const beats = storyData.beats ?? {};
  const previousPlace = ref(place.value);

  /** Beat awaiting player acknowledgment (blocks narrative updates). */
  const pendingBeat = ref(null);
  /** Current location narrative (revisit or ambient). */
  const locationNarrative = ref(null);

  const showEndCard = computed(
    () =>
      hasFlag(gameState.flags, "day1.complete") &&
      !gameState.endCardDismissed,
  );

  const narrativeBeat = computed(() => pendingBeat.value ?? locationNarrative.value);

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

  function beatMatchesLocation(id, beat, loc) {
    if (!requireSatisfied(beat.require, gameState.flags)) return false;
    return triggerMatches(beat, loc);
  }

  function findNewBeat(loc, event = null) {
    for (const [id, beat] of Object.entries(beats)) {
      if (beat.once !== false && beatSeen(id)) continue;
      if (!requireSatisfied(beat.require, gameState.flags)) continue;
      if (!triggerMatches(beat, loc, event)) continue;
      return {
        id,
        eyebrow: beat.eyebrow,
        heading: beat.heading,
        text: beat.text,
        choices: beat.choices,
        acknowledge: beat.acknowledge !== false,
      };
    }
    return null;
  }

  function findRevisitBeat(loc) {
    for (const [id, beat] of Object.entries(beats)) {
      if (beat.once === false || !beatSeen(id) || !beat.revisit) continue;
      if (!beatMatchesLocation(id, beat, loc)) continue;
      return {
        id,
        eyebrow: beat.eyebrow,
        heading: beat.heading,
        text: beat.revisit,
        revisit: true,
        acknowledge: false,
      };
    }
    return null;
  }

  function refreshNarrative(event = null) {
    if (pendingBeat.value || showEndCard.value) return;

    const loc = locationContext();
    const fresh = findNewBeat(loc, event);
    if (fresh) {
      pendingBeat.value = fresh;
      locationNarrative.value = null;
      return;
    }

    pendingBeat.value = null;
    locationNarrative.value = findRevisitBeat(loc);
  }

  function dismissBeat(choiceIndex = 0) {
    const beat = pendingBeat.value;
    if (!beat) return;

    const choice = beat.choices?.[choiceIndex];
    if (choice?.sets) setFlags(gameState.flags, choice.sets);
    if (choice?.set_flags) setFlags(gameState.flags, choice.set_flags);

    markSeen(beat.id);
    pendingBeat.value = null;
    refreshNarrative();
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
    ],
    () => {
      const enteredIndoors =
        previousPlace.value === "outdoors" && place.value === "indoors";
      previousPlace.value = place.value;

      if (pendingBeat.value) return;

      if (enteredIndoors) {
        refreshNarrative("enter-building");
      } else {
        refreshNarrative();
      }
    },
    { flush: "post" },
  );

  return {
    narrativeBeat,
    pendingBeat,
    showEndCard,
    dismissBeat,
    dismissEndCard,
    refreshNarrative,
  };
}
