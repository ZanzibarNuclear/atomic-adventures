import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import {
  buildGameplayWorld,
  gameplayMoveTo,
  GATE_FLAG_PASSED,
  GATE_FLAG_UNLOCKED,
} from './gameplayTravel.js'
import { getMovementOptions } from '../../../composables/usePlayPanel.js'
import { distToBarrierKind } from '../composables/useBarrierStand.js'

/**
 * Gameplay smoke: locked compound gate with real moveTo + gameState.
 * Geometry-only tests (buildTravelWorld) leave the gate open and miss these paths.
 */
describe('compound gate gameplay', () => {
  const FENCE_X = -30

  function walkToRoadFork(outdoor) {
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'road-fork']) {
      gameplayMoveTo(outdoor, h)
    }
  }

  function atGateApproach(outdoor) {
    for (const h of ['east-pines', 'center-pines', 'north-bend', 'gate-woods']) {
      gameplayMoveTo(outdoor, h)
    }
  }

  it('enters north-bend outside the compound fence when walking from center-pines', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    gameplayMoveTo(outdoor, 'east-pines')
    gameplayMoveTo(outdoor, 'center-pines')
    gameplayMoveTo(outdoor, 'north-bend')

    expect(outdoor.state.currentId).toBe('north-bend')
    expect(outdoor.state.stand.x).toBeGreaterThan(FENCE_X)
  })

  it('road-fork south lands north of the locked gate, not inside the fence', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    walkToRoadFork(outdoor)
    gameplayMoveTo(outdoor, 'gate-woods')

    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -76 })
    expect(outdoor.state.stand.y).toBeLessThan(-62)
    expect(outdoor.state.atBarrier).not.toBe('fence')
    expect(outdoor.state.lastBlocked).toBeNull()
  })

  it('north-bend → gate-woods follows the compound road to the gate approach', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    gameplayMoveTo(outdoor, 'east-pines')
    gameplayMoveTo(outdoor, 'center-pines')
    gameplayMoveTo(outdoor, 'north-bend')
    expect(outdoor.state.stand.x).toBeGreaterThan(FENCE_X)

    gameplayMoveTo(outdoor, 'gate-woods')
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -76 })
  })

  it('offers solve puzzle before gate passage or south moves', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)
    const options = getMovementOptions(outdoor, null).map((o) => o.label)

    expect(options).toContain('Solve the puzzle to unlock')
    expect(options).not.toContain('Go through the gate')
    expect(options.some((l) => /^Go south\b/i.test(l))).toBe(false)
    expect(options).toContain('Go east')
    expect(outdoor.passageCrossings.map((c) => c.openingId)).not.toContain(
      'compound-gate',
    )
  })

  it('unlocks gate passage after solving the puzzle', () => {
    const { outdoor, gameState } = buildGameplayWorld(mapData)
    atGateApproach(outdoor)

    outdoor.unlockPassage('compound-gate')
    let options = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(options).toContain('Go through the gate')
    expect(options).not.toContain('Solve the puzzle to unlock')
    expect(options.some((l) => /^Go south\b/i.test(l))).toBe(false)

    outdoor.crossPassage('compound-gate')
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED)).toBe(true)
    expect(gameState.flags.has(GATE_FLAG_PASSED)).toBe(true)

    options = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(options.some((l) => l.match(/^Go south/i))).toBe(true)
  })

  it('treats gate as open when story flags are already set', () => {
    const { outdoor } = buildGameplayWorld(mapData, {
      flags: [GATE_FLAG_UNLOCKED, GATE_FLAG_PASSED],
    })
    outdoor.state.currentId = 'gate-woods'
    outdoor.state.stand = { x: -81, y: -76 }
    outdoor.crossPassage('compound-gate')
    const options = getMovementOptions(outdoor, null).map((o) => o.label)

    expect(options).not.toContain('Solve the puzzle to unlock')
    expect(options.some((l) => l.match(/^Go south/i))).toBe(true)
  })
})
