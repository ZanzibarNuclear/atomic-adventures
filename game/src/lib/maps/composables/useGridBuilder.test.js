import { describe, expect, it } from "vitest";
import { utilityData } from '../../testing/content.js';
import {
  findGridEditable,
  listEditableRoomStands,
  resolvedRoomStandHandle,
  setRoomStandAt,
} from "./useGridBuilder.js";

describe("grid builder room stands", () => {
  it("lists, resolves, and moves authored room stands", () => {
    const draft = structuredClone(utilityData);
    const items = listEditableRoomStands(draft, "first");
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "large-bay/midway",
        "large-bay/stairs-bottom",
        "large-bay/service-area",
      ]),
    );

    const stand = findGridEditable(draft, "stands", "large-bay/stairs-bottom");
    expect(resolvedRoomStandHandle(stand, draft.cell)).toEqual([
      expect.objectContaining({ role: "room-stand", handleKey: "room-stand" }),
    ]);

    setRoomStandAt(draft, "large-bay/stairs-bottom", 1.5, 2.8);
    expect(stand.at).toEqual({ x: 1.5, y: 2.8 });
  });
});
