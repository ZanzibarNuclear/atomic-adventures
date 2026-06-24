import { buildingLabel } from "../../../displayLabel.js";
import { normalizeDoorInitial } from '../useDoors.js'
import { layoutSideFromEdge, normalizeCompassEdge } from './useGridCompass.js'

function buildExteriorModel(exterior) {
  if (!exterior) {
    return {
      level: 'first',
      entry: null,
      nodes: [],
      nodeById: {},
      entryByDoorId: {},
      adj: {},
      paths: [],
    }
  }
  const nodes = exterior.nodes ?? []
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const adj = Object.fromEntries(nodes.map((n) => [n.id, new Set()]))
  const paths = []
  for (const path of exterior.paths ?? []) {
    const nodeIds = path.nodes ?? []
    const points =
      path.points?.length > 0
        ? path.points
        : nodeIds.map((id) => nodeById[id]?.at).filter(Boolean)
    paths.push({
      id: path.id ?? nodeIds.join('-'),
      nodeIds,
      points,
      smooth: path.smooth !== false,
    })
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const a = nodeIds[i]
      const b = nodeIds[i + 1]
      adj[a]?.add(b)
      adj[b]?.add(a)
    }
  }
  for (const node of nodes) {
    if (!node.joinNode || !nodeById[node.joinNode]) continue
    adj[node.id]?.add(node.joinNode)
    adj[node.joinNode]?.add(node.id)
  }
  const entryByDoorId = Object.fromEntries(
    nodes.filter((n) => n.door).map((n) => [n.door, n]),
  )
  return {
    level: exterior.level ?? 'first',
    entry: exterior.entry ?? nodes[0]?.id ?? null,
    pad: exterior.pad ?? 0.8,
    nodes,
    nodeById,
    entryByDoorId,
    adj: Object.fromEntries(Object.entries(adj).map(([k, v]) => [k, [...v]])),
    paths,
  }
}

export function buildBuilding(data) {
  const cell = data.cell ?? 64
  const rooms = (data.rooms ?? []).map((r) => ({
    w: 1,
    h: 1,
    ...r,
    windows: r.windows?.map((w) => normalizeCompassEdge(w)),
    rollDoor: r.rollDoor ? normalizeCompassEdge(r.rollDoor) : r.rollDoor,
    stands: (r.stands ?? []).map((stand) => ({ ...stand })),
  }))
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const levels = [...(data.levels ?? [])].sort((a, b) => b.order - a.order)
  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]))
  const links = data.links ?? []
  const fixtures = (data.fixtures ?? []).map((f) => ({
    ...f,
    protrude: f.protrude ? normalizeCompassEdge(f.protrude) : f.protrude,
  }))
  const items = data.items ?? []
  const itemById = Object.fromEntries(
    items.filter((i) => i.id).map((i) => [i.id, { kind: 'item', ...i }]),
  )
  const pickups = (data.pickups ?? []).filter((p) => p.id && p.item)
  const switches = (data.switches ?? []).filter((s) => s.id && s.door)
  const actions = (data.actions ?? []).filter((a) => a.id && a.label)
  const doors = (data.doors ?? []).map((d) => ({
    ...d,
    initial: normalizeDoorInitial(d.initial),
  }))
  const doorById = Object.fromEntries(doors.filter((d) => d.id).map((d) => [d.id, d]))
  const exits = (data.transitions ?? data.exits ?? []).map((e) => ({ ...e }))
  const exitByDoorId = Object.fromEntries(exits.filter((e) => e.door).map((e) => [e.door, e]))
  const exitById = Object.fromEntries(exits.filter((e) => e.id).map((e) => [e.id, e]))
  const exterior = buildExteriorModel(data.exterior)
  const areaId = data.id ?? data.area ?? 'building'
  return {
    id: areaId,
    areaId,
    label: buildingLabel({ id: areaId, label: data.label }),
    cell,
    gridFeet: data.gridFeet ?? 10,
    unitFeet: data.unitFeet ?? data.gridFeet ?? 10,
    north: data.north ?? 'up',
    outdoorHex: data.outdoorHex ?? null,
    rooms,
    roomById,
    levels,
    levelById,
    links,
    fixtures,
    items,
    itemById,
    pickups,
    switches,
    actions,
    doors,
    doorById,
    exits,
    exitByDoorId,
    exitById,
    exterior,
    river: data.river ?? null,
    cliffWall: data.cliffWall ?? null,
    hydroSystem: data.hydroSystem ?? false,
    start: data.start ?? rooms[0]?.id,
  }
}

export const DOOR_STAND_INSET = 0.22

export function authoredRoomStands(room) {
  return (room?.stands ?? []).map((stand) => ({
    ...stand,
    kind: 'authored',
  }))
}

export function defaultRoomStandId(room) {
  if (!room) return null
  if (room.defaultStand && room.stands?.some((stand) => stand.id === room.defaultStand)) {
    return room.defaultStand
  }
  return room.stands?.[0]?.id ?? null
}

function thresholdPointForRoom(room, point, inset = DOOR_STAND_INSET) {
  if (!room || !point) return null
  const left = room.x
  const right = room.x + (room.w ?? 1)
  const top = room.y
  const bottom = room.y + (room.h ?? 1)
  const distances = [
    { edge: 'left', value: Math.abs(point.x - left) },
    { edge: 'right', value: Math.abs(point.x - right) },
    { edge: 'top', value: Math.abs(point.y - top) },
    { edge: 'bottom', value: Math.abs(point.y - bottom) },
  ].sort((a, b) => a.value - b.value)
  const edge = distances[0].edge
  const at = {
    x: Math.max(left + inset, Math.min(right - inset, point.x)),
    y: Math.max(top + inset, Math.min(bottom - inset, point.y)),
  }
  if (edge === 'left') at.x = left + inset
  if (edge === 'right') at.x = right - inset
  if (edge === 'top') at.y = top + inset
  if (edge === 'bottom') at.y = bottom - inset
  return at
}

export function doorThresholdForRoom(building, roomId, doorId) {
  const room = building?.roomById?.[roomId]
  const door = building?.doorById?.[doorId]
  if (!room || !door) return null
  let point = door.at
  if (door.kind === 'roll') {
    const edge = layoutSideFromEdge(room.rollDoor)
    if (edge === 'top') point = { x: room.x + room.w / 2, y: room.y }
    if (edge === 'bottom') point = { x: room.x + room.w / 2, y: room.y + room.h }
    if (edge === 'left') point = { x: room.x, y: room.y + room.h / 2 }
    if (edge === 'right') point = { x: room.x + room.w, y: room.y + room.h / 2 }
  }
  const at = thresholdPointForRoom(room, point)
  if (!at) return null
  return {
    id: `door:${doorId}`,
    room: roomId,
    door: doorId,
    at,
    label: door.label ?? `Door — ${doorId}`,
    kind: 'door',
  }
}

export function derivedDoorStands(building, roomId) {
  const room = building?.roomById?.[roomId]
  if (!room || room.feature) return []
  const out = []
  for (const door of building.doors ?? []) {
    if (!linkedRoomIdsForDoor(building, door).includes(roomId)) continue
    const stand = doorThresholdForRoom(building, roomId, door.id)
    if (stand) out.push(stand)
  }
  return out
}

export function roomStandModels(building, roomId) {
  const room = building?.roomById?.[roomId]
  if (!room) return []
  return [
    ...authoredRoomStands(room).map((stand) => ({ ...stand, room: roomId })),
    ...derivedDoorStands(building, roomId),
  ]
}

export function roomStandById(building, roomId, standId) {
  if (!standId) return null
  return roomStandModels(building, roomId).find((stand) => stand.id === standId) ?? null
}

export function roomsOnLevel(building, levelId) {
  return building.rooms.filter(
    (r) => !r.feature && (r.level === levelId || r.levels?.includes(levelId)),
  )
}

export function roomOnLevel(room, levelId) {
  if (room.feature) return room.levels?.includes(levelId) ?? room.level === levelId
  return room.level === levelId
}

export function roomRect(room, cell) {
  return {
    x: room.x * cell,
    y: room.y * cell,
    w: (room.w ?? 1) * cell,
    h: (room.h ?? 1) * cell,
  }
}

export function roomCenter(room, cell) {
  const r = roomRect(room, cell)
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

// Keep in sync with GridRoomLayer centered icon (p.center.y, dominant-baseline: middle).
export const ROOM_ICON_HALF_HEIGHT = 11
export const FEET_GAP_ABOVE_ROOM_ICON = 4

export function protrudeAngle(edge) {
  const side = layoutSideFromEdge(edge ?? 'west')
  if (side === 'top') return 270
  if (side === 'bottom') return 90
  if (side === 'left') return 180
  return 0
}

const SPIRAL_TREAD_COUNT = 7

export function spiralStandPoint(cx, cy, radius, protrude = 'west', treadIndex) {
  const base = (protrudeAngle(protrude) * Math.PI) / 180
  const westAng = base - Math.PI / 2
  const n = SPIRAL_TREAD_COUNT
  const midFrac = 0.5
  const i = treadIndex ?? Math.floor((n - 1) / 2)
  const t = n > 1 ? i / (n - 1) : 0
  const ang = westAng + Math.PI * t
  return {
    x: cx + radius * midFrac * Math.cos(ang),
    y: cy + radius * midFrac * Math.sin(ang),
  }
}

export function spiralExitPoint(cx, cy, radius, protrude = 'west', end) {
  const n = SPIRAL_TREAD_COUNT
  const innerDown = Math.floor((n - 1) * 0.35)
  const innerUp = Math.ceil((n - 1) * 0.65)
  const treadIndex =
    end === 'up' ? Math.round((innerUp + (n - 1)) / 2) : Math.round(innerDown / 2)
  return spiralStandPoint(cx, cy, radius, protrude, treadIndex)
}

export function isStairLanding(room) {
  return !!room?.feature
}

export function featureRoomForFixture(building, fixtureId) {
  const room = building.rooms.find((r) => r.feature === fixtureId)
  return room?.id ?? null
}

export function primaryLevel(room) {
  if (!room) return null
  return room.level ?? room.levels?.[0] ?? null
}

export function roomLevel(room, landing = null) {
  if (!room) return landing
  if (room.feature) return landing ?? room.levels?.[0]
  return room.level ?? room.levels?.[0]
}

export function levelOrder(building, levelId) {
  return building.levelById[levelId]?.order ?? 0
}

export function spiralLandingsFor(building, room) {
  const levels = room?.levels ?? []
  if (levels.length < 2) return { low: levels[0], high: levels[0] }
  const sorted = [...levels].sort((a, b) => levelOrder(building, a) - levelOrder(building, b))
  return { low: sorted[0], high: sorted[sorted.length - 1] }
}

export function stairExitRooms(building, stairRoomId) {
  const stair = building.roomById[stairRoomId]
  if (!stair?.feature) return { upRoomId: null, downRoomId: null }
  const { low, high } = spiralLandingsFor(building, stair)
  let upRoomId = null
  let downRoomId = null
  for (const link of building.links) {
    let otherId = null
    if (link.from === stairRoomId) otherId = link.to
    else if (link.to === stairRoomId) otherId = link.from
    else continue
    const other = building.roomById[otherId]
    if (!other || isStairLanding(other)) continue
    const lv = roomLevel(other)
    if (lv === high) upRoomId = otherId
    if (lv === low) downRoomId = otherId
  }
  return { upRoomId, downRoomId }
}

/** @deprecated use stairExitRooms */
export function spiralExitRooms(building) {
  return stairExitRooms(building, 'spiral-stair')
}

export function roomStandPosition(building, room, standId = null) {
  if (!room) return null
  const selected = roomStandById(building, room.id, standId)
  if (selected?.at) {
    return { x: selected.at.x * building.cell, y: selected.at.y * building.cell }
  }
  const defaultId = defaultRoomStandId(room)
  const authoredDefault = roomStandById(building, room.id, defaultId)
  if (authoredDefault?.at) {
    return {
      x: authoredDefault.at.x * building.cell,
      y: authoredDefault.at.y * building.cell,
    }
  }
  if (room.feature) {
    const fixture = (building.fixtures ?? []).find((f) => f.id === room.feature)
    if (fixture?.kind === 'spiral-stairs' && fixture.at) {
      const cell = building.cell
      return spiralStandPoint(
        fixture.at.x * cell,
        fixture.at.y * cell,
        (fixture.radius ?? 0.6) * cell,
        fixture.protrude ?? 'west',
      )
    }
    if (fixture?.kind === 'straight-stairs' && fixture.rect) {
      const cell = building.cell
      const r = fixture.rect
      return {
        x: (r.x + r.w / 2) * cell,
        y: (r.y + r.h / 2) * cell,
      }
    }
  }
  return roomCenter(room, building.cell)
}

export function linkedRoomIdsForDoor(building, door) {
  if (!door) return []
  if (door.room) return [door.room]
  const ids = new Set()
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door === door.id) {
      ids.add(link.from)
      ids.add(link.to)
    }
  }
  return [...ids]
}

export function sharedEdge(a, b, cell) {
  const ra = roomRect(a, cell)
  const rb = roomRect(b, cell)
  const eps = 0.5
  for (const [left, right] of [[ra, rb], [rb, ra]]) {
    if (Math.abs(left.x + left.w - right.x) < eps) {
      const y1 = Math.max(left.y, right.y)
      const y2 = Math.min(left.y + left.h, right.y + right.h)
      if (y2 > y1) return { x: right.x, y1, y2, vertical: true }
    }
  }
  for (const [top, bot] of [[ra, rb], [rb, ra]]) {
    if (Math.abs(top.y + top.h - bot.y) < eps) {
      const x1 = Math.max(top.x, bot.x)
      const x2 = Math.min(top.x + top.w, bot.x + bot.w)
      if (x2 > x1) return { y: bot.y, x1, x2, vertical: false }
    }
  }
  return null
}

export function dirBetween(building, fromRoom, toRoom) {
  const a = building.levelById[roomLevel(fromRoom)]?.order ?? 0
  const b = building.levelById[roomLevel(toRoom)]?.order ?? 0
  if (b > a) return 'up'
  if (b < a) return 'down'
  return 'same'
}

export function rollDoorRect(room, cell) {
  if (!room?.rollDoor) return null
  const r = roomRect(room, cell)
  const edge = layoutSideFromEdge(room.rollDoor)
  const wallLen = edge === 'top' || edge === 'bottom' ? r.w : r.h
  const span = (room.rollSpan ?? 0.6) * wallLen
  let x1, y1
  if (edge === 'top') {
    const mx = r.x + r.w / 2
    x1 = mx - span / 2
    y1 = r.y
    return { x: x1, y: y1, w: span, h: 10, vertical: false }
  }
  if (edge === 'bottom') {
    const mx = r.x + r.w / 2
    x1 = mx - span / 2
    y1 = r.y + r.h - 10
    return { x: x1, y: y1, w: span, h: 10, vertical: false }
  }
  if (edge === 'left') {
    const my = r.y + r.h / 2
    x1 = r.x
    y1 = my - span / 2
    return { x: x1, y: y1, w: 10, h: span, vertical: true }
  }
  const my = r.y + r.h / 2
  x1 = r.x + r.w - 10
  y1 = my - span / 2
  return { x: x1, y: y1, w: 10, h: span, vertical: true }
}

export const EXIT_MAP_OFFSET = { dx: 0.38, dy: -0.38 }

export function exitMapAt(exit) {
  if (exit?.mapAt) return exit.mapAt
  if (!exit?.at) return null
  if (!exit?.door) return exit.at  // transitions: at is the display position directly
  return {
    x: exit.at.x + EXIT_MAP_OFFSET.dx,
    y: exit.at.y + EXIT_MAP_OFFSET.dy,
  }
}

function doorOnLevel(door, levelId) {
  const levels = door.onLevels ?? (door.level != null ? [door.level] : [])
  return levels.includes(levelId)
}

function spiralStairEndpointLevel(door, building) {
  const linked = linkedRoomIdsForDoor(building, door)
    .map((id) => building.roomById[id])
    .filter(Boolean)
  const stair = linked.find((r) => r.feature === 'spiral-stair')
  if (!stair) return null
  const end = linked.find((r) => !isStairLanding(r))
  return end ? primaryLevel(end) : null
}

export function spiralStairRoomId(building) {
  return building.rooms?.find((r) => r.feature === 'spiral-stair')?.id ?? null
}

function spiralStairEndpointRoom(door, building) {
  const linked = linkedRoomIdsForDoor(building, door)
    .map((id) => building.roomById[id])
    .filter(Boolean)
  if (!linked.some((r) => r.feature === 'spiral-stair')) return null
  return linked.find((r) => !isStairLanding(r)) ?? null
}

function straightStairEndpointLevel(door, building) {
  const linked = linkedRoomIdsForDoor(building, door)
    .map((id) => building.roomById[id])
    .filter(Boolean)
  const stair = linked.find((r) => r.feature === 'garage-stair')
  if (!stair) return null
  const end = linked.find((r) => !isStairLanding(r))
  return end ? primaryLevel(end) : null
}

function straightStairRoomId(building) {
  return building.rooms?.find((r) => r.feature === 'garage-stair')?.id ?? null
}

function manDoorOnLevel(door, building, levelId, currentRoom = null) {
  const spiralEndpoint = spiralStairEndpointLevel(door, building)
  if (spiralEndpoint != null) {
    const onSpiral = currentRoom && currentRoom === spiralStairRoomId(building)
    if (onSpiral) return true
    return spiralEndpoint === levelId
  }

  const straightEndpoint = straightStairEndpointLevel(door, building)
  if (straightEndpoint != null) {
    if (levelId === straightEndpoint) return doorOnLevel(door, levelId)
    const onGarageStair = currentRoom && currentRoom === straightStairRoomId(building)
    return onGarageStair && doorOnLevel(door, levelId)
  }

  return doorOnLevel(door, levelId)
}

export function exitsOnLevel(building, levelId) {
  const exteriorLevel = building.exterior?.level
  return (building.exits ?? []).filter((exit) => {
    if (!exit.door) {
      // Transition (no door): lives on the exterior level
      return exteriorLevel === levelId
    }
    const door = building.doorById?.[exit.door]
    if (!door) return false
    if (door.kind === 'roll') {
      const room = building.roomById[door.room]
      return room?.level === levelId
    }
    return doorOnLevel(door, levelId)
  })
}

export function exteriorPathsOnLevel(building, levelId) {
  if (building.exterior?.level !== levelId) return []
  return building.exterior.paths ?? []
}

export function exteriorNodesOnLevel(building, levelId) {
  if (building.exterior?.level !== levelId) return []
  return building.exterior.nodes ?? []
}

export function doorsOnLevel(building, levelId, doorState = null, currentRoom = null) {
  const cell = building.cell
  const areaId = building.areaId
  const out = []
  for (const door of building.doors ?? []) {
    if (!door.id) continue
    const state = doorState?.[`${areaId}:${door.id}`] ?? door.initial
    if (door.kind === 'man' && manDoorOnLevel(door, building, levelId, currentRoom) && door.at) {
      out.push({
        id: door.id,
        kind: 'man',
        x: door.at.x * cell,
        y: door.at.y * cell,
        vertical: !!door.vertical,
        state,
      })
    }
    if (door.kind === 'roll') {
      const room = building.roomById[door.room]
      if (!room || room.level !== levelId) continue
      const rect = rollDoorRect(room, cell)
      if (!rect) continue
      out.push({
        id: door.id,
        kind: 'roll',
        ...rect,
        state,
      })
    }
  }
  return out
}

export function fixturesOnLevel(building, levelId) {
  const cell = building.cell
  const out = []
  for (const f of building.fixtures) {
    const onLevels = f.onLevels ?? building.levels.map((l) => l.id)
    if (!onLevels.includes(levelId)) continue
    const rooms = (f.connects ?? []).map((id) => building.roomById[id]).filter(Boolean)
    const here = rooms.find((r) => roomOnLevel(r, levelId))
    const there = rooms.find((r) => r !== here && !roomOnLevel(r, levelId))
    const dir = here && there ? dirBetween(building, here, there) : 'same'
    const featureRoomId = featureRoomForFixture(building, f.id)
    const toRoomId = featureRoomId ?? there?.id ?? null
    const connects = (f.connects ?? rooms.map((r) => r.id)).filter(Boolean)
    if (f.kind === 'spiral-stairs') {
      out.push({
        id: f.id,
        kind: f.kind,
        dir,
        toRoomId,
        featureRoomId,
        connects,
        x: f.at.x * cell,
        y: f.at.y * cell,
        protrude: f.protrude ?? 'west',
        radius: (f.radius ?? 0.6) * cell,
      })
    } else if (f.kind === 'straight-stairs') {
      const r = f.rect
      out.push({
        id: f.id,
        kind: f.kind,
        dir,
        toRoomId,
        featureRoomId,
        connects,
        visualOnly: !!f.visualOnly,
        rect: { x: r.x * cell, y: r.y * cell, w: r.w * cell, h: r.h * cell },
        run: f.run ?? 'horizontal',
        ascend: f.ascend ?? 'end',
      })
    }
  }
  return out
}

export { spiralStairEndpointRoom, doorOnLevel }
