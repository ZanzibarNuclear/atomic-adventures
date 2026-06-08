import { canPassDoor } from '../useDoors.js'

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
    return {
      toNodeId,
      kind: 'path',
      label: 'along the footpath',
      toName: other?.label ?? toNodeId,
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

export function exteriorStepOutMoves(building, roomId, doorState, areaId) {
  if (!roomId) return []
  const out = []
  for (const exit of building.exits ?? []) {
    if (exit.room !== roomId || !exit.exteriorNode) continue
    if (!canPassDoor(doorState, areaId, exit.door)) continue
    const node = building.exterior?.nodeById?.[exit.exteriorNode]
    if (!node) continue
    out.push({
      toExteriorNode: exit.exteriorNode,
      kind: 'path',
      doorId: exit.door,
      label: 'out to the footpath',
      toName: node.label ?? exit.exteriorNode,
    })
  }
  return out
}
