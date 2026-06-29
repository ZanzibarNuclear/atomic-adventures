import { computed, ref, unref, watch } from "vue";
import { hasFlag, setFlags } from "../lib/maps/composables/useFlags.js";
import { advanceGameTime } from "../lib/character/gameTime.js";

/**
 * Location-triggered narrative for the card between map and play panel.
 * First presentation: story text. Later presentations use revisit text when
 * authored. Choices remain available whenever the beat is active.
 */
export function useStory(storyData, ctx) {
  const { gameState, place, outdoor, indoor, openStageView = () => false } = ctx;
  const beats = computed(() => unref(storyData)?.beats ?? {});

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
      originHex: outdoor.state.previousId,
      localExit: outdoor.state.localExit,
      room: indoor.indoor.currentRoom,
      exteriorNode: indoor.indoor.exteriorNode,
    };
  }

  function storyActionContext(loc, event = null) {
    if (event) return "event";
    if (loc.place === "outdoors" && loc.localExit) return "exitLocalMap";
    if (loc.place === "outdoors" && loc.originHex) return "enterOutdoorHex";
    if (loc.place === "indoors") return "enterIndoorLocation";
    return "ambientRefresh";
  }

  function triggerMatches(beat, loc, event) {
    const trigger = beat.trigger ?? {};
    if (event && !trigger.event) return false;
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

  function timeMatches(beat) {
    const time = beat.time ?? {};
    const hasTime = hasTimeCriteria(time);
    if (!hasTime) return true;
    const clock = gameState.clock;
    if (!clock) return false;

    const day = Number(clock.day);
    const minuteOfDay = Math.floor(Number(clock.minuteOfDay));
    const elapsedMinutes = Number(clock.elapsedMinutes);

    if (Array.isArray(time.days) && time.days.length && !time.days.includes(day)) return false;
    if (time.dayFrom != null && day < Number(time.dayFrom)) return false;
    if (time.dayTo != null && day > Number(time.dayTo)) return false;
    if (time.elapsedFrom != null && elapsedMinutes < Number(time.elapsedFrom)) return false;
    if (time.elapsedTo != null && elapsedMinutes > Number(time.elapsedTo)) return false;
    if (!minuteWindowMatches(time, minuteOfDay)) return false;
    if (time.phase && phaseForMinute(minuteOfDay) !== time.phase) return false;
    if (time.afterMilestone && !hasFlag(gameState.flags, time.afterMilestone)) return false;
    if (time.beforeMilestone && hasFlag(gameState.flags, time.beforeMilestone)) return false;

    return true;
  }

  function timeScore(beat) {
    const time = beat.time ?? {};
    if (!hasTimeCriteria(time)) return 0;
    let score = 0;
    if (Array.isArray(time.days) && time.days.length) score += 1;
    if (time.dayFrom != null || time.dayTo != null) score += 1;
    if (time.minuteOfDayFrom != null || time.minuteOfDayTo != null) score += 1;
    if (time.phase) score += 1;
    if (time.elapsedFrom != null || time.elapsedTo != null) score += 1;
    if (time.afterMilestone) score += 1;
    if (time.beforeMilestone) score += 1;
    return score;
  }

  function matchScore(beat, loc, action = storyActionContext(loc)) {
    const match = beat.match ?? {};
    const hasMatch = Boolean(match.originHex || match.localExit);
    let relevant = 0;
    let score = 0;
    if (action === "enterOutdoorHex" && match.originHex) {
      relevant += 1;
      if (loc.place !== "outdoors" || match.originHex !== loc.originHex) return -1;
      score += 1;
    }
    if (action === "exitLocalMap" && match.localExit) {
      relevant += 1;
      if (loc.place !== "outdoors" || match.localExit !== loc.localExit) return -1;
      score += 1;
    }
    if (hasMatch && relevant === 0) return -1;
    return score;
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
    let selected = null;
    let selectedScore = -1;
    const action = storyActionContext(loc, event);
    for (const [id, beat] of Object.entries(beats.value)) {
      if (!triggerMatches(beat, loc, event)) continue;
      if (!timeMatches(beat)) continue;
      const score = matchScore(beat, loc, action) + timeScore(beat);
      if (score < 0 || score <= selectedScore) continue;
      selected = { id, beat };
      selectedScore = score;
    }
    if (selected) return activeBeat(selected.id, selected.beat);
    if (event) return findBeat(loc, null);
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
      if (
        dest.go_exterior_node &&
        choice.go_exterior_node === dest.go_exterior_node
      ) {
        return true;
      }
      if (dest.enter && choice.enter) return true;
      return false;
    });
  }

  function atBeatTrigger(beat, loc) {
    const trigger = beat.trigger ?? {};
    if (trigger.event) return true;
    if (trigger.place && trigger.place !== loc.place) return false;
    if (matchScore(beat, loc) < 0) return false;
    if (!timeMatches(beat)) return false;
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

    const duration = choiceDurationMinutes(choice, gameState.clock);
    if (choice.timeUntil && duration <= 0) return;
    if (duration > 0 && gameState.clock) {
      const timeResult = advanceGameTime(gameState, duration, choice.activity ?? "light");
      if (!timeResult.ok) return;
    }
    if (choice.sets) setFlags(gameState.flags, choice.sets);
    if (choice.set_flags) setFlags(gameState.flags, choice.set_flags);

    markSeen(beat.id);

    if (choice.view) {
      openStageView(choice.view);
      return;
    }

    pendingBeat.value = null;

    const movesPlayer =
      (choice.go_hex && place.value === "outdoors") ||
      (choice.enter && place.value === "outdoors") ||
      (choice.go_room && place.value === "indoors") ||
      (choice.go_exterior_node && place.value === "indoors");

    if (choice.go_hex && place.value === "outdoors") {
      outdoor.moveTo(choice.go_hex);
    } else if (choice.enter && place.value === "outdoors") {
      indoor.enterBuilding();
    } else if (choice.go_room && place.value === "indoors") {
      indoor.moveToRoom(choice.go_room);
    } else if (choice.go_exterior_node && place.value === "indoors") {
      indoor.moveToExteriorNode(choice.go_exterior_node);
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

  function travelToExteriorNode(nodeId) {
    const idx = findChoiceIndex(pendingBeat.value, { go_exterior_node: nodeId });
    if (idx >= 0) {
      applyChoice(idx);
      return;
    }
    indoor.moveToExteriorNode(nodeId);
  }

  function dismissEndCard() {
    gameState.endCardDismissed = true;
  }

  watch(
    () => [
      place.value,
      outdoor.state.currentId,
      outdoor.state.previousId,
      outdoor.state.localExit,
      indoor.indoor.currentRoom,
      indoor.indoor.exteriorNode,
      [...gameState.flags].join("\0"),
      gameState.clock?.day,
      gameState.clock?.minuteOfDay,
      gameState.clock?.elapsedMinutes,
      gameState.character?.revision ?? 0,
    ],
    () => {
      const loc = locationContext();

      if (pendingBeat.value) {
        const beatDef = beats.value[pendingBeat.value.id];
        if (beatDef && atBeatTrigger(beatDef, loc)) return;
        pendingBeat.value = null;
      }

      refreshNarrative();
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
    travelToExteriorNode,
    dismissEndCard,
    refreshNarrative,
  };
}

function hasTimeCriteria(time = {}) {
  return Boolean(
    (Array.isArray(time.days) && time.days.length) ||
    time.dayFrom != null ||
    time.dayTo != null ||
    time.minuteOfDayFrom != null ||
    time.minuteOfDayTo != null ||
    time.phase ||
    time.elapsedFrom != null ||
    time.elapsedTo != null ||
    time.afterMilestone ||
    time.beforeMilestone,
  );
}

function minuteWindowMatches(time, minuteOfDay) {
  const from = time.minuteOfDayFrom;
  const to = time.minuteOfDayTo;
  if (from == null && to == null) return true;
  const start = from == null ? 0 : Number(from);
  const end = to == null ? 1439 : Number(to);
  if (start <= end) return minuteOfDay >= start && minuteOfDay <= end;
  return minuteOfDay >= start || minuteOfDay <= end;
}

function phaseForMinute(minuteOfDay) {
  if (minuteOfDay >= 6 * 60 && minuteOfDay < 12 * 60) return "morning";
  if (minuteOfDay >= 12 * 60 && minuteOfDay < 17 * 60) return "afternoon";
  if (minuteOfDay >= 17 * 60 && minuteOfDay < 21 * 60) return "evening";
  return "night";
}

function choiceDurationMinutes(choice, clock) {
  if (choice.timeUntil) return minutesUntil(choice.timeUntil, clock);
  return Number(choice.timeMinutes) > 0 ? Number(choice.timeMinutes) : 0;
}

function minutesUntil(timeUntil, explicitClock) {
  const clock = explicitClock;
  if (!clock) return 0;
  return targetMinutesFromClock(clock, timeUntil) - currentAbsoluteMinutes(clock);
}

function targetMinutesFromClock(clock, timeUntil) {
  const targetDay = Number.isFinite(Number(timeUntil.day))
    ? Number(timeUntil.day)
    : Number(clock.day) + Number(timeUntil.dayOffset ?? 0);
  return (targetDay - 1) * 24 * 60 + Number(timeUntil.minuteOfDay);
}

function currentAbsoluteMinutes(clock) {
  return (Number(clock.day) - 1) * 24 * 60 + Number(clock.minuteOfDay);
}
