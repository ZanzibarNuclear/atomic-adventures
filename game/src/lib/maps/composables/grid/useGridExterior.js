import { exteriorNodeLabel } from "../../../displayLabel.js";
import { canPassDoor } from '../useDoors.js'

export function exteriorStepDirection(from, to) {
  if (!from?.at || !to?.at) return null
  const north = to.at.x - from.at.x
  const east = to.at.y - from.at.y
  const ns = Math.abs(north) > 0.35 ? (north > 0 ? 'north' : 'south') : ''
  const ew = Math.abs(east) > 0.35 ? (east > 0 ? 'east' : 'west') : ''
  return `${ns}${ew}` || null
}

export function canUseExteriorExit(
  building,
  exit,
  roomId,
  doorState,
  areaId,
  exteriorNode = null,
) {
  if (!exit) return false
  if (exteriorNode) return true
  if (!canPassDoor(doorState, areaId, exit.door)) return false
  return roomId === exit.room
}

export function exteriorMovesFrom(building, nodeId) {
  const node = building.exterior?.nodeById?.[nodeId]
  if (!node) return []
  const neighbors = building.exterior?.adj?.[nodeId] ?? []
  return neighbors.map((toNodeId) => {
    const other = building.exterior.nodeById[toNodeId]
    const direction = exteriorStepDirection(node, other)
    return {
      toNodeId,
      kind: 'path',
      label: direction
        ? `${direction} along the footpath`
        : 'along the footpath',
      toName: exteriorNodeLabel(other),
    }
  })
}

export function exteriorReachableNodes(building, nodeId) {
  const adj = building.exterior?.adj ?? {}
  if (!nodeId || !building.exterior?.nodeById?.[nodeId]) return []
  const seen = new Set([nodeId])
  const q = [nodeId]
  while (q.length) {
    const id = q.shift()
    for (const next of adj[id] ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      q.push(next)
    }
  }
  seen.delete(nodeId)
  return [...seen]
}

export function exteriorPathBetween(building, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return []
  const adj = building.exterior?.adj ?? {}
  if (!building.exterior?.nodeById?.[fromId] || !building.exterior?.nodeById?.[toId]) {
    return null
  }
  const prev = new Map()
  const seen = new Set([fromId])
  const q = [fromId]
  let found = false
  while (q.length) {
    const id = q.shift()
    if (id === toId) {
      found = true
      break
    }
    for (const next of adj[id] ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      prev.set(next, id)
      q.push(next)
    }
  }
  if (!found) return null
  const path = []
  let cur = toId
  while (cur !== fromId) {
    path.unshift(cur)
    cur = prev.get(cur)
  }
  return path
}

/**
 * Returns the drawn path points for the segment between two adjacent exterior
 * nodes, including the start and end positions plus any intermediate waypoints.
 * Result is in layout units ({ x, y } same scale as node.at).
 * Returns [fromAt, toAt] if no path or points are found.
 */
export function exteriorSegmentPoints(building, fromNodeId, toNodeId) {
  const nodeById = building.exterior?.nodeById ?? {}
  const fromNode = nodeById[fromNodeId]
  const toNode = nodeById[toNodeId]
  if (!fromNode?.at || !toNode?.at) return []

  for (const path of building.exterior?.paths ?? []) {
    const nodeIds = path.nodeIds ?? []
    const i1 = nodeIds.indexOf(fromNodeId)
    const i2 = nodeIds.indexOf(toNodeId)
    if (i1 === -1 || i2 === -1 || Math.abs(i1 - i2) !== 1) continue

    const points = path.points ?? []
    if (!points.length) return [fromNode.at, toNode.at]

    // Match each node to its closest point in the drawn polyline.
    let bestFrom = 0, bestTo = 0, dfrom = Infinity, dto = Infinity
    for (let i = 0; i < points.length; i++) {
      const df = (points[i].x - fromNode.at.x) ** 2 + (points[i].y - fromNode.at.y) ** 2
      const dt = (points[i].x - toNode.at.x)   ** 2 + (points[i].y - toNode.at.y)   ** 2
      if (df < dfrom) { dfrom = df; bestFrom = i }
      if (dt < dto)   { dto   = dt; bestTo   = i }
    }

    const lo = Math.min(bestFrom, bestTo)
    const hi = Math.max(bestFrom, bestTo)
    const segment = points.slice(lo, hi + 1)
    return bestFrom <= bestTo ? segment : [...segment].reverse()
  }

  return [fromNode.at, toNode.at]
}

export function exteriorStepOutMoves(building, roomId, doorState, areaId) {
  if (!roomId) return []
  const out = []
  const seen = new Set()

  for (const exit of building.exits ?? []) {
    if (!exit.door || exit.room !== roomId || !exit.exteriorNode) continue
    if (!canPassDoor(doorState, areaId, exit.door)) continue
    const node = building.exterior?.nodeById?.[exit.exteriorNode]
    if (!node) continue
    seen.add(exit.exteriorNode)
    out.push({
      toExteriorNode: exit.exteriorNode,
      kind: 'path',
      doorId: exit.door,
      label: 'out to the footpath',
      toName: exteriorNodeLabel(node),
    })
  }

  // Current schema: exterior nodes name the door and interior room
  for (const node of building.exterior?.nodes ?? []) {
    if (!node.door || node.room !== roomId) continue
    if (!canPassDoor(doorState, areaId, node.door)) continue
    if (seen.has(node.id)) continue
    seen.add(node.id)
    out.push({
      toExteriorNode: node.id,
      kind: 'path',
      doorId: node.door,
      label: 'out to the footpath',
      toName: exteriorNodeLabel(node),
    })
  }

  return out
}
