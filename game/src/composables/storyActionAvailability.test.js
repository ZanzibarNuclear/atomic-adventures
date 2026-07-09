import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { utilityData } from "../lib/testing/content.js";
import { filterAllowedActions } from "./storyActionAvailability.js";

const contentDbPath = fileURLToPath(
  new URL("../../content/atomic-adventures.sqlite", import.meta.url),
);

function storyBeat(arcId, beatId) {
  const db = new DatabaseSync(contentDbPath, { readOnly: true });
  try {
    const row = db.prepare(
      "SELECT document_json FROM story_arc_documents WHERE id = ?",
    ).get("story-main");
    const document = JSON.parse(row.document_json);
    return document.storyArcs
      .find((arc) => arc.id === arcId)
      ?.beats.find((beat) => beat.id === beatId);
  } finally {
    db.close();
  }
}

function storyArc(arcId) {
  const db = new DatabaseSync(contentDbPath, { readOnly: true });
  try {
    const row = db.prepare(
      "SELECT document_json FROM story_arc_documents WHERE id = ?",
    ).get("story-main");
    const document = JSON.parse(row.document_json);
    return document.storyArcs.find((arc) => arc.id === arcId);
  } finally {
    db.close();
  }
}

describe("story action availability", () => {
  it("keeps base traversal affordances available in story mode", () => {
    const actions = [
      { id: "exit-world:garage-exit", label: "Travel world map" },
      { id: "door-open:garage-roll-up", label: "Open the garage door" },
      { id: "door-break:large-bay-man", label: "Break the lock" },
      { id: "switch:large-bay-roll", label: "Release the larger garage door manually" },
    ];

    expect(filterAllowedActions(actions, { mode: "story", allowed: {} })).toEqual(actions);
  });

  it("requires authored permission for searches and passage controls in story mode", () => {
    const actions = [
      { id: "search:barrier", label: "Inspect the fence" },
      { id: "passage-toggle:compound-gate", label: "Open the gate" },
      { id: "passage-unlock:service-bridge", label: "Unlock the bridge" },
      { id: "passage:compound-gate", label: "Walk through the gate" },
    ];

    expect(filterAllowedActions(actions, { mode: "story", allowed: {} })).toEqual([]);
    expect(filterAllowedActions(actions, {
      mode: "story",
      allowed: {
        outdoorActions: ["search:barrier", "passage-toggle:compound-gate"],
        storyForwardActions: ["passage:compound-gate"],
      },
    })).toEqual([
      { id: "search:barrier", label: "Inspect the fence" },
      { id: "passage-toggle:compound-gate", label: "Open the gate" },
      { id: "passage:compound-gate", label: "Walk through the gate" },
    ]);
  });

  it("allows the required conference-room door during the first shelter beat", () => {
    const beat = storyBeat("part-i-station", "solve-first-crisis");
    const actions = [
      { id: "move-room:garage-stair", label: "Descend the stairs" },
      { id: "door-open:conference-garage-stair", label: "Open the door" },
    ];

    expect(
      filterAllowedActions(actions, {
        mode: "story",
        beatId: beat.id,
        allowed: beat.allowed,
        unrestricted: false,
      }),
    ).toEqual(actions);
  });

  it("does not let station story beats hide base traversal controls", () => {
    const stationArc = storyArc("part-i-station");
    const traversalActions = [
      ...utilityData.doors.flatMap((door) => [
        { id: `door-open:${door.id}`, label: `Open ${door.id}` },
        { id: `door-close:${door.id}`, label: `Close ${door.id}` },
        { id: `door-lock:${door.id}`, label: `Lock ${door.id}` },
        { id: `door-break:${door.id}`, label: `Break ${door.id}` },
      ]),
      ...utilityData.switches.map((sw) => ({
        id: `switch:${sw.door}`,
        label: sw.label,
      })),
      { id: "exit-world:garage-exit", label: "Travel world map" },
    ];

    for (const beat of stationArc.beats) {
      expect(
        filterAllowedActions(traversalActions, {
          mode: "story",
          beatId: beat.id,
          allowed: beat.allowed,
          unrestricted: false,
        }),
        beat.id,
      ).toEqual(traversalActions);
    }
  });
});
