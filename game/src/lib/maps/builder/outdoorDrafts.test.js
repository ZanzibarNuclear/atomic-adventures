import { describe, expect, it } from "vitest";
import {
  applyStandPointToDraft,
  landmarkDraftFrom,
  landmarkFromDraft,
  normalizeStand,
  standDraftFrom,
  standFromDraft,
} from "./outdoorDrafts.js";
import { axialToPixel } from "../composables/useHexGeometry.js";

describe("outdoor builder drafts", () => {
  it("round-trips trimmed landmark draft fields and omits empty values", () => {
    expect(landmarkDraftFrom({ icon: "◆", label: "Gate", dx: "0.5" })).toEqual({
      icon: "◆",
      label: "Gate",
      building: "",
      blurb: "",
      dx: 0.5,
      dy: 0,
    });
    expect(landmarkFromDraft({
      icon: " ◆ ",
      label: " Gate ",
      building: " ",
      blurb: " Entry ",
      dx: 0,
      dy: -0.25,
    })).toEqual({
      icon: "◆",
      label: "Gate",
      blurb: "Entry",
      dy: -0.25,
    });
  });

  it("preserves stand anchor modes", () => {
    expect(standDraftFrom({ id: "lookout", at: { x: 12, y: 34 } }).anchor).toBe("world");
    expect(standDraftFrom({ id: "sign", at: { from: "landmark", dx: 0.2 } }).anchor).toBe("landmark");
    expect(standDraftFrom({ id: "center", at: { dx: -0.1 } }).anchor).toBe("hex");

    expect(standFromDraft({
      id: " gate ",
      label: " Gate stand ",
      anchor: "landmark",
      dx: 0.2,
      dy: -0.1,
    })).toEqual({
      id: "gate",
      label: "Gate stand",
      at: { from: "landmark", dx: 0.2, dy: -0.1 },
    });
  });

  it("normalizes stands without sharing nested state", () => {
    const source = { id: " stand ", label: " Stand ", at: { dx: 0.2 } };
    const normalized = normalizeStand(source);
    normalized.at.dx = 1;
    expect(normalized).toEqual({ id: "stand", label: "Stand", at: { dx: 1 } });
    expect(source.at.dx).toBe(0.2);
  });

  it("applies dragged points to world, hex, and landmark anchored drafts", () => {
    const hex = { id: "cell", q: 1, r: -1, landmark: { dx: 0.25, dy: -0.5 } };
    const size = 44;
    const center = axialToPixel(hex.q, hex.r, size);

    const world = { anchor: "world" };
    applyStandPointToDraft(world, hex, 12.4, 99.6, size);
    expect(world).toEqual({ anchor: "world", x: 12, y: 100 });

    const hexDraft = { anchor: "hex" };
    applyStandPointToDraft(hexDraft, hex, center.x + 22, center.y - 11, size);
    expect(hexDraft).toMatchObject({ dx: 0.5, dy: -0.25 });

    const landmarkDraft = { anchor: "landmark" };
    applyStandPointToDraft(landmarkDraft, hex, center.x + 11, center.y - 22, size);
    expect(landmarkDraft).toMatchObject({ dx: 0, dy: 0 });
  });
});
