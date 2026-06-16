import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { getMovementOptions } from '../../../composables/usePlayPanel.js'
import {
  isNorthOfCompoundGate,
  isSouthOfCompoundGate,
} from '../composables/useCompoundGate.js'
import {
  buildGameplayWorld,
  canReachHex,
  gameplayMoveTo,
  GATE_FLAG_PASSED,
  GATE_FLAG_UNLOCKED,
  passCompoundGate,
} from './gameplayTravel.js'

/**
 * Smoke: Day-1 mainline journey using real gameplay (moveTo + gameState).
 * Complements barrierPassageJourney.test.js (barrier geometry via travelWorld).
 *
 * map.yaml `journey` is one story beat per hex; after the gate, gameplay walks
 * gate-woods → west-slope → utility-yard on hero-route (west-slope is not in journey).
 */
describe('story journey smoke test (gameplay)', () => {
  const JOURNEY = mapData.journey ?? []

  function expectMoveOk(outdoor, from, to) {
    const label = `${from} → ${to}`
    expect(canReachHex(outdoor, to), `${label} reachable`).toBe(true)
    gameplayMoveTo(outdoor, to)
    expect(outdoor.state.currentId, label).toBe(to)
    expect(outdoor.state.lastBlocked, label).toBeNull()
  }

  it('journeys from trailhead through the gate to utility-yard', () => {
    expect(JOURNEY).toEqual([
      'trailhead',
      'east-pines',
      'center-pines',
      'north-bend',
      'gate-woods',
      'utility-yard',
    ])

    const { outdoor, gameState } = buildGameplayWorld(mapData)
    expect(outdoor.state.currentId).toBe('trailhead')

    for (let i = 1; i < 5; i++) {
      expectMoveOk(outdoor, JOURNEY[i - 1], JOURNEY[i])
    }

    const gateStand = mapData.hexes.find((h) => h.id === 'gate-woods')?.standAt
    expect(outdoor.state.stand).toEqual({ x: gateStand.x, y: gateStand.y })
    expect(
      isNorthOfCompoundGate(outdoor.state.stand, outdoor.travelBarrierCtx),
      'north of locked gate on arrival',
    ).toBe(true)
    expect(isSouthOfCompoundGate(outdoor.state.stand, outdoor.travelBarrierCtx)).toBe(
      false,
    )

    const lockedOptions = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(lockedOptions).toContain('Solve the puzzle to unlock')
    expect(lockedOptions).not.toContain('Go through the gate')
    expect(lockedOptions.some((l) => /^Go south\b/i.test(l))).toBe(false)

    passCompoundGate(outdoor)
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED), 'gate puzzle solved').toBe(true)
    expect(gameState.flags.has(GATE_FLAG_PASSED), 'gate crossed').toBe(true)

    expect(isSouthOfCompoundGate(outdoor.state.stand, outdoor.travelBarrierCtx)).toBe(
      true,
    )
    const southOptions = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(southOptions.some((l) => /^Go south/i.test(l))).toBe(true)

    // Hero-route south: gate-woods → west-slope → utility-yard (journey skips the middle hex).
    expectMoveOk(outdoor, 'gate-woods', 'west-slope')
    expectMoveOk(outdoor, 'west-slope', 'utility-yard')
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED)).toBe(true)
    expect(gameState.flags.has(GATE_FLAG_PASSED)).toBe(true)
  })
})
