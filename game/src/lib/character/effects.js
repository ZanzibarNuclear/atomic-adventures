import { applyCharacterState, captureCharacterState } from "../../composables/useCharacterState.js";
import { EFFECT_HANDLERS, catalogFor } from "./effectHandlers.js";
import { evaluateSkillAwards } from "./skillAwards.js";
import { syncComposureFromNeeds } from "./metabolism.js";

export function applyEffectsAtomically(effects = [], {
  character,
  flags = new Set(),
  now = () => new Date().toISOString(),
}) {
  const previousNeeds = {
    satiety: character?.stats?.satiety,
    hydration: character?.stats?.hydration,
  };
  const draft = captureCharacterState(character);
  const draftFlags = new Set(flags);
  const definitions = character.definitions ?? {};
  try {
    for (const effect of effects) applyEffect(draft, draftFlags, definitions, effect, now);
    evaluateSkillAwards(draft, draftFlags, definitions, now);
  } catch (error) {
    return { ok: false, error: error.message, effect: error.effect };
  }
  applyCharacterState(character, draft, { mergeAuthored: false });
  // Composure side effects from satiety/hydration transitions.
  syncComposureFromNeeds(character, { previous: previousNeeds });
  flags.clear();
  for (const flag of draftFlags) flags.add(flag);
  return { ok: true };
}

function applyEffect(state, flags, definitions, effect, now) {
  const fail = createEffectFailure(effect);
  const [domain, operation] = String(effect?.op ?? "").split(".");
  if (!domain || !operation) fail("Effect operation is required.");

  const handler = EFFECT_HANDLERS[domain];
  if (!handler) fail(`Unsupported effect domain "${domain}".`);

  const definition = domain === "flag"
    ? null
    : resolveDefinition(definitions, domain, effect, fail);
  handler({
    state,
    flags,
    definitions,
    effect,
    operation,
    definition,
    now,
    fail,
  });
}

function resolveDefinition(definitions, domain, effect, fail) {
  const catalog = catalogFor(definitions, domain);
  const definition = catalog[effect.id];
  if (!definition) fail(`Unknown ${domain} "${effect.id}".`);
  return definition;
}

function createEffectFailure(effect) {
  return (message) => {
    const error = new Error(message);
    error.effect = effect;
    throw error;
  };
}
