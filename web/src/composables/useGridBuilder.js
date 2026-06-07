import { roomRect, roomOnLevel } from './useGrid.js'

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

export function listAllGridEditable(data, levelId) {
  return [
    ...listEditablePaths(data, levelId),
    ...listEditableRooms(data, levelId),
    ...listEditableDoors(data, levelId),
    ...listEditableNodes(data, levelId),
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
  return null
}

export function gridEditModeForSource(source) {
  if (source === 'paths') return 'line'
  if (source === 'rooms') return 'room'
  if (source === 'doors') return 'door'
  if (source === 'nodes') return 'node'
  return null
}

/** Path waypoint handles in layout pixels (pre-rotation). */
export function resolvedPathHandles(path, cell) {
  return (path?.points ?? []).map((p, index) => ({
    index,
    role: 'point',
    x: p.x * cell,
    y: p.y * cell,
    handleKey: `point-${index}`,
  }))
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
  if (!path?.points?.[pointIndex]) return
  path.points[pointIndex].x = round2(xUnits)
  path.points[pointIndex].y = round2(yUnits)
}

export function addPathPoint(data, pathId, xUnits, yUnits) {
  const path = data.exterior?.paths?.find((p) => p.id === pathId)
  if (!path) return -1
  if (!path.points) path.points = []
  path.points.push({ x: round2(xUnits), y: round2(yUnits) })
  return path.points.length - 1
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
  if (edge != null) room.rollDoor = edge
  if (rollSpan != null) room.rollSpan = Math.max(0.1, Math.min(1, round2(rollSpan)))
}

export function setNodeAt(data, nodeId, xUnits, yUnits) {
  const node = data.exterior?.nodes?.find((n) => n.id === nodeId)
  if (!node) return
  if (!node.at) node.at = {}
  node.at.x = round2(xUnits)
  node.at.y = round2(yUnits)
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
  if (path.smooth) lines.push(`${inner}smooth: true`)
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
  const exteriorYaml = data.exterior ? serializeExterior(data.exterior, 0) : ''

  const roomsYaml = roomBlocks.length ? `rooms:\n${roomBlocks.join('\n\n')}` : ''
  const doorsYaml = doorBlocks.length ? `doors:\n${doorBlocks.join('\n\n')}` : ''

  return {
    rooms: roomsYaml,
    doors: doorsYaml,
    exterior: exteriorYaml,
    all: [roomsYaml, doorsYaml, exteriorYaml].filter(Boolean).join('\n\n'),
  }
}

export function pathHandleColor() {
  return '#c9b97e'
}

export function roomHandleColor(role) {
  if (role === 'move') return '#c792ea'
  return '#ffd166'
}
