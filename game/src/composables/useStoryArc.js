import { computed, watch } from "vue";
import { advanceGameTime } from "../lib/character/gameTime.js";
import { applyEffectsAtomically } from "../lib/character/effects.js";
import { itemQuantity } from "../lib/character/holdings.js";
import { hasFlag, setFlags } from "../lib/maps/composables/useFlags.js";
import { createStoryState, STORY_ARC_ID } from "./useGameState.js";
import { selectAmbientSceneForArc, selectSceneForBeat } from "./storyArcModel.js";

const MAX_ADVANCES_PER_TICK = 10;

export function useStoryArc(storyData, {
  gameState,
  place,
  outdoor,
  indoor,
  openStageView = () => false,
  engineActions = () => [],
} = {}) {
  const storyArcs = computed(() => storyData.value?.storyArcs ?? []);
  const ambientScenes = computed(() => storyData.value?.ambientScenes ?? []);
  const activeArc = computed(() => {
    if (gameState.playMode !== "story") return null;
    return storyArcs.value.find((arc) => arc.id === gameState.story?.activeArcId)
      ?? storyArcs.value.find((arc) => arc.defaultMode === "story")
      ?? storyArcs.value[0]
      ?? null;
  });
  const activeBeat = computed(() => {
    const arc = activeArc.value;
    if (!arc) return null;
    const beatId = gameState.story?.activeBeatId;
    if (!beatId) return null;
    return arc.beats?.find((beat) => beat.id === beatId) ?? null;
  });
  const locationContext = computed(() => ({
    place: place.value,
    hex: outdoor?.state?.currentId ?? null,
    originHex: outdoor?.state?.previousId ?? null,
    mapTransition: outdoor?.state?.mapTransition ?? null,
    transitionDirection: outdoor?.state?.transitionDirection ?? null,
    room: indoor?.indoor?.currentRoom ?? null,
    exteriorNode: indoor?.indoor?.exteriorNode ?? null,
  }));
  const sceneContext = computed(() => ({
    playMode: gameState.playMode,
    location: locationContext.value,
    flags: gameState.flags,
    milestones: gameState.milestones,
    clock: gameState.clock,
  }));
  const activeScene = computed(() => {
    if (gameState.playMode !== "story" || !activeBeat.value) return null;
    return selectSceneForBeat(activeBeat.value, sceneContext.value);
  });
  const ambientScene = computed(() => {
    if (gameState.playMode !== "story" || activeScene.value || !activeArc.value) return null;
    return selectAmbientSceneForArc(activeArc.value, sceneContext.value, ambientScenes.value);
  });
  const displayScene = computed(() => activeScene.value ?? ambientScene.value);
  const visibleScene = computed(() => {
    if (gameState.playMode !== "story") return null;
    return displayScene.value;
  });
  const activeChoices = computed(() => {
    if (gameState.playMode !== "story" || !activeBeat.value) return [];
    return activeScene.value?.choices ?? [];
  });
  const storyError = computed(() => {
    if (gameState.playMode !== "story") return "";
    if (!activeArc.value) return "Story mode has no active story arc.";
    if (!gameState.story?.activeBeatId) return "";
    if (!activeBeat.value) return `Story beat "${gameState.story?.activeBeatId ?? activeArc.value.startBeat}" was not found.`;
    return "";
  });
  const storyActions = computed(() => {
    if (gameState.playMode !== "story" || !activeBeat.value) return [];
    return mergeStoryActions([
      ...choiceActions(activeChoices.value),
      ...authoredActions(activeBeat.value),
      ...engineActions(),
    ]);
  });

  function ensureStarted() {
    if (gameState.playMode !== "story") return;
    const arc = activeArc.value;
    if (!arc) return;
    if (!gameState.story || gameState.story.activeArcId !== arc.id) {
      gameState.story = createStoryState({
        activeArcId: arc.id,
        activeBeatId: arc.startBeat ?? null,
        completedBeatIds: gameState.story?.completedBeatIds ?? [],
        enteredBeatIds: gameState.story?.enteredBeatIds ?? [],
        seenSceneIds: gameState.story?.seenSceneIds ?? [],
      });
    }
  }

  function tick() {
    if (gameState.playMode !== "story") return;
    ensureStarted();
    if (storyError.value) return;

    let advances = 0;
    while (advances < MAX_ADVANCES_PER_TICK) {
      const beat = activeBeat.value;
      const arc = activeArc.value;
      if (!beat || !arc) return;
      if (!applyEnterEffects(beat)) return;
      if (!isCompletionConditionMet(beat.completesWhen, { gameState, place, outdoor, indoor })) {
        if (recoverForwardToLocation(arc, beat)) {
          advances += 1;
          continue;
        }
        return;
      }
      completeBeat(arc, beat);
      advances += 1;
    }
  }

  function recoverForwardToLocation(arc, beat) {
    if (activeScene.value) return false;
    const beats = arc.beats ?? [];
    const startIndex = beats.findIndex((candidate) => candidate.id === beat.id);
    if (startIndex < 0) return false;
    for (const candidate of beats.slice(startIndex + 1)) {
      if (
        isCompletionConditionMet(candidate.completesWhen, { gameState, place, outdoor, indoor })
      ) {
        gameState.story.activeBeatId = candidate.id;
        return true;
      }
    }
    return false;
  }

  function applyEnterEffects(beat) {
    const entered = new Set(gameState.story?.enteredBeatIds ?? []);
    if (entered.has(beat.id)) return true;
    const result = applyBeatEffect(beat.onEnter, { gameState, place, outdoor, indoor, openStageView });
    if (!result.ok) return false;
    entered.add(beat.id);
    gameState.story.enteredBeatIds = [...entered];
    return true;
  }

  function completeBeat(arc, beat) {
    const completed = new Set(gameState.story?.completedBeatIds ?? []);
    if (!completed.has(beat.id)) {
      const result = applyBeatEffect(beat.onComplete, { gameState, place, outdoor, indoor, openStageView });
      if (!result.ok) return;
      completed.add(beat.id);
      gameState.story.completedBeatIds = [...completed];
    }
    const nextArc = beat.nextArc
      ? storyArcs.value.find((candidate) => candidate.id === beat.nextArc) ?? null
      : null;
    const nextBeat = nextArc
      ? nextArc.beats?.find((candidate) => candidate.id === nextArc.startBeat) ?? null
      : beat.next
        ? arc.beats?.find((candidate) => candidate.id === beat.next) ?? null
        : null;
    if (nextArc) gameState.story.activeArcId = nextArc.id;
    gameState.story.activeBeatId = nextBeat?.id ?? null;
  }

  function markActiveSceneSeen() {
    const scene = activeScene.value;
    if (!scene?.id || !gameState.story) return;
    const seen = new Set(gameState.story.seenSceneIds ?? []);
    seen.add(scene.id);
    gameState.story.seenSceneIds = [...seen];
    gameState.storySeen = new Set([...(gameState.storySeen ?? []), scene.id]);
  }

  function applyStoryAction(actionOrId) {
    const action = typeof actionOrId === "string"
      ? storyActions.value.find((candidate) => candidate.id === actionOrId)
      : actionOrId;
    if (!action || action.disabled) return false;
    if (action.choice) return applyChoice(action.choice);
    if (action.view) return Boolean(openStageView(action.view));
    markActiveSceneSeen();
    if (action.toHexId) return moveHex(action.toHexId) && tickAfterAction();
    if (action.toRoomId) return moveRoom(action.toRoomId) && tickAfterAction();
    if (action.toExteriorNode) return moveExterior(action.toExteriorNode) && tickAfterAction();
    if (action.enterBuilding) {
      indoor?.enterBuilding?.();
      return tickAfterAction();
    }
    return false;
  }

  function applyChoice(choice) {
    const duration = choiceDurationMinutes(choice, gameState.clock);
    if (choice.timeUntil && duration <= 0) return false;
    if (duration > 0 && gameState.clock) {
      const timeResult = advanceGameTime(gameState, duration, choice.activity ?? "light");
      if (!timeResult.ok) return false;
    }
    if (choice.sets) setFlags(gameState.flags, choice.sets);
    if (choice.set_flags) setFlags(gameState.flags, choice.set_flags);
    if (choice.effects?.length) {
      const result = applyEffectsAtomically(choice.effects, {
        character: gameState.character,
        flags: gameState.flags,
      });
      if (!result.ok) return false;
    }
    markActiveSceneSeen();
    if (choice.view) return Boolean(openStageView(choice.view));
    if (choice.go_hex) return moveChoiceDestination(choice, () => moveHex(choice.go_hex, { suppressDefaultTime: duration > 0 }));
    if (choice.go_room) return moveChoiceDestination(choice, () => moveRoom(choice.go_room));
    if (choice.go_exterior_node) return moveChoiceDestination(choice, () => moveExterior(choice.go_exterior_node));
    if (choice.enter) {
      indoor?.enterBuilding?.();
      return moveChoiceDestination(choice, () => true);
    }
    if (choice.nextBeat && gameState.story) {
      gameState.story.activeBeatId = choice.nextBeat;
    }
    tick();
    return true;
  }

  function moveChoiceDestination(choice, move) {
    const moved = move();
    if (!moved) return false;
    if (choice.nextBeat && gameState.story) {
      gameState.story.activeBeatId = choice.nextBeat;
    }
    tick();
    return true;
  }

  function tickAfterAction() {
    tick();
    return true;
  }

  function moveHex(hexId, options = {}) {
    if (place.value !== "outdoors") return false;
    if (outdoor?.canReachHex && !outdoor.canReachHex(hexId)) return false;
    outdoor?.moveTo?.(hexId, options);
    return true;
  }

  function moveRoom(roomId) {
    if (place.value !== "indoors") place.value = "indoors";
    indoor?.moveToRoom?.(roomId);
    return true;
  }

  function moveExterior(nodeId) {
    if (place.value !== "indoors") place.value = "indoors";
    indoor?.moveToExteriorNode?.(nodeId);
    return true;
  }

  watch(
    () => [
      gameState.playMode,
      gameState.story?.activeArcId,
      gameState.story?.activeBeatId,
      storyArcs.value,
      place.value,
      outdoor?.state?.currentId,
      outdoor?.state?.previousId,
      outdoor?.state?.mapTransition,
      outdoor?.state?.transitionDirection,
      indoor?.indoor?.currentRoom,
      indoor?.indoor?.exteriorNode,
      [...(gameState.flags ?? [])].join("\0"),
      JSON.stringify(gameState.milestones ?? {}),
      JSON.stringify(gameState.facilities ?? {}),
      JSON.stringify(gameState.lessons ?? {}),
      gameState.clock?.day,
      gameState.clock?.minuteOfDay,
      gameState.clock?.elapsedMinutes,
      gameState.character?.revision ?? 0,
    ],
    tick,
    { flush: "post", immediate: true },
  );

  return {
    activeArc,
    activeBeat,
    activeScene,
    ambientScene,
    displayScene: visibleScene,
    activeChoices,
    storyActions,
    applyStoryAction,
    storyError,
    tick,
    isCompletionConditionMet: (condition = activeBeat.value?.completesWhen) =>
      isCompletionConditionMet(condition, { gameState, place, outdoor, indoor }),
  };
}

export function applyBeatEffect(effect, { gameState, place, outdoor, indoor, openStageView = () => false }) {
  if (!effect) return { ok: true };
  if (effect.timeMinutes && effect.timeMinutes > 0 && gameState.clock) {
    const time = advanceGameTime(gameState, effect.timeMinutes, effect.activity ?? "light");
    if (!time.ok) return time;
  }
  if (effect.setFlags?.length) setFlags(gameState.flags, effect.setFlags);
  if (effect.effects?.length) {
    const result = applyEffectsAtomically(effect.effects, {
      character: gameState.character,
      flags: gameState.flags,
    });
    if (!result.ok) return result;
  }
  if (effect.move?.hex && place.value === "outdoors") outdoor?.moveTo?.(effect.move.hex);
  if (effect.move?.room) {
    if (place.value !== "indoors") place.value = "indoors";
    indoor?.moveToRoom?.(effect.move.room);
  }
  if (effect.move?.exteriorNode) {
    if (place.value !== "indoors") place.value = "indoors";
    indoor?.moveToExteriorNode?.(effect.move.exteriorNode);
  }
  if (effect.view) openStageView(effect.view, { force: true });
  return { ok: true };
}

export function isCompletionConditionMet(condition, ctx) {
  if (!condition) return false;
  if (Array.isArray(condition.anyOf)) {
    return condition.anyOf.some((candidate) => isCompletionConditionMet(candidate, ctx));
  }
  const families = ["flag", "facility", "location", "holding", "lesson", "milestone"]
    .filter((key) => hasConditionValue(condition[key]));
  if (families.length !== 1) return false;
  if (condition.flag) return hasFlag(ctx.gameState.flags, condition.flag);
  if (condition.facility) return facilityMatches(ctx.gameState.facilities, condition.facility);
  if (condition.location) return locationMatches(ctx, condition.location);
  if (condition.holding) return holdingMatches(ctx.gameState, condition.holding);
  if (condition.lesson) return lessonMatches(ctx.gameState.lessons, condition.lesson);
  if (condition.milestone) return milestoneMatches(ctx.gameState.milestones, condition.milestone);
  return false;
}

function choiceActions(choices = []) {
  return choices.map((choice, index) => ({
    id: `story:${choice.id ?? index}`,
    label: choice.label ?? choice.text,
    choice,
    toHexId: choice.go_hex ?? choice.action?.hex ?? null,
    toRoomId: choice.go_room ?? choice.action?.room ?? null,
    toExteriorNode: choice.go_exterior_node ?? choice.action?.exteriorNode ?? null,
    enterBuilding: choice.enter ?? null,
    view: choice.view ?? null,
    role: "story",
  }));
}

function authoredActions(beat) {
  return (beat.authoredActions ?? []).map((action) => ({
    ...action,
    label: action.label ?? labelForActionId(action.id),
    ...destinationForActionId(action.id),
  }));
}

function mergeStoryActions(actions) {
  const seen = new Set();
  const merged = [];
  for (const action of actions) {
    if (!action?.id || seen.has(action.id)) continue;
    seen.add(action.id);
    merged.push(action);
  }
  return merged;
}

function destinationForActionId(id = "") {
  if (id.startsWith("move-hex:") || id.startsWith("route:") || id.startsWith("barrier:")) {
    return { toHexId: id.slice(id.indexOf(":") + 1) };
  }
  if (id.startsWith("move-room:")) return { toRoomId: id.slice("move-room:".length) };
  if (id.startsWith("move-exterior:")) return { toExteriorNode: id.slice("move-exterior:".length) };
  if (id.startsWith("stage-view:")) {
    const [, kind, viewId] = id.split(":");
    return { view: { kind, id: viewId } };
  }
  return {};
}

function labelForActionId(id = "") {
  if (id.startsWith("move-hex:")) return "Move onward";
  if (id.startsWith("route:")) return "Follow the route";
  if (id.startsWith("move-room:")) return "Move through the building";
  if (id.startsWith("move-exterior:")) return "Move outside";
  if (id.startsWith("stage-view:")) return "Inspect";
  return id;
}

function facilityMatches(facilities, expected) {
  return Object.entries(expected ?? {}).every(([path, value]) => getPath(facilities, path) === value);
}

function locationMatches({ place, outdoor, indoor }, expected) {
  if (expected.place && place.value !== expected.place) return false;
  if (expected.hex && (place.value !== "outdoors" || !locationValueMatches(expected.hex, outdoor.state.currentId))) return false;
  if (expected.room && (place.value !== "indoors" || !locationValueMatches(expected.room, indoor.indoor.currentRoom))) return false;
  if (
    expected.exteriorNode &&
    (place.value !== "indoors" || !locationValueMatches(expected.exteriorNode, indoor.indoor.exteriorNode))
  ) {
    return false;
  }
  return true;
}

function locationValueMatches(expected, actual) {
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

function holdingMatches(gameState, expected) {
  if (!expected.item) return false;
  const holderId = expected.holder || null;
  return itemQuantity(gameState.character?.holdings, expected.item, {
    holderId,
    access: holderId ? "anywhere" : "carried",
  }) > 0;
}

function lessonMatches(lessons, expected) {
  if (!expected.id) return false;
  if (expected.status !== "completed") return false;
  return Boolean(lessons?.[expected.id]?.completedAt);
}

function milestoneMatches(milestones, id) {
  return Boolean(milestones?.[id]);
}

function getPath(source, path) {
  return String(path).split(".").reduce((value, part) => value?.[part], source);
}

function hasConditionValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value != null && value !== "";
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
