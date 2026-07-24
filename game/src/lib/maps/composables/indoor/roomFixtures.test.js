import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import {
  buildProcessFixtureActions,
  ensureFixtureRuntime,
  listProcessFixtures,
  performProcessFixtureAction,
  processFixtureStatusLines,
} from "./roomFixtures.js";
import { createHoldings, addItem, itemQuantity, characterHolderId } from "../../../character/holdings.js";
import { createFlags } from "../useFlags.js";
import { normalizeContents } from "../../../character/vessels.js";

const building = {
  rooms: [
    {
      id: "kitchen",
      stands: [{ id: "kitchen-sink" }, { id: "cabinets" }],
      fixtures: [
        {
          id: "kitchen-sink",
          kind: "sink",
          stand: "kitchen-sink",
          label: "Kitchen sink",
        },
        {
          id: "kitchen-purifier",
          kind: "water-purifier",
          stand: "kitchen-sink",
          label: "Countertop purifier",
          requiresTabletItem: "purifier-tablet",
          outputLiquid: "purified-water",
          outputMl: 250,
        },
      ],
    },
  ],
};

const definitions = {
  items: [
    { id: "purifier-tablet", carrying: "stack", maxQuantity: 24, portable: true, kind: "consumable" },
    {
      id: "drinking-glass",
      carrying: "unique",
      maxQuantity: 12,
      portable: true,
      kind: "vessel",
      vessel: { capacityMl: 250, forms: ["liquid"] },
    },
    {
      id: "water-bottle",
      carrying: "unique",
      maxQuantity: 4,
      portable: true,
      kind: "vessel",
      vessel: { capacityMl: 500, forms: ["liquid"] },
    },
    {
      id: "purified-water",
      carrying: "stack",
      maxQuantity: 24,
      portable: true,
      kind: "consumable",
      properties: { form: "liquid", unitMl: 500 },
    },
  ],
};

function makeIndoor() {
  const holdings = createHoldings("player");
  const character = {
    holdings,
    definitions,
    stats: { hydration: 20 },
  };
  const indoorState = reactive({
    currentRoom: "kitchen",
    currentStand: "kitchen-sink",
    facility: { fixtures: {} },
    flags: createFlags(),
  });
  ensureFixtureRuntime(indoorState.facility, building);
  return {
    building,
    playerRoomId: "kitchen",
    indoor: indoorState,
    character,
    facility: indoorState.facility,
    flags: indoorState.flags,
  };
}

describe("room process fixtures", () => {
  it("lists kitchen sink and purifier from room fixtures", () => {
    expect(listProcessFixtures(building).map((f) => f.id)).toEqual([
      "kitchen-sink",
      "kitchen-purifier",
    ]);
  });

  it("does not mutate facility state while building actions or status lines", () => {
    const indoor = makeIndoor();
    indoor.indoor.facility.fixtures = {};
    buildProcessFixtureActions(indoor);
    processFixtureStatusLines(indoor);
    expect(indoor.indoor.facility.fixtures).toEqual({});
  });

  it("runs the faucet clear, fills the purifier, doses a tablet, and fills a glass vessel", () => {
    const indoor = makeIndoor();
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 2);
    addItem(indoor.character.holdings, definitions, "drinking-glass", 2);

    let actions = buildProcessFixtureActions(indoor).map((a) => a.id);
    expect(actions).toContain("fixture:kitchen-sink:flow-on");
    expect(actions).toContain("fixture:kitchen-purifier:add-tablet");

    let result = performProcessFixtureAction(indoor, "fixture:kitchen-sink:flow-on");
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/sputters|clear/i);

    result = performProcessFixtureAction(indoor, "fixture:kitchen-purifier:fill");
    expect(result.ok).toBe(true);

    result = performProcessFixtureAction(indoor, "fixture:kitchen-purifier:add-tablet");
    expect(result.ok).toBe(true);
    expect(indoor.indoor.facility.fixtures["kitchen-purifier"].stage).toBe("ready");

    actions = buildProcessFixtureActions(indoor).map((a) => a.id);
    expect(actions).toContain("fixture:kitchen-purifier:fill-glass");

    result = performProcessFixtureAction(indoor, "fixture:kitchen-purifier:fill-glass");
    expect(result.ok).toBe(true);
    const glass = Object.values(indoor.character.holdings.instances)
      .find((entry) => entry.item === "drinking-glass" && normalizeContents(entry.contents));
    expect(normalizeContents(glass.contents)).toEqual({
      item: "purified-water",
      amountMl: 250,
    });
    expect(indoor.indoor.flags.has("day1.found-water")).toBe(true);
    // Faucet copy is action-notice only; purifier may still contribute status.
    expect(processFixtureStatusLines(indoor).some((line) => /faucet sputters|Clear water runs/i.test(line))).toBe(false);
  });

  it("uses distinct faucet notices for first clear vs later open", () => {
    const indoor = makeIndoor();
    const first = performProcessFixtureAction(indoor, "fixture:kitchen-sink:flow-on");
    expect(first.notice).toMatch(/sputters rust and silt/i);
    performProcessFixtureAction(indoor, "fixture:kitchen-sink:flow-off");
    const later = performProcessFixtureAction(indoor, "fixture:kitchen-sink:flow-on");
    expect(later.notice).toBe("Clear water runs from the faucet.");
    expect(processFixtureStatusLines(indoor)).not.toContain("Clear water runs from the faucet.");
  });

  it("refuses to fill the purifier before the faucet runs clear", () => {
    const indoor = makeIndoor();
    const result = performProcessFixtureAction(indoor, "fixture:kitchen-purifier:fill");
    expect(result.ok).toBe(false);
    expect(result.notice).toMatch(/faucet/i);
  });

  it("fills a held empty water bottle from a ready purifier", () => {
    const indoor = makeIndoor();
    const holder = characterHolderId(indoor.character.holdings);
    indoor.character.holdings.instances["bottle-1"] = {
      item: "water-bottle",
      holder,
    };
    const facility = indoor.indoor.facility.fixtures;
    facility["kitchen-sink"] = { flow: "low", cleared: true };
    facility["kitchen-purifier"] = { hasTablet: true, filled: true, stage: "ready" };

    const result = performProcessFixtureAction(indoor, "fixture:kitchen-purifier:fill-bottle");
    expect(result.ok).toBe(true);
    const bottle = indoor.character.holdings.instances["bottle-1"];
    expect(normalizeContents(bottle.contents)).toEqual({
      item: "purified-water",
      amountMl: 250,
    });
  });
});
