import { computed, watch } from "vue";
import { advanceGameTime } from "../lib/character/gameTime.js";
import { applyEffectsAtomically } from "../lib/character/effects.js";
import { itemQuantity } from "../lib/character/holdings.js";
import { hasFlag, setFlags } from "../lib/maps/composables/useFlags.js";

const MAX_ADVANCES_PER_TICK = 10;

export function useStoryline(storylineData, {
  gameState,
  place,
  outdoor,
  indoor,
  openStageView = () => false,
} = {}) {
  const scenarios = computed(() => storylineData.value?.scenarios ?? []);
  const activeScenario = computed(() => {
    if (gameState.playMode !== "storyline") return null;
    return scenarios.value.find((scenario) => scenario.id === gameState.storyline?.scenarioId)
      ?? scenarios.value.find((scenario) => scenario.defaultMode === "storyline")
      ?? scenarios.value[0]
      ?? null;
  });
  const activeStep = computed(() => {
    const scenario = activeScenario.value;
    if (!scenario) return null;
    const stepId = gameState.storyline?.stepId;
    if (!stepId) return null;
    return scenario.steps?.find((step) => step.id === stepId) ?? null;
  });
  const currentObjective = computed(() => {
    if (gameState.playMode !== "storyline") return "";
    return activeStep.value?.objective ?? gameState.storyline?.objective ?? "";
  });
  const authoringError = computed(() => {
    if (gameState.playMode !== "storyline") return "";
    if (!activeScenario.value) return "Storyline mode has no active scenario.";
    if (!gameState.storyline?.stepId) return "";
    if (!activeStep.value) return `Storyline step "${gameState.storyline?.stepId ?? activeScenario.value.startStep}" was not found.`;
    return "";
  });
  const actionPolicy = computed(() => ({
    mode: gameState.playMode === "storyline" ? "storyline" : "open-world",
    stepId: activeStep.value?.id ?? null,
    allowed: activeStep.value?.allowed ?? null,
    unrestricted: gameState.playMode !== "storyline" || !activeStep.value,
  }));

  function ensureStarted() {
    if (gameState.playMode !== "storyline") return;
    const scenario = activeScenario.value;
    if (!scenario) return;
    if (gameState.storyline?.scenarioId !== scenario.id || !gameState.storyline) {
      const step = scenario.steps?.find((candidate) => candidate.id === scenario.startStep) ?? null;
      gameState.storyline = {
        scenarioId: scenario.id,
        stepId: scenario.startStep ?? null,
        completedStepIds: [...(gameState.storyline?.completedStepIds ?? [])],
        enteredStepIds: [...(gameState.storyline?.enteredStepIds ?? [])],
        objective: step?.objective ?? null,
      };
    }
  }

  function tick() {
    if (gameState.playMode !== "storyline") return;
    ensureStarted();
    if (authoringError.value) return;

    let advances = 0;
    while (advances < MAX_ADVANCES_PER_TICK) {
      const step = activeStep.value;
      const scenario = activeScenario.value;
      if (!step || !scenario) return;
      if (!applyEnterEffects(step)) return;
      gameState.storyline.objective = step.objective;
      if (!isStepComplete(step, { gameState, place, outdoor, indoor })) return;
      completeStep(scenario, step);
      advances += 1;
    }
  }

  function applyEnterEffects(step) {
    const entered = new Set(gameState.storyline?.enteredStepIds ?? []);
    if (entered.has(step.id)) return true;
    const result = applyStepEffect(step.onEnter);
    if (!result.ok) return false;
    entered.add(step.id);
    gameState.storyline.enteredStepIds = [...entered];
    return true;
  }

  function completeStep(scenario, step) {
    const completed = new Set(gameState.storyline?.completedStepIds ?? []);
    if (!completed.has(step.id)) {
      const result = applyStepEffect(step.onComplete);
      if (!result.ok) return;
      completed.add(step.id);
      gameState.storyline.completedStepIds = [...completed];
    }
    const nextStep = step.next
      ? scenario.steps?.find((candidate) => candidate.id === step.next) ?? null
      : null;
    gameState.storyline.stepId = nextStep?.id ?? null;
    gameState.storyline.objective = nextStep?.objective ?? null;
  }

  function applyStepEffect(effect) {
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
    if (effect.move) applyMove(effect.move);
    if (effect.view) openStageView(effect.view);
    return { ok: true };
  }

  function applyMove(move) {
    if (move.hex && place.value === "outdoors") {
      outdoor.moveTo?.(move.hex);
      return;
    }
    if (move.room) {
      if (place.value !== "indoors") place.value = "indoors";
      indoor.moveToRoom?.(move.room);
      return;
    }
    if (move.exteriorNode) {
      if (place.value !== "indoors") place.value = "indoors";
      indoor.moveToExteriorNode?.(move.exteriorNode);
    }
  }

  watch(
    () => [
      gameState.playMode,
      gameState.storyline?.scenarioId,
      gameState.storyline?.stepId,
      scenarios.value,
      place.value,
      outdoor?.state?.currentId,
      indoor?.indoor?.currentRoom,
      indoor?.indoor?.exteriorNode,
      [...(gameState.flags ?? [])].join("\0"),
      JSON.stringify(gameState.facilities ?? {}),
      JSON.stringify(gameState.lessons ?? {}),
      gameState.character?.revision ?? 0,
    ],
    tick,
    { flush: "post", immediate: true },
  );

  return {
    activeScenario,
    activeStep,
    currentObjective,
    authoringError,
    actionPolicy,
    tick,
    isStepComplete: (step = activeStep.value) =>
      step ? isStepComplete(step, { gameState, place, outdoor, indoor }) : false,
  };
}

export function isStepComplete(step, ctx) {
  const predicate = step?.completesWhen;
  if (!predicate) return false;
  const families = ["flag", "facility", "location", "holding", "lesson"]
    .filter((key) => hasPredicateValue(predicate[key]));
  if (families.length !== 1) return false;
  if (predicate.flag) return hasFlag(ctx.gameState.flags, predicate.flag);
  if (predicate.facility) return facilityMatches(ctx.gameState.facilities, predicate.facility);
  if (predicate.location) return locationMatches(ctx, predicate.location);
  if (predicate.holding) return holdingMatches(ctx.gameState, predicate.holding);
  if (predicate.lesson) return lessonMatches(ctx.gameState.lessons, predicate.lesson);
  return false;
}

function facilityMatches(facilities, expected) {
  return Object.entries(expected ?? {}).every(([path, value]) => getPath(facilities, path) === value);
}

function locationMatches({ place, outdoor, indoor }, expected) {
  if (expected.place && place.value !== expected.place) return false;
  if (expected.hex && (place.value !== "outdoors" || outdoor.state.currentId !== expected.hex)) return false;
  if (expected.room && (place.value !== "indoors" || indoor.indoor.currentRoom !== expected.room)) return false;
  if (
    expected.exteriorNode &&
    (place.value !== "indoors" || indoor.indoor.exteriorNode !== expected.exteriorNode)
  ) {
    return false;
  }
  return true;
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

function getPath(source, path) {
  return String(path).split(".").reduce((value, part) => value?.[part], source);
}

function hasPredicateValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value != null && value !== "";
}
