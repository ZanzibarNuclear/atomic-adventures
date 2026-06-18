import { describe, expect, it } from 'vitest'
import {
  applyPassageCrossEffects,
  applyPassageUnlock,
  filterAvailablePassages,
  passageRequirementSatisfied,
} from './usePassageState.js'

describe('passage state', () => {
  const passage = {
    id: 'test-gate',
    require: { all: ['test.unlocked'] },
    unlock: { set_flags: ['test.unlocked'] },
    on_cross: { set_flags: ['test.passed'] },
  }

  it('uses authored requirements without passage-id knowledge', () => {
    const flags = new Set()
    expect(passageRequirementSatisfied(passage, flags)).toBe(false)
    expect(filterAvailablePassages([passage], flags)).toEqual([])

    expect(applyPassageUnlock(passage, flags)).toBe(true)
    expect(filterAvailablePassages([passage], flags)).toEqual([passage])
  })

  it('applies authored crossing effects', () => {
    const flags = new Set(['test.unlocked'])
    applyPassageCrossEffects(passage, flags)
    expect(flags.has('test.passed')).toBe(true)
  })
})
