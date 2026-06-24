import { describe, expect, it } from 'vitest'
import { mapData } from '../../testing/content.js'
import {
  buildMapMovementAudit,
  movementAuditSummary,
} from '../debug/mapMovementAudit.js'
import {
  BARRIER_STAND_INSET,
  distToBarrierKind,
} from '../composables/useBarrierStand.js'
import { pointInHexPolygon } from '../composables/useTravelBarriers.js'
import {
  adjacentHexes,
  firstBlockedOnPath,
} from './travelWorld.js'
import { gameplayMoveTo } from './gameplayTravel.js'
import {
  createMovementCaseWorld,
  expectedArrivalState,
  fenceSideAt,
  MAP_MOVEMENT_CASES,
  movementCaseById,
  riverSideAt,
} from './mapMovementCases.js'

const BARRIER_KINDS = ['fence', 'river', 'cliff', 'ravine']

function sorted(values) {
  return [...values].sort()
}

function renameWorldHex(world, from, to) {
  world.hexes.find((hex) => hex.id === from).id = to
  if (world.start === from) world.start = to
  world.journey = world.journey.map((id) => (id === from ? to : id))
  for (const route of world.routes ?? []) {
    for (const point of route.points ?? []) {
      if (point.hex === from) point.hex = to
    }
  }
  for (const feature of world.features ?? []) {
    if (feature.hex === from) feature.hex = to
    for (const key of ['at', 'labelAt', 'boothAt']) {
      if (feature[key]?.hex === from) feature[key].hex = to
    }
    for (const point of feature.points ?? []) {
      if (point.hex === from) point.hex = to
    }
  }
}

function offeredDestinations(outdoor) {
  return sorted(
    new Set([
      ...outdoor.moves.map((move) => move.toHexId),
      ...outdoor.directMoves.map((move) => move.toHexId),
    ]),
  )
}

function snapshot(outdoor, gameState) {
  return {
    currentId: outdoor.state.currentId,
    stand: { ...outdoor.state.stand },
    lastBlocked: outdoor.state.lastBlocked,
    atBarrier: outdoor.state.atBarrier,
    discovered: [...outdoor.state.discovered],
    discoveredOpenings: [...outdoor.state.discoveredOpenings],
    flags: [...gameState.flags],
  }
}

function restore(outdoor, gameState, saved) {
  outdoor.state.currentId = saved.currentId
  outdoor.state.stand = { ...saved.stand }
  outdoor.state.lastBlocked = saved.lastBlocked
  outdoor.state.atBarrier = saved.atBarrier
  outdoor.state.discovered = [...saved.discovered]
  outdoor.state.discoveredOpenings = [...saved.discoveredOpenings]
  gameState.flags.clear()
  for (const flag of saved.flags) gameState.flags.add(flag)
  outdoor.traveling = false
}

function regionAt(outdoor) {
  return {
    river: riverSideAt(
      outdoor.state.stand,
      outdoor.travelBarrierCtx.barriers,
    ),
    fence: fenceSideAt(outdoor.state.stand),
  }
}

function expectRegion(outdoor, expectedCase, label) {
  const actual = regionAt(outdoor)
  if (expectedCase.region?.river) {
    expect.soft(actual.river, `${label}: river side`).toBe(
      expectedCase.region.river,
    )
  }
  if (expectedCase.region?.fence) {
    expect.soft(actual.fence, `${label}: fence side`).toBe(
      expectedCase.region.fence,
    )
  }
}

function expectSafeStand(outdoor, hexId, label) {
  const hex = outdoor.hexById[hexId]
  expect.soft(
    pointInHexPolygon(outdoor.state.stand, hex, outdoor.size),
    `${label}: stand must be inside ${hexId}`,
  ).toBe(true)

  for (const kind of BARRIER_KINDS) {
    const distance = distToBarrierKind(
      outdoor.state.stand,
      kind,
      outdoor.travelBarrierCtx.barriers,
    )
    if (distance == null) continue
    expect.soft(
      distance,
      `${label}: ${kind} clearance at ${JSON.stringify(outdoor.state.stand)}`,
    ).toBeGreaterThanOrEqual(
      BARRIER_STAND_INSET[kind] ?? BARRIER_STAND_INSET.fence,
    )
  }
}

function movementRow({
  movementCase,
  destination,
  offered,
  entered,
  stand,
  expectedState,
  actualRegion,
}) {
  return [
    movementCase.id.padEnd(38),
    String(destination).padEnd(14),
    `offered=${String(offered).padEnd(5)}`,
    `entered=${String(entered).padEnd(5)}`,
    `stand=${stand.x},${stand.y}`.padEnd(20),
    `region=${actualRegion.river}/${actualRegion.fence}`.padEnd(24),
    `expected=${expectedState}`,
  ].join(' | ')
}

describe('map-wide outdoor movement audit', () => {
  it('reports stale audit cases instead of throwing when a hex is removed', () => {
    const sourceHexId = mapData.start
    const renamed = structuredClone(mapData)
    renamed.hexes = renamed.hexes.filter((hex) => hex.id !== sourceHexId)
    renamed.start = 'east-pines'
    renamed.journey = renamed.journey.filter((id) => id !== sourceHexId)

    expect(() => buildMapMovementAudit(renamed)).not.toThrow()
    const entries = buildMapMovementAudit(renamed)

    expect(
      entries.some((entry) =>
        entry.reason.includes(`missing source hex "${sourceHexId}"`),
      ),
    ).toBe(true)
    expect(
      entries.some((entry) =>
        entry.reason.includes(`missing destination hex "${sourceHexId}"`),
      ),
    ).toBe(true)
  })

  it('infers audit renames when a hex id changes but its position does not', () => {
    const sourceHexId = mapData.start
    const renamedHexId = `${sourceHexId}-renamed`
    const renamed = structuredClone(mapData)
    renameWorldHex(renamed, sourceHexId, renamedHexId)

    const entries = buildMapMovementAudit(renamed)

    expect(
      entries.filter((entry) => entry.reason.includes('missing')),
    ).toEqual([])
  })

  it('uses authored audit renames to follow renamed hex ids', () => {
    const sourceHexId = mapData.start
    const renamedHexId = `${sourceHexId}-renamed`
    const renamed = structuredClone(mapData)
    renameWorldHex(renamed, sourceHexId, renamedHexId)
    renamed.movementAuditRenames = [
      { kind: 'hex', from: sourceHexId, to: renamedHexId },
    ]

    const entries = buildMapMovementAudit(renamed)

    expect(
      entries.filter((entry) => entry.reason.includes('missing')),
    ).toEqual([])
  })

  it('builds a complete visual overlay with no invalid paths', () => {
    const entries = buildMapMovementAudit(mapData)
    const summary = movementAuditSummary(entries)
    const states = new Set(entries.map((entry) => entry.stateId))

    expect(states).toEqual(
      new Set(MAP_MOVEMENT_CASES.map((movementCase) => movementCase.id)),
    )
    expect(summary.total).toBeGreaterThan(54)
    expect(summary.valid).toBeGreaterThan(0)
    expect(summary.blocked).toBeGreaterThan(0)
    expect(
      entries
        .filter((entry) => entry.status === 'invalid')
        .map((entry) => `${entry.id}: ${entry.reason} @ ${JSON.stringify(entry.stand)}`),
    ).toEqual([])
  })

  it('classifies every adjacent direction from every canonical state', () => {
    const directedEdges = new Set()
    for (const fromHex of mapData.hexes) {
      for (const toHex of adjacentHexes(fromHex, mapData.hexes)) {
        directedEdges.add(`${fromHex.id}->${toHex.id}`)
      }
    }

    const classifiedEdges = new Set()
    for (const movementCase of MAP_MOVEMENT_CASES) {
      const fromHex = mapData.hexes.find(
        (hex) => hex.id === movementCase.hexId,
      )
      const adjacent = sorted(
        adjacentHexes(fromHex, mapData.hexes).map((hex) => hex.id),
      )
      const expected = sorted(movementCase.expectedMoves)
      const forbidden = sorted(movementCase.forbiddenMoves)
      const classified = sorted(new Set([...expected, ...forbidden]))

      expect.soft(
        classified,
        `${movementCase.id}: every adjacent destination must be expected or forbidden`,
      ).toEqual(adjacent)
      expect.soft(
        expected.filter((id) => forbidden.includes(id)),
        `${movementCase.id}: expected/forbidden overlap`,
      ).toEqual([])

      for (const destination of classified) {
        classifiedEdges.add(`${movementCase.hexId}->${destination}`)
      }
      for (const destination of expected) {
        const arrivalId = expectedArrivalState(movementCase, destination)
        expect.soft(
          movementCaseById(arrivalId),
          `${movementCase.id}->${destination}: missing canonical arrival state ${arrivalId}`,
        ).toBeTruthy()
      }
    }

    expect(sorted(classifiedEdges)).toEqual(sorted(directedEdges))
    expect(directedEdges.size).toBe(54)
  })

  it(
    'executes every expected move and rejects every forbidden move',
    () => {
      const auditRows = []
      for (const movementCase of MAP_MOVEMENT_CASES) {
        const { outdoor, gameState } = createMovementCaseWorld(
          mapData,
          movementCase,
        )
        const saved = snapshot(outdoor, gameState)
        const setupLabel = movementCase.id

        expect.soft(outdoor.state.currentId, `${setupLabel}: setup hex`).toBe(
          movementCase.hexId,
        )
        expectRegion(outdoor, movementCase, setupLabel)
        expectSafeStand(outdoor, movementCase.hexId, setupLabel)

        const offered = offeredDestinations(outdoor)
        expect.soft(offered, `${setupLabel}: offered destinations`).toEqual(
          sorted(movementCase.expectedMoves),
        )

        for (const destination of movementCase.expectedMoves) {
          restore(outdoor, gameState, saved)
          const expectedStateId = expectedArrivalState(
            movementCase,
            destination,
          )
          const expectedCase = movementCaseById(expectedStateId)
          const preview = outdoor.previewMove(destination)

          expect.soft(
            preview?.result.activeHexId,
            `${setupLabel}->${destination}: preview destination`,
          ).toBe(destination)
          expect.soft(
            preview?.result.path
              ? firstBlockedOnPath(
                  preview.result.path,
                  outdoor.travelBarrierCtx,
                )
              : null,
            `${setupLabel}->${destination}: resolved path crosses a barrier`,
          ).toBeNull()
          expect.soft(
            outdoor.canReachHex(destination),
            `${setupLabel}->${destination}: canReachHex`,
          ).toBe(true)

          gameplayMoveTo(outdoor, destination)
          const row = movementRow({
            movementCase,
            destination,
            offered: offered.includes(destination),
            entered: outdoor.state.currentId === destination,
            stand: outdoor.state.stand,
            expectedState: expectedStateId,
            actualRegion: regionAt(outdoor),
          })
          auditRows.push(row)
          expect.soft(outdoor.state.currentId, row).toBe(destination)
          expect.soft(outdoor.state.lastBlocked, row).toBeNull()
          expectSafeStand(outdoor, destination, row)
          expectRegion(outdoor, expectedCase, row)
        }

        for (const destination of movementCase.forbiddenMoves) {
          restore(outdoor, gameState, saved)
          const before = { ...outdoor.state.stand }
          expect.soft(
            outdoor.canReachHex(destination),
            `${setupLabel}->${destination}: forbidden canReachHex`,
          ).toBe(false)
          gameplayMoveTo(outdoor, destination)
          auditRows.push(
            movementRow({
              movementCase,
              destination,
              offered: offered.includes(destination),
              entered: outdoor.state.currentId === destination,
              stand: outdoor.state.stand,
              expectedState: 'forbidden',
              actualRegion: regionAt(outdoor),
            }),
          )
          expect.soft(
            outdoor.state.currentId,
            `${setupLabel}->${destination}: forbidden move changed hex`,
          ).toBe(movementCase.hexId)
          expect.soft(
            outdoor.state.stand,
            `${setupLabel}->${destination}: forbidden move changed stand`,
          ).toEqual(before)
        }
      }

      if (process.env.MOVEMENT_AUDIT_REPORT) {
        console.log(
          [
            'Map movement audit',
            'state                                  | destination    | offered       | entered       | stand                | region                   | expected',
            ...auditRows,
          ].join('\n'),
        )
      }
    },
    120000,
  )

  it(
    'verifies unlock, discovery, and both directions of every local passage',
    () => {
      const transitions = [
        {
          from: 'gate-woods:north-of-fence',
          opening: 'compound-gate',
          to: 'gate-woods:south-of-fence',
          toggle: true,
        },
        {
          from: 'upper-gorge:east-bank',
          opening: 'upper-gorge-bridge',
          to: 'upper-gorge:west-bank',
        },
        {
          from: 'mid-west:east-bank',
          opening: 'mid-west-ford',
          to: 'mid-west:west-bank',
          search: true,
        },
        {
          from: 'south-pines:east-of-fence',
          opening: 'south-pines-hole',
          to: 'south-pines:west-of-fence',
          search: true,
        },
      ]

      for (const transition of transitions) {
        const fromCase = movementCaseById(transition.from)
        const toCase = movementCaseById(transition.to)
        const { outdoor } = createMovementCaseWorld(mapData, fromCase)
        const label = `${transition.from} --${transition.opening}--> ${transition.to}`

        if (transition.toggle) {
          expect.soft(
            outdoor.passageToggleActions.map((action) => action.openingId),
            `${label}: toggle action`,
          ).toContain(transition.opening)
          expect.soft(
            outdoor.passageCrossings.map((crossing) => crossing.openingId),
            `${label}: closed passage should not be crossable`,
          ).not.toContain(transition.opening)
          expect.soft(outdoor.togglePassage(transition.opening), label).toBe(true)
        }

        if (transition.search) {
          expect.soft(
            outdoor.searchableOpenings().map((opening) => opening.id),
            `${label}: searchable opening`,
          ).toContain(transition.opening)
          outdoor.searchBarrier()
          expect.soft(
            outdoor.state.discoveredOpenings,
            `${label}: discovered opening`,
          ).toContain(transition.opening)
        }

        expect.soft(
          outdoor.passageCrossings.map((crossing) => crossing.openingId),
          `${label}: crossing action`,
        ).toContain(transition.opening)
        outdoor.crossPassage(transition.opening)
        expectRegion(outdoor, toCase, `${label}: far side`)
        expectSafeStand(outdoor, toCase.hexId, `${label}: far side`)

        expect.soft(
          outdoor.passageCrossings.map((crossing) => crossing.openingId),
          `${label}: reverse crossing action`,
        ).toContain(transition.opening)
        outdoor.crossPassage(transition.opening)
        expectRegion(outdoor, fromCase, `${label}: return side`)
        expectSafeStand(outdoor, fromCase.hexId, `${label}: return side`)
      }
    },
    30000,
  )
})
