import { applyEffectsAtomically } from "./effects.js";
import { ACTIVITY_PROFILES, advanceGameTime } from "./gameTime.js";
import {
  addItem,
  characterHolderId,
  createPartialItemInstance,
  itemQuantity,
  removeItem,
} from "./holdings.js";
import { hydrationPointsForMl } from "./metabolism.js";
import {
  applyVesselContentConsumption,
  isVesselDefinition,
  normalizeContents,
  planVesselContentConsumption,
  vesselCapacityMl,
  vesselIsEmpty,
} from "./vessels.js";

function itemDef(character, itemId) {
  return (character.definitions?.items ?? []).find((entry) => entry.id === itemId) ?? null;
}

export function availableItemActions(character, itemId, { recordId = null } = {}) {
  const item = itemDef(character, itemId);
  if (!item) return [];
  if (itemQuantity(character.holdings, itemId) <= 0) return [];

  // Vessel with contents: expose the content item's consume actions.
  if (isVesselDefinition(item) && recordId) {
    const instance = character.holdings.instances?.[recordId];
    if (instance?.item === itemId && !vesselIsEmpty(instance)) {
      const contents = normalizeContents(instance.contents);
      const liquid = itemDef(character, contents.item);
      return (liquid?.actions ?? []).filter((action) => isConsumptiveAction(action));
    }
    // Empty vessel: no drink/eat actions.
    if (instance?.item === itemId && vesselIsEmpty(instance)) return [];
  }

  // Vessel without recordId: if any held instance has contents, still list actions
  // (inventory UI always passes recordId for instances).
  if (isVesselDefinition(item) && !recordId) {
    const filled = Object.entries(character.holdings.instances ?? {})
      .find(([, record]) => record.item === itemId && !vesselIsEmpty(record));
    if (filled) {
      const contents = normalizeContents(filled[1].contents);
      const liquid = itemDef(character, contents.item);
      return (liquid?.actions ?? []).filter((action) => isConsumptiveAction(action));
    }
    return [];
  }

  return item.actions ?? [];
}

export function performItemAction(gameState, itemId, actionId, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const vesselDef = itemDef(gameState.character, itemId);
  if (isVesselDefinition(vesselDef)) {
    return performVesselContentAction(gameState, itemId, actionId, {
      holderId,
      recordId,
      optionId,
    });
  }

  const action = availableItemActions(gameState.character, itemId, { recordId })
    .find((entry) => entry.id === actionId);
  if (!action) return { ok: false, error: "Item action is not available." };
  if (action.timeMinutes > 0 && !ACTIVITY_PROFILES.includes(action.activity ?? "light")) {
    return { ok: false, error: "Item action has an invalid activity profile." };
  }
  const consumptive = isConsumptiveAction(action);
  let portion = { ok: true, scale: 1, instance: null, stackUnit: null };
  let consumptionSource = { ok: true, holderId: null };
  let wellbeingGate = { ok: true, notice: null, scale: 1 };
  if (consumptive) {
    consumptionSource = consumableActionSource(gameState.character, itemId, action, holderId);
    if (!consumptionSource.ok) return consumptionSource;
    portion = resolveConsumptionPortion(gameState.character, itemId, action, {
      holderId: consumptionSource.holderId ?? holderId,
      recordId,
      optionId,
    });
    if (!portion.ok) return portion;

    wellbeingGate = consumptionWellbeingGate(gameState.character, action, portion.scale);
    if (!wellbeingGate.ok) return wellbeingGate;
    portion = applyWellbeingScaleToPortion(portion, wellbeingGate.scale);
  }

  const sourceHolderId = consumptionSource.holderId ??
    (holderId && itemQuantity(gameState.character.holdings, itemId, { holderId }) > 0
      ? holderId
      : null);
  // Whole-unit consume (no partial instance) only when the entire unit is spent.
  const removeWholeUnit = consumptive &&
    action.consume > 0 &&
    !portion.instance &&
    !portion.stackUnit &&
    portion.scale >= 1 - 1e-9;
  const effects = [
    ...(removeWholeUnit
      ? [{
          op: "item.remove",
          id: itemId,
          quantity: action.consume,
          ...(sourceHolderId ? { holder: sourceHolderId } : {}),
        }]
      : []),
    ...(action.effects ?? [])
      .map((effect) => scaledEffect(effect, portion.scale))
      .map((effect) => sourceAwareEffect(effect, sourceHolderId)),
  ];
  const hadEatAndDrink = Number(gameState.character.skills?.["eat-and-drink"]?.rank ?? 0) > 0;
  const result = applyEffectsAtomically(effects, {
    character: gameState.character,
    flags: gameState.flags,
  });
  if (!result.ok) return result;
  if (consumptive) {
    const depletion = applyInstanceConsumption(gameState.character, itemId, action, portion, sourceHolderId);
    if (!depletion.ok) return depletion;
  }
  if (action.timeMinutes > 0) {
    const minutes = action.timeMinutes * (Number(portion.scale) || 1);
    if (minutes > 0) {
      const timeResult = advanceGameTime(
        gameState,
        minutes,
        action.activity ?? "light",
      );
      if (!timeResult.ok) return timeResult;
    }
  }
  const learnedEatAndDrink = !hadEatAndDrink
    && Number(gameState.character.skills?.["eat-and-drink"]?.rank ?? 0) > 0;
  const learnedNotice = learnedEatAndDrink
    ? "You've learned to eat Tastee Tack with water."
    : null;
  const notice = [wellbeingGate.notice, learnedNotice].filter(Boolean).join(" ") || null;
  return {
    ok: true,
    notice,
    view: action.view && typeof action.view === "object" ? { ...action.view } : null,
  };
}

function performVesselContentAction(gameState, vesselItemId, actionId, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const character = gameState.character;
  const vesselDef = itemDef(character, vesselItemId);
  const heldHolderId = characterHolderId(character.holdings);
  if (holderId && holderId !== heldHolderId) {
    return { ok: false, error: "Hold the vessel before using its contents." };
  }

  let instanceId = recordId;
  let instance = instanceId ? character.holdings.instances?.[instanceId] : null;
  if (!instance || instance.item !== vesselItemId) {
    const found = Object.entries(character.holdings.instances ?? {})
      .filter(([, record]) => record.item === vesselItemId)
      .filter(([, record]) => record.holder === heldHolderId)
      .find(([, record]) => !vesselIsEmpty(record));
    if (!found) return { ok: false, error: "No filled vessel is available." };
    instanceId = found[0];
    instance = found[1];
  }
  if (vesselIsEmpty(instance)) {
    return { ok: false, error: "The vessel is empty." };
  }

  const contents = normalizeContents(instance.contents);
  const contentDef = itemDef(character, contents.item);
  const action = (contentDef?.actions ?? []).find((entry) => entry.id === actionId);
  if (!action || !isConsumptiveAction(action)) {
    return { ok: false, error: "That action is not available for the contents." };
  }
  if (action.timeMinutes > 0 && !ACTIVITY_PROFILES.includes(action.activity ?? "light")) {
    return { ok: false, error: "Item action has an invalid activity profile." };
  }

  let plan = planVesselContentConsumption(instance, vesselDef, contentDef, action, { optionId });
  if (!plan.ok) return plan;

  // Hydration from vessels is volume-based (mL), not "one full vessel = one serving".
  const capacity = vesselCapacityMl(vesselDef);
  const pointsPerFullVessel = hydrationPointsForMl(capacity);
  const gateAction = {
    ...action,
    effects: (action.effects ?? []).map((effect) => (
      effect?.op === "stat.add" && effect.id === "hydration"
        ? { op: "stat.add", id: "hydration", value: pointsPerFullVessel, scaleBy: "portion" }
        : effect
    )),
  };

  const wellbeingGate = consumptionWellbeingGate(character, gateAction, plan.scale);
  if (!wellbeingGate.ok) return wellbeingGate;
  if (wellbeingGate.scale < plan.scale - 1e-9) {
    plan = applyWellbeingScaleToVesselPlan(
      plan,
      wellbeingGate.scale,
      capacity,
    );
  }

  const effects = (action.effects ?? [])
    .map((effect) => {
      if (effect?.op === "stat.add" && effect.id === "hydration") {
        return {
          ...effect,
          value: hydrationPointsForMl(plan.spentMl),
          scaleBy: undefined,
        };
      }
      return scaledEffect(effect, plan.scale);
    })
    .map((effect) => sourceAwareEffect(effect, heldHolderId));
  const result = applyEffectsAtomically(effects, {
    character,
    flags: gameState.flags,
  });
  if (!result.ok) return result;

  // applyEffects replaces holdings; re-resolve the live instance before mutating fill.
  const liveInstance = character.holdings.instances?.[instanceId];
  if (!liveInstance) {
    return { ok: false, error: "Vessel instance disappeared during consumption." };
  }
  applyVesselContentConsumption(liveInstance, plan);

  if (action.timeMinutes > 0) {
    const timeResult = advanceGameTime(
      gameState,
      action.timeMinutes * plan.scale,
      action.activity ?? "light",
    );
    if (!timeResult.ok) return timeResult;
  }

  const contentLabel = contentDef?.label ?? contents.item;
  const notice = plan.emptied
    ? `You finish the ${contentLabel}. The ${vesselDef.label ?? "vessel"} is empty.`
    : wellbeingGate.notice ?? null;

  return {
    ok: true,
    notice,
    view: action.view && typeof action.view === "object" ? { ...action.view } : null,
    vesselEmptied: plan.emptied,
  };
}

function consumableActionSource(character, itemId, action, holderId) {
  if (!isConsumptiveAction(action)) return { ok: true, holderId: null };
  const heldHolderId = characterHolderId(character.holdings);
  if (holderId && holderId !== heldHolderId) {
    return { ok: false, error: "Hold the item before consuming it." };
  }
  if (itemQuantity(character.holdings, itemId, { holderId: heldHolderId }) <= 0) {
    return { ok: false, error: "Hold the item before consuming it." };
  }
  return { ok: true, holderId: heldHolderId };
}

function isConsumptiveAction(action) {
  return Number(action.consume ?? 0) > 0 || (action.consumeOptions ?? []).length > 0;
}

/**
 * UI label for a consume option. "Eat all remaining" / "Drink all remaining"
 * always read as "Eat all" / "Drink all" — leftover amount is implied.
 */
export function consumeOptionLabel(option) {
  const label = String(option?.label ?? "").trim();
  if (!label) return label;
  return label.replace(/\s+remaining\s*$/i, "");
}

/**
 * Whether a portion choice should appear for the current leftover fraction.
 *
 * Fixed portions are of a *full* item (half = 50% of original). When the
 * leftover is already at or below that portion, the choice would finish the
 * item and is redundant with "all" — hide it.
 *
 * Small bites (nibble / sip, portion ≤ 0.25) stay available even if they
 * finish what is left; that is intentional.
 */
export function isConsumeOptionOffered(option, remainingFraction = 1) {
  const remaining = clampFraction(remainingFraction);
  if (!(remaining > 0)) return false;
  if (option?.remaining) return true;
  const portion = clampFraction(option?.portion);
  if (!(portion > 0)) return false;
  if (isSmallBiteOption(option, portion)) return true;
  return portion < remaining - 1e-9;
}

/**
 * Expand a consumptive action into the player-facing button choices for the
 * given leftover fraction (1 = whole / unknown stack unit).
 */
export function presentConsumeOptions(action, remainingFraction = 1) {
  const options = action?.consumeOptions ?? [];
  if (!options.length) {
    return action ? [{ ...action, optionId: null, buttonLabel: action.label }] : [];
  }
  return options
    .filter((option) => isConsumeOptionOffered(option, remainingFraction))
    .map((option) => ({
      ...action,
      optionId: option.id,
      buttonLabel: consumeOptionLabel(option) || action.label,
    }));
}

function isSmallBiteOption(option, portion = clampFraction(option?.portion)) {
  if (portion > 0 && portion <= 0.25 + 1e-9) return true;
  const id = String(option?.id ?? "");
  const label = String(option?.label ?? "");
  return /^(nibble|sip|small)$/i.test(id) || /^(nibble|sip)\b/i.test(label);
}

const WELLBEING_METER_IDS = new Set(["satiety", "hydration", "energy", "composure", "health"]);

/**
 * Plan consumptive wellbeing effects against the *primary* recovery meter
 * (largest positive meter gain — satiety on a meal beats a sip of hydration).
 *
 * - Already at meter max → soft refusal (not hungry / not thirsty / well rested).
 * - Otherwise allow the action, reducing portion scale so the primary meter
 *   tops off at max when the full request would overshoot. Leftover food/drink
 *   stays for later (nibble/sip of a larger "all" request).
 *
 * Returns `{ ok, scale, notice?, error? }`. Callers must apply `scale` to both
 * effects and inventory/vessel depletion.
 */
export function consumptionWellbeingGate(character, action, portionScale = 1) {
  const requested = Math.max(0, Number(portionScale) || 0);
  if (!(requested > 0)) return { ok: true, scale: requested };

  const primary = primaryWellbeingMeterEffect(character, action);
  if (!primary) return { ok: true, scale: requested };

  const { effect, definition, baseValue } = primary;
  const min = Number.isFinite(Number(definition.min)) ? Number(definition.min) : 0;
  const max = Number.isFinite(Number(definition.max)) ? Number(definition.max) : 100;
  const current = clampMeter(
    Number(character.stats?.[effect.id] ?? definition.default ?? min),
    min,
    max,
  );
  const headroom = max - current;

  if (headroom <= 1e-9) {
    return {
      ok: false,
      error: wellbeingMaxedMessage(effect.id),
      scale: 0,
    };
  }

  // Gain if the full requested portion is taken (portion-scaled or whole unit).
  const fullGain = baseValue * requested;
  if (!(fullGain > 0)) return { ok: true, scale: requested };

  if (fullGain <= headroom + 1e-9) {
    return { ok: true, scale: requested };
  }

  // Top off: spend only enough of the item to reach max.
  const scale = Math.min(requested, headroom / baseValue);
  if (!(scale > 0)) {
    return {
      ok: false,
      error: wellbeingMaxedMessage(effect.id),
      scale: 0,
    };
  }

  return {
    ok: true,
    scale,
  };
}

function primaryWellbeingMeterEffect(character, action) {
  const entries = (action.effects ?? [])
    .filter((effect) => effect?.op === "stat.add" && Number(effect.value) > 0)
    .map((effect) => {
      const definition = (character.definitions?.stats ?? [])
        .find((stat) => stat.id === effect.id);
      return {
        effect,
        definition,
        // Base gain at scale 1 (before portion). scaleBy:portion uses this base.
        baseValue: Number(effect.value),
      };
    })
    .filter(({ definition, baseValue }) =>
      definition?.type === "meter" &&
      Number.isFinite(baseValue) &&
      baseValue > 0 &&
      WELLBEING_METER_IDS.has(definition.id));

  if (!entries.length) return null;

  // Primary benefit = largest base meter gain (satiety 55 beats hydration 4).
  return entries.reduce((best, entry) =>
    entry.baseValue > best.baseValue ? entry : best
  );
}

function wellbeingMaxedMessage(statId) {
  if (statId === "satiety") return "You're not hungry right now.";
  if (statId === "hydration") return "You're not thirsty right now.";
  if (statId === "energy") return "You're already well rested.";
  if (statId === "composure") return "You're already calm enough.";
  return "That won't help right now.";
}

function clampMeter(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Reduce a resolved consumption portion so inventory/vessel depletion matches
 * the wellbeing top-off scale.
 */
export function applyWellbeingScaleToPortion(portion, scale) {
  if (!portion?.ok) return portion;
  const nextScale = Math.max(0, Number(scale) || 0);
  const remaining = Number.isFinite(Number(portion.remaining))
    ? Number(portion.remaining)
    : null;
  return {
    ...portion,
    scale: nextScale,
    nextRemaining: remaining == null
      ? portion.nextRemaining
      : Math.max(0, remaining - nextScale),
  };
}

/**
 * Rebuild a vessel consumption plan at a reduced scale (top-off sip).
 */
export function applyWellbeingScaleToVesselPlan(plan, scale, capacityMl) {
  if (!plan?.ok) return plan;
  const nextScale = Math.max(0, Number(scale) || 0);
  const capacity = Number(capacityMl) || 0;
  const spentMl = capacity > 0
    ? Number((nextScale * capacity).toFixed(2))
    : 0;
  const previousSpent = Number(plan.spentMl) || 0;
  const previousNext = Number(plan.nextMl);
  const amountBefore = previousSpent + (Number.isFinite(previousNext) ? previousNext : 0);
  const nextMl = Math.max(0, Number((amountBefore - spentMl).toFixed(2)));
  return {
    ...plan,
    scale: nextScale,
    spentMl,
    nextMl,
    emptied: nextMl <= 0.001,
  };
}

function resolveConsumptionPortion(character, itemId, action, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const options = action.consumeOptions ?? [];
  // Always prefer a concrete instance/stack so top-off can leave leftovers.
  const instance = resolveSourceInstance(character.holdings, itemId, { holderId, recordId });
  const stackUnit = instance
    ? null
    : resolveSourceStack(character.holdings, itemId, { holderId });

  if (!options.length) {
    if (instance) {
      const remaining = clampFraction(instance.record.remaining ?? 1);
      if (remaining <= 0) return { ok: false, error: "Nothing remains to consume." };
      return {
        ok: true,
        scale: remaining,
        instance,
        stackUnit: null,
        remaining,
        nextRemaining: 0,
      };
    }
    if (stackUnit) {
      return {
        ok: true,
        scale: 1,
        instance: null,
        stackUnit,
        remaining: 1,
        nextRemaining: 0,
      };
    }
    // Fallback for odd holdings layouts: whole-unit remove via effects.
    return { ok: true, scale: 1, instance: null, stackUnit: null };
  }

  if (instance) {
    const remaining = clampFraction(instance.record.remaining ?? 1);
    if (remaining <= 0) return { ok: false, error: "Nothing remains to consume." };
    const option = pickConsumeOption(options, optionId);
    if (!option) return { ok: false, error: "Consumption option is not available." };
    const requested = option.remaining ? remaining : clampFraction(option.portion);
    const spent = Math.min(remaining, requested);
    if (!(spent > 0)) return { ok: false, error: "Consumption amount must be positive." };
    return {
      ok: true,
      scale: spent,
      instance,
      stackUnit: null,
      remaining,
      nextRemaining: Math.max(0, remaining - spent),
    };
  }

  if (!stackUnit) return { ok: false, error: "Item is not available." };
  const remaining = 1;
  const option = pickConsumeOption(options, optionId);
  if (!option) return { ok: false, error: "Consumption option is not available." };
  const requested = option.remaining ? remaining : clampFraction(option.portion);
  const spent = Math.min(remaining, requested);
  if (!(spent > 0)) return { ok: false, error: "Consumption amount must be positive." };
  return {
    ok: true,
    scale: spent,
    instance: null,
    stackUnit,
    remaining,
    nextRemaining: Math.max(0, remaining - spent),
  };
}

function pickConsumeOption(options, optionId) {
  return options.find((entry) => entry.id === optionId) ??
    options.find((entry) => entry.remaining) ??
    options.at(-1) ??
    null;
}

function resolveSourceInstance(holdings, itemId, { holderId = null, recordId = null } = {}) {
  if (recordId && holdings.instances?.[recordId]?.item === itemId) {
    const record = holdings.instances[recordId];
    if (!holderId || record.holder === holderId) return { id: recordId, record };
  }
  // Prefer partially eaten instances over whole stack units.
  const partial = Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === itemId)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .filter(([, record]) => Number(record.remaining ?? 1) < 1)
    .map(([id, record]) => ({ id, record }));
  if (partial.length) return partial[0];
  return Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === itemId)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .map(([id, record]) => ({ id, record }))
    .at(0) ?? null;
}

function resolveSourceStack(holdings, itemId, { holderId = null } = {}) {
  return Object.entries(holdings.stacks ?? {})
    .filter(([, record]) => record.item === itemId && Number(record.quantity) > 0)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .map(([id, record]) => ({ id, record }))
    .at(0) ?? null;
}

function scaledEffect(effect, scale = 1) {
  if (effect?.scaleBy === "portion") {
    return {
      ...effect,
      value: Number(effect.value ?? 0) * scale,
    };
  }
  // Partial / top-off consumption: wellbeing meters track portion scale even
  // when the effect was authored without scaleBy: "portion".
  if (
    scale !== 1 &&
    effect?.op === "stat.add" &&
    Number(effect.value) > 0 &&
    WELLBEING_METER_IDS.has(effect.id)
  ) {
    return {
      ...effect,
      value: Number(effect.value ?? 0) * scale,
    };
  }
  return effect;
}

function applyInstanceConsumption(character, itemId, action, portion, sourceHolderId) {
  if (!isConsumptiveAction(action)) return { ok: true };
  if (portion.instance) {
    const instance = character.holdings.instances?.[portion.instance.id];
    if (!instance) return { ok: false, error: "Consumed item instance is no longer available." };
    if (portion.nextRemaining > 0) {
      instance.remaining = Number(portion.nextRemaining.toFixed(4));
      return { ok: true };
    }
    try {
      removeItem(character.holdings, character.definitions, itemId, 1, {
        holderId: instance.holder,
      });
      if (action.depletedItem) {
        addItem(character.holdings, character.definitions, action.depletedItem, 1, {
          holderId: sourceHolderId ?? instance.holder,
        });
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  if (portion.stackUnit) {
    try {
      removeItem(character.holdings, character.definitions, itemId, 1, {
        holderId: portion.stackUnit.record.holder,
      });
      if (portion.nextRemaining > 0) {
        createPartialItemInstance(character.holdings, itemId, {
          holderId: sourceHolderId ?? portion.stackUnit.record.holder,
          remaining: portion.nextRemaining,
        });
      } else if (action.depletedItem) {
        addItem(character.holdings, character.definitions, action.depletedItem, 1, {
          holderId: sourceHolderId ?? portion.stackUnit.record.holder,
        });
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

function sourceAwareEffect(effect, sourceHolderId) {
  if (!sourceHolderId || effect?.holder !== "$source") return effect;
  return {
    ...effect,
    holder: sourceHolderId,
  };
}

function clampFraction(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(1, Math.max(0, number));
}
