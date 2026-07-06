import { computed, ref, watch } from "vue";
import {
  findGridEditable,
  gridEditModeForSource,
  removePathNodeFromPath,
  removePathPoint,
  resolvedDoorHandle,
  resolvedExitHandle,
  resolvedFixtureHandles,
  resolvedNodeHandle,
  resolvedPathHandles,
  resolvedPathNodeHandles,
  resolvedRoomHandles,
  resolvedRoomStandHandle,
  resolvedWallHandles,
  setDoorAt,
  setExitMapAt,
  setFixtureFromHandle,
  setNodeAt,
  setPathPoint,
  setRoomFromHandle,
  setRoomStandAt,
  setWallPoint,
  addPathNode,
  addPathPoint,
} from "../lib/maps/composables/useGridBuilder.js";

export function splitGridSelectionKey(key) {
  const index = key.indexOf(":");
  return index < 0 ? null : { source: key.slice(0, index), id: key.slice(index + 1) };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueId(base, list = []) {
  const used = new Set(list.map((item) => item.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

export function useGridBuilderSelection({
  draft,
  level,
  status = ref(""),
  renames = ref([]),
  previewRename = async () => [],
} = {}) {
  const selectedKey = ref("");
  const selectedHandleId = ref(null);
  const geometryEditing = ref(false);
  const addMode = ref(null);

  const selection = computed(() => {
    const parsed = splitGridSelectionKey(selectedKey.value);
    if (!parsed) return null;
    const entity = findGridEditable(draft.value, parsed.source, parsed.id);
    return entity ? { ...parsed, entity } : null;
  });

  const editMode = computed(() =>
    selection.value ? gridEditModeForSource(selection.value.source) : null,
  );
  const cell = computed(() => draft.value.cell ?? 64);
  const editHandles = computed(() => {
    const selected = selection.value;
    if (!selected) return [];
    if (selected.source === "paths") {
      return [
        ...resolvedPathHandles(selected.entity, cell.value, draft.value),
        ...resolvedPathNodeHandles(draft.value, selected.entity, cell.value),
      ];
    }
    if (selected.source === "rooms") return resolvedRoomHandles(selected.entity, cell.value);
    if (selected.source === "doors") {
      return selected.entity.kind === "roll" ? [] : resolvedDoorHandle(selected.entity, cell.value);
    }
    if (selected.source === "nodes") return resolvedNodeHandle(selected.entity, cell.value);
    if (selected.source === "exits") return resolvedExitHandle(selected.entity, cell.value);
    if (selected.source === "fixtures") return resolvedFixtureHandles(selected.entity, cell.value);
    if (selected.source === "walls") return resolvedWallHandles(selected.entity, cell.value);
    if (selected.source === "stands") return resolvedRoomStandHandle(selected.entity, cell.value);
    return [];
  });
  const canEditGeometry = computed(() => editHandles.value.length > 0);
  const selectedPathNode = computed(() => {
    const id = selectedHandleId.value?.match(/^node-(.+)$/)?.[1];
    return id ? draft.value.exterior?.nodes?.find((node) => node.id === id) ?? null : null;
  });
  const rollDoorRoom = computed(() => {
    const door = selection.value?.source === "doors" ? selection.value.entity : null;
    return door?.kind === "roll"
      ? draft.value.rooms?.find((room) => room.id === door.room) ?? null
      : null;
  });

  function resetSelectionMode() {
    selectedHandleId.value = null;
    geometryEditing.value = false;
    addMode.value = null;
  }

  function selectItem(sourceName, id) {
    selectedKey.value = `${sourceName}:${id}`;
    resetSelectionMode();
  }

  function toggleGeometryEditing() {
    if (!canEditGeometry.value) return;
    geometryEditing.value = !geometryEditing.value;
    selectedHandleId.value = null;
    if (!geometryEditing.value) addMode.value = null;
  }

  function togglePathAddMode(mode) {
    if (addMode.value === mode) {
      addMode.value = null;
      return;
    }
    geometryEditing.value = true;
    addMode.value = mode;
  }

  function onHandleMove(payload) {
    const selected = selection.value;
    if (!selected) return;
    const x = payload.x / cell.value;
    const y = payload.y / cell.value;
    if (selected.source === "paths") {
      if (payload.role === "path-node" && payload.nodeId) {
        setNodeAt(draft.value, payload.nodeId, x, y);
      } else {
        setPathPoint(draft.value, selected.id, payload.index, x, y);
      }
    } else if (selected.source === "rooms") {
      setRoomFromHandle(draft.value, selected.id, payload.role, x, y);
    } else if (selected.source === "doors") {
      setDoorAt(draft.value, selected.id, x, y);
    } else if (selected.source === "nodes") {
      setNodeAt(draft.value, selected.id, x, y);
    } else if (selected.source === "exits") {
      setExitMapAt(draft.value, selected.id, x, y);
    } else if (selected.source === "fixtures") {
      setFixtureFromHandle(draft.value, selected.id, payload.role, x, y);
    } else if (selected.source === "walls") {
      setWallPoint(draft.value, selected.id, payload.index, x, y);
    } else if (selected.source === "stands") {
      setRoomStandAt(draft.value, selected.id, x, y);
    }
  }

  function onMapClick(payload) {
    const selected = selection.value;
    if (selected?.source !== "paths" || !addMode.value) return;
    const x = payload.x / cell.value;
    const y = payload.y / cell.value;
    if (addMode.value === "node") {
      const id = addPathNode(draft.value, selected.id, x, y);
      selectedHandleId.value = id ? `node-${id}` : null;
    } else {
      const index = addPathPoint(draft.value, selected.id, x, y);
      selectedHandleId.value = index >= 0 ? `point-${index}` : null;
    }
  }

  function removeSelectedPathHandle() {
    const selected = selection.value;
    if (selected?.source !== "paths") return;
    const point = selectedHandleId.value?.match(/^point-(\d+)$/);
    const node = selectedHandleId.value?.match(/^node-(.+)$/);
    if (point) removePathPoint(draft.value, selected.id, Number(point[1]));
    if (node) removePathNodeFromPath(draft.value, selected.id, node[1]);
    selectedHandleId.value = null;
  }

  function collectionFor(sourceName) {
    if (sourceName === "rooms") return draft.value.rooms;
    if (sourceName === "doors") return draft.value.doors;
    if (sourceName === "paths") return draft.value.exterior?.paths;
    if (sourceName === "nodes") return draft.value.exterior?.nodes;
    if (sourceName === "exits") return draft.value.transitions ?? draft.value.exits;
    if (sourceName === "fixtures") return draft.value.fixtures;
    if (sourceName === "walls") return draft.value.cliffWall ? [draft.value.cliffWall] : null;
    if (sourceName === "links") return draft.value.links;
    if (sourceName === "switches") return draft.value.switches;
    if (sourceName === "stands") {
      const roomId = selection.value?.source === "stands"
        ? selection.value.id.split("/")[0]
        : selection.value?.source === "rooms"
          ? selection.value.id
          : null;
      return draft.value.rooms.find((room) => room.id === roomId)?.stands ?? null;
    }
    return null;
  }

  function addObject(sourceName) {
    let list = collectionFor(sourceName);
    let item = null;
    if (sourceName === "stands") {
      const room = selection.value?.source === "rooms"
        ? selection.value.entity
        : draft.value.rooms.find((candidate) =>
            !candidate.feature &&
            (candidate.level === level.value || candidate.levels?.includes(level.value))
          );
      if (!room) return;
      room.stands ??= [];
      list = room.stands;
      item = {
        id: uniqueId("new-stand", list),
        at: {
          x: Number(room.x ?? 0) + Number(room.w ?? 1) / 2,
          y: Number(room.y ?? 0) + Number(room.h ?? 1) / 2,
        },
        label: "New stand",
      };
      list.push(item);
      room.defaultStand ??= item.id;
      selectItem("stands", `${room.id}/${item.id}`);
      return;
    }
    if (!list) return;
    if (sourceName === "rooms") {
      item = {
        id: uniqueId("new-room", list),
        level: level.value,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        label: "New Room",
      };
    } else if (sourceName === "doors") {
      item = {
        id: uniqueId("new-door", list),
        kind: "man",
        level: level.value,
        at: { x: 0, y: 0 },
        initial: { closed: true, locked: false },
      };
    } else if (sourceName === "paths") {
      item = {
        id: uniqueId("new-path", list),
        smooth: true,
        nodes: [],
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      };
    } else if (sourceName === "nodes") {
      item = {
        id: uniqueId("new-stand", list),
        at: { x: 0, y: 0 },
        label: "New stand",
      };
    } else if (sourceName === "exits") {
      item = {
        id: uniqueId("new-transition", list),
        label: "New transition",
        at: { x: 0, y: 0 },
        hex: draft.value.outdoorHex ?? "utility-yard",
      };
    } else if (sourceName === "links") {
      const rooms = draft.value.rooms.filter((room) =>
        room.level === level.value || room.levels?.includes(level.value),
      );
      if (rooms.length < 2) {
        status.value = "Add at least two rooms on this floor before creating a connection.";
        return;
      }
      item = {
        from: rooms[0].id,
        to: rooms[1].id,
        kind: "open",
      };
    } else if (sourceName === "switches") {
      const rooms = draft.value.rooms.filter((room) =>
        room.level === level.value || room.levels?.includes(level.value),
      );
      const door = draft.value.doors[0];
      if (!rooms.length || !door) {
        status.value = "Add a room and door before creating a switch.";
        return;
      }
      item = {
        id: uniqueId("new-switch", list),
        room: rooms[0].id,
        door: door.id,
        label: "New switch",
      };
    }
    if (!item) return;
    list.push(item);
    const id = sourceName === "links"
      ? `${item.from}-${item.to}-${list.length - 1}`
      : item.id;
    selectItem(sourceName, id);
  }

  function duplicateSelected() {
    const selected = selection.value;
    const list = selected ? collectionFor(selected.source) : null;
    if (!selected || !list || ["fixtures", "walls", "links"].includes(selected.source)) return;
    const copy = clonePlain(selected.entity);
    copy.id = uniqueId(`${copy.id}-copy`, list);
    if (selected.source === "rooms") {
      copy.x = Number(copy.x ?? 0) + 0.5;
      copy.y = Number(copy.y ?? 0) + 0.5;
    }
    if (copy.at) {
      copy.at.x = Number(copy.at.x ?? 0) + 0.25;
      copy.at.y = Number(copy.at.y ?? 0) + 0.25;
    }
    list.push(copy);
    selectItem(
      selected.source,
      selected.source === "stands"
        ? `${selected.id.split("/")[0]}/${copy.id}`
        : copy.id,
    );
  }

  function selectedIndex(selected, list) {
    return selected.source === "links"
      ? Number(selected.id.split("-").at(-1))
      : list.findIndex((item) => item.id === (
          selected.source === "stands" ? selected.id.split("/")[1] : selected.id
        ));
  }

  function deleteSelected() {
    const selected = selection.value;
    const list = selected ? collectionFor(selected.source) : null;
    if (!selected || !list || ["fixtures", "walls"].includes(selected.source)) return;
    if (!window.confirm(
      `Delete ${selected.source.slice(0, -1)} "${selected.id}"? References are checked when you save.`,
    )) return;
    const index = selectedIndex(selected, list);
    if (selected.source === "stands") {
      const room = draft.value.rooms.find((item) => item.id === selected.id.split("/")[0]);
      if (room?.defaultStand === selected.id.split("/")[1]) room.defaultStand = null;
    }
    if (index >= 0) list.splice(index, 1);
    selectedKey.value = "";
    resetSelectionMode();
  }

  function moveSelected(delta) {
    const selected = selection.value;
    const list = selected ? collectionFor(selected.source) : null;
    if (!selected || !list) return;
    const index = selectedIndex(selected, list);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
  }

  async function renameSelected() {
    const selected = selection.value;
    if (!selected || ["fixtures", "walls", "links"].includes(selected.source)) return;
    const currentId = selected.source === "stands" ? selected.id.split("/")[1] : selected.id;
    const next = window.prompt(`Rename "${currentId}" to:`, currentId)?.trim();
    if (!next || next === currentId) return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
      status.value = "IDs must use kebab-case.";
      return;
    }
    const list = collectionFor(selected.source);
    if (list.some((item) => item.id === next)) {
      status.value = `The ID "${next}" already exists.`;
      return;
    }
    const kind = {
      rooms: "room",
      doors: "door",
      paths: "path",
      nodes: "exteriorNode",
      exits: "transition",
      switches: "switch",
    }[selected.source];
    if (selected.source === "stands") {
      const roomId = selected.id.split("/")[0];
      const room = draft.value.rooms.find((item) => item.id === roomId);
      if (room?.defaultStand === currentId) room.defaultStand = next;
      selected.entity.id = next;
      selectedKey.value = `stands:${roomId}/${next}`;
      return;
    }
    let references = [];
    if (["room", "exteriorNode"].includes(kind)) {
      try {
        references = await previewRename({ kind, from: selected.id, to: next });
      } catch (error) {
        status.value = error.message;
        return;
      }
    }
    const lines = references.slice(0, 8).map(referenceLabel);
    const overflow = references.length - lines.length;
    const summary = lines.length
      ? `\n\nReferences to update:\n${lines.join("\n")}${overflow > 0 ? `\n...and ${overflow} more` : ""}`
      : "";
    if (!window.confirm(`Rename "${selected.id}" to "${next}"?${summary}`)) return;
    const from = selected.id;
    selected.entity.id = next;
    cascadeLocalRename(kind, from, next);
    renames.value.push({ kind, from, to: next });
    selectedKey.value = `${selected.source}:${next}`;
  }

  function cascadeLocalRename(kind, from, to) {
    const replace = (value) => value === from ? to : value;
    if (kind === "room") {
      draft.value.start = replace(draft.value.start);
      for (const room of draft.value.rooms) if (room.mirror) room.mirror = replace(room.mirror);
      for (const link of draft.value.links) {
        link.from = replace(link.from);
        link.to = replace(link.to);
      }
      for (const door of draft.value.doors) {
        if (door.room) door.room = replace(door.room);
        if (door.showWhenRoom) door.showWhenRoom = replace(door.showWhenRoom);
        if (door.showWhenDiscovered) door.showWhenDiscovered = replace(door.showWhenDiscovered);
        if (door.showWhenRevealed) door.showWhenRevealed = replace(door.showWhenRevealed);
        if (door.lock?.freeFrom) door.lock.freeFrom = replace(door.lock.freeFrom);
      }
      for (const node of draft.value.exterior?.nodes ?? []) if (node.room) node.room = replace(node.room);
      for (const transition of draft.value.transitions ?? []) if (transition.room) transition.room = replace(transition.room);
      for (const pickup of draft.value.pickups ?? []) pickup.room = replace(pickup.room);
      for (const item of draft.value.switches ?? []) item.room = replace(item.room);
      for (const action of draft.value.actions ?? []) if (action.room) action.room = replace(action.room);
      for (const fixture of draft.value.fixtures ?? []) {
        fixture.connects = (fixture.connects ?? []).map(replace);
        if (fixture.revealRoom) fixture.revealRoom = replace(fixture.revealRoom);
      }
    }
    if (kind === "door") {
      for (const link of draft.value.links) if (link.door) link.door = replace(link.door);
      for (const node of draft.value.exterior?.nodes ?? []) if (node.door) node.door = replace(node.door);
      for (const transition of draft.value.transitions ?? []) if (transition.door) transition.door = replace(transition.door);
      for (const item of draft.value.switches ?? []) item.door = replace(item.door);
      for (const room of draft.value.rooms) if (room.revealWhenDoor) room.revealWhenDoor = replace(room.revealWhenDoor);
      for (const fixture of draft.value.fixtures ?? []) {
        if (fixture.revealWhenDoor) fixture.revealWhenDoor = replace(fixture.revealWhenDoor);
      }
    }
    if (kind === "exteriorNode") {
      draft.value.exterior.entry = replace(draft.value.exterior.entry);
      for (const path of draft.value.exterior.paths ?? []) {
        path.nodes = (path.nodes ?? []).map(replace);
      }
      for (const transition of draft.value.transitions ?? []) {
        if (transition.exteriorNode) transition.exteriorNode = replace(transition.exteriorNode);
      }
      for (const action of draft.value.actions ?? []) {
        if (action.exteriorNode) action.exteriorNode = replace(action.exteriorNode);
      }
    }
  }

  watch(level, resetSelectionMode);

  return {
    selectedKey,
    selectedHandleId,
    geometryEditing,
    addMode,
    selection,
    editMode,
    cell,
    editHandles,
    canEditGeometry,
    selectedPathNode,
    rollDoorRoom,
    resetSelectionMode,
    selectItem,
    toggleGeometryEditing,
    togglePathAddMode,
    onHandleMove,
    onMapClick,
    removeSelectedPathHandle,
    collectionFor,
    addObject,
    duplicateSelected,
    deleteSelected,
    moveSelected,
    renameSelected,
    cascadeLocalRename,
  };
}

function referenceLabel(reference) {
  if (reference.kind === "storyline") {
    return `storyline ${reference.scenarioId}/${reference.stepId}: ${reference.path}`;
  }
  if (reference.kind === "story") {
    return `${reference.areaId}/${reference.beatId}: ${reference.path}`;
  }
  return reference.path;
}
