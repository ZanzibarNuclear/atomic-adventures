import { barrierXAtY } from '../composables/useBarrierStand.js'
import { pointInHexPolygon } from '../composables/useTravelBarriers.js'
import {
  buildGameplayWorld,
  gameplayMoveTo,
  passCompoundGate,
} from './gameplayTravel.js'
import { buildTravelWorld } from './travelWorld.js'

function move(outdoor, ...hexIds) {
  for (const hexId of hexIds) gameplayMoveTo(outdoor, hexId)
}

function startAt(outdoor, hexId) {
  outdoor.state.currentId = hexId
  outdoor.state.stand = outdoor.defaultStandForHex(hexId)
  outdoor.state.lastBlocked = null
  outdoor.state.atBarrier = null
  outdoor.traveling = false
}

function northGateApproach(outdoor) {
  startAt(outdoor, 'origin')
  move(outdoor, 'east-pines', 'center-pines', 'north-bend', 'gate-woods')
}

function southOfGate(outdoor) {
  northGateApproach(outdoor)
  passCompoundGate(outdoor)
}

function upperGorgeEast(outdoor) {
  startAt(outdoor, 'origin')
  move(
    outdoor,
    'east-pines',
    'center-pines',
    'north-bend',
    'road-fork',
    'upper-gorge',
  )
}

function upperGorgeWest(outdoor) {
  upperGorgeEast(outdoor)
  outdoor.crossPassage('upper-gorge-bridge')
}

function lowerGorgeWest(outdoor) {
  upperGorgeWest(outdoor)
  move(outdoor, 'lower-gorge')
}

function midWestWest(outdoor) {
  lowerGorgeWest(outdoor)
  move(outdoor, 'the-flats')
}

function westSlope(outdoor) {
  southOfGate(outdoor)
  move(outdoor, 'west-slope')
}

function utilityYardEast(outdoor) {
  westSlope(outdoor)
  move(outdoor, 'utility-yard')
}

function utilityYardWest(outdoor) {
  midWestWest(outdoor)
  move(outdoor, 'utility-yard')
}

function southPinesEast(outdoor) {
  startAt(outdoor, 'origin')
  move(outdoor, 'east-pines', 'lower-stand', 'south-pines')
}

function southPinesWest(outdoor) {
  utilityYardEast(outdoor)
  move(outdoor, 'south-pines')
}

/**
 * Canonical map-specific movement states.
 *
 * `expectedMoves` and `forbiddenMoves` intentionally classify every adjacent
 * destination for the state's current hex. They are filled from authored map
 * expectations, not generated from the implementation under test.
 */
export const MAP_MOVEMENT_CASES = [
  {
    id: 'origin:start',
    hexId: 'origin',
    auditStand: { x: 266.7358243656071, y: -66 },
    expectedMoves: ['east-pines'],
    forbiddenMoves: [],
    setup: (outdoor) => startAt(outdoor, 'origin'),
  },
  {
    id: 'east-pines:from-origin',
    hexId: 'east-pines',
    auditStand: { x: 191, y: -66 },
    expectedMoves: ['center-pines', 'far-pines', 'lower-stand', 'origin'],
    forbiddenMoves: [],
    setup(outdoor) {
      startAt(outdoor, 'origin')
      move(outdoor, 'east-pines')
    },
  },
  {
    id: 'far-pines:from-east',
    hexId: 'far-pines',
    auditStand: { x: 152, y: -132 },
    expectedMoves: ['center-pines', 'east-pines', 'north-bend'],
    forbiddenMoves: [],
    setup(outdoor) {
      startAt(outdoor, 'origin')
      move(outdoor, 'east-pines', 'far-pines')
    },
  },
  {
    id: 'center-pines:from-east',
    hexId: 'center-pines',
    auditStand: { x: 114, y: -66 },
    expectedMoves: [
      'east-pines',
      'far-pines',
      'lower-stand',
      'north-bend',
      'south-pines',
    ],
    forbiddenMoves: ['west-slope'],
    region: { fence: 'east' },
    setup(outdoor) {
      startAt(outdoor, 'origin')
      move(outdoor, 'east-pines', 'center-pines')
    },
  },
  {
    id: 'center-pines:inside-fence',
    hexId: 'center-pines',
    auditStand: { x: 79, y: -80 },
    expectedMoves: ['north-bend', 'south-pines', 'west-slope'],
    forbiddenMoves: ['east-pines', 'far-pines', 'lower-stand'],
    region: { fence: 'inside' },
    setup(outdoor) {
      westSlope(outdoor)
      move(outdoor, 'center-pines')
    },
  },
  {
    id: 'lower-stand:from-east',
    hexId: 'lower-stand',
    auditStand: { x: 152, y: 0 },
    expectedMoves: ['center-pines', 'east-pines', 'south-pines'],
    forbiddenMoves: [],
    setup(outdoor) {
      startAt(outdoor, 'origin')
      move(outdoor, 'east-pines', 'lower-stand')
    },
  },
  {
    id: 'north-bend:east-of-fence',
    hexId: 'north-bend',
    auditStand: { x: 93, y: -138 },
    expectedMoves: ['center-pines', 'far-pines', 'gate-woods', 'road-fork'],
    forbiddenMoves: ['west-slope'],
    region: { fence: 'north' },
    setup(outdoor) {
      startAt(outdoor, 'origin')
      move(outdoor, 'east-pines', 'center-pines', 'north-bend')
    },
  },
  {
    id: 'north-bend:inside-fence',
    hexId: 'north-bend',
    auditStand: { x: 70, y: -112 },
    expectedMoves: ['center-pines', 'gate-woods', 'west-slope'],
    forbiddenMoves: ['far-pines', 'road-fork'],
    region: { fence: 'inside' },
    setup(outdoor) {
      westSlope(outdoor)
      move(outdoor, 'north-bend')
    },
  },
  {
    id: 'road-fork:north',
    hexId: 'road-fork',
    auditStand: { x: 32, y: -188 },
    expectedMoves: ['gate-woods', 'north-bend', 'upper-gorge'],
    forbiddenMoves: [],
    region: { fence: 'north' },
    setup(outdoor) {
      startAt(outdoor, 'origin')
      move(
        outdoor,
        'east-pines',
        'center-pines',
        'north-bend',
        'road-fork',
      )
    },
  },
  {
    id: 'gate-woods:north-of-fence',
    hexId: 'gate-woods',
    auditStand: { x: 33, y: -142 },
    expectedMoves: ['north-bend', 'lower-gorge', 'road-fork', 'upper-gorge'],
    forbiddenMoves: ['the-flats', 'west-slope'],
    region: { fence: 'north' },
    setup: northGateApproach,
  },
  {
    id: 'gate-woods:south-of-fence',
    hexId: 'gate-woods',
    auditStand: { x: 33, y: -116 },
    expectedMoves: ['the-flats', 'north-bend', 'lower-gorge', 'road-fork', 'west-slope'],
    forbiddenMoves: ['upper-gorge'],
    expectedPassages: ['compound-gate'],
    region: { fence: 'inside' },
    setup: southOfGate,
  },
  {
    id: 'upper-gorge:east-bank',
    hexId: 'upper-gorge',
    auditStand: { x: -18, y: -191 },
    expectedMoves: ['gate-woods', 'lower-gorge', 'road-fork'],
    forbiddenMoves: [],
    expectedPassages: ['upper-gorge-bridge'],
    region: { river: 'east' },
    setup: upperGorgeEast,
  },
  {
    id: 'upper-gorge:west-bank',
    hexId: 'upper-gorge',
    auditStand: { x: -32, y: -216 },
    expectedMoves: ['lower-gorge'],
    forbiddenMoves: ['gate-woods', 'road-fork'],
    expectedPassages: ['upper-gorge-bridge'],
    region: { river: 'west' },
    setup: upperGorgeWest,
  },
  {
    id: 'lower-gorge:east-bank',
    hexId: 'lower-gorge',
    auditStand: { x: -43, y: -143 },
    expectedMoves: ['gate-woods', 'upper-gorge'],
    forbiddenMoves: ['the-flats'],
    region: { river: 'east' },
    setup(outdoor) {
      northGateApproach(outdoor)
      move(outdoor, 'lower-gorge')
    },
  },
  {
    id: 'lower-gorge:east-bank-inside-fence',
    hexId: 'lower-gorge',
    auditStand: { x: -43, y: -121 },
    expectedMoves: ['gate-woods', 'the-flats'],
    forbiddenMoves: ['upper-gorge'],
    region: { river: 'east', fence: 'inside' },
    setup(outdoor) {
      southOfGate(outdoor)
      move(outdoor, 'lower-gorge')
    },
  },
  {
    id: 'lower-gorge:west-bank',
    hexId: 'lower-gorge',
    auditStand: { x: -87, y: -132 },
    expectedMoves: ['the-flats', 'upper-gorge'],
    forbiddenMoves: ['gate-woods'],
    region: { river: 'west' },
    setup: lowerGorgeWest,
  },
  {
    id: 'the-flats:east-bank',
    hexId: 'the-flats',
    auditStand: { x: -24, y: -82 },
    expectedMoves: ['gate-woods', 'lower-gorge', 'utility-yard', 'west-slope'],
    forbiddenMoves: [],
    expectedSearch: ['the-flats-ford'],
    region: { river: 'east' },
    setup(outdoor) {
      southOfGate(outdoor)
      move(outdoor, 'the-flats')
    },
  },
  {
    id: 'the-flats:west-bank',
    hexId: 'the-flats',
    auditStand: { x: -47, y: -50 },
    expectedMoves: ['lower-gorge', 'utility-yard'],
    forbiddenMoves: ['gate-woods', 'west-slope'],
    expectedSearch: ['the-flats-ford'],
    region: { river: 'west' },
    setup: midWestWest,
  },
  {
    id: 'west-slope:inside-fence',
    hexId: 'west-slope',
    auditStand: { x: 33, y: -88 },
    expectedMoves: [
      'center-pines',
      'gate-woods',
      'the-flats',
      'north-bend',
      'south-pines',
      'utility-yard',
    ],
    forbiddenMoves: [],
    region: { fence: 'inside' },
    setup: westSlope,
  },
  {
    id: 'utility-yard:east-bank',
    hexId: 'utility-yard',
    auditStand: { x: 5, y: -16 },
    expectedMoves: ['the-flats', 'south-pines', 'west-slope'],
    forbiddenMoves: [],
    region: { river: 'east' },
    setup: utilityYardEast,
  },
  {
    id: 'utility-yard:west-bank',
    hexId: 'utility-yard',
    auditStand: { x: -22, y: 0 },
    expectedMoves: ['the-flats'],
    forbiddenMoves: ['south-pines', 'west-slope'],
    region: { river: 'west' },
    setup: utilityYardWest,
  },
  {
    id: 'south-pines:east-of-fence',
    hexId: 'south-pines',
    auditStand: { x: 98, y: -11 },
    expectedMoves: ['center-pines', 'lower-stand'],
    forbiddenMoves: ['utility-yard', 'west-slope'],
    expectedSearch: ['south-pines-hole'],
    region: { fence: 'east' },
    setup: southPinesEast,
  },
  {
    id: 'south-pines:west-of-fence',
    hexId: 'south-pines',
    auditStand: { x: 76, y: 0 },
    expectedMoves: ['utility-yard', 'west-slope'],
    forbiddenMoves: ['center-pines', 'lower-stand'],
    expectedSearch: ['south-pines-hole'],
    region: { fence: 'inside' },
    setup: southPinesWest,
  },
]

export function createMovementCaseWorld(mapData, movementCase) {
  // These map-geometry states include both sides of the compound gate. The
  // authored inspection prerequisite belongs to story progression, not the
  // movement cases being audited here.
  const { outdoor, gameState } = buildGameplayWorld(mapData, {
    // Movement audit is not testing vine discovery; grant untangle so open/close works.
    flags: ['story.gate.inspected', 'story.gate.untangled'],
  })
  movementCase.setup(outdoor, gameState)
  return { outdoor, gameState }
}

export function movementCasesForMap() {
  return MAP_MOVEMENT_CASES
}

export function riverSideAt(stand, barriers) {
  const river = (barriers ?? []).filter(
    (segment) => segment.kind === 'stream' || segment.kind === 'river',
  )
  const x = barrierXAtY(river, stand.y)
  if (x == null) return null
  if (stand.x < x - 1) return 'west'
  if (stand.x > x + 1) return 'east'
  return 'on'
}

export function fenceSideAt(stand) {
  if (stand.y < -128) return 'north'
  if (stand.y > -127 && stand.x < 84.32) return 'inside'
  if (stand.x > 84.32) return 'east'
  return 'on'
}

const DEFAULT_ARRIVAL_STATE = {
  origin: 'origin:start',
  'east-pines': 'east-pines:from-origin',
  'far-pines': 'far-pines:from-east',
  'center-pines': 'center-pines:from-east',
  'lower-stand': 'lower-stand:from-east',
  'north-bend': 'north-bend:east-of-fence',
  'road-fork': 'road-fork:north',
  'gate-woods': 'gate-woods:north-of-fence',
  'upper-gorge': 'upper-gorge:east-bank',
  'lower-gorge': 'lower-gorge:east-bank',
  'the-flats': 'the-flats:east-bank',
  'west-slope': 'west-slope:inside-fence',
  'utility-yard': 'utility-yard:east-bank',
  'south-pines': 'south-pines:east-of-fence',
}

const INSIDE_FENCE_STATES = new Set([
  'center-pines:inside-fence',
  'north-bend:inside-fence',
  'gate-woods:south-of-fence',
  'lower-gorge:east-bank-inside-fence',
  'the-flats:east-bank',
  'west-slope:inside-fence',
  'utility-yard:east-bank',
  'south-pines:west-of-fence',
])

/** Expected canonical region after a successful map-specific move. */
export function expectedArrivalState(movementCase, destination) {
  const from = movementCase.id
  const insideFenceStates = INSIDE_FENCE_STATES

  if (
    destination === 'center-pines' &&
    insideFenceStates.has(from)
  ) {
    return 'center-pines:inside-fence'
  }
  if (destination === 'north-bend' && insideFenceStates.has(from)) {
    return 'north-bend:inside-fence'
  }
  if (destination === 'gate-woods' && insideFenceStates.has(from)) {
    return 'gate-woods:south-of-fence'
  }
  if (destination === 'lower-gorge') {
    if (
      from === 'upper-gorge:west-bank' ||
      from === 'the-flats:west-bank'
    ) {
      return 'lower-gorge:west-bank'
    }
    if (insideFenceStates.has(from)) {
      return 'lower-gorge:east-bank-inside-fence'
    }
    return 'lower-gorge:east-bank'
  }
  if (
    destination === 'upper-gorge' &&
    from === 'lower-gorge:west-bank'
  ) {
    return 'upper-gorge:west-bank'
  }
  if (destination === 'the-flats') {
    if (
      from === 'lower-gorge:west-bank' ||
      from === 'utility-yard:west-bank'
    ) {
      return 'the-flats:west-bank'
    }
    return 'the-flats:east-bank'
  }
  if (
    destination === 'utility-yard' &&
    from === 'the-flats:west-bank'
  ) {
    return 'utility-yard:west-bank'
  }
  if (
    destination === 'south-pines' &&
    insideFenceStates.has(from)
  ) {
    return 'south-pines:west-of-fence'
  }

  return DEFAULT_ARRIVAL_STATE[destination] ?? null
}

export function movementCaseById(id, movementCases = MAP_MOVEMENT_CASES) {
  return movementCases.find((movementCase) => movementCase.id === id) ?? null
}

export function movementCaseBySourceId(id, movementCases = MAP_MOVEMENT_CASES) {
  return movementCaseById(id, movementCases)
}
