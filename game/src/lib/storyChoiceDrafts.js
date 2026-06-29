export function createEmptyChoice({ id = crypto.randomUUID(), order = 0 } = {}) {
  return {
    id,
    order,
    text: "",
    timeMinutes: 0,
    timeUntil: null,
    activity: "light",
    sets: [],
    set_flags: [],
    go_hex: null,
    go_room: null,
    go_exterior_node: null,
    enter: null,
    view: null,
  };
}

export function choiceDestinationType(choice) {
  if (choice.go_hex) return "hex";
  if (choice.go_room) return "room";
  if (choice.go_exterior_node) return "exterior";
  if (choice.enter) return "enter";
  if (choice.view) return "view";
  return "";
}

export function setChoiceDestinationType(choice, type, catalog) {
  choice.go_hex = type === "hex" ? catalog.world.hexes[0]?.id ?? null : null;
  choice.go_room = type === "room" ? catalog.world.rooms[0]?.id ?? null : null;
  choice.go_exterior_node = type === "exterior" ? catalog.world.exteriorNodes[0]?.id ?? null : null;
  choice.enter = type === "enter" ? catalog.world.buildings[0]?.id ?? "building" : null;
  choice.view = type === "view" ? { kind: "inventory" } : null;
}

export function setChoiceViewKind(choice, kind) {
  choice.view = kind === "character-stats"
    ? { kind, focus: "health" }
    : { kind };
}
