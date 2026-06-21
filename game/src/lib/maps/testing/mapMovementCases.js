import { barrierXAtY } from '../composables/useBarrierStand.js'
import {
  buildGameplayWorld,
  gameplayMoveTo,
  passCompoundGate,
} from './gameplayTravel.js'

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
  startAt(outdoor, 'trailhead')
  move(outdoor, 'east-pines', 'center-pines', 'north-bend', 'gate-woods')
}

function southOfGate(outdoor) {
  northGateApproach(outdoor)
  passCompoundGate(outdoor)
}

function upperGorgeEast(outdoor) {
  startAt(outdoor, 'trailhead')
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

function northWestWest(outdoor) {
  upperGorgeWest(outdoor)
  move(outdoor, 'north-west')
}

function midWestWest(outdoor) {
  northWestWest(outdoor)
  move(outdoor, 'mid-west')
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
  startAt(outdoor, 'trailhead')
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
    id: 'trailhead:start',
    hexId: 'trailhead',
    auditStand: { x: 152, y: 0 },
    expectedMoves: ['east-pines'],
    forbiddenMoves: [],
    setup: (outdoor) => startAt(outdoor, 'trailhead'),
  },
  {
    id: 'east-pines:from-trailhead',
    hexId: 'east-pines',
    auditStand: { x: 76, y: 0 },
    expectedMoves: ['center-pines', 'far-pines', 'lower-stand', 'trailhead'],
    forbiddenMoves: [],
    setup(outdoor) {
      startAt(outdoor, 'trailhead')
      move(outdoor, 'east-pines')
    },
  },
  {
    id: 'far-pines:from-east',
    hexId: 'far-pines',
    auditStand: { x: 38, y: -66 },
    expectedMoves: ['center-pines', 'east-pines', 'north-bend'],
    forbiddenMoves: [],
    setup(outdoor) {
      startAt(outdoor, 'trailhead')
      move(outdoor, 'east-pines', 'far-pines')
    },
  },
  {
    id: 'center-pines:from-east',
    hexId: 'center-pines',
    auditStand: { x: 0, y: 0 },
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
      startAt(outdoor, 'trailhead')
      move(outdoor, 'east-pines', 'center-pines')
    },
  },
  {
    id: 'center-pines:inside-fence',
    hexId: 'center-pines',
    auditStand: { x: -35, y: -14 },
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
    auditStand: { x: 38, y: 66 },
    expectedMoves: ['center-pines', 'east-pines', 'south-pines'],
    forbiddenMoves: [],
    setup(outdoor) {
      startAt(outdoor, 'trailhead')
      move(outdoor, 'east-pines', 'lower-stand')
    },
  },
  {
    id: 'north-bend:east-of-fence',
    hexId: 'north-bend',
    auditStand: { x: -10, y: -70 },
    expectedMoves: ['center-pines', 'far-pines', 'gate-woods', 'road-fork'],
    forbiddenMoves: ['west-slope'],
    region: { fence: 'north' },
    setup(outdoor) {
      startAt(outdoor, 'trailhead')
      move(outdoor, 'east-pines', 'center-pines', 'north-bend')
    },
  },
  {
    id: 'north-bend:inside-fence',
    hexId: 'north-bend',
    auditStand: { x: -44, y: -46 },
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
    auditStand: { x: -83, y: -122 },
    expectedMoves: ['gate-woods', 'north-bend', 'upper-gorge'],
    forbiddenMoves: [],
    region: { fence: 'north' },
    setup(outdoor) {
      startAt(outdoor, 'trailhead')
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
    auditStand: { x: -81, y: -76 },
    expectedMoves: ['north-bend', 'north-west', 'road-fork', 'upper-gorge'],
    forbiddenMoves: ['mid-west', 'west-slope'],
    expectedUnlocks: ['compound-gate'],
    region: { fence: 'north' },
    setup: northGateApproach,
  },
  {
    id: 'gate-woods:south-of-fence',
    hexId: 'gate-woods',
    auditStand: { x: -81, y: -50 },
    expectedMoves: ['mid-west', 'north-bend', 'north-west', 'west-slope'],
    forbiddenMoves: ['road-fork', 'upper-gorge'],
    expectedPassages: ['compound-gate'],
    region: { fence: 'inside' },
    setup: southOfGate,
  },
  {
    id: 'upper-gorge:east-bank',
    hexId: 'upper-gorge',
    auditStand: { x: -131, y: -129 },
    expectedMoves: ['gate-woods', 'north-west', 'road-fork'],
    forbiddenMoves: [],
    expectedPassages: ['upper-gorge-bridge'],
    region: { river: 'east' },
    setup: upperGorgeEast,
  },
  {
    id: 'upper-gorge:west-bank',
    hexId: 'upper-gorge',
    auditStand: { x: -147, y: -150 },
    expectedMoves: ['north-west'],
    forbiddenMoves: ['gate-woods', 'road-fork'],
    expectedPassages: ['upper-gorge-bridge'],
    region: { river: 'west' },
    setup: upperGorgeWest,
  },
  {
    id: 'north-west:east-bank',
    hexId: 'north-west',
    auditStand: { x: -158, y: -77 },
    expectedMoves: ['gate-woods', 'upper-gorge'],
    forbiddenMoves: ['mid-west'],
    region: { river: 'east' },
    setup(outdoor) {
      northGateApproach(outdoor)
      move(outdoor, 'north-west')
    },
  },
  {
    id: 'north-west:east-bank-inside-fence',
    hexId: 'north-west',
    auditStand: { x: -158, y: -55 },
    expectedMoves: ['gate-woods', 'mid-west'],
    forbiddenMoves: ['upper-gorge'],
    region: { river: 'east', fence: 'inside' },
    setup(outdoor) {
      southOfGate(outdoor)
      move(outdoor, 'north-west')
    },
  },
  {
    id: 'north-west:west-bank',
    hexId: 'north-west',
    auditStand: { x: -202, y: -66 },
    expectedMoves: ['mid-west', 'upper-gorge'],
    forbiddenMoves: ['gate-woods'],
    region: { river: 'west' },
    setup: northWestWest,
  },
  {
    id: 'mid-west:east-bank',
    hexId: 'mid-west',
    auditStand: { x: -138, y: -16 },
    expectedMoves: ['gate-woods', 'north-west', 'utility-yard', 'west-slope'],
    forbiddenMoves: [],
    expectedSearch: ['mid-west-ford'],
    region: { river: 'east' },
    setup(outdoor) {
      southOfGate(outdoor)
      move(outdoor, 'mid-west')
    },
  },
  {
    id: 'mid-west:west-bank',
    hexId: 'mid-west',
    auditStand: { x: -162, y: 16 },
    expectedMoves: ['north-west', 'utility-yard'],
    forbiddenMoves: ['gate-woods', 'west-slope'],
    expectedSearch: ['mid-west-ford'],
    region: { river: 'west' },
    setup: midWestWest,
  },
  {
    id: 'west-slope:inside-fence',
    hexId: 'west-slope',
    auditStand: { x: -81, y: -22 },
    expectedMoves: [
      'center-pines',
      'gate-woods',
      'mid-west',
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
    auditStand: { x: -109, y: 50 },
    expectedMoves: ['mid-west', 'south-pines', 'west-slope'],
    forbiddenMoves: [],
    region: { river: 'east' },
    setup: utilityYardEast,
  },
  {
    id: 'utility-yard:west-bank',
    hexId: 'utility-yard',
    auditStand: { x: -136, y: 66 },
    expectedMoves: ['mid-west'],
    forbiddenMoves: ['south-pines', 'west-slope'],
    region: { river: 'west' },
    setup: utilityYardWest,
  },
  {
    id: 'south-pines:east-of-fence',
    hexId: 'south-pines',
    auditStand: { x: -16, y: 55 },
    expectedMoves: ['center-pines', 'lower-stand'],
    forbiddenMoves: ['utility-yard', 'west-slope'],
    expectedSearch: ['south-pines-hole'],
    region: { fence: 'east' },
    setup: southPinesEast,
  },
  {
    id: 'south-pines:west-of-fence',
    hexId: 'south-pines',
    auditStand: { x: -38, y: 66 },
    expectedMoves: ['utility-yard', 'west-slope'],
    forbiddenMoves: ['center-pines', 'lower-stand'],
    expectedSearch: ['south-pines-hole'],
    region: { fence: 'inside' },
    setup: southPinesWest,
  },
]

export function createMovementCaseWorld(mapData, movementCase) {
  const { outdoor, gameState } = buildGameplayWorld(mapData)
  movementCase.setup(outdoor, gameState)
  return { outdoor, gameState }
}

export function riverSideAt(stand, barriers) {
  const river = (barriers ?? []).filter((segment) => segment.kind === 'river')
  const x = barrierXAtY(river, stand.y)
  if (x == null) return null
  if (stand.x < x - 1) return 'west'
  if (stand.x > x + 1) return 'east'
  return 'on'
}

export function fenceSideAt(stand) {
  if (stand.y < -62) return 'north'
  if (stand.y > -61 && stand.x < -30) return 'inside'
  if (stand.x > -30) return 'east'
  return 'on'
}

const DEFAULT_ARRIVAL_STATE = {
  trailhead: 'trailhead:start',
  'east-pines': 'east-pines:from-trailhead',
  'far-pines': 'far-pines:from-east',
  'center-pines': 'center-pines:from-east',
  'lower-stand': 'lower-stand:from-east',
  'north-bend': 'north-bend:east-of-fence',
  'road-fork': 'road-fork:north',
  'gate-woods': 'gate-woods:north-of-fence',
  'upper-gorge': 'upper-gorge:east-bank',
  'north-west': 'north-west:east-bank',
  'mid-west': 'mid-west:east-bank',
  'west-slope': 'west-slope:inside-fence',
  'utility-yard': 'utility-yard:east-bank',
  'south-pines': 'south-pines:east-of-fence',
}

const INSIDE_FENCE_STATES = new Set([
  'center-pines:inside-fence',
  'north-bend:inside-fence',
  'gate-woods:south-of-fence',
  'north-west:east-bank-inside-fence',
  'mid-west:east-bank',
  'west-slope:inside-fence',
  'utility-yard:east-bank',
  'south-pines:west-of-fence',
])

/** Expected canonical region after a successful map-specific move. */
export function expectedArrivalState(movementCase, destination) {
  const from = movementCase.id

  if (
    destination === 'center-pines' &&
    INSIDE_FENCE_STATES.has(from)
  ) {
    return 'center-pines:inside-fence'
  }
  if (destination === 'north-bend' && INSIDE_FENCE_STATES.has(from)) {
    return 'north-bend:inside-fence'
  }
  if (destination === 'gate-woods' && INSIDE_FENCE_STATES.has(from)) {
    return 'gate-woods:south-of-fence'
  }
  if (destination === 'north-west') {
    if (
      from === 'upper-gorge:west-bank' ||
      from === 'mid-west:west-bank'
    ) {
      return 'north-west:west-bank'
    }
    if (INSIDE_FENCE_STATES.has(from)) {
      return 'north-west:east-bank-inside-fence'
    }
    return 'north-west:east-bank'
  }
  if (destination === 'upper-gorge' && from === 'north-west:west-bank') {
    return 'upper-gorge:west-bank'
  }
  if (destination === 'mid-west') {
    if (
      from === 'north-west:west-bank' ||
      from === 'utility-yard:west-bank'
    ) {
      return 'mid-west:west-bank'
    }
    return 'mid-west:east-bank'
  }
  if (destination === 'utility-yard' && from === 'mid-west:west-bank') {
    return 'utility-yard:west-bank'
  }
  if (
    destination === 'south-pines' &&
    INSIDE_FENCE_STATES.has(from)
  ) {
    return 'south-pines:west-of-fence'
  }

  return DEFAULT_ARRIVAL_STATE[destination] ?? null
}

export function movementCaseById(id) {
  return MAP_MOVEMENT_CASES.find((movementCase) => movementCase.id === id) ?? null
}
