export function buildWorldCatalog(map, building) {
  map ??= {};
  building ??= {};
  // localExits is retained as a public alias for older story-builder clients.
  const localExits = building.exits ?? building.transitions ?? [];
  const mapTransitions = localExits.map(({ id, label }) => ({ id, label: label ?? id }));
  return {
    hexes: (map.hexes ?? []).map(({ id, label }) => ({ id, label: label ?? id })),
    rooms: (building.rooms ?? []).map(({ id, label, level }) => ({ id, label: label ?? id, level })),
    exteriorNodes: (building.exterior?.nodes ?? []).map(({ id, label }) => ({ id, label: label ?? id })),
    localExits: mapTransitions,
    mapTransitions,
    buildings: [
      { id: "building", label: building.label ?? building.id },
      { id: building.id, label: building.label ?? building.id },
    ],
    hexIds: new Set((map.hexes ?? []).map((item) => item.id)),
    roomIds: new Set((building.rooms ?? []).map((item) => item.id)),
    exteriorNodeIds: new Set((building.exterior?.nodes ?? []).map((item) => item.id)),
    localExitIds: new Set(localExits.map((item) => item.id)),
    buildingIds: new Set(["building", building.id]),
  };
}

export function publicWorldCatalog(catalog) {
  return {
    hexes: catalog.hexes,
    rooms: catalog.rooms,
    exteriorNodes: catalog.exteriorNodes,
    localExits: catalog.localExits,
    mapTransitions: catalog.mapTransitions,
    buildings: catalog.buildings,
  };
}
