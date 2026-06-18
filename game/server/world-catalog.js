import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, "..", "content", "world");

export function loadWorldCatalog() {
  const map = yaml.load(readFileSync(join(contentDir, "map.yaml"), "utf8"));
  const building = yaml.load(readFileSync(join(contentDir, "utility-station.yaml"), "utf8"));
  return {
    hexes: (map.hexes ?? []).map(({ id, label }) => ({ id, label: label ?? id })),
    rooms: (building.rooms ?? []).map(({ id, label, level }) => ({ id, label: label ?? id, level })),
    exteriorNodes: (building.exterior?.nodes ?? []).map(({ id, label }) => ({ id, label: label ?? id })),
    buildings: [
      { id: "building", label: building.label ?? building.id },
      { id: building.id, label: building.label ?? building.id },
    ],
    hexIds: new Set((map.hexes ?? []).map((item) => item.id)),
    roomIds: new Set((building.rooms ?? []).map((item) => item.id)),
    exteriorNodeIds: new Set((building.exterior?.nodes ?? []).map((item) => item.id)),
    buildingIds: new Set(["building", building.id]),
  };
}

export function publicWorldCatalog(catalog = loadWorldCatalog()) {
  return {
    hexes: catalog.hexes,
    rooms: catalog.rooms,
    exteriorNodes: catalog.exteriorNodes,
    buildings: catalog.buildings,
  };
}
