import { computed, ref, watch } from "vue";
import { hasFlag, requireSatisfied, setFlags } from "../lib/maps/composables/useFlags.js";

/**
 * Location- and flag-triggered story beats from YAML.
 * Shows one beat at a time; dismissed beats are tracked in gameState.storySeen.
 */
export function useStory(storyData, ctx) {
  const { gameState, place, outdoor, indoor } = ctx;
  const beats = storyData.beats ?? {};
  const previousPlace = ref(place.value);

  const activeBeat = ref(null);
  const showEndCard = computed(
    () =>
      hasFlag(gameState.flags, "day1.complete") &&
      !gameState.endCardDismissed,
  );

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

  function beatEligible(id, beat, loc, event) {
    if (beat.once !== false && beatSeen(id)) return false;
    if (!requireSatisfied(beat.require, gameState.flags)) return false;
    return triggerMatches(beat, loc, event);
  }

  function findBeat(loc, event = null) {
    for (const [id, beat] of Object.entries(beats)) {
      if (beatEligible(id, beat, loc, event)) {
        return { id, ...beat };
      }
    }
    return null;
  }

  function tryShowBeat(event = null) {
    if (activeBeat.value || showEndCard.value) return;
    const loc = locationContext();
    const beat = findBeat(loc, event);
    if (beat) activeBeat.value = beat;
  }

  function dismissBeat(choiceIndex = 0) {
    const beat = activeBeat.value;
    if (!beat) return;

    const choice = beat.choices?.[choiceIndex];
    if (choice?.sets) setFlags(gameState.flags, choice.sets);
    if (choice?.set_flags) setFlags(gameState.flags, choice.set_flags);

    markSeen(beat.id);
    activeBeat.value = null;
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

      if (enteredIndoors) {
        tryShowBeat("enter-building");
      } else {
        tryShowBeat();
      }
    },
    { flush: "post" },
  );

  return {
    activeBeat,
    showEndCard,
    dismissBeat,
    dismissEndCard,
    tryShowBeat,
  };
}
