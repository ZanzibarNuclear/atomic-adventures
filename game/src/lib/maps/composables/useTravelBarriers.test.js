import { describe, expect, it } from 'vitest'
import mapData from '../../../../content/world/map.yaml'
import { buildTravelWorld, evaluateNeighborMove } from '../testing/travelWorld.js'
import { axialToPixel, NEIGHBOR_DIRS, pixelToHex } from './useHexGeometry.js'
import { hexCenterStand } from './useAvatarStand.js'
import { buildRouteModels } from './useRoutes.js'
import {
  barrierSegments,
  firstBlockedOnPath,
  moveBlocked,
  resolveMove,
  segmentsCross,
  segmentIntersection,
  blockedLeavingDepartureHex,
  canEnterNeighbor,
} from './useTravelBarriers.js'

const verticalFence = {
  barriers: [{ a: { x: 100, y: -80 }, b: { x: 100, y: 200 }, kind: 'fence' }],
  openings: [],
}

const gateAtFence = {
  barriers: verticalFence.barriers,
  openings: [{ kind: 'gate', x: 100, y: 100, r: 22 }],
}

const TEST_HEX_SIZE = 44

function hexAtPoint(pt, fallback) {
  const { q, r } = pixelToHex(pt.x, pt.y, TEST_HEX_SIZE)
  const key = `${q},${r}`
  if (fallback === 'from' || fallback === 'to') {
    return { '0,0': 'from', '1,0': 'to' }[key] ?? fallback
  }
  return {
    '0,0': 'west',
    '1,0': 'east',
    '0,1': 'lower-stand',
    '-1,1': 'south-pines',
  }[key] ?? fallback
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
  it('builds collision segments from the same sampled curve used for a smooth barrier', () => {
    const hexes = [{ id: 'origin', q: 0, r: 0 }]
    const feature = {
      id: 'curved-fence',
      kind: 'fence',
      smooth: true,
      points: [
        { x: -40, y: 0 },
        { x: 0, y: 30 },
        { x: 40, y: 0 },
      ],
    }
    const [model] = buildRouteModels([feature], { origin: hexes[0] }, hexes, TEST_HEX_SIZE)
    const segments = barrierSegments([model])

    expect(model.points.length).toBeGreaterThan(feature.points.length)
    expect(segments).toHaveLength(model.points.length - 1)
    expect(segments[0].a).toBe(model.points[0])
    expect(segments[0].b).toBe(model.points[1])
    expect(segments.at(-1).b).toBe(model.points.at(-1))
  })

  it('blocks crossing a fence without an opening', () => {
    const path = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ]
    expect(firstBlockedOnPath(path, verticalFence)).not.toBeNull()
    expect(moveBlocked(null, null, path, verticalFence)).toBe('fence')
  })

  it('treats passage openings as irrelevant to path barrier checks', () => {
    const path = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ]
    expect(firstBlockedOnPath(path, gateAtFence)?.kind).toBe('fence')
    expect(moveBlocked(null, null, path, gateAtFence)).toBe('fence')
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

  it('blocks a river crossing even when a bridge opening exists off the path', () => {
    const ctx = {
      barriers: [{ a: { x: 0, y: 50 }, b: { x: 200, y: 50 }, kind: 'river' }],
      openings: [{ kind: 'bridge', x: 100, y: 50, r: 14 }],
    }
    const path = [
      { x: 100, y: 20 },
      { x: 100, y: 80 },
    ]
    expect(firstBlockedOnPath(path, ctx)?.kind).toBe('river')
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

describe('resolveMove', () => {
  const size = TEST_HEX_SIZE
  const fromHex = { id: 'west', q: 0, r: 0 }
  const toHex = { id: 'east', q: 1, r: 0 }

  it('enters the destination hex on the accessible side when the chord crosses a fence', () => {
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
      size,
    })
    expect(result.blockedKind).toBeNull()
    expect(result.activeHexId).toBe('east')
    expect(result.stand.x).toBeLessThan(100)
    expect(result.stand.x).toBeGreaterThan(60)
    expect(Math.abs(result.stand.y)).toBeLessThan(5)
  })

  it('completes an unblocked move at the destination stand', () => {
    const fromPos = { x: 76, y: -20 }
    const toPos = { x: 76, y: 20 }
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path: [fromPos, toPos],
      ctx: verticalFence,
      hexAtPoint,
      size,
    })
    expect(result.blockedKind).toBeNull()
    expect(result.activeHexId).toBe('east')
    expect(result.stand).toEqual(toPos)
  })

  it('enters the destination hex on the accessible side of an in-hex fence', () => {
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

    expect(result.blockedKind).toBeNull()
    expect(result.activeHexId).toBe('south-pines')
    expect(result.stand.x).toBeGreaterThan(-30)
  })
})

describe('reachable arrival stand selection', () => {
  const size = 44
  const fromHex = { id: 'from', q: 0, r: 0 }
  const toHex = { id: 'to', q: 1, r: 0, standAt: { x: 120, y: 0 } }
  const fromPos = { x: 0, y: 0 }
  const authoredStand = { x: 120, y: 0 }
  const centerStand = hexCenterStand(toHex, size)

  it('uses an authored stand when it is reachable', () => {
    const result = resolveMove({
      fromHex,
      toHex: { ...toHex, standAt: { x: 70, y: 20 } },
      fromPos,
      toPos: { x: 70, y: 20 },
      path: [fromPos, { x: 70, y: 20 }],
      ctx: verticalFence,
      hexAtPoint,
      size,
    })

    expect(result.blockedKind).toBeNull()
    expect(result.stand).toEqual({ x: 70, y: 20 })
  })

  it('uses a central point in the entered sub-area when an authored stand is across a closed barrier', () => {
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos: authoredStand,
      path: [fromPos, authoredStand],
      ctx: verticalFence,
      hexAtPoint,
      size,
    })

    expect(result.blockedKind).toBeNull()
    expect(result.stand.x).toBeLessThan(100)
    expect(result.stand.x).toBeGreaterThan(60)
    expect(result.stand).not.toEqual(authoredStand)
  })

  it('stops before the barrier when no destination stand is reachable', () => {
    const blockedCenter = {
      barriers: [{ a: { x: 40, y: -50 }, b: { x: 40, y: 50 }, kind: 'fence' }],
      openings: [],
    }
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos: authoredStand,
      path: [fromPos, authoredStand],
      ctx: blockedCenter,
      hexAtPoint,
      size,
    })

    expect(result.blockedKind).toBe('fence')
    expect(result.stand).not.toEqual(authoredStand)
    expect(result.stand).not.toEqual(centerStand)
  })
})

describe('single adjacent-move authority', () => {
  it('offers south-pines from lower-stand even though the fence is in the destination hex', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['lower-stand']
    const to = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))

    expect(m.offerable).toBe(true)
    expect(m.reachable).toBe(true)
    expect(m.enters).toBe(true)
  })

  it('center-pines to south-pines stays inside south-pines and does not drift below the cell', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['center-pines']
    const to = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))

    expect(m.enters).toBe(true)
    expect(m.result.activeHexId).toBe('south-pines')
    expect(world.hexAtPoint(m.result.stand, null)).toBe('south-pines')
    expect(m.result.stand.y).toBeLessThan(90)
  })

  it('lower-stand to south-pines stands safely inside the entered fence-side area', () => {
    const world = buildTravelWorld(mapData)
    const from = world.hexById['lower-stand']
    const to = world.hexById['south-pines']
    const m = evaluateNeighborMove(world, from, to, world.resolveStand(from))

    expect(m.enters).toBe(true)
    expect(m.result.activeHexId).toBe('south-pines')
    expect(m.result.stand.x).toBeGreaterThan(-30)
    expect(m.result.stand.x).toBeLessThan(0)
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
