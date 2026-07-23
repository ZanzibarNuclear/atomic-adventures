import { computed, ref, unref, watch } from "vue";
import { advanceGameTime } from "../lib/character/gameTime.js";
import { hasFlag, setFlags } from "../lib/maps/composables/useFlags.js";

export function useOpenWorldStory(storyData, {
  gameState,
  place,
  outdoor,
  indoor,
  openStageView = () => false,
} = {}) {
  const beats = computed(() => unref(storyData)?.beats ?? {});
  const activeScene = ref(null);
  const activeBeat = computed(() => activeScene.value);

  function locationContext() {
    return {
      place: place.value,
      hex: outdoor.state.currentId,
      originHex: outdoor.state.previousId,
      mapTransition: outdoor.state.mapTransition,
      transitionDirection: outdoor.state.transitionDirection,
      room: indoor.indoor.currentRoom,
      stand: indoor.indoor.currentStand,
      exteriorNode: indoor.indoor.exteriorNode,
    };
  }

  function refreshScene() {
    if (gameState.playMode !== "open-world") {
      activeScene.value = null;
      return;
    }
    const loc = locationContext();
    const selected = selectOpenWorldBeat(beats.value, loc, gameState);
    activeScene.value = selected;
    if (selected?.id) gameState.storySeen = new Set([...(gameState.storySeen ?? []), selected.id]);
  }

  function applyChoice(index = 0) {
    const choice = activeScene.value?.choices?.[Number(index)];
    if (!choice || choice.disabled) return false;
    const duration = Number(choice.timeMinutes) > 0 ? Number(choice.timeMinutes) : 0;
    if (duration > 0 && gameState.clock) {
      const result = advanceGameTime(gameState, duration, choice.activity ?? "light");
      if (!result.ok) return false;
    }
    if (choice.set_flags) setFlags(gameState.flags, choice.set_flags);
    if (choice.view) {
      openStageView(choice.view);
      return true;
    }
    if (choice.go_hex && place.value === "outdoors") {
      if (outdoor.canReachHex?.(choice.go_hex) === false) return false;
      outdoor.moveTo?.(choice.go_hex, { suppressDefaultTime: duration > 0 });
      return true;
    }
    if (choice.enter && place.value === "outdoors") {
      indoor.enterBuilding?.();
      return true;
    }
    if (choice.go_room && place.value === "indoors") {
      indoor.moveToRoom?.(choice.go_room);
      return true;
    }
    if (choice.go_exterior_node && place.value === "indoors") {
      indoor.moveToExteriorNode?.(choice.go_exterior_node);
      return true;
    }
    return true;
  }

  watch(
    () => [
      gameState.playMode,
      place.value,
      outdoor.state.currentId,
      outdoor.state.previousId,
      outdoor.state.mapTransition,
      outdoor.state.transitionDirection,
      indoor.indoor.currentRoom,
      indoor.indoor.currentStand,
      indoor.indoor.exteriorNode,
      [...(gameState.flags ?? [])].join("\0"),
      gameState.clock?.day,
      gameState.clock?.minuteOfDay,
      gameState.clock?.elapsedMinutes,
      beats.value,
    ],
    refreshScene,
    { flush: "post", immediate: true },
  );

  return {
    activeBeat,
    activeScene,
    applyChoice,
    refreshScene,
  };
}

function selectOpenWorldBeat(beats, loc, gameState) {
  let selected = null;
  let selectedScore = -1;
  for (const [id, beat] of Object.entries(beats ?? {})) {
    if (!modeMatches(beat)) continue;
    if (!triggerMatches(beat, loc, gameState)) continue;
    const score = matchScore(beat, loc) + (beat.modes?.includes("open-world") ? 2 : 0);
    if (score <= selectedScore) continue;
    selected = presentBeat(id, beat, gameState);
    selectedScore = score;
  }
  return selected;
}

function modeMatches(beat) {
  const modes = Array.isArray(beat.modes) ? beat.modes : [];
  return !modes.length || modes.includes("open-world");
}

function triggerMatches(beat, loc, gameState) {
  const trigger = beat.trigger ?? {};
  if (trigger.event) return false;
  if (trigger.place && trigger.place !== loc.place) return false;
  if (trigger.hex && (loc.place !== "outdoors" || trigger.hex !== loc.hex)) return false;
  if (trigger.room && (loc.place !== "indoors" || trigger.room !== loc.room)) return false;
  if (trigger.stand) {
    if (loc.place !== "indoors" || trigger.stand !== loc.stand) return false;
  }
  if (trigger.exteriorNode && (loc.place !== "indoors" || trigger.exteriorNode !== loc.exteriorNode)) return false;
  if (trigger.flag && !hasFlag(gameState.flags, trigger.flag)) return false;
  return true;
}

function matchScore(beat, loc) {
  const match = beat.match ?? {};
  let score = 0;
  if (match.originHex) {
    const origins = Array.isArray(match.originHex) ? match.originHex : [match.originHex];
    if (!origins.includes(loc.originHex)) return -1;
    score += 1;
  }
  if (match.mapTransition) {
    if (match.mapTransition !== loc.mapTransition) return -1;
    score += 1;
  }
  if (match.transitionDirection) {
    if (match.transitionDirection !== loc.transitionDirection) return -1;
    score += 1;
  }
  const trigger = beat.trigger ?? {};
  if (trigger.room) score += 1;
  if (trigger.stand) score += 2;
  if (trigger.hex) score += 1;
  if (trigger.exteriorNode) score += 2;
  return score;
}

function presentBeat(id, beat, gameState) {
  const seen = gameState.storySeen?.has(id);
  return {
    id,
    eyebrow: beat.eyebrow,
    heading: beat.heading,
    text: seen && beat.revisit ? beat.revisit : beat.text,
    revisit: seen && Boolean(beat.revisit),
    choices: beat.choices ?? [],
  };
}
