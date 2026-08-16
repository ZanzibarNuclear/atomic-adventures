import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { addItem, itemQuantity } from "./holdings.js";
import { ensureFixedHolderAt } from "./holdingsAuthoring.js";
import { createGameClock } from "./gameTime.js";
import { applyEffectsAtomically } from "./effects.js";
import {
  EAT_AND_DRINK_ACTION_ID,
  SATISFIED_THRESHOLD,
  WATER_PURIFICATION_SKILL,
  buildKitchenSkillActions,
  listEatAndDrinkOptions,
  performEatAndDrinkShortcut,
} from "./kitchenSkills.js";
import {
  buildProcessFixtureActions,
  ensureFixtureRuntime,
  performProcessFixtureAction,
} from "../maps/composables/indoor/roomFixtures.js";
import { createFlags } from "../maps/composables/useFlags.js";

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
          capacityServings: 4,
        },
      ],
    },
  ],
};

const definitions = {
  items: [
    {
      id: "tastee-tack-turkey-cranberry-meal",
      label: "Tastee Tack: Turkey Cranberry Dinner",
      kind: "consumable",
      carrying: "stack",
      maxQuantity: 12,
      portable: true,
      actions: [{
        id: "eat",
        label: "Eat meal",
        consume: 1,
        timeMinutes: 0,
        activity: "resting",
        effects: [
          { op: "stat.add", id: "satiety", value: 55 },
          { op: "stat.add", id: "hydration", value: -8 },
          { op: "knowledge.acquire", id: "tastee-tack-thirst" },
        ],
      }],
    },
    {
      id: "tastee-tack-pioneer-breakfast",
      label: "Tastee Tack: Pioneer Breakfast",
      kind: "consumable",
      carrying: "stack",
      maxQuantity: 12,
      portable: true,
      actions: [{
        id: "eat",
        label: "Eat meal",
        consume: 1,
        timeMinutes: 0,
        activity: "resting",
        effects: [
          { op: "stat.add", id: "satiety", value: 55 },
          { op: "stat.add", id: "hydration", value: -8 },
        ],
      }],
    },
    {
      id: "half-eaten-energy-bar",
      label: "Neutron bar",
      kind: "consumable",
      carrying: "unique",
      maxQuantity: 1,
      portable: true,
      actions: [{
        id: "eat",
        label: "Eat",
        consume: 1,
        timeMinutes: 0,
        activity: "resting",
        effects: [{ op: "stat.add", id: "satiety", value: 60 }],
      }],
    },
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
      properties: { form: "liquid", unitMl: 250 },
      actions: [{
        id: "drink",
        label: "Drink",
        consume: 1,
        timeMinutes: 0,
        activity: "resting",
        effects: [{ op: "stat.add", id: "hydration", value: 20 }],
      }],
    },
  ],
  stats: [
    { id: "satiety", type: "meter", default: 49, min: 0, max: 100 },
    { id: "hydration", type: "meter", default: 49, min: 0, max: 100 },
    { id: "composure", type: "meter", default: 80, min: 0, max: 100 },
  ],
  knowledge: [{
    id: "tastee-tack-thirst",
    label: "Tastee Tack is thirsty work",
  }, {
    id: "drank-purified-water",
    label: "Purified tap water",
  }],
  skills: [
    {
      id: "water-purification",
      label: "Purify water",
      mode: "acquired",
      maxRank: 1,
    },
    {
      id: "eat-and-drink",
      label: "Eat and drink",
      mode: "acquired",
      maxRank: 1,
      practice: {
        evidence: [],
        awards: [{
          rank: 1,
          earnedText: "Learned to pair Tastee Tack with purified water.",
          require: {
            skills: [{ id: "water-purification", op: "gte", rank: 1 }],
            knowledge: { all: ["tastee-tack-thirst", "drank-purified-water"] },
          },
        }],
      },
    },
  ],
  quests: [],
  documents: [],
};

function makeIndoor({ stand = "kitchen-sink", skills = {}, stats = {} } = {}) {
  const character = createCharacterState(definitions);
  Object.assign(character.skills, skills);
  Object.assign(character.stats, { satiety: 49, hydration: 49, ...stats });
  const indoorState = reactive({
    currentRoom: "kitchen",
    currentStand: stand,
    facility: { fixtures: {} },
    flags: createFlags(),
  });
  ensureFixtureRuntime(indoorState.facility, building);
  const gameState = {
    character,
    flags: indoorState.flags,
    clock: createGameClock(),
  };
  return {
    building,
    playerRoomId: "kitchen",
    indoor: indoorState,
    character,
    facility: indoorState.facility,
    flags: indoorState.flags,
    gameState,
  };
}

describe("kitchen skill shortcuts", () => {
  it("hides Eat and drink until the combined skill is acquired", () => {
    const indoor = makeIndoor();
    expect(buildKitchenSkillActions(indoor).map((action) => action.id)).not.toContain(
      EAT_AND_DRINK_ACTION_ID,
    );

    indoor.character.skills["eat-and-drink"] = { rank: 1 };
    expect(buildKitchenSkillActions(indoor).map((action) => action.id)).toContain(
      EAT_AND_DRINK_ACTION_ID,
    );
  });

  it("hides Purify water until the purification skill is acquired", () => {
    const indoor = makeIndoor();
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 1);
    const before = buildProcessFixtureActions(indoor).map((action) => action.id);
    expect(before).not.toContain("fixture:kitchen-purifier:purify");
    expect(before).toContain("fixture:kitchen-purifier:add-tablet");

    indoor.character.skills[WATER_PURIFICATION_SKILL] = { rank: 1 };
    const after = buildProcessFixtureActions(indoor).map((action) => action.id);
    expect(after).toContain("fixture:kitchen-purifier:purify");
    expect(after).not.toContain("fixture:kitchen-purifier:add-tablet");
    expect(after).not.toContain("fixture:kitchen-purifier:fill");
  });

  it("awards water-purification after the first tablet-and-fill", () => {
    const indoor = makeIndoor();
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 1);
    performProcessFixtureAction(indoor, "fixture:kitchen-sink:flow-on", indoor.gameState);
    performProcessFixtureAction(indoor, "fixture:kitchen-purifier:fill", indoor.gameState);
    const result = performProcessFixtureAction(
      indoor,
      "fixture:kitchen-purifier:add-tablet",
      indoor.gameState,
    );
    expect(result.ok).toBe(true);
    expect(indoor.character.skills[WATER_PURIFICATION_SKILL]?.rank).toBeGreaterThanOrEqual(1);
  });

  it("awards eat-and-drink only after purifying, tasting Tastee Tack, and drinking treated water", () => {
    const indoor = makeIndoor();
    expect(indoor.character.skills["eat-and-drink"]?.rank ?? 0).toBe(0);
    const beforeDrink = applyEffectsAtomically([
      { op: "skill.acquire", id: WATER_PURIFICATION_SKILL },
      { op: "knowledge.acquire", id: "tastee-tack-thirst" },
    ], { character: indoor.character, flags: indoor.flags });
    expect(beforeDrink.ok).toBe(true);
    expect(indoor.character.skills["eat-and-drink"]?.rank ?? 0).toBe(0);

    const afterDrink = applyEffectsAtomically([
      { op: "knowledge.acquire", id: "drank-purified-water" },
    ], { character: indoor.character, flags: indoor.flags });
    expect(afterDrink.ok).toBe(true);
    expect(indoor.character.skills["eat-and-drink"]?.rank).toBe(1);
  });

  it("eat-and-drink raises satiety and hydration above 80", () => {
    const indoor = makeIndoor({
      skills: {
        [WATER_PURIFICATION_SKILL]: { rank: 1 },
        "eat-and-drink": { rank: 1 },
      },
      stats: { satiety: 40, hydration: 40 },
    });
    addItem(indoor.character.holdings, definitions, "tastee-tack-turkey-cranberry-meal", 3);
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 2);
    addItem(indoor.character.holdings, definitions, "drinking-glass", 1);
    const cabinets = ensureFixedHolderAt(indoor.character.holdings, {
      room: "kitchen",
      stand: "cabinets",
      slots: 8,
    });
    addItem(indoor.character.holdings, definitions, "tastee-tack-turkey-cranberry-meal", 1, {
      holderId: cabinets,
    });

    const result = performEatAndDrinkShortcut(indoor, indoor.gameState);
    expect(result.ok).toBe(true);
    expect(result.eatAndDrinkPicker).toBeUndefined();
    expect(indoor.character.stats.satiety).toBeGreaterThan(SATISFIED_THRESHOLD);
    expect(indoor.character.stats.hydration).toBeGreaterThan(SATISFIED_THRESHOLD);
    expect(indoor.flags.has("day1.found-food")).toBe(true);
    expect(indoor.flags.has("day1.found-water")).toBe(true);
  });

  it("opens a picker when more than one food is in reach", () => {
    const indoor = makeIndoor({
      skills: {
        [WATER_PURIFICATION_SKILL]: { rank: 1 },
        "eat-and-drink": { rank: 1 },
      },
      stats: { satiety: 40, hydration: 40 },
    });
    addItem(indoor.character.holdings, definitions, "tastee-tack-turkey-cranberry-meal", 1);
    addItem(indoor.character.holdings, definitions, "tastee-tack-pioneer-breakfast", 1);
    addItem(indoor.character.holdings, definitions, "half-eaten-energy-bar", 1);
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 1);
    addItem(indoor.character.holdings, definitions, "drinking-glass", 1);

    const satietyBefore = indoor.character.stats.satiety;
    const result = performEatAndDrinkShortcut(indoor, indoor.gameState);
    expect(result.ok).toBe(true);
    expect(result.eatAndDrinkPicker?.food.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "tastee-tack-turkey-cranberry-meal",
      "tastee-tack-pioneer-breakfast",
      "half-eaten-energy-bar",
    ]));
    expect(indoor.character.stats.satiety).toBe(satietyBefore);

    const confirmed = performEatAndDrinkShortcut(indoor, indoor.gameState, {
      foodId: "tastee-tack-pioneer-breakfast",
      drinkId: "purifier:refill",
    });
    expect(confirmed.ok).toBe(true);
    expect(indoor.character.stats.satiety).toBeGreaterThan(SATISFIED_THRESHOLD);
    expect(itemQuantity(indoor.character.holdings, "tastee-tack-pioneer-breakfast")).toBe(0);
    expect(itemQuantity(indoor.character.holdings, "tastee-tack-turkey-cranberry-meal")).toBe(1);
  });

  it("lists glasses, the purifier, and bottles as separate drink choices", () => {
    const indoor = makeIndoor({
      skills: {
        [WATER_PURIFICATION_SKILL]: { rank: 1 },
        "eat-and-drink": { rank: 1 },
      },
    });
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 1);
    addItem(indoor.character.holdings, definitions, "drinking-glass", 2);
    addItem(indoor.character.holdings, definitions, "water-bottle", 1);
    const bottleId = Object.entries(indoor.character.holdings.instances ?? {})
      .find(([, record]) => record.item === "water-bottle")?.[0];
    indoor.character.holdings.instances[bottleId].contents = {
      item: "purified-water",
      amountMl: 250,
    };
    indoor.indoor.facility.fixtures["kitchen-purifier"] = {
      hasTablet: true,
      filled: true,
      stage: "ready",
      servingsLeft: 3,
    };

    const options = listEatAndDrinkOptions(indoor, indoor.gameState);
    expect(options.drink.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "vessel:water-bottle",
      "purifier:pour",
    ]));
    expect(options.drink.map((entry) => entry.id)).not.toContain("purifier:refill");
  });

  it("purify-water shortcut fills the container after the skill is learned", () => {
    const indoor = makeIndoor({
      skills: { [WATER_PURIFICATION_SKILL]: { rank: 1 } },
    });
    addItem(indoor.character.holdings, definitions, "purifier-tablet", 1);
    const result = performProcessFixtureAction(
      indoor,
      "fixture:kitchen-purifier:purify",
      indoor.gameState,
    );
    expect(result.ok).toBe(true);
    expect(indoor.indoor.facility.fixtures["kitchen-purifier"].stage).toBe("ready");
    expect(indoor.indoor.facility.fixtures["kitchen-purifier"].servingsLeft).toBe(4);
    expect(indoor.flags.has("kitchen.purified-water")).toBe(true);
  });
});
