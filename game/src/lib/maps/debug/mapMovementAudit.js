import {
  BARRIER_STAND_INSET,
  distToBarrierKind,
} from '../composables/useBarrierStand.js'
import { pointInHexPolygon } from '../composables/useTravelBarriers.js'
import {
  buildTravelWorld,
  evaluateNeighborMove,
  firstBlockedOnPath,
} from '../testing/travelWorld.js'
import {
  expectedArrivalState,
  fenceSideAt,
  movementCasesForMap,
  movementCaseById,
  riverSideAt,
} from '../testing/mapMovementCases.js'

const BARRIER_KINDS = ['fence', 'river', 'cliff', 'ravine']

function staleAuditEntry(movementCase, destination, reason) {
  return {
    id: `${movementCase.id}->${destination}`,
    stateId: movementCase.id,
    fromHexId: movementCase.hexId,
    toHexId: destination,
    from: movementCase.auditStand,
    stand: null,
    path: null,
    expected: movementCase.expectedMoves.includes(destination),
    valid: false,
    status: 'invalid',
    label: `${movementCase.id} → ${destination}`,
    expectedStateId: null,
    reason,
  }
}

function regionMatches(expectedCase, stand, barriers) {
  if (
    expectedCase?.region?.river &&
    riverSideAt(stand, barriers) !== expectedCase.region.river
  ) {
    return false
  }
  if (
    expectedCase?.region?.fence &&
    fenceSideAt(stand) !== expectedCase.region.fence
  ) {
    return false
  }
  return true
}

function hasSafeClearance(stand, barriers) {
  return BARRIER_KINDS.every((kind) => {
    const distance = distToBarrierKind(stand, kind, barriers)
    if (distance == null) return true
    return (
      distance >=
      (BARRIER_STAND_INSET[kind] ?? BARRIER_STAND_INSET.fence)
    )
  })
}

/** Build the visual audit from the same checked-in map state manifest as tests. */
export function buildMapMovementAudit(mapData) {
  const world = buildTravelWorld(mapData)
  const entries = []
  const movementCases = movementCasesForMap(mapData, world)

  for (const movementCase of movementCases) {
    const fromHex = world.hexById[movementCase.hexId]
    for (const destination of [
      ...movementCase.expectedMoves,
      ...movementCase.forbiddenMoves,
    ]) {
      const toHex = world.hexById[destination]
      if (!fromHex) {
        entries.push(
          staleAuditEntry(
            movementCase,
            destination,
            `stale audit case references missing source hex "${movementCase.hexId}"`,
          ),
        )
        continue
      }
      if (!toHex) {
        entries.push(
          staleAuditEntry(
            movementCase,
            destination,
            `stale audit case references missing destination hex "${destination}"`,
          ),
        )
        continue
      }
      const evaluated = evaluateNeighborMove(
        world,
        fromHex,
        toHex,
        movementCase.auditStand,
        { allowRouteOpenings: (movementCase.expectedPassages ?? []).length > 0 },
      )
      const expected = movementCase.expectedMoves.includes(destination)
      const expectedStateId = expected
        ? expectedArrivalState(movementCase, destination)
        : null
      const expectedCase = expectedStateId
        ? movementCaseById(expectedStateId, movementCases)
        : null
      const path = evaluated.result.path ?? evaluated.path
      const stand = evaluated.result.stand
        ? {
            x: Math.round(evaluated.result.stand.x),
            y: Math.round(evaluated.result.stand.y),
          }
        : null
      const pathBlocked = path
        ? firstBlockedOnPath(
            path,
            evaluated.routeLeg
              ? { ...world.ctx, allowOpenings: true, allowOpeningHexId: movementCase.hexId }
              : world.ctx,
          ) != null
        : true
      const safe =
        !!stand &&
        pointInHexPolygon(stand, toHex, world.size) &&
        hasSafeClearance(stand, world.ctx.barriers)
      const regionOk =
        !!stand && regionMatches(expectedCase, stand, world.ctx.barriers)
      const valid = expected
        ? evaluated.enters && !pathBlocked && safe && regionOk
        : !evaluated.enters
      const reasons = []
      if (expected && !evaluated.enters) reasons.push('did not enter')
      if (expected && pathBlocked) reasons.push('path blocked')
      if (expected && !safe) reasons.push('unsafe stand')
      if (expected && !regionOk) reasons.push('wrong region')
      if (!expected && evaluated.enters) reasons.push('forbidden move entered')

      entries.push({
        id: `${movementCase.id}->${destination}`,
        stateId: movementCase.id,
        fromHexId: movementCase.hexId,
        toHexId: destination,
        from: movementCase.auditStand,
        stand,
        path,
        expected,
        valid,
        status: valid ? (expected ? 'valid' : 'blocked') : 'invalid',
        label: `${movementCase.id} → ${destination}`,
        expectedStateId,
        reason: reasons.join(', '),
      })
    }
  }

  return entries
}

export function movementAuditSummary(entries) {
  return {
    total: entries.length,
    valid: entries.filter((entry) => entry.status === 'valid').length,
    blocked: entries.filter((entry) => entry.status === 'blocked').length,
    invalid: entries.filter((entry) => entry.status === 'invalid').length,
  }
}
