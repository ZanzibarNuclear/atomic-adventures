import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { createGameState } from '../../../composables/useGameState.js'
import utilityData from '../../../../content/world/utility-station.yaml'
import { getMovementOptions } from '../../../composables/usePlayPanel.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import {
  GATE_FLAG_PASSED,
  GATE_FLAG_UNLOCKED,
  isNorthOfCompoundGate,
} from '../composables/useCompoundGate.js'
import { buildTravelWorld, evaluateNeighborMove } from './travelWorld.js'
import { routeLegBetween, availableMoves } from '../composables/useRoutes.js'
import { resolveAvatarPosition } from '../composables/useAvatarStand.js'
import { standAcrossOpening } from '../composables/usePassageCrossing.js'
import { setFlags } from '../composables/useFlags.js'
import { barrierXAtY } from '../composables/useBarrierStand.js'

describe('compound gate production flow', () => {
  const world = buildTravelWorld(mapData)
  const gw = world.hexById['gate-woods']
  const nb = world.hexById['north-bend']
  const gate = world.ctx.openings.find((o) => o.id === 'compound-gate')

  function outdoorAtGate(gameState = null) {
    const outdoor = useOutdoorWorld(mapData, gameState)
    outdoor.state.currentId = 'gate-woods'
    outdoor.state.stand = resolveAvatarPosition(gw, world.size)
    return outdoor
  }

  it('arrives north of the gate from north-bend', () => {
    const fromPos = world.resolveStand(nb)
    const leg = routeLegBetween('north-bend', 'gate-woods', world.routeModels)
    expect(leg, 'hero-route leg north-bend → gate-woods').toBeTruthy()
    const m = evaluateNeighborMove(world, nb, gw, fromPos)
    expect(gw.standAt).toEqual({ x: -81, y: -76 })
    expect(m.path.length, 'uses route polyline').toBeGreaterThan(2)
    expect(m.hit, 'road stays east of fence').toBeNull()
    expect(m.result.blockedKind).toBeNull()
    expect(m.result.stand).toEqual({ x: -81, y: -76 })
    expect(m.result.stand.y).toBeLessThan(gate.y)
  })

  it('moveTo lands at authored stand when gate is locked', () => {
    const gameState = createGameState({ mapData, buildingData: utilityData })
    const outdoor = useOutdoorWorld(mapData, gameState)
    outdoor.state.currentId = 'north-bend'
    outdoor.state.stand = world.resolveStand(nb)
    outdoor.moveTo('gate-woods')
    expect(outdoor.state.stand).toEqual({ x: -81, y: -76 })
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(
      isNorthOfCompoundGate(outdoor.state.stand, outdoor.travelBarrierCtx),
    ).toBe(true)
  })

  it('offers solve puzzle before gate passage or south moves', () => {
    const gameState = createGameState({ mapData, buildingData: utilityData })
    const outdoor = outdoorAtGate(gameState)
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
    const gameState = createGameState({ mapData, buildingData: utilityData })
    const outdoor = outdoorAtGate(gameState)

    outdoor.solveGatePuzzle()
    let options = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(options).toContain('Go through the gate')
    expect(options).not.toContain('Solve the puzzle to unlock')
    expect(options.some((l) => /^Go south\b/i.test(l))).toBe(false)

    const opening = outdoor.travelBarrierCtx.openings.find(
      (o) => o.id === 'compound-gate',
    )
    outdoor.crossPassage('compound-gate')
    expect(gameState.flags.has(GATE_FLAG_UNLOCKED)).toBe(true)
    expect(gameState.flags.has(GATE_FLAG_PASSED)).toBe(true)

    options = getMovementOptions(outdoor, null).map((o) => o.label)
    expect(options.some((l) => l.match(/^Go south/i))).toBe(true)
    expect(opening).toBeTruthy()
  })

  it('shifts ford stands east with balanced river gaps at the ford', () => {
    world.revealOpening('mid-west-ford')
    const ford = world.ctx.openings.find((o) => o.id === 'mid-west-ford')
    const nw = world.hexById['north-west']
    const fromPos = evaluateNeighborMove(
      world,
      world.hexById['upper-gorge'],
      nw,
      world.resolveStand(world.hexById['upper-gorge']),
    ).result.stand
    const westBank = evaluateNeighborMove(
      world,
      nw,
      world.hexById['mid-west'],
      fromPos,
    ).result.stand
    const eastBank = standAcrossOpening(ford, westBank, world.ctx, world.size)
    const y = ford.y
    const riverX = barrierXAtY(
      world.ctx.barriers.filter((s) => s.kind === 'river'),
      y,
    )
    const westGap = riverX - westBank.x
    const eastGap = eastBank.x - riverX
    const westAtFord = standAcrossOpening(ford, { x: riverX - 30, y }, world.ctx, world.size)

    expect(westAtFord.x).toBeGreaterThan(riverX - 30)
    expect(Math.abs((riverX - westAtFord.x) - (eastBank.x - riverX))).toBeLessThan(6)
  })

  it('treats gate as open when story flags are already set', () => {
    const gameState = createGameState({ mapData, buildingData: utilityData })
    setFlags(gameState.flags, [GATE_FLAG_UNLOCKED, GATE_FLAG_PASSED])
    const outdoor = outdoorAtGate(gameState)
    const options = getMovementOptions(outdoor, null).map((o) => o.label)

    expect(options).not.toContain('Solve the puzzle to unlock')
    expect(options.some((l) => l.match(/^Go south/i))).toBe(true)
  })
})
