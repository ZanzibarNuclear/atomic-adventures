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
  const guidance = policy.allowed ?? {};
  return actionIdMatchesAllowed(actionId, guidance.storyForwardActions) ||
    actionMatchesMovement(action, guidance.movement);
}

export function isActionAllowed(action, policy, context = {}) {
  if (policy?.mustRest) return isRestAction(action, context);
  return true;
}

export function isDestinationAllowed(policy, destination) {
  if (!policy || policy.unrestricted || policy.mode !== "story") return true;
  void destination;
  return true;
}

export function isStageViewAllowed(policy, viewOrAction) {
  void policy;
  void viewOrAction;
  return true;
}

function isRestAction(action, context = {}) {
  const actionId = typeof action === "string" ? action : action?.id;
  const label = typeof action === "string" ? "" : action?.label;
  const haystack = `${actionId ?? ""} ${label ?? ""} ${context.actionId ?? ""}`.toLowerCase();
  return haystack.includes("rest") || haystack.includes("sleep");
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
