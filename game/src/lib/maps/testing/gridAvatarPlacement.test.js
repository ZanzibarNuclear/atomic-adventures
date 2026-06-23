import { describe, expect, it } from "vitest";
import { utilityData } from '../../testing/content.js';
import {
  buildBuilding,
  roomStandPosition,
  ROOM_ICON_HALF_HEIGHT,
  FEET_GAP_ABOVE_ROOM_ICON,
} from "../composables/useGrid.js";

function avatarFootOffset(cell) {
  const avatarScale = (cell / 64) * 0.42;
  return 26 * avatarScale;
}

function avatarAtStand(standPoint, cell) {
  const offset = avatarFootOffset(cell);
  return { x: standPoint.x, y: standPoint.y - offset };
}

describe("grid avatar placement at room stands", () => {
  it("anchors avatar feet at the stand point in icon rooms", () => {
    const building = buildBuilding(utilityData);
    const room = building.roomById["large-bay"];
    expect(room.icon).toBeTruthy();

    const stand = roomStandPosition(building, room, "center");
    expect(stand).not.toBeNull();

    const avatar = avatarAtStand(stand, building.cell);
    const offset = avatarFootOffset(building.cell);

    expect(avatar.x).toBe(stand.x);
    expect(avatar.y).toBe(stand.y - offset);

    const legacyIconRoomY =
      stand.y - ROOM_ICON_HALF_HEIGHT - FEET_GAP_ABOVE_ROOM_ICON - offset;
    expect(avatar.y).not.toBe(legacyIconRoomY);
    expect(avatar.y - legacyIconRoomY).toBe(
      ROOM_ICON_HALF_HEIGHT + FEET_GAP_ABOVE_ROOM_ICON,
    );
  });
});
