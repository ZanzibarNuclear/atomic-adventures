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
    const nextScenario = step.nextScenario
      ? scenarios.value.find((candidate) => candidate.id === step.nextScenario) ?? null
      : null;
    const nextStep = nextScenario
      ? nextScenario.steps?.find((candidate) => candidate.id === nextScenario.startStep) ?? null
      : step.next
        ? scenario.steps?.find((candidate) => candidate.id === step.next) ?? null
        : null;
    if (nextScenario) gameState.storyline.scenarioId = nextScenario.id;
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
    if (effect.view) openStageView(effect.view, { force: true });
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

export function filterAllowedActions(actions = [], policy, context = {}) {
  return actions.filter((action) => isActionAllowed(action, policy, context));
}

export function actionPromptCategory(action, policy) {
  if (!policy || policy.unrestricted || policy.mode !== "storyline") return "ordinary";
  if (isStoryForwardAction(action, policy)) return "story-forward";
  if (isOptionalAction(action, policy)) return "optional";
  return "ordinary";
}

export function annotateActionPrompts(actions = [], policy) {
  return actions.map((action) => ({
    ...action,
    promptCategory: actionPromptCategory(action, policy),
  }));
}

export function isStoryForwardAction(action, policy) {
  if (!policy || policy.unrestricted || policy.mode !== "storyline") return false;
  const actionId = typeof action === "string" ? action : action?.id;
  const allowed = policy.allowed ?? {};
  return actionIdMatchesAllowed(actionId, allowed.storyForwardActions) ||
    actionMatchesMovement(action, allowed.movement);
}

export function isOptionalAction(action, policy) {
  if (!policy || policy.unrestricted || policy.mode !== "storyline") return false;
  const actionId = typeof action === "string" ? action : action?.id;
  return actionIdMatchesAllowed(actionId, policy.allowed?.optionalActions);
}

export function isActionAllowed(action, policy, context = {}) {
  if (!policy || policy.unrestricted || policy.mode !== "storyline") return true;
  const actionId = typeof action === "string" ? action : action?.id;
  if (!actionId) return false;
  const allowed = policy.allowed ?? {};
  if (isExplicitlyAllowed(actionId, allowed)) return true;
  if (isStageViewAllowed(policy, action)) return true;

  if (actionId.startsWith("story:")) return listIncludes(allowed.storyChoices, actionId);
  if (actionId.startsWith("route:") || actionId.startsWith("barrier:") || actionId.startsWith("move-hex:")) {
    return true;
  }
  if (actionId.startsWith("move-room:")) {
    return true;
  }
  if (actionId.startsWith("move-exterior:")) {
    return true;
  }
  if (actionId.startsWith("move-stand:")) {
    return true;
  }
  if (actionId.startsWith("action:")) {
    const raw = actionId.slice("action:".length);
    return listIncludes(allowed.indoorActions, raw) || listIncludes(allowed.indoorActions, actionId);
  }
  if (actionId.startsWith("pickup:")) {
    const raw = actionId.slice("pickup:".length);
    return listIncludes(allowed.indoorActions, raw) || listIncludes(allowed.indoorActions, actionId);
  }
  if (actionId.startsWith("holding-pickup:")) {
    return listIncludes(allowed.indoorActions, actionId);
  }
  if (actionId.startsWith("item-action:")) {
    const raw = actionId.slice("item-action:".length);
    return listIncludes(allowed.itemActions, raw) || listIncludes(allowed.itemActions, actionId);
  }
  if (context.itemId && context.actionId) {
    return itemActionAllowed(allowed, context.itemId, context.actionId);
  }
  if (actionId.startsWith("door-") || actionId.startsWith("switch:") || actionId.startsWith("exit-world:")) {
    return listIncludes(allowed.indoorActions, actionId);
  }
  if (
    actionId === "search:barrier" ||
    actionId.startsWith("passage:") ||
    actionId.startsWith("passage-unlock:") ||
    actionId.startsWith("passage-toggle:")
  ) {
    return listIncludes(allowed.outdoorActions, actionId);
  }
  if (actionId.includes(":")) {
    return listIncludes(allowed.indoorActions, actionId) ||
      listIncludes(allowed.outdoorActions, actionId) ||
      listIncludes(allowed.developerActions, actionId);
  }
  void context;
  return false;
}

export function isDestinationAllowed(policy, destination) {
  if (!policy || policy.unrestricted || policy.mode !== "storyline") return true;
  void destination;
  return true;
}

export function isStageViewAllowed(policy, viewOrAction) {
  if (!policy || policy.unrestricted || policy.mode !== "storyline") return true;
  const allowed = policy.allowed ?? {};
  const view = stageViewFor(viewOrAction);
  if (!view?.kind) return false;
  return (allowed.stageViews ?? []).some((candidate) => {
    if (candidate.kind !== view.kind) return false;
    if (candidate.id && candidate.id !== view.id) return false;
    if (candidate.focus && candidate.focus !== view.focus) return false;
    if (candidate.tab && candidate.tab !== view.tab) return false;
    return true;
  });
}

function stageViewFor(viewOrAction) {
  if (!viewOrAction) return null;
  if (viewOrAction.kind) return viewOrAction;
  if (viewOrAction.id === "hydro-console:open") return { kind: "console", id: "hydro" };
  if (viewOrAction.id === "holo-reader:open" || viewOrAction.id === "holo-reader:library") return { kind: "lesson" };
  return null;
}

function isExplicitlyAllowed(actionId, allowed) {
  return listIncludes(allowed.indoorActions, actionId) ||
    listIncludes(allowed.outdoorActions, actionId) ||
    listIncludes(allowed.storyChoices, actionId) ||
    listIncludes(allowed.itemActions, actionId) ||
    listIncludes(allowed.developerActions, actionId) ||
    actionIdMatchesAllowed(actionId, allowed.storyForwardActions) ||
    actionIdMatchesAllowed(actionId, allowed.optionalActions);
}

function itemActionAllowed(allowed, itemId, actionId) {
  return listIncludes(allowed.itemActions, `${itemId}.${actionId}`) ||
    listIncludes(allowed.itemActions, `item-action:${itemId}.${actionId}`) ||
    listIncludes(allowed.itemActions, actionId);
}

function listIncludes(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function actionIdMatchesAllowed(actionId, allowedIds = []) {
  if (!actionId || !Array.isArray(allowedIds)) return false;
  if (allowedIds.includes(actionId)) return true;
  if (actionId.startsWith("action:") && allowedIds.includes(actionId.slice("action:".length))) return true;
  if (actionId.startsWith("item-action:") && allowedIds.includes(actionId.slice("item-action:".length))) return true;
  return false;
}

function actionMatchesMovement(action, movement = {}) {
  if (!movement) return false;
  const actionId = typeof action === "string" ? action : action?.id;
  if (!actionId) return false;
  const target = typeof action === "string" ? null : action;
  if (actionId.startsWith("story:") && target?.toHexId) return listIncludes(movement.hexes, target.toHexId);
  if (actionId.startsWith("route:") || actionId.startsWith("barrier:") || actionId.startsWith("move-hex:")) {
    const hexId = target?.toHexId ?? actionId.slice(actionId.indexOf(":") + 1);
    return listIncludes(movement.hexes, hexId);
  }
  if (actionId.startsWith("move-room:")) {
    return listIncludes(movement.rooms, actionId.slice("move-room:".length));
  }
  if (actionId.startsWith("move-exterior:")) {
    return listIncludes(movement.exteriorNodes, actionId.slice("move-exterior:".length));
  }
  if (actionId.startsWith("exit-world:")) {
    return listIncludes(movement.transitions, actionId.slice("exit-world:".length));
  }
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
