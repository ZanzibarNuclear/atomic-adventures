import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { getMovementOptions } from '../../../composables/usePlayPanel.js'
import { resolveAvatarPosition } from '../composables/useAvatarStand.js'
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
 * Complements geometry coverage in travelWorld tests; see docs/designs/hex-crawling.md.
 *
 * map.yaml `journey` is one story beat per hex; after the gate, gameplay walks
 * gate-woods → west-slope → utility-yard using generic adjacent travel.
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

  it(
    'journeys from trailhead through the gate to utility-yard',
    () => {
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
    expect(outdoor.state.stand.y, 'north of locked gate on arrival').toBeLessThan(-62)

    const lockedOptions = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(lockedOptions).toContain('Solve the puzzle to unlock')
    expect(lockedOptions).not.toContain('Go through the gate')
    expect(lockedOptions.some((l) => /^Go south\b/i.test(l))).toBe(false)

    passCompoundGate(outdoor)
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED), 'gate puzzle solved').toBe(true)
    expect(gameState.flags.has(GATE_FLAG_PASSED), 'gate crossed').toBe(true)

    expect(outdoor.state.stand.y).toBeGreaterThan(-62)
    const southOptions = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(southOptions.some((l) => /^Go south/i.test(l))).toBe(true)

    // Adjacent travel south: gate-woods → west-slope → utility-yard (journey skips the middle hex).
    expectMoveOk(outdoor, 'gate-woods', 'west-slope')
    expectMoveOk(outdoor, 'west-slope', 'utility-yard')

    const uyHex = mapData.hexes.find((h) => h.id === 'utility-yard')
    const driveway = resolveAvatarPosition(uyHex, outdoor.size)
    expect(outdoor.state.stand.x).toBeCloseTo(driveway.x, 0)
    expect(outdoor.state.stand.y).toBeCloseTo(driveway.y, 0)
    expect(outdoor.atBuildingEntrance).toBe(true)
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED)).toBe(true)
    expect(gameState.flags.has(GATE_FLAG_PASSED)).toBe(true)
  },
    15000,
  )
})
