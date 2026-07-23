import { barrierXAtY } from '../composables/useBarrierStand.js'

function riverX(pos, barriers) {
  return barrierXAtY(
    (barriers ?? []).filter(
      (segment) => segment.kind === 'stream' || segment.kind === 'river',
    ),
    pos.y,
  )
}

export function isWestOfRiverAt(pos, barriers) {
  const x = riverX(pos, barriers)
  return x != null && pos.x < x - 1
}

export function isEastOfRiverAt(pos, barriers) {
  const x = riverX(pos, barriers)
  return x != null && pos.x > x + 1
}
