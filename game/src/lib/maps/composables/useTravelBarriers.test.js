import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from '../testing/travelWorld.js'
import { axialToPixel, NEIGHBOR_DIRS, pixelToHex } from './useHexGeometry.js'
import {
  firstBlockedOnPath,
  moveBlocked,
  openingAllows,
  resolveMove,
  segmentsCross,
  segmentIntersection,
  blockedLeavingDepartureHex,
  canEnterNeighbor,
} from './useTravelBarriers.js'

const verticalFence = {
  barriers: [{ a: { x: 100, y: 0 }, b: { x: 100, y: 200 }, kind: 'fence' }],
  openings: [],
}

const gateAtFence = {
  barriers: verticalFence.barriers,
  openings: [{ kind: 'gate', x: 100, y: 100, r: 22 }],
}

function hexAtPoint(pt, fallback) {
  return fallback
}

describe('segment geometry', () => {
  it('detects a strict crossing', () => {
    expect(
      segmentsCross(
        { x: 0, y: 100 },
        { x: 200, y: 100 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
      ),
    ).toBe(true)
  })

  it('ignores parallel segments', () => {
    expect(
      segmentsCross(
        { x: 50, y: 0 },
        { x: 50, y: 200 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
      ),
    ).toBe(false)
  })

  it('returns intersection param along the path', () => {
    const hit = segmentIntersection(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    )
    expect(hit).not.toBeNull()
    expect(hit.x).toBeCloseTo(100)
    expect(hit.y).toBeCloseTo(100)
    expect(hit.t).toBeCloseTo(0.5)
  })
})

describe('barrier crossings', () => {
  it('blocks crossing a fence without an opening', () => {
    const path = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ]
    expect(firstBlockedOnPath(path, verticalFence)).not.toBeNull()
    expect(moveBlocked(null, null, path, verticalFence)).toBe('fence')
  })

  it('allows crossing at a gate opening', () => {
    const path = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ]
    expect(firstBlockedOnPath(path, gateAtFence)).toBeNull()
    expect(moveBlocked(null, null, path, gateAtFence)).toBeNull()
  })

  it('allows walking parallel to a fence without crossing it', () => {
    const path = [
      { x: 80, y: 40 },
      { x: 80, y: 160 },
    ]
    expect(firstBlockedOnPath(path, verticalFence)).toBeNull()
  })

  it('does not block at the path origin on a barrier (walk along / start on fence)', () => {
    const path = [
      { x: 100, y: 100 },
      { x: 180, y: 100 },
    ]
    // Intersection is at t≈0 — skipped so movement away from the fence line is not
    // immediately blocked when already standing on it.
    expect(firstBlockedOnPath(path, verticalFence)).toBeNull()
  })

  it('blocks a river crossing without a bridge', () => {
    const ctx = {
      barriers: [{ a: { x: 0, y: 50 }, b: { x: 200, y: 50 }, kind: 'river' }],
      openings: [],
    }
    const path = [
      { x: 100, y: 20 },
      { x: 100, y: 80 },
    ]
    expect(firstBlockedOnPath(path, ctx)?.kind).toBe('river')
  })

  it('allows a river crossing at a bridge', () => {
    const ctx = {
      barriers: [{ a: { x: 0, y: 50 }, b: { x: 200, y: 50 }, kind: 'river' }],
      openings: [{ kind: 'bridge', x: 100, y: 50, r: 14 }],
    }
    const path = [
      { x: 100, y: 20 },
      { x: 100, y: 80 },
    ]
    expect(firstBlockedOnPath(path, ctx)).toBeNull()
  })

  it('allows walking parallel to a river without crossing it', () => {
    const ctx = {
      barriers: [{ a: { x: 0, y: 50 }, b: { x: 200, y: 50 }, kind: 'river' }],
      openings: [],
    }
    const path = [
      { x: 100, y: 60 },
      { x: 100, y: 120 },
    ]
    expect(firstBlockedOnPath(path, ctx)).toBeNull()
  })
})

describe('openingAllows', () => {
  it('accepts only matching opening kinds for the barrier', () => {
    const openings = [{ kind: 'gate', x: 10, y: 10, r: 20 }]
    expect(openingAllows('fence', 10, 10, openings)).toBe(true)
    expect(openingAllows('river', 10, 10, openings)).toBe(false)
  })

  it('respects opening radius', () => {
    const openings = [{ kind: 'gate', x: 0, y: 0, r: 10 }]
    expect(openingAllows('fence', 9, 0, openings)).toBe(true)
    expect(openingAllows('fence', 11, 0, openings)).toBe(false)
  })

  it('rejects river shortcut chords that only graze the opening disc off-axis', () => {
    const openings = [{ kind: 'bridge', x: -138, y: -144, r: 14 }]
    // Horizontal chord crossing the river 12px below the bridge anchor.
    expect(openingAllows('river', -143, -132, openings)).toBe(false)
    // Path that crosses at the bridge.
    expect(openingAllows('river', -138, -144, openings)).toBe(true)
  })
})

describe('resolveMove', () => {
  const fromHex = { id: 'west', q: 0, r: 0 }
  const toHex = { id: 'east', q: 1, r: 0 }

  it('stops before a fence with stand short of the crossing', () => {
    const fromPos = { x: 50, y: 100 }
    const toPos = { x: 150, y: 100 }
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path: [fromPos, toPos],
      ctx: verticalFence,
      hexAtPoint,
    })
    expect(result.blockedKind).toBe('fence')
    expect(result.stand.x).toBeLessThan(100)
    expect(result.stand.y).toBeCloseTo(100, 0)
  })

  it('completes an unblocked move at the destination stand', () => {
    const fromPos = { x: 80, y: 40 }
    const toPos = { x: 80, y: 160 }
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path: [fromPos, toPos],
      ctx: verticalFence,
      hexAtPoint,
    })
    expect(result.blockedKind).toBeNull()
    expect(result.stand).toEqual(toPos)
  })

  it('uses the destination hex when blocked at a fence (reveals fog on approach)', () => {
    const size = 44
    const fromHex = { id: 'lower-stand', q: 0, r: 1 }
    const toHex = { id: 'south-pines', q: -1, r: 1 }
    const fromPos = { x: 38.1, y: 66 }
    const toPos = { x: -38.1, y: 66 }
    const eastFence = {
      barriers: [{ a: { x: -30, y: -50 }, b: { x: -30, y: 140 }, kind: 'fence' }],
      openings: [],
    }

    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path: [fromPos, toPos],
      ctx: eastFence,
      hexAtPoint,
      size,
    })

    expect(result.blockedKind).toBe('fence')
    expect(result.activeHexId).toBe('south-pines')
    expect(result.stand).not.toEqual(toPos)
  })
})

describe('canOfferNeighbor vs canReachNeighbor', () => {
  it('offers south-pines from lower-stand even though the fence is in the destination hex', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['lower-stand']
    const to = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))

    expect(m.offerable).toBe(true)
    expect(m.reachable).toBe(false)
    expect(m.enters).toBe(true)
  })
})

describe('parallel barrier walks', () => {
  it('does not block when both path endpoints stay on the same side of a river segment', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['mid-west']
    const to = world.hexById['utility-yard']
    const fromPos = world.resolveStand(from)
    const m = evaluateNeighborMove(world, from, to, fromPos)

    expect(m.reachable).toBe(true)
    expect(m.offerable).toBe(true)
    expect(m.result.blockedKind).toBeNull()
  })

  it('enters adjacent hexes along a barrier in every hex direction', () => {
    const size = 44
    for (const dir of NEIGHBOR_DIRS) {
      const fromHex = { id: 'from', q: 0, r: 0 }
      const toHex = { id: `to-${dir.q}-${dir.r}`, q: dir.q, r: dir.r }
      const fromCenter = axialToPixel(fromHex.q, fromHex.r, size)
      const toCenter = axialToPixel(toHex.q, toHex.r, size)
      const vx = toCenter.x - fromCenter.x
      const vy = toCenter.y - fromCenter.y
      const len = Math.hypot(vx, vy)
      const ux = vx / len
      const uy = vy / len
      const nx = -uy
      const ny = ux
      const mid = {
        x: (fromCenter.x + toCenter.x) / 2,
        y: (fromCenter.y + toCenter.y) / 2,
      }
      const fromPos = {
        x: fromCenter.x + nx * size * 0.35,
        y: fromCenter.y + ny * size * 0.35,
      }
      const toPos = {
        x: toCenter.x - nx * size * 0.35,
        y: toCenter.y - ny * size * 0.35,
      }
      const ctx = {
        barriers: [
          {
            a: { x: mid.x - ux * size * 2, y: mid.y - uy * size * 2 },
            b: { x: mid.x + ux * size * 2, y: mid.y + uy * size * 2 },
            kind: 'fence',
          },
        ],
        openings: [],
      }
      const coordMap = new Map([
        ['0,0', fromHex.id],
        [`${toHex.q},${toHex.r}`, toHex.id],
      ])
      const hexAt = (pt, fallback) => {
        const h = pixelToHex(pt.x, pt.y, size)
        return coordMap.get(`${h.q},${h.r}`) ?? fallback
      }
      const args = {
        fromHex,
        toHex,
        fromPos,
        toPos,
        path: [fromPos, toPos],
        ctx,
        hexAtPoint: hexAt,
        size,
      }

      expect(
        firstBlockedOnPath([fromPos, toPos], ctx),
        `${toHex.id} direct stand path should hit the barrier`,
      ).not.toBeNull()
      expect(canEnterNeighbor(args), `${toHex.id} should be enterable`).toBe(true)
      const result = resolveMove(args)
      expect(result.blockedKind, `${toHex.id} should not be blocked`).toBeNull()
      expect(result.activeHexId, `${toHex.id} should become active`).toBe(toHex.id)
    }
  })
})

describe('blockedLeavingDepartureHex', () => {
  it('ignores fence hits in the neighboring hex when offering a move', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['lower-stand']
    const fromPos = world.resolveStand(from)
    const toPos = world.resolveStand(world.hexById['south-pines'])
    const path = [fromPos, toPos]

    expect(blockedLeavingDepartureHex(path, from.id, world.ctx, world.hexAtPoint)).toBeNull()
  })
})
