const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBuilding(input = {}) {
  const building = structuredClone(input && typeof input === "object" ? input : {});
  building.id = text(building.id);
  building.label = text(building.label) || building.id;
  building.cell = finiteNumber(building.cell, 64);
  building.gridFeet = finiteNumber(building.gridFeet, 10);
  building.unitFeet = finiteNumber(building.unitFeet, building.gridFeet);
  building.start = nullableText(building.start);
  building.outdoorHex = nullableText(building.outdoorHex);
  building.levels = array(building.levels);
  building.rooms = array(building.rooms);
  building.links = array(building.links);
  building.items = array(building.items);
  building.pickups = array(building.pickups);
  building.switches = array(building.switches);
  building.actions = array(building.actions);
  building.doors = array(building.doors);
  building.fixtures = array(building.fixtures);
  building.transitions = array(building.transitions ?? building.exits);
  building.holders = array(building.holders).map((holder) => ({
    ...holder,
    id: text(holder.id),
    kind: text(holder.kind),
    label: text(holder.label) || text(holder.id),
  }));
  delete building.exits;
  if (building.exterior) {
    building.exterior.nodes = array(building.exterior.nodes);
    building.exterior.paths = array(building.exterior.paths);
  }
  return building;
}

export function validateBuilding(input, {
  outdoorHexIds = new Set(),
  characterItemIds = new Set(),
  character = null,
} = {}) {
  const building = normalizeBuilding(input);
  const errors = {};
  const warnings = [];
  const add = (path, message) => ((errors[path] ??= []).push(message));
  const warn = (path, message) => warnings.push({ path, message });

  if (!ID_PATTERN.test(building.id)) add("id", "Use a kebab-case building ID.");
  if (!(building.cell > 0)) add("cell", "Cell size must be greater than zero.");
  if (!(building.gridFeet > 0)) add("gridFeet", "Grid spacing must be greater than zero.");
  if (!(building.unitFeet > 0)) add("unitFeet", "Layout unit size must be greater than zero.");

  const levelIds = validateIds(building.levels, "levels", errors);
  building.levels.forEach((level, index) => {
    level.order = finiteNumber(level.order, index);
  });

  const roomIds = validateIds(building.rooms, "rooms", errors);
  building.rooms.forEach((room, index) => {
    const base = `rooms.${index}`;
    const levels = room.levels ?? (room.level ? [room.level] : []);
    if (!levels.length) add(`${base}.level`, "Rooms must belong to at least one level.");
    levels.forEach((level) => {
      if (!levelIds.has(level)) add(`${base}.level`, `Unknown level "${level}".`);
    });
    if (!room.feature) {
      for (const field of ["x", "y", "w", "h"]) {
        room[field] = finiteNumber(room[field], field === "w" || field === "h" ? 1 : NaN);
        if (!Number.isFinite(room[field])) add(`${base}.${field}`, "Use a numeric layout value.");
      }
      if (!(room.w > 0)) add(`${base}.w`, "Room width must be greater than zero.");
      if (!(room.h > 0)) add(`${base}.h`, "Room height must be greater than zero.");
    }
    if (room.mirror && !roomIds.has(room.mirror)) add(`${base}.mirror`, "Mirror must reference an existing room.");
    const standIds = validateIds(room.stands ?? [], `${base}.stands`, errors);
    for (const [standIndex, stand] of (room.stands ?? []).entries()) {
      const standBase = `${base}.stands.${standIndex}`;
      if (!validPoint(stand.at)) add(`${standBase}.at`, "Room stands require numeric x/y coordinates.");
      if (
        validPoint(stand.at) &&
        !room.feature &&
        (
          stand.at.x < room.x ||
          stand.at.x > room.x + room.w ||
          stand.at.y < room.y ||
          stand.at.y > room.y + room.h
        )
      ) {
        add(`${standBase}.at`, "Room stands must lie inside their room rectangle.");
      }
      if (stand.pose != null) stand.pose = text(stand.pose);
      if (stand.interaction != null) stand.interaction = text(stand.interaction);
    }
    if (room.defaultStand && !standIds.has(room.defaultStand)) {
      add(`${base}.defaultStand`, "Default stand must reference an authored stand in this room.");
    }
  });

  const holderIds = new Set();
  building.holders.forEach((holder, index) => {
    const base = `holders.${index}`;
    if (!/^(vehicle|fixed):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(holder.id)) {
      add(`${base}.id`, "Holder IDs must use vehicle:<id> or fixed:<id>.");
    }
    if (holderIds.has(holder.id)) add(`${base}.id`, "Holder IDs must be unique.");
    holderIds.add(holder.id);
    if (!["vehicle", "fixed"].includes(holder.kind)) {
      add(`${base}.kind`, "World holders must be vehicle or fixed.");
    }
    if (holder.location?.room && !roomIds.has(holder.location.room)) {
      add(`${base}.location.room`, "Holder room must reference an existing room.");
    }
    if (
      holder.capacity?.slots != null &&
      (!Number.isInteger(Number(holder.capacity.slots)) || Number(holder.capacity.slots) < 1)
    ) {
      add(`${base}.capacity.slots`, "Slot capacity must be a positive integer.");
    }
    if (
      holder.capacity?.massKg != null &&
      (!Number.isFinite(Number(holder.capacity.massKg)) || Number(holder.capacity.massKg) <= 0)
    ) {
      add(`${base}.capacity.massKg`, "Mass capacity must be positive.");
    }
  });

  if (!building.start || !roomIds.has(building.start)) add("start", "Choose an existing start room.");

  const doorIds = validateIds(building.doors, "doors", errors);
  building.doors.forEach((door, index) => {
    const base = `doors.${index}`;
    if (!["man", "roll"].includes(door.kind)) add(`${base}.kind`, "Door kind must be man or roll.");
    const levels = door.onLevels ?? (door.level ? [door.level] : []);
    levels.forEach((level) => {
      if (!levelIds.has(level)) add(`${base}.level`, `Unknown level "${level}".`);
    });
    if (door.kind === "roll") {
      if (!roomIds.has(door.room)) add(`${base}.room`, "Roll-up doors require an existing room.");
    } else if (!validPoint(door.at)) {
      add(`${base}.at`, "Man doors require numeric x/y coordinates.");
    }
    const knownItemIds = new Set([
      ...building.items.map((item) => item.id),
      ...characterItemIds,
    ]);
    if (door.lock?.key && !knownItemIds.has(door.lock.key)) {
      add(`${base}.lock.key`, "Door key must reference an existing item.");
    }
    if (door.lock?.freeFrom && !roomIds.has(door.lock.freeFrom)) {
      add(`${base}.lock.freeFrom`, "Free side must reference an existing room.");
    }
  });

  building.links.forEach((link, index) => {
    const base = `links.${index}`;
    if (!roomIds.has(link.from)) add(`${base}.from`, "Link source must reference an existing room.");
    if (!roomIds.has(link.to)) add(`${base}.to`, "Link destination must reference an existing room.");
    if (!["open", "door", "stairs", "winding-stairs"].includes(link.kind)) {
      add(`${base}.kind`, "Choose a supported link kind.");
    }
    if (link.kind === "door" && !doorIds.has(link.door)) {
      add(`${base}.door`, "Door links must reference an existing door.");
    }
  });

  const itemIds = new Set([
    ...validateIds(building.items, "items", errors),
    ...characterItemIds,
  ]);
  validateIds(building.pickups, "pickups", errors);
  building.pickups.forEach((pickup, index) => {
    if (!roomIds.has(pickup.room)) add(`pickups.${index}.room`, "Pickup room must exist.");
    if (!itemIds.has(pickup.item)) add(`pickups.${index}.item`, "Pickup item must exist.");
  });

  validateIds(building.switches, "switches", errors);
  building.switches.forEach((item, index) => {
    if (!roomIds.has(item.room)) add(`switches.${index}.room`, "Switch room must exist.");
    if (!doorIds.has(item.door)) add(`switches.${index}.door`, "Switch door must exist.");
  });

  validateIds(building.actions, "actions", errors);
  const exteriorNodes = building.exterior?.nodes ?? [];
  const nodeIds = validateIds(exteriorNodes, "exterior.nodes", errors);
  exteriorNodes.forEach((node, index) => {
    const base = `exterior.nodes.${index}`;
    if (!validPoint(node.at)) add(`${base}.at`, "Exterior nodes require numeric x/y coordinates.");
    if (node.room && !roomIds.has(node.room)) add(`${base}.room`, "Exterior node room must exist.");
    if (node.door && !doorIds.has(node.door)) add(`${base}.door`, "Exterior node door must exist.");
  });
  if (building.exterior) {
    if (!levelIds.has(building.exterior.level)) add("exterior.level", "Exterior level must exist.");
    if (!nodeIds.has(building.exterior.entry)) add("exterior.entry", "Exterior entry node must exist.");
  }

  validateIds(building.exterior?.paths ?? [], "exterior.paths", errors);
  for (const [index, path] of (building.exterior?.paths ?? []).entries()) {
    const base = `exterior.paths.${index}`;
    if ((path.points ?? []).length < 2) add(`${base}.points`, "Exterior paths require at least two points.");
    (path.points ?? []).forEach((point, pointIndex) => {
      if (!validPoint(point)) add(`${base}.points.${pointIndex}`, "Use numeric x/y coordinates.");
    });
    if ((path.nodes ?? []).length < 2) warn(`${base}.nodes`, "A path with fewer than two nodes does not connect travel.");
    (path.nodes ?? []).forEach((nodeId, nodeIndex) => {
      if (!nodeIds.has(nodeId)) add(`${base}.nodes.${nodeIndex}`, `Unknown exterior node "${nodeId}".`);
    });
  }

  validateIds(building.transitions, "transitions", errors);
  building.transitions.forEach((transition, index) => {
    const base = `transitions.${index}`;
    if (!validPoint(transition.at ?? transition.mapAt)) add(`${base}.at`, "Transitions require numeric map coordinates.");
    if (transition.exteriorNode && !nodeIds.has(transition.exteriorNode)) {
      add(`${base}.exteriorNode`, "Transition exterior node must exist.");
    }
    if (transition.room && !roomIds.has(transition.room)) add(`${base}.room`, "Transition room must exist.");
    if (transition.door && !doorIds.has(transition.door)) add(`${base}.door`, "Transition door must exist.");
    if (transition.hex && outdoorHexIds.size && !outdoorHexIds.has(transition.hex)) {
      add(`${base}.hex`, "Transition hex must exist in the outdoor world.");
    }
  });

  validateIds(building.fixtures, "fixtures", errors);
  building.fixtures.forEach((fixture, index) => {
    const base = `fixtures.${index}`;
    (fixture.onLevels ?? []).forEach((level) => {
      if (!levelIds.has(level)) add(`${base}.onLevels`, `Unknown level "${level}".`);
    });
    (fixture.connects ?? []).forEach((roomId) => {
      if (!roomIds.has(roomId)) add(`${base}.connects`, `Unknown room "${roomId}".`);
    });
  });

  building.actions.forEach((action, index) => {
    if (action.room && !roomIds.has(action.room)) add(`actions.${index}.room`, "Action room must exist.");
    if (action.exteriorNode && !nodeIds.has(action.exteriorNode)) {
      add(`actions.${index}.exteriorNode`, "Action exterior node must exist.");
    }
    if (action.timeMinutes != null && (!Number.isFinite(Number(action.timeMinutes)) || Number(action.timeMinutes) < 0)) {
      add(`actions.${index}.timeMinutes`, "Action time must be a non-negative number.");
    }
    if (
      action.activity != null &&
      !["resting", "light", "moderate", "strenuous"].includes(action.activity)
    ) {
      add(`actions.${index}.activity`, "Choose a supported activity profile.");
    }
    validateActionCharacterReferences(action, index, character, add);
  });

  validateTraversalConnectivity(building, roomIds, nodeIds, add);

  return {
    building,
    errors,
    warnings,
    valid: Object.keys(errors).length === 0,
  };
}

function validateActionCharacterReferences(action, index, character, add) {
  if (!character) return;
  const catalogs = Object.fromEntries(
    ["items", "stats", "knowledge", "skills", "quests", "documents"]
      .map((key) => [key, new Set((character[key] ?? []).map((entry) => entry.id))]),
  );
  for (const domain of ["items", "knowledge", "documents"]) {
    const value = action.require?.[domain];
    const groups = Array.isArray(value) ? { all: value } : value ?? {};
    for (const group of ["all", "any", "not"]) {
      (groups[group] ?? []).forEach((entry, entryIndex) => {
        const id = typeof entry === "string" ? entry : entry?.id;
        if (!catalogs[domain].has(id)) {
          add(`actions.${index}.require.${domain}.${group}.${entryIndex}`, `Unknown ${domain.slice(0, -1)} "${id}".`);
        }
      });
    }
  }
  for (const domain of ["stats", "skills", "quests"]) {
    (action.require?.[domain] ?? []).forEach((entry, entryIndex) => {
      if (!catalogs[domain].has(entry?.id)) {
        add(`actions.${index}.require.${domain}.${entryIndex}.id`, `Unknown ${domain.slice(0, -1)} "${entry?.id}".`);
      }
    });
  }
  (action.effects ?? []).forEach((effect, effectIndex) => {
    const rawDomain = String(effect.op ?? "").split(".")[0];
    if (rawDomain === "flag") return;
    const domain = rawDomain === "item" ? "items"
      : rawDomain === "stat" ? "stats"
        : rawDomain === "skill" ? "skills"
          : rawDomain === "quest" ? "quests"
            : rawDomain === "document" ? "documents"
              : rawDomain;
    if (!catalogs[domain]?.has(effect.id)) {
      add(`actions.${index}.effects.${effectIndex}.id`, `Unknown ${rawDomain} "${effect.id}".`);
    }
    if (effect.op === "skill.add-evidence") {
      const skill = (character.skills ?? []).find((entry) => entry.id === effect.id);
      if (!skill?.practice?.evidence?.some((entry) => entry.id === effect.evidence)) {
        add(
          `actions.${index}.effects.${effectIndex}.evidence`,
          `Unknown evidence "${effect.evidence}" for skill "${effect.id}".`,
        );
      }
      if (effect.once === true && !String(effect.event ?? "").trim()) {
        add(
          `actions.${index}.effects.${effectIndex}.event`,
          "One-time evidence requires an event ID.",
        );
      }
      if (!Number.isFinite(Number(effect.value ?? 1)) || Number(effect.value ?? 1) <= 0) {
        add(
          `actions.${index}.effects.${effectIndex}.value`,
          "Evidence value must be a positive number.",
        );
      }
    }
    if (["quest.advance-objective", "quest.complete-objective"].includes(effect.op)) {
      const quest = (character.quests ?? []).find((entry) => entry.id === effect.id);
      if (!quest?.objectives?.some((entry) => entry.id === effect.objective)) {
        add(
          `actions.${index}.effects.${effectIndex}.objective`,
          `Unknown objective "${effect.objective}" for quest "${effect.id}".`,
        );
      }
      if (
        effect.op === "quest.advance-objective" &&
        (!Number.isFinite(Number(effect.value ?? 1)) || Number(effect.value ?? 1) <= 0)
      ) {
        add(
          `actions.${index}.effects.${effectIndex}.value`,
          "Objective progress must be a positive number.",
        );
      }
    }
  });
}

function validateTraversalConnectivity(building, roomIds, nodeIds, add) {
  if (building.start && roomIds.has(building.start)) {
    const adjacent = Object.fromEntries([...roomIds].map((id) => [id, []]));
    for (const link of building.links ?? []) {
      if (!roomIds.has(link.from) || !roomIds.has(link.to)) continue;
      adjacent[link.from].push(link.to);
      adjacent[link.to].push(link.from);
    }
    const reachable = traverse(adjacent, building.start);
    building.rooms.forEach((room, index) => {
      if (!room.open && !reachable.has(room.id)) {
        add(`rooms.${index}.connectivity`, "Room must be reachable from the building start when doors are open.");
      }
    });
  }

  const entry = building.exterior?.entry;
  if (entry && nodeIds.has(entry)) {
    const adjacent = Object.fromEntries([...nodeIds].map((id) => [id, []]));
    for (const path of building.exterior?.paths ?? []) {
      const nodes = (path.nodes ?? []).filter((id) => nodeIds.has(id));
      for (let index = 0; index < nodes.length - 1; index += 1) {
        adjacent[nodes[index]].push(nodes[index + 1]);
        adjacent[nodes[index + 1]].push(nodes[index]);
      }
    }
    const reachable = traverse(adjacent, entry);
    building.exterior.nodes.forEach((node, index) => {
      if (!reachable.has(node.id)) {
        add(
          `exterior.nodes.${index}.connectivity`,
          "Exterior node must connect to the exterior entry through authored paths.",
        );
      }
    });
  }
}

function traverse(adjacent, start) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacent[current] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

export function changedBuildingObjectIds(before, after) {
  const identify = (building) => new Map([
    ...(building.rooms ?? []).map((item) => [`room:${item.id}`, JSON.stringify(item)]),
    ...(building.doors ?? []).map((item) => [`door:${item.id}`, JSON.stringify(item)]),
    ...(building.exterior?.paths ?? []).map((item) => [`path:${item.id}`, JSON.stringify(item)]),
    ...(building.exterior?.nodes ?? []).map((item) => [`node:${item.id}`, JSON.stringify(item)]),
    ...(building.transitions ?? []).map((item) => [`transition:${item.id}`, JSON.stringify(item)]),
    ...(building.fixtures ?? []).map((item) => [`fixture:${item.id}`, JSON.stringify(item)]),
  ]);
  const left = identify(before);
  const right = identify(after);
  return [...new Set([...left.keys(), ...right.keys()])]
    .filter((id) => left.get(id) !== right.get(id));
}

export function applyBuildingRenames(building, renames = []) {
  const maps = Object.fromEntries(
    ["room", "door", "path", "exteriorNode", "transition", "fixture", "item"]
      .map((kind) => [kind, new Map(
        renames
          .filter((rename) => rename?.kind === kind && rename.from && rename.to)
          .map((rename) => [String(rename.from), String(rename.to)]),
      )]),
  );
  const rename = (kind, value) => {
    let current = value;
    const seen = new Set();
    while (maps[kind].has(current) && !seen.has(current)) {
      seen.add(current);
      current = maps[kind].get(current);
    }
    return current;
  };

  building.start = rename("room", building.start);
  for (const room of building.rooms ?? []) {
    room.id = rename("room", room.id);
    if (room.mirror) room.mirror = rename("room", room.mirror);
    if (room.feature) room.feature = rename("fixture", room.feature);
    if (room.revealWhenDoor) room.revealWhenDoor = rename("door", room.revealWhenDoor);
  }
  for (const link of building.links ?? []) {
    link.from = rename("room", link.from);
    link.to = rename("room", link.to);
    if (link.door) link.door = rename("door", link.door);
  }
  for (const door of building.doors ?? []) {
    door.id = rename("door", door.id);
    if (door.room) door.room = rename("room", door.room);
    if (door.showWhenRoom) door.showWhenRoom = rename("room", door.showWhenRoom);
    if (door.showWhenDiscovered) door.showWhenDiscovered = rename("room", door.showWhenDiscovered);
    if (door.showWhenRevealed) door.showWhenRevealed = rename("room", door.showWhenRevealed);
    if (door.lock?.freeFrom) door.lock.freeFrom = rename("room", door.lock.freeFrom);
    if (door.lock?.key) door.lock.key = rename("item", door.lock.key);
  }
  for (const item of building.items ?? []) item.id = rename("item", item.id);
  for (const pickup of building.pickups ?? []) {
    pickup.room = rename("room", pickup.room);
    pickup.item = rename("item", pickup.item);
  }
  for (const item of building.switches ?? []) {
    item.room = rename("room", item.room);
    item.door = rename("door", item.door);
  }
  for (const action of building.actions ?? []) {
    if (action.room) action.room = rename("room", action.room);
    if (action.exteriorNode) action.exteriorNode = rename("exteriorNode", action.exteriorNode);
  }
  for (const node of building.exterior?.nodes ?? []) {
    node.id = rename("exteriorNode", node.id);
    if (node.room) node.room = rename("room", node.room);
    if (node.door) node.door = rename("door", node.door);
  }
  if (building.exterior?.entry) {
    building.exterior.entry = rename("exteriorNode", building.exterior.entry);
  }
  for (const path of building.exterior?.paths ?? []) {
    path.id = rename("path", path.id);
    path.nodes = (path.nodes ?? []).map((id) => rename("exteriorNode", id));
  }
  for (const transition of building.transitions ?? []) {
    transition.id = rename("transition", transition.id);
    if (transition.room) transition.room = rename("room", transition.room);
    if (transition.door) transition.door = rename("door", transition.door);
    if (transition.exteriorNode) {
      transition.exteriorNode = rename("exteriorNode", transition.exteriorNode);
    }
  }
  for (const fixture of building.fixtures ?? []) {
    fixture.id = rename("fixture", fixture.id);
    fixture.connects = (fixture.connects ?? []).map((id) => rename("room", id));
    if (fixture.revealWhenDoor) fixture.revealWhenDoor = rename("door", fixture.revealWhenDoor);
    if (fixture.revealRoom) fixture.revealRoom = rename("room", fixture.revealRoom);
  }
  return building;
}

function validateIds(items, path, errors) {
  const ids = new Set();
  const add = (field, message) => ((errors[field] ??= []).push(message));
  items.forEach((item, index) => {
    item.id = text(item.id);
    if (!ID_PATTERN.test(item.id)) add(`${path}.${index}.id`, "Use a unique kebab-case ID.");
    if (ids.has(item.id)) add(`${path}.${index}.id`, "IDs must be unique within this group.");
    ids.add(item.id);
  });
  return ids;
}

function validPoint(point) {
  return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function nullableText(value) {
  return text(value) || null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
