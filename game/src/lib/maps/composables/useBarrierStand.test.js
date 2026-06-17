import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld } from '../testing/travelWorld.js'
import {
  BARRIER_STAND_INSET,
  barrierXAtY,
  barrierHintAtStand,
  isNearBarrierKind,
  RIVER_BANK_MAX_DIST,
  standBeforeBarrierHit,
  standBesideBarrierLine,
} from './useBarrierStand.js'
import { isOnRiverBank } from './usePassageCrossing.js'

describe('standBeforeBarrierHit', () => {
  it('insets along the approach vector from the intersection', () => {
    const from = { x: 50, y: 100 }
    const hit = { x: 100, y: 100 }
    const stand = standBeforeBarrierHit(from, hit)
    expect(stand.x).toBeCloseTo(100 - BARRIER_STAND_INSET.fence)
    expect(stand.y).toBeCloseTo(100)
  })

  it('uses per-kind inset when provided', () => {
    const from = { x: 50, y: 100 }
    const hit = { x: 100, y: 100 }
    const stand = standBeforeBarrierHit(from, hit, { inset: 12 })
    expect(stand.x).toBeCloseTo(88)
  })

  it('falls back to intersection when approach vector is zero-length', () => {
    const hit = { x: 100, y: 100 }
    const stand = standBeforeBarrierHit(hit, hit)
    expect(stand).toEqual({ x: 100, y: 100 })
  })
})

describe('standBesideBarrierLine', () => {
  it('places stand east of the barrier line', () => {
    const stand = standBesideBarrierLine({ xAtY: 100, side: 'east', y: 50 })
    expect(stand).toEqual({ x: 108, y: 50 })
  })

  it('places stand west of the barrier line', () => {
    const stand = standBesideBarrierLine({ xAtY: 100, side: 'west', y: 50 })
    expect(stand).toEqual({ x: 92, y: 50 })
  })

  it('returns null when xAtY is null', () => {
    expect(standBesideBarrierLine({ xAtY: null, side: 'east', y: 50 })).toBeNull()
  })
})

describe('barrierXAtY', () => {
  it('interpolates x along a segment at y', () => {
    const segments = [{ a: { x: 0, y: 0 }, b: { x: 100, y: 100 } }]
    expect(barrierXAtY(segments, 50)).toBeCloseTo(50)
  })
})

describe('barrierHintAtStand', () => {
  const world = buildTravelWorld(mapData)
  const barriers = world.ctx.barriers

  it('flags upper-gorge drive end as river bank', () => {
    const pos = { x: -133, y: -130 }
    expect(isOnRiverBank(pos, barriers)).toBe(true)
    expect(barrierHintAtStand(pos, barriers)).toBe('river')
  })

  it('does not flag south-pines or lower-stand as river bank', () => {
    const south = { x: -38, y: 66 }
    const lower = world.resolveStand(world.hexById['lower-stand'])
    expect(isOnRiverBank(south, barriers)).toBe(false)
    expect(isOnRiverBank(lower, barriers)).toBe(false)
    expect(barrierHintAtStand(south, barriers)).not.toBe('river')
    expect(barrierHintAtStand(lower, barriers)).toBeNull()
  })

  it('prefers fence when closer than river at south-pines', () => {
    const south = { x: -38, y: 66 }
    expect(barrierHintAtStand(south, barriers)).toBe('fence')
  })

  it('does not flag gate approach north of the compound west fence run', () => {
    const approach = { x: -81, y: -76 }
    expect(barrierHintAtStand(approach, barriers)).toBeNull()
  })

  it('uses a tight river proximity threshold', () => {
    expect(RIVER_BANK_MAX_DIST).toBeLessThan(30)
    const inland = { x: -38, y: 66 }
    expect(isNearBarrierKind(inland, 'river', barriers)).toBe(false)
  })
})
