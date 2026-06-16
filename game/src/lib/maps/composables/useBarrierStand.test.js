import { describe, expect, it } from 'vitest'
import {
  BARRIER_STAND_INSET,
  barrierXAtY,
  standBeforeBarrierHit,
  standBesideBarrierLine,
} from './useBarrierStand.js'

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
