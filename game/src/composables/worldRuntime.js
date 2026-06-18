export function applyOutdoorWorldUpdate(outdoor, next) {
  const previousHex = outdoor.state.currentId;
  const nextHexIds = new Set((next.hexes ?? []).map((hex) => hex.id));
  const nextOpeningIds = new Set((next.features ?? []).map((feature) => feature.id));
  outdoor.syncFromMapData(next);

  const current = nextHexIds.has(previousHex) ? previousHex : next.start;
  outdoor.state.currentId = current;
  outdoor.state.discovered = outdoor.state.discovered.filter((id) => nextHexIds.has(id));
  if (current && !outdoor.state.discovered.includes(current)) {
    outdoor.state.discovered.push(current);
  }
  outdoor.state.discoveredOpenings = outdoor.state.discoveredOpenings.filter((id) =>
    nextOpeningIds.has(id),
  );
  outdoor.state.stand = outdoor.defaultStandForHex(current);
  outdoor.state.lastBlocked = null;
  outdoor.state.atBarrier = null;
  return current;
}
