export function filterAllowedActions(actions = [], policy, context = {}) {
  return actions.filter((action) => isActionAllowed(action, policy, context));
}

export function actionPromptCategory(action, policy) {
  if (isStoryForwardAction(action, policy)) return "story";
  return "ordinary";
}

export function annotateActionPrompts(actions = [], policy) {
  return actions.map((action) => ({
    ...action,
    promptCategory: actionPromptCategory(action, policy),
  }));
}

export function isStoryForwardAction(action, policy) {
  if (!policy || policy.unrestricted || policy.mode !== "story") return false;
  const actionId = typeof action === "string" ? action : action?.id;
  const allowed = policy.allowed ?? {};
  return actionIdMatchesAllowed(actionId, allowed.storyForwardActions) ||
    actionMatchesMovement(action, allowed.movement);
}

export function isOptionalAction(action, policy) {
  if (!policy || policy.unrestricted || policy.mode !== "story") return false;
  const actionId = typeof action === "string" ? action : action?.id;
  return actionIdMatchesAllowed(actionId, policy.allowed?.optionalActions);
}

export function isActionAllowed(action, policy, context = {}) {
  if (policy?.mustRest) return isRestAction(action, context);
  if (!policy || policy.unrestricted || policy.mode !== "story") return true;
  const actionId = typeof action === "string" ? action : action?.id;
  if (!actionId) return false;
  const allowed = policy.allowed ?? {};
  if (isExplicitlyAllowed(actionId, allowed)) return true;
  if (isStageViewAllowed(policy, action)) return true;

  if (actionId.startsWith("story:")) {
    return listIncludes(allowed.storyChoices, actionId) ||
      isMovementChoice(action) ||
      actionMatchesMovement(action, allowed.movement) ||
      Boolean(action?.enterBuilding);
  }
  if (action?.enterBuilding) return true;
  if (actionId.startsWith("route:") || actionId.startsWith("barrier:") || actionId.startsWith("move-hex:")) return true;
  if (actionId.startsWith("move-room:")) return true;
  if (actionId.startsWith("move-exterior:")) return true;
  if (actionId.startsWith("move-stand:")) return true;
  if (actionId.startsWith("exit-world:")) return true;
  if (actionId.startsWith("door-") || actionId.startsWith("switch:")) return true;
  if (actionId.startsWith("action:")) {
    const raw = actionId.slice("action:".length);
    return listIncludes(allowed.indoorActions, raw) || listIncludes(allowed.indoorActions, actionId);
  }
  if (actionId.startsWith("pickup:")) {
    const raw = actionId.slice("pickup:".length);
    return listIncludes(allowed.indoorActions, raw) || listIncludes(allowed.indoorActions, actionId);
  }
  if (actionId.startsWith("holding-pickup:")) return listIncludes(allowed.indoorActions, actionId);
  if (actionId.startsWith("item-action:")) {
    const raw = actionId.slice("item-action:".length);
    return listIncludes(allowed.itemActions, raw) || listIncludes(allowed.itemActions, actionId);
  }
  if (context.itemId && context.actionId) return itemActionAllowed(allowed, context.itemId, context.actionId);
  if (
    actionId === "search:barrier" ||
    actionId.startsWith("passage:") ||
    actionId.startsWith("passage-unlock:") ||
    actionId.startsWith("passage-toggle:")
  ) {
    return false;
  }
  if (actionId.includes(":")) {
    return listIncludes(allowed.indoorActions, actionId) ||
      listIncludes(allowed.outdoorActions, actionId) ||
      listIncludes(allowed.developerActions, actionId);
  }
  return false;
}

export function isDestinationAllowed(policy, destination) {
  if (!policy || policy.unrestricted || policy.mode !== "story") return true;
  void destination;
  return true;
}

export function isStageViewAllowed(policy, viewOrAction) {
  if (!policy || policy.unrestricted || policy.mode !== "story") return true;
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

function isMovementChoice(action) {
  if (!action || typeof action === "string") return false;
  return Boolean(action.toHexId || action.toRoomId || action.toExteriorNode || action.enterBuilding);
}

function isRestAction(action, context = {}) {
  const actionId = typeof action === "string" ? action : action?.id;
  const label = typeof action === "string" ? "" : action?.label;
  const haystack = `${actionId ?? ""} ${label ?? ""} ${context.actionId ?? ""}`.toLowerCase();
  return haystack.includes("rest") || haystack.includes("sleep");
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
  if (actionId.startsWith("story:")) {
    if (target?.toHexId) return listIncludes(movement.hexes, target.toHexId);
    if (target?.toRoomId) return listIncludes(movement.rooms, target.toRoomId);
    if (target?.toExteriorNode) return listIncludes(movement.exteriorNodes, target.toExteriorNode);
    return false;
  }
  if (actionId.startsWith("route:") || actionId.startsWith("barrier:") || actionId.startsWith("move-hex:")) {
    const hexId = target?.toHexId ?? actionId.slice(actionId.indexOf(":") + 1);
    return listIncludes(movement.hexes, hexId);
  }
  if (actionId.startsWith("move-room:")) return listIncludes(movement.rooms, actionId.slice("move-room:".length));
  if (actionId.startsWith("move-exterior:")) return listIncludes(movement.exteriorNodes, actionId.slice("move-exterior:".length));
  if (actionId.startsWith("exit-world:")) return listIncludes(movement.transitions, actionId.slice("exit-world:".length));
  return false;
}

function listIncludes(list, value) {
  return Array.isArray(list) && list.includes(value);
}
