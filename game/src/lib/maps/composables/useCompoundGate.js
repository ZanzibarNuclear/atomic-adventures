import { hasFlag, setFlags } from './useFlags.js'

export const GATE_FLAG_UNLOCKED = 'compound.gate-unlocked'
export const GATE_FLAG_PASSED = 'compound.gate-passed'
export const COMPOUND_GATE_ID = 'compound-gate'
export const GATE_HEX_ID = 'gate-woods'

/** When no story flags are wired, gate passages behave as unlocked (map tests). */
export function gateStateFromFlags(flags) {
  if (!flags) {
    return { unlocked: true, passed: true }
  }
  return {
    unlocked: hasFlag(flags, GATE_FLAG_UNLOCKED),
    passed: hasFlag(flags, GATE_FLAG_PASSED),
  }
}

export function compoundGateOpening(ctx) {
  const list = ctx?.allOpenings ?? ctx?.openings
  return list?.find((o) => o.id === COMPOUND_GATE_ID) ?? null
}

export function isNorthOfCompoundGate(pos, ctx) {
  const gate = compoundGateOpening(ctx)
  if (!gate || pos?.y == null) return false
  return pos.y < gate.y
}

export function isSouthOfCompoundGate(pos, ctx) {
  const gate = compoundGateOpening(ctx)
  if (!gate || pos?.y == null) return false
  return pos.y > gate.y
}

export function filterOpeningsForGateState(openings, flags) {
  const { unlocked } = gateStateFromFlags(flags)
  if (unlocked) return openings
  return openings.filter((o) => o.id !== COMPOUND_GATE_ID)
}

export function unlockCompoundGate(flags) {
  if (!flags) return
  setFlags(flags, [GATE_FLAG_UNLOCKED])
}

export function markCompoundGatePassed(flags) {
  if (!flags) return
  setFlags(flags, [GATE_FLAG_PASSED])
}
