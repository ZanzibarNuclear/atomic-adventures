import { roomRect, roomOnLevel, exitMapAt } from './useGrid.js'
import { normalizeCompassEdge } from './grid/useGridCompass.js'

function round2(n) {
  return Math.round(n * 100) / 100
}

function snapHalf(n) {
  return Math.round(n * 2) / 2
}

function doorOnLevel(door, levelId) {
  const levels = door.onLevels ?? (door.level != null ? [door.level] : [])
  return levels.includes(levelId)
}

function exteriorLevel(data) {
  return data.exterior?.level ?? null
}

/** Footpaths on the exterior level. */
export function listEditablePaths(data, levelId) {
  if (exteriorLevel(data) !== levelId) return []
  return (data.exterior?.paths ?? [])
    .filter((p) => p.points?.length)
    .map((p) => ({
      source: 'paths',
      id: p.id,
      label: p.id,
    }))
}

/** Non-feature rooms on a floor. */
export function listEditableRooms(data, levelId) {
  return (data.rooms ?? [])
    .filter((r) => !r.feature && roomOnLevel(r, levelId))
    .map((r) => ({
      source: 'rooms',
      id: r.id,
      label: r.name ? `${r.name} (${r.id})` : r.id,
    }))
}

/** Man and roll doors visible on a floor. */
export function listEditableDoors(data, levelId) {
  const items = []
  for (const door of data.doors ?? []) {
    if (!door.id) continue
    if (door.kind === 'roll') {
      const room = data.rooms?.find((r) => r.id === door.room)
      if (!room || room.level !== levelId) continue
      items.push({
        source: 'doors',
        id: door.id,
        label: `${door.id} (roll)`,
        kind: 'roll',
      })
      continue
    }
    if (door.kind === 'man' && doorOnLevel(door, levelId) && door.at) {
      items.push({
        source: 'doors',
        id: door.id,
        label: door.label ?? door.id,
        kind: 'man',
      })
    }
  }
  return items
}

/** Exterior stand spots on the exterior level. */
export function listEditableNodes(data, levelId) {
  if (exteriorLevel(data) !== levelId) return []
  return (data.exterior?.nodes ?? []).map((n) => ({
    source: 'nodes',
    id: n.id,
    label: n.label ? `${n.label} (${n.id})` : n.id,
  }))
}

/** World-map exit icons on a floor. */
export function listEditableExits(data, levelId) {
  const roomById = Object.fromEntries((data.rooms ?? []).map((r) => [r.id, r]))
  const exteriorLevel = data.exterior?.level
  return (data.transitions ?? data.exits ?? [])
    .filter((exit) => {
      if (!exit.door) {
        // Transition (no door): lives on the exterior level
        return exteriorLevel === levelId
      }
      const door = data.doors?.find((d) => d.id === exit.door)
      if (!door) return false
      if (door.kind === 'roll') {
        const room = roomById[door.room]
        return room?.level === levelId
      }
      return doorOnLevel(door, levelId)
    })
    .map((exit) => {
      const key = exit.id ?? exit.door
      return {
        source: 'exits',
        id: key,
        label: `${key} (world map)`,
      }
    })
}

export function listAllGridEditable(data, levelId) {
  return [
    ...listEditablePaths(data, levelId),
    ...listEditableRooms(data, levelId),
    ...listEditableDoors(data, levelId),
    ...listEditableNodes(data, levelId),
    ...listEditableExits(data, levelId),
  ]
}

export function findGridEditable(data, source, id) {
  if (source === 'paths') {
    return data.exterior?.paths?.find((p) => p.id === id) ?? null
  }
  if (source === 'rooms') {
    return data.rooms?.find((r) => r.id === id) ?? null
  }
  if (source === 'doors') {
    return data.doors?.find((d) => d.id === id) ?? null
  }
  if (source === 'nodes') {
    return data.exterior?.nodes?.find((n) => n.id === id) ?? null
  }
  if (source === 'exits') {
    const arr = data.transitions ?? data.exits ?? []
    return arr.find((e) => (e.id ?? e.door) === id) ?? null
  }
  return null
}

export function gridEditModeForSource(source) {
  if (source === 'paths') return 'line'
  if (source === 'rooms') return 'room'
  if (source === 'doors') return 'door'
  if (source === 'nodes') return 'node'
  if (source === 'exits') return 'exit'
  return null
}

/** World-map ⬡ icon handle in layout pixels. */
export function resolvedExitHandle(exit, cell) {
  const at = exitMapAt(exit)
  if (!at) return []
  return [
    {
      role: 'exit-map',
      x: at.x * cell,
      y: at.y * cell,
      handleKey: 'exit-map',
    },
  ]
}

export function setExitMapAt(data, exitId, xUnits, yUnits) {
  const arr = data.transitions ?? data.exits ?? []
  const exit = arr.find((e) => (e.id ?? e.door) === exitId)
  if (!exit) return
  if (exit.door) {
    // Door-based exit: mapAt is a separate display override
    exit.mapAt = { x: round2(xUnits), y: round2(yUnits) }
  } else {
    // Transition: at IS the position — drag updates it directly
    exit.at = { x: round2(xUnits), y: round2(yUnits) }
  }
}

export function getExitMapAt(exit) {
  return exitMapAt(exit) ?? { x: 0, y: 0 }
}

function coordsKey(x, y) {
  return `${round2(x)},${round2(y)}`
}

/** True when a curve point shares coordinates with a named node on this path. */
function isPathNodeLocation(data, path, x, y) {
  const key = coordsKey(x, y)
  for (const nodeId of path?.nodes ?? []) {
    const node = data.exterior?.nodes?.find((n) => n.id === nodeId)
    if (node?.at && coordsKey(node.at.x, node.at.y) === key) return true
  }
  return false
}

/** Curve handles — skips points that share coords with a named path node. */
export function resolvedPathHandles(path, cell, data = null) {
  const handles = []
  for (const [index, p] of (path?.points ?? []).entries()) {
    if (data && isPathNodeLocation(data, path, p.x, p.y)) continue
    handles.push({
      index,
      role: 'point',
      x: p.x * cell,
      y: p.y * cell,
      handleKey: `point-${index}`,
    })
  }
  return handles
}

/** Named stand spots referenced by a path — drag these to move path nodes. */
export function resolvedPathNodeHandles(data, path, cell) {
  if (!path?.nodes?.length) return []
  const handles = []
  for (const nodeId of path.nodes) {
    const node = data.exterior?.nodes?.find((n) => n.id === nodeId)
    if (!node?.at) continue
    handles.push({
      nodeId,
      role: 'path-node',
      x: node.at.x * cell,
      y: node.at.y * cell,
      handleKey: `node-${nodeId}`,
    })
  }
  return handles
}

function syncCoordsEverywhere(data, oldX, oldY, newX, newY) {
  if (oldX == null || oldY == null) return
  const oldKey = coordsKey(oldX, oldY)
  const newKey = coordsKey(newX, newY)
  if (oldKey === newKey) return

  for (const path of data.exterior?.paths ?? []) {
    for (const p of path.points ?? []) {
      if (coordsKey(p.x, p.y) === oldKey) {
        p.x = round2(newX)
        p.y = round2(newY)
      }
    }
  }

  for (const exit of (data.transitions ?? data.exits ?? [])) {
    if (exit.at && coordsKey(exit.at.x, exit.at.y) === oldKey) {
      exit.at.x = round2(newX)
      exit.at.y = round2(newY)
    }
  }
}

function syncNodeAtCoords(data, oldX, oldY, newX, newY) {
  for (const node of data.exterior?.nodes ?? []) {
    if (!node.at || coordsKey(node.at.x, node.at.y) !== coordsKey(oldX, oldY)) {
      continue
    }
    node.at.x = round2(newX)
    node.at.y = round2(newY)
    if (node.door) {
      const arr = data.transitions ?? data.exits ?? []
      const exit = arr.find((e) => e.door === node.door)
      if (exit) {
        if (!exit.at) exit.at = {}
        exit.at.x = node.at.x
        exit.at.y = node.at.y
      }
    }
  }
}

/** Room move + corner resize handles in layout pixels. */
export function resolvedRoomHandles(room, cell) {
  if (!room) return []
  const r = roomRect(room, cell)
  const handles = [
    { role: 'move', x: r.x + r.w / 2, y: r.y + r.h / 2, handleKey: 'move' },
    { role: 'nw', x: r.x, y: r.y, handleKey: 'nw' },
    { role: 'ne', x: r.x + r.w, y: r.y, handleKey: 'ne' },
    { role: 'se', x: r.x + r.w, y: r.y + r.h, handleKey: 'se' },
    { role: 'sw', x: r.x, y: r.y + r.h, handleKey: 'sw' },
  ]
  return handles
}

/** Man door handle in layout pixels. */
export function resolvedDoorHandle(door, cell) {
  if (!door?.at) return []
  return [
    {
      role: 'door-at',
      x: door.at.x * cell,
      y: door.at.y * cell,
      handleKey: 'door-at',
    },
  ]
}

/** Exterior node handle in layout pixels. */
export function resolvedNodeHandle(node, cell) {
  if (!node?.at) return []
  return [
    {
      role: 'node-at',
      x: node.at.x * cell,
      y: node.at.y * cell,
      handleKey: 'node-at',
    },
  ]
}

export function setPathPoint(data, pathId, pointIndex, xUnits, yUnits) {
  const path = data.exterior?.paths?.find((p) => p.id === pathId)
  const pt = path?.points?.[pointIndex]
  if (!pt) return
  const oldX = pt.x
  const oldY = pt.y
  pt.x = round2(xUnits)
  pt.y = round2(yUnits)
  syncCoordsEverywhere(data, oldX, oldY, pt.x, pt.y)
  syncNodeAtCoords(data, oldX, oldY, pt.x, pt.y)
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const nx = ax + t * dx
  const ny = ay + t * dy
  return Math.hypot(px - nx, py - ny)
}

function insertIndexOnPolyline(px, py, pts) {
  if (pts.length < 2) return pts.length
  let bestDist = Infinity
  let insertIndex = pts.length
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const d = distanceToSegment(px, py, a.x, a.y, b.x, b.y)
    if (d < bestDist) {
      bestDist = d
      insertIndex = i + 1
    }
  }
  return insertIndex
}

function pathNodePositions(data, path) {
  return (path.nodes ?? [])
    .map((id) => data.exterior?.nodes?.find((n) => n.id === id)?.at)
    .filter(Boolean)
}

export function generateExteriorNodeId(data, prefix = 'footpath-stand') {
  const ids = new Set((data.exterior?.nodes ?? []).map((n) => n.id))
  let n = 1
  while (ids.has(`${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}

/** Insert a curve waypoint on the nearest control segment (not always at the end). */
export function addPathPoint(data, pathId, xUnits, yUnits) {
  const path = data.exterior?.paths?.find((p) => p.id === pathId)
  if (!path) return -1
  if (!path.points) path.points = []

  const newPt = { x: round2(xUnits), y: round2(yUnits) }
  if (path.points.length < 2) {
    path.points.push(newPt)
    return path.points.length - 1
  }

  const insertIndex = insertIndexOnPolyline(xUnits, yUnits, path.points)
  path.points.splice(insertIndex, 0, newPt)
  return insertIndex
}

/**
 * Insert a named stand spot on the path route (green node). Also adds a matching
 * curve point when the path already has a points list.
 */
export function addPathNode(data, pathId, xUnits, yUnits, label = null) {
  const path = data.exterior?.paths?.find((p) => p.id === pathId)
  if (!path) return null
  if (!data.exterior.nodes) data.exterior.nodes = []
  if (!path.nodes) path.nodes = []

  const at = { x: round2(xUnits), y: round2(yUnits) }
  const nodeId = generateExteriorNodeId(data)
  const node = {
    id: nodeId,
    at,
    label: label ?? `Stand ${path.nodes.length + 1}`,
  }
  data.exterior.nodes.push(node)

  const nodePts = pathNodePositions(data, path)
  const guidePts =
    nodePts.length >= 2 ? nodePts : (path.points?.length ? path.points : [at])
  const nodeInsertIndex = insertIndexOnPolyline(xUnits, yUnits, guidePts)
  path.nodes.splice(nodeInsertIndex, 0, nodeId)

  if (path.points?.length) {
    const pointInsertIndex = insertIndexOnPolyline(xUnits, yUnits, path.points)
    path.points.splice(pointInsertIndex, 0, { ...at })
  }

  return nodeId
}

/** Remove a stand spot from a path; deletes the exterior node if unused elsewhere. */
export function removePathNodeFromPath(data, pathId, nodeId) {
  const path = data.exterior?.paths?.find((p) => p.id === pathId)
  const node = data.exterior?.nodes?.find((n) => n.id === nodeId)
  if (!path?.nodes || !node) return false
  if (node.door) return false

  const idx = path.nodes.indexOf(nodeId)
  if (idx === -1) return false
  path.nodes.splice(idx, 1)

  const key = coordsKey(node.at.x, node.at.y)
  if (path.points) {
    const pi = path.points.findIndex((p) => coordsKey(p.x, p.y) === key)
    if (pi !== -1) path.points.splice(pi, 1)
  }

  const stillUsed = (data.exterior?.paths ?? []).some((p) =>
    p.nodes?.includes(nodeId),
  )
  if (!stillUsed) {
    data.exterior.nodes = data.exterior.nodes.filter((n) => n.id !== nodeId)
  }
  return true
}

export function removePathPoint(data, pathId, pointIndex) {
  const path = data.exterior?.paths?.find((p) => p.id === pathId)
  if (!path?.points || path.points.length <= 2) return false
  path.points.splice(pointIndex, 1)
  return true
}

export function setRoomRect(data, roomId, { x, y, w, h }) {
  const room = data.rooms?.find((r) => r.id === roomId)
  if (!room) return
  if (x != null) room.x = snapHalf(x)
  if (y != null) room.y = snapHalf(y)
  if (w != null) room.w = Math.max(0.5, snapHalf(w))
  if (h != null) room.h = Math.max(0.5, snapHalf(h))
}

export function setRoomName(data, roomId, name) {
  const room = data.rooms?.find((r) => r.id === roomId)
  if (!room) return
  room.name = name
}

/** Move or resize room from a handle drag (layout units). */
export function setRoomFromHandle(data, roomId, role, xUnits, yUnits) {
  const room = data.rooms?.find((r) => r.id === roomId)
  if (!room) return
  const ox = room.x
  const oy = room.y
  const ow = room.w ?? 1
  const oh = room.h ?? 1
  const x = snapHalf(xUnits)
  const y = snapHalf(yUnits)

  if (role === 'move') {
    room.x = snapHalf(x - ow / 2)
    room.y = snapHalf(y - oh / 2)
    return
  }
  if (role === 'nw') {
    room.x = x
    room.y = y
    room.w = Math.max(0.5, snapHalf(ox + ow - x))
    room.h = Math.max(0.5, snapHalf(oy + oh - y))
    return
  }
  if (role === 'ne') {
    room.y = y
    room.w = Math.max(0.5, snapHalf(x - ox))
    room.h = Math.max(0.5, snapHalf(oy + oh - y))
    return
  }
  if (role === 'se') {
    room.w = Math.max(0.5, snapHalf(x - ox))
    room.h = Math.max(0.5, snapHalf(y - oy))
    return
  }
  if (role === 'sw') {
    room.x = x
    room.w = Math.max(0.5, snapHalf(ox + ow - x))
    room.h = Math.max(0.5, snapHalf(y - oy))
  }
}

export function setDoorAt(data, doorId, xUnits, yUnits) {
  const door = data.doors?.find((d) => d.id === doorId)
  if (!door) return
  if (!door.at) door.at = {}
  door.at.x = round2(xUnits)
  door.at.y = round2(yUnits)
}

export function setRollDoorProps(data, doorId, { edge, rollSpan }) {
  const door = data.doors?.find((d) => d.id === doorId)
  if (!door?.room) return
  const room = data.rooms?.find((r) => r.id === door.room)
  if (!room) return
  if (edge != null) room.rollDoor = normalizeCompassEdge(edge)
  if (rollSpan != null) room.rollSpan = Math.max(0.1, Math.min(1, round2(rollSpan)))
}

export function setNodeAt(data, nodeId, xUnits, yUnits) {
  const node = data.exterior?.nodes?.find((n) => n.id === nodeId)
  if (!node) return
  if (!node.at) node.at = {}
  const oldX = node.at.x
  const oldY = node.at.y
  node.at.x = round2(xUnits)
  node.at.y = round2(yUnits)
  syncCoordsEverywhere(data, oldX, oldY, node.at.x, node.at.y)
  if (node.door) {
    const arr = data.transitions ?? data.exits ?? []
    const exit = arr.find((e) => e.door === node.door)
    if (exit) {
      if (!exit.at) exit.at = {}
      exit.at.x = node.at.x
      exit.at.y = node.at.y
    }
  }
}

export function setNodeLabel(data, nodeId, label) {
  const node = data.exterior?.nodes?.find((n) => n.id === nodeId)
  if (!node) return
  node.label = label
}

function fmtPoint(p) {
  return `{ x: ${round2(p.x)}, y: ${round2(p.y)} }`
}

function serializeRoom(room, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}- id: ${room.id}`]
  if (room.level) lines.push(`${inner}level: ${room.level}`)
  if (room.levels?.length) {
    lines.push(`${inner}levels: [${room.levels.join(', ')}]`)
  }
  lines.push(
    `${inner}x: ${room.x}`,
    `${inner}y: ${room.y}`,
    `${inner}w: ${room.w ?? 1}`,
    `${inner}h: ${room.h ?? 1}`,
  )
  if (room.name) lines.push(`${inner}name: ${JSON.stringify(room.name)}`)
  if (room.icon) lines.push(`${inner}icon: ${JSON.stringify(room.icon)}`)
  if (room.note) lines.push(`${inner}note: ${JSON.stringify(room.note)}`)
  if (room.blurb) lines.push(`${inner}blurb: ${JSON.stringify(room.blurb)}`)
  if (room.windows?.length) {
    lines.push(`${inner}windows: [${room.windows.join(', ')}]`)
  }
  if (room.open) lines.push(`${inner}open: true`)
  if (room.mirror) lines.push(`${inner}mirror: ${room.mirror}`)
  if (room.revealWhenDoor) lines.push(`${inner}revealWhenDoor: ${room.revealWhenDoor}`)
  if (room.feature) lines.push(`${inner}feature: ${room.feature}`)
  if (room.rollDoor) lines.push(`${inner}rollDoor: ${room.rollDoor}`)
  if (room.rollSpan != null) lines.push(`${inner}rollSpan: ${round2(room.rollSpan)}`)
  return lines.join('\n')
}

function serializeDoor(door, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}- id: ${door.id}`, `${inner}kind: ${door.kind}`]
  if (door.level) lines.push(`${inner}level: ${door.level}`)
  if (door.onLevels?.length) {
    lines.push(`${inner}onLevels: [${door.onLevels.join(', ')}]`)
  }
  if (door.room) lines.push(`${inner}room: ${door.room}`)
  if (door.at) lines.push(`${inner}at: ${fmtPoint(door.at)}`)
  if (door.vertical) lines.push(`${inner}vertical: true`)
  if (door.label) lines.push(`${inner}label: ${JSON.stringify(door.label)}`)
  if (door.showWhenRoom) lines.push(`${inner}showWhenRoom: ${door.showWhenRoom}`)
  if (door.showWhenDiscovered) lines.push(`${inner}showWhenDiscovered: ${door.showWhenDiscovered}`)
  if (door.showWhenRevealed) lines.push(`${inner}showWhenRevealed: ${door.showWhenRevealed}`)
  if (door.initial) {
    const init = door.initial
    const parts = []
    if (init.closed != null) parts.push(`closed: ${init.closed}`)
    if (init.locked != null) parts.push(`locked: ${init.locked}`)
    if (parts.length) lines.push(`${inner}initial: { ${parts.join(', ')} }`)
  }
  return lines.join('\n')
}

function serializePath(path, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}- id: ${path.id}`]
  if (path.smooth === false) lines.push(`${inner}smooth: false`)
  else if (path.smooth) lines.push(`${inner}smooth: true`)
  if (path.nodes?.length) {
    lines.push(`${inner}nodes: [${path.nodes.join(', ')}]`)
  }
  lines.push(`${inner}points:`)
  for (const p of path.points ?? []) {
    lines.push(`${inner}  - ${fmtPoint(p)}`)
  }
  return lines.join('\n')
}

function serializeNode(node, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}- id: ${node.id}`, `${inner}at: ${fmtPoint(node.at)}`]
  if (node.label) lines.push(`${inner}label: ${JSON.stringify(node.label)}`)
  if (node.door) lines.push(`${inner}door: ${node.door}`)
  if (node.room) lines.push(`${inner}room: ${node.room}`)
  return lines.join('\n')
}

function serializeExit(exit, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  if (!exit.door) {
    // Transition (no door)
    const lines = [`${pad}- id: ${exit.id}`]
    if (exit.label) lines.push(`${inner}label: ${JSON.stringify(exit.label)}`)
    if (exit.exteriorNode) lines.push(`${inner}exteriorNode: ${exit.exteriorNode}`)
    if (exit.at) lines.push(`${inner}at: ${fmtPoint(exit.at)}`)
    if (exit.hex) lines.push(`${inner}hex: ${exit.hex}`)
    return lines.join('\n')
  }
  // Legacy door-based exit
  const lines = [`${pad}- door: ${exit.door}`]
  if (exit.room) lines.push(`${inner}room: ${exit.room}`)
  if (exit.exteriorNode) lines.push(`${inner}exteriorNode: ${exit.exteriorNode}`)
  if (exit.at) lines.push(`${inner}at: ${fmtPoint(exit.at)}`)
  if (exit.mapAt) lines.push(`${inner}mapAt: ${fmtPoint(exit.mapAt)}`)
  if (exit.hex) lines.push(`${inner}hex: ${exit.hex}`)
  if (exit.standAt) {
    const st = exit.standAt
    if (st.from === 'landmark') {
      const parts = ['from: landmark']
      if (st.dx !== undefined && st.dx !== 0) parts.push(`dx: ${round2(st.dx)}`)
      if (st.dy !== undefined && st.dy !== 0) parts.push(`dy: ${round2(st.dy)}`)
      lines.push(`${inner}standAt: { ${parts.join(', ')} }`)
    } else if (st.x != null && st.y != null) {
      lines.push(`${inner}standAt: { x: ${round2(st.x)}, y: ${round2(st.y)} }`)
    }
  }
  return lines.join('\n')
}

function serializeExterior(exterior, indent = 0) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}exterior:`]
  if (exterior.level) lines.push(`${inner}level: ${exterior.level}`)
  if (exterior.entry) lines.push(`${inner}entry: ${exterior.entry}`)
  if (exterior.pad != null) lines.push(`${inner}pad: ${exterior.pad}`)
  if (exterior.nodes?.length) {
    lines.push(`${inner}nodes:`)
    for (const n of exterior.nodes) {
      lines.push(serializeNode(n, indent + 2))
    }
  }
  if (exterior.paths?.length) {
    lines.push(`${inner}paths:`)
    for (const p of exterior.paths) {
      lines.push(serializePath(p, indent + 2))
    }
  }
  return lines.join('\n')
}

/** YAML snippets ready to paste into utility-station.yaml. */
export function exportBuildingYaml(data) {
  const roomBlocks = (data.rooms ?? []).map((r) => serializeRoom(r, 2))
  const doorBlocks = (data.doors ?? []).map((d) => serializeDoor(d, 2))
  const transitionArr = data.transitions ?? data.exits ?? []
  const exitBlocks = transitionArr.map((e) => serializeExit(e, 2))
  const exteriorYaml = data.exterior ? serializeExterior(data.exterior, 0) : ''

  const roomsYaml = roomBlocks.length ? `rooms:\n${roomBlocks.join('\n\n')}` : ''
  const doorsYaml = doorBlocks.length ? `doors:\n${doorBlocks.join('\n\n')}` : ''
  const exitsYaml = exitBlocks.length ? `transitions:\n${exitBlocks.join('\n\n')}` : ''

  return {
    rooms: roomsYaml,
    doors: doorsYaml,
    exits: exitsYaml,
    exterior: exteriorYaml,
    all: [roomsYaml, doorsYaml, exitsYaml, exteriorYaml].filter(Boolean).join('\n\n'),
  }
}

/** Builder palette — keep footpath, edit overlays, and handles visually distinct. */
export const GRID_BUILDER_COLORS = {
  footpath: '#c9b97e',
  footpathDim: '#5c574e',
  pathPreview: '#e878a8',
  pathControl: '#58c4e8',
  curvePoint: '#f4a261',
  pathNode: '#7dcea0',
}

export function pathHandleColor() {
  return GRID_BUILDER_COLORS.footpath
}

export function pathCurvePointColor() {
  return GRID_BUILDER_COLORS.curvePoint
}

export function pathNodeHandleColor() {
  return GRID_BUILDER_COLORS.pathNode
}

export function pathControlLineColor() {
  return GRID_BUILDER_COLORS.pathControl
}

export function pathPreviewColor() {
  return GRID_BUILDER_COLORS.pathPreview
}

export function roomHandleColor(role) {
  if (role === 'move') return '#c792ea'
  if (role === 'path-node' || role === 'exit-map') return '#7dcea0'
  return '#ffd166'
}
