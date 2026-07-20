import { requireSatisfied, setFlags } from './useFlags.js'

/** Geometry-only map consumers have no gameplay flags, so authored locks are open. */
export function passageRequirementSatisfied(passage, flags) {
  if (!flags) return true
  return requireSatisfied(passage?.require, flags)
}

export function filterAvailablePassages(passages, flags) {
  return (passages ?? []).filter((passage) =>
    passageRequirementSatisfied(passage, flags),
  )
}

export function applyPassageUnlock(passage, flags) {
  if (!flags || !passage?.unlock?.set_flags?.length) return false
  setFlags(flags, passage.unlock.set_flags)
  return passageRequirementSatisfied(passage, flags)
}

export function applyPassageCrossEffects(passage, flags) {
  if (!flags || !passage?.on_cross?.set_flags?.length) return
  setFlags(flags, passage.on_cross.set_flags)
}

export function applyPassageOpenEffects(passage, flags) {
  if (!flags || !passage?.on_open?.set_flags?.length) return
  setFlags(flags, passage.on_open.set_flags)
}
