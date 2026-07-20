import { describe, expect, it } from "vitest";
import { moveStoryBeat, reorderStoryBeat, splitStoryBeat } from "./storyArcOperations.js";

function beat(id, fields = {}) {
  return { id, title: id, scene: `${id}-scene`, allowed: { movement: { hexes: [id] } }, completesWhen: { flag: id }, onEnter: null, onComplete: null, next: null, ...fields };
}

function document() {
  return { storyArcs: [
    { id: "one", title: "One", startBeat: "a", completion: { nextArc: "two" }, beats: [beat("a", { next: "b" }), beat("b")] },
    { id: "two", title: "Two", startBeat: "c", beats: [beat("c", { next: "d" }), beat("d")] },
  ] };
}

describe("story arc beat operations", () => {
  it("reorders a beat without changing its hidden fields", () => {
    const original = document();
    const result = reorderStoryBeat(original, { arcId: "two", beatId: "d", toIndex: 0 });

    expect(result.ok).toBe(true);
    expect(result.document.storyArcs[1].beats.map(({ id }) => id)).toEqual(["d", "c"]);
    expect(result.document.storyArcs[1].beats[0].allowed).toEqual(original.storyArcs[1].beats[1].allowed);
    expect(original.storyArcs[1].beats.map(({ id }) => id)).toEqual(["c", "d"]);
  });

  it("moves the first beat to the end of the previous arc and rewires the boundary", () => {
    const original = document();
    const hidden = structuredClone(original.storyArcs[1].beats[0]);
    const result = moveStoryBeat(original, { beatId: "c", fromArcId: "two", toArcId: "one", toIndex: 2 });

    expect(result.ok).toBe(true);
    expect(result.document.storyArcs[0].beats.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(result.document.storyArcs[1].beats.map(({ id }) => id)).toEqual(["d"]);
    expect(result.document.storyArcs[1].startBeat).toBe("d");
    expect(result.document.storyArcs[0].beats[1]).toMatchObject({ next: "c" });
    expect(result.document.storyArcs[0].beats[2]).toMatchObject({ next: null });
    expect(result.document.storyArcs[0].completion).toEqual({ nextArc: "two" });
    expect(result.document.storyArcs[0].beats[2].allowed).toEqual(hidden.allowed);
    expect(result.document.storyArcs[0].beats[2].completesWhen).toEqual(hidden.completesWhen);
  });

  it("rejects a destination whose existing outgoing flow is non-linear", () => {
    const original = document();
    original.storyArcs[0].beats[1].next = "branch";
    const result = moveStoryBeat(original, { beatId: "c", fromArcId: "two", toArcId: "one", toIndex: 2 });

    expect(result.ok).toBe(false);
    expect(result.conflicts[0]).toContain("already points");
  });

  it("moves a beat into an empty arc and makes it the start beat", () => {
    const original = document();
    original.storyArcs.push({ id: "empty", title: "Empty", startBeat: "", beats: [] });
    const result = moveStoryBeat(original, { beatId: "d", fromArcId: "two", toArcId: "empty", toIndex: 0 });

    expect(result.ok).toBe(true);
    expect(result.document.storyArcs[2]).toMatchObject({ startBeat: "d", beats: [expect.objectContaining({ id: "d" })] });
  });

  it("inserts a beat between a sequential pair and rewires both sides", () => {
    const original = document();
    const result = moveStoryBeat(original, { beatId: "d", fromArcId: "two", toArcId: "one", toIndex: 1 });

    expect(result.ok).toBe(true);
    expect(result.document.storyArcs[0].beats.map(({ id }) => id)).toEqual(["a", "d", "b"]);
    expect(result.document.storyArcs[0].beats[0].next).toBe("d");
    expect(result.document.storyArcs[0].beats[1].next).toBe("b");
  });

  it("splits a scene suffix into a new beat without changing the original hidden fields", () => {
    const original = document();
    const hidden = structuredClone(original.storyArcs[0].beats[0]);
    const result = splitStoryBeat(original, {
      arcId: "one", beatId: "a", newBeatId: "a-later", newBeatTitle: "A later",
      sceneIds: ["a-scene", "second", "third"], splitIndex: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.movedSceneIds).toEqual(["second", "third"]);
    expect(result.document.storyArcs[0].beats.map(({ id }) => id)).toEqual(["a", "a-later", "b"]);
    expect(result.document.storyArcs[0].beats[0]).toMatchObject({ scene: "a-scene", next: "a-later", allowed: hidden.allowed, completesWhen: hidden.completesWhen });
    expect(result.document.storyArcs[0].beats[1]).toMatchObject({ scene: "second", next: "b", completesWhen: null });
  });
});
