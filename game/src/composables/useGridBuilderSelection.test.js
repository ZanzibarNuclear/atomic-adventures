import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  splitGridSelectionKey,
  useGridBuilderSelection,
} from "./useGridBuilderSelection.js";

function makeDraft() {
  return {
    cell: 10,
    start: "control",
    rooms: [
      { id: "control", level: "main", x: 0, y: 0, w: 2, h: 2 },
      { id: "storage", level: "main", x: 3, y: 0, w: 2, h: 2 },
    ],
    doors: [{ id: "main-door", room: "control", kind: "man", at: { x: 1, y: 1 } }],
    links: [],
    fixtures: [{ id: "fixture", connects: ["control"] }],
    exterior: {
      nodes: [{ id: "yard", at: { x: 0, y: 0 } }],
      paths: [{ id: "walk", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], nodes: [] }],
    },
    transitions: [],
    pickups: [],
    switches: [],
    actions: [],
  };
}

describe("useGridBuilderSelection", () => {
  it("parses stable source/id selection keys", () => {
    expect(splitGridSelectionKey("rooms:control")).toEqual({
      source: "rooms",
      id: "control",
    });
    expect(splitGridSelectionKey("")).toBeNull();
  });

  it("selects editable items and applies room handle movement in grid units", () => {
    const draft = ref(makeDraft());
    const selection = useGridBuilderSelection({ draft, level: ref("main") });

    selection.selectItem("rooms", "control");
    selection.onHandleMove({ role: "move", x: 30, y: 40 });

    expect(selection.selection.value.id).toBe("control");
    expect(draft.value.rooms[0].x).toBe(2);
    expect(draft.value.rooms[0].y).toBe(3);
  });

  it("adds and removes path point handles", () => {
    const draft = ref(makeDraft());
    const selection = useGridBuilderSelection({ draft, level: ref("main") });

    selection.selectItem("paths", "walk");
    selection.togglePathAddMode("point");
    selection.onMapClick({ x: 20, y: 30 });

    expect(draft.value.exterior.paths[0].points).toHaveLength(3);
    expect(selection.selectedHandleId.value).toBe("point-1");

    selection.removeSelectedPathHandle();

    expect(draft.value.exterior.paths[0].points).toHaveLength(2);
  });

  it("adds, duplicates, moves, and deletes selected objects", () => {
    vi.stubGlobal("window", { confirm: vi.fn(() => true) });
    const draft = ref(makeDraft());
    const selection = useGridBuilderSelection({ draft, level: ref("main") });

    selection.addObject("rooms");
    expect(selection.selection.value.id).toBe("new-room");
    expect(draft.value.rooms).toHaveLength(3);

    selection.duplicateSelected();
    expect(selection.selection.value.id).toBe("new-room-copy");
    expect(draft.value.rooms).toHaveLength(4);

    selection.moveSelected(-1);
    expect(draft.value.rooms.at(-2).id).toBe("new-room-copy");

    selection.deleteSelected();
    expect(draft.value.rooms.some((room) => room.id === "new-room-copy")).toBe(false);
    expect(selection.selectedKey.value).toBe("");

    vi.unstubAllGlobals();
  });

  it("renames rooms, cascades local references, and records pending rename metadata", async () => {
    vi.stubGlobal("window", {
      prompt: vi.fn(() => "operations"),
      confirm: vi.fn(() => true),
    });
    const status = ref("");
    const renames = ref([]);
    const previewRename = vi.fn(async () => [{ kind: "story", path: "trigger.room" }]);
    const draft = ref(makeDraft());
    const selection = useGridBuilderSelection({
      draft,
      level: ref("main"),
      status,
      renames,
      previewRename,
    });

    selection.selectItem("rooms", "control");
    await selection.renameSelected();

    expect(previewRename).toHaveBeenCalledWith({
      kind: "room",
      from: "control",
      to: "operations",
    });
    expect(draft.value.rooms[0].id).toBe("operations");
    expect(draft.value.start).toBe("operations");
    expect(draft.value.doors[0].room).toBe("operations");
    expect(draft.value.fixtures[0].connects).toEqual(["operations"]);
    expect(renames.value).toEqual([{ kind: "room", from: "control", to: "operations" }]);
    expect(status.value).toBe("");

    vi.unstubAllGlobals();
  });
});
