// Top-down building navigation: rooms laid out on stacked grid levels,
// connected by doors (same level) and stairs (between levels).
//
// This is the grid-layout counterpart to useRoutes.js. Where the outdoor map
// derives movement from path geometry, a building's connectivity is authored
// explicitly as `links`, and up/down is inferred from each level's `order`.

import { canPassDoor, normalizeDoorInitial } from './useDoors.js'

function buildExteriorModel(exterior) {
  if (!exterior) {
    return { level: 'first', entry: null, nodes: [], nodeById: {}, adj: {}, paths: [] }
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
  return {
    level: exterior.level ?? 'first',
    entry: exterior.entry ?? nodes[0]?.id ?? null,
    pad: exterior.pad ?? 0.8,
    nodes,
    nodeById,
    adj: Object.fromEntries(Object.entries(adj).map(([k, v]) => [k, [...v]])),
    paths,
  }
}

// Normalize the raw YAML into a convenient model.
export function buildBuilding(data) {
  const cell = data.cell ?? 64
  const rooms = (data.rooms ?? []).map((r) => ({ w: 1, h: 1, ...r }))
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const levels = [...(data.levels ?? [])].sort((a, b) => b.order - a.order)
  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]))
  const links = data.links ?? []
  const fixtures = data.fixtures ?? []
  const doors = (data.doors ?? []).map((d) => ({
    ...d,
    initial: normalizeDoorInitial(d.initial),
  }))
  const doorById = Object.fromEntries(doors.filter((d) => d.id).map((d) => [d.id, d]))
  const exits = (data.exits ?? []).map((e) => ({ ...e }))
  const exitByDoorId = Object.fromEntries(exits.filter((e) => e.door).map((e) => [e.door, e]))
  const exterior = buildExteriorModel(data.exterior)
  const areaId = data.id ?? data.area ?? 'building'
  return {
    id: areaId,
    areaId,
    name: data.name,
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
    doors,
    doorById,
    exits,
    exitByDoorId,
    exterior,
    river: data.river ?? null,
    start: data.start ?? rooms[0]?.id,
  }
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

// Pixel rectangle for a room, given the cell size.
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

// `top` = west / river wall when north points right on the plan.
function protrudeAngle(edge) {
  if (edge === 'top') return 270
  if (edge === 'bottom') return 90
  if (edge === 'left') return 180
  return 0
}

const SPIRAL_TREAD_COUNT = 7

// Center of a spiral tread in layout pixels — default is the middle tread on the arc.
export function spiralStandPoint(cx, cy, radius, protrude = 'top', treadIndex) {
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

// Landing badges at the top and bottom of the spiral run (kitchen / library ends).
export function spiralExitPoint(cx, cy, radius, protrude = 'top', end) {
  const n = SPIRAL_TREAD_COUNT
  const treadIndex = end === 'up' ? n - 1 : 0
  return spiralStandPoint(cx, cy, radius, protrude, treadIndex)
}

export function isStairLanding(room) {
  return !!room?.feature
}

export function featureRoomForFixture(building, fixtureId) {
  const room = building.rooms.find((r) => r.feature === fixtureId)
  return room?.id ?? null
}

// Room ids at the high (▲) and low (▼) ends of a multi-floor stair landing.
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

// Where the avatar stands — feature rooms use their fixture anchor instead of a grid cell.
export function roomStandPosition(building, room) {
  if (!room) return null
  if (room.feature) {
    const fixture = (building.fixtures ?? []).find((f) => f.id === room.feature)
    if (fixture?.kind === 'spiral-stairs' && fixture.at) {
      const cell = building.cell
      return spiralStandPoint(
        fixture.at.x * cell,
        fixture.at.y * cell,
        (fixture.radius ?? 0.6) * cell,
        fixture.protrude ?? 'top',
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

export function mapVisibilityCtx(
  discovered,
  revealed = [],
  building = null,
  doorState = null,
  areaId = null,
  builderView = false,
  currentRoom = null,
  exteriorNode = null,
) {
  return {
    discovered: discovered instanceof Set ? discovered : new Set(discovered),
    revealed: revealed instanceof Set ? revealed : new Set(revealed),
    building,
    doorState,
    areaId: areaId ?? building?.areaId ?? null,
    builderView,
    currentRoom: currentRoom ?? null,
    exteriorNode: exteriorNode ?? null,
  }
}

export function isOutsideBuilding(ctx) {
  return !!ctx?.exteriorNode && !ctx?.currentRoom
}

const LAYOUT_EPS = 1e-5

function layoutRect(room) {
  return { x: room.x, y: room.y, w: room.w ?? 1, h: room.h ?? 1 }
}

function subtractIntervals(fullStart, fullEnd, covered) {
  if (fullEnd - fullStart <= LAYOUT_EPS) return []
  const merged = covered
    .filter(([a, b]) => b - a > LAYOUT_EPS)
    .sort((a, b) => a[0] - b[0])
  const out = []
  let cursor = fullStart
  for (const [a, b] of merged) {
    const start = Math.max(a, fullStart)
    const end = Math.min(b, fullEnd)
    if (end <= start + LAYOUT_EPS) continue
    if (start > cursor + LAYOUT_EPS) out.push([cursor, start])
    cursor = Math.max(cursor, end)
  }
  if (cursor < fullEnd - LAYOUT_EPS) out.push([cursor, fullEnd])
  return out
}

function neighborCoverOnSide(room, other, side) {
  const r = layoutRect(room)
  const s = layoutRect(other)
  if (side === 'left') {
    if (Math.abs(s.x + s.w - r.x) >= LAYOUT_EPS) return null
    const y1 = Math.max(r.y, s.y)
    const y2 = Math.min(r.y + r.h, s.y + s.h)
    return y2 - y1 > LAYOUT_EPS ? [y1, y2] : null
  }
  if (side === 'right') {
    if (Math.abs(s.x - (r.x + r.w)) >= LAYOUT_EPS) return null
    const y1 = Math.max(r.y, s.y)
    const y2 = Math.min(r.y + r.h, s.y + s.h)
    return y2 - y1 > LAYOUT_EPS ? [y1, y2] : null
  }
  if (side === 'top') {
    if (Math.abs(s.y + s.h - r.y) >= LAYOUT_EPS) return null
    const x1 = Math.max(r.x, s.x)
    const x2 = Math.min(r.x + r.w, s.x + s.w)
    return x2 - x1 > LAYOUT_EPS ? [x1, x2] : null
  }
  if (side === 'bottom') {
    if (Math.abs(s.y - (r.y + r.h)) >= LAYOUT_EPS) return null
    const x1 = Math.max(r.x, s.x)
    const x2 = Math.min(r.x + r.w, s.x + s.w)
    return x2 - x1 > LAYOUT_EPS ? [x1, x2] : null
  }
  return null
}

function exteriorEdgeIntervals(room, rooms, side) {
  const r = layoutRect(room)
  const covered = []
  for (const o of rooms) {
    if (o.id === room.id) continue
    const span = neighborCoverOnSide(room, o, side)
    if (span) covered.push(span)
  }
  if (side === 'left') return subtractIntervals(r.y, r.y + r.h, covered)
  if (side === 'right') return subtractIntervals(r.y, r.y + r.h, covered)
  if (side === 'top') return subtractIntervals(r.x, r.x + r.w, covered)
  if (side === 'bottom') return subtractIntervals(r.x, r.x + r.w, covered)
  return []
}

function collectExteriorSegments(rooms) {
  const segs = []
  for (const room of rooms) {
    const r = layoutRect(room)
    for (const [y1, y2] of exteriorEdgeIntervals(room, rooms, 'left')) {
      segs.push({ x1: r.x, y1, x2: r.x, y2 })
    }
    for (const [y1, y2] of exteriorEdgeIntervals(room, rooms, 'right')) {
      segs.push({ x1: r.x + r.w, y1: y2, x2: r.x + r.w, y2: y1 })
    }
    for (const [x1, x2] of exteriorEdgeIntervals(room, rooms, 'top')) {
      segs.push({ x1, y1: r.y, x2, y2: r.y })
    }
    for (const [x1, x2] of exteriorEdgeIntervals(room, rooms, 'bottom')) {
      segs.push({ x1: x2, y1: r.y + r.h, x2: x1, y2: r.y + r.h })
    }
  }
  return segs
}

function mergeCollinearSegments(segments) {
  const horiz = []
  const vert = []
  for (const s of segments) {
    if (Math.abs(s.y1 - s.y2) < LAYOUT_EPS) {
      horiz.push({ x1: Math.min(s.x1, s.x2), x2: Math.max(s.x1, s.x2), y: s.y1 })
    } else {
      vert.push({ y1: Math.min(s.y1, s.y2), y2: Math.max(s.y1, s.y2), x: s.x1 })
    }
  }
  const merged = []
  const byHorizY = new Map()
  for (const s of horiz) {
    const key = s.y.toFixed(6)
    if (!byHorizY.has(key)) byHorizY.set(key, [])
    byHorizY.get(key).push(s)
  }
  for (const [yKey, group] of byHorizY) {
    group.sort((a, b) => a.x1 - b.x1)
    let cur = { ...group[0] }
    for (let i = 1; i < group.length; i++) {
      const next = group[i]
      if (next.x1 <= cur.x2 + LAYOUT_EPS) cur.x2 = Math.max(cur.x2, next.x2)
      else {
        merged.push({ x1: cur.x1, y1: Number(yKey), x2: cur.x2, y2: Number(yKey) })
        cur = { ...next }
      }
    }
    merged.push({ x1: cur.x1, y1: Number(yKey), x2: cur.x2, y2: Number(yKey) })
  }
  const byVertX = new Map()
  for (const s of vert) {
    const key = s.x.toFixed(6)
    if (!byVertX.has(key)) byVertX.set(key, [])
    byVertX.get(key).push(s)
  }
  for (const [xKey, group] of byVertX) {
    group.sort((a, b) => a.y1 - b.y1)
    let cur = { ...group[0] }
    for (let i = 1; i < group.length; i++) {
      const next = group[i]
      if (next.y1 <= cur.y2 + LAYOUT_EPS) cur.y2 = Math.max(cur.y2, next.y2)
      else {
        merged.push({ x1: Number(xKey), y1: cur.y1, x2: Number(xKey), y2: cur.y2 })
        cur = { ...next }
      }
    }
    merged.push({ x1: Number(xKey), y1: cur.y1, x2: Number(xKey), y2: cur.y2 })
  }
  return merged
}

function segmentsToRings(segments) {
  const unused = new Set(segments.map((_, i) => i))
  const rings = []
  while (unused.size) {
    const startIdx = unused.values().next().value
    unused.delete(startIdx)
    const start = segments[startIdx]
    const ring = [{ x: start.x1, y: start.y1 }]
    let cx = start.x2
    let cy = start.y2
    ring.push({ x: cx, y: cy })
    while (Math.abs(cx - start.x1) > LAYOUT_EPS || Math.abs(cy - start.y1) > LAYOUT_EPS) {
      let found = false
      for (const idx of unused) {
        const s = segments[idx]
        if (Math.abs(s.x1 - cx) < LAYOUT_EPS && Math.abs(s.y1 - cy) < LAYOUT_EPS) {
          unused.delete(idx)
          cx = s.x2
          cy = s.y2
          if (Math.abs(cx - start.x1) > LAYOUT_EPS || Math.abs(cy - start.y1) > LAYOUT_EPS) {
            ring.push({ x: cx, y: cy })
          }
          found = true
          break
        }
        if (Math.abs(s.x2 - cx) < LAYOUT_EPS && Math.abs(s.y2 - cy) < LAYOUT_EPS) {
          unused.delete(idx)
          cx = s.x1
          cy = s.y1
          if (Math.abs(cx - start.x1) > LAYOUT_EPS || Math.abs(cy - start.y1) > LAYOUT_EPS) {
            ring.push({ x: cx, y: cy })
          }
          found = true
          break
        }
      }
      if (!found) break
    }
    if (ring.length >= 3) rings.push(ring)
  }
  return rings
}

/** Closed perimeter ring(s) for all rooms on a level, in layout coordinates. */
export function levelBuildingPerimeter(building, levelId) {
  const rooms = roomsOnLevel(building, levelId)
  if (rooms.length === 0) return []
  const segments = mergeCollinearSegments(collectExteriorSegments(rooms))
  return segmentsToRings(segments)
}

/** Axis-aligned bounds of the level footprint (layout pixels). */
export function levelBuildingOutline(building, levelId) {
  const cell = building.cell
  const rings = levelBuildingPerimeter(building, levelId)
  if (rings.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const ring of rings) {
    for (const p of ring) {
      const x = p.x * cell
      const y = p.y * cell
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** River strip west of the level footprint (layout units; west = top / −y). */
export function levelRiverRect(building, levelId) {
  const cfg = building.river
  if (!cfg) return null
  const onLevels = cfg.onLevels ?? [building.exterior?.level ?? 'first']
  if (!onLevels.includes(levelId)) return null
  const rings = levelBuildingPerimeter(building, levelId)
  if (!rings.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const ring of rings) {
    for (const p of ring) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  const unitFeet = building.unitFeet ?? 10
  const gap = (cfg.offsetFeet ?? 20) / unitFeet
  const width = (cfg.widthFeet ?? 25) / unitFeet
  const pad = (cfg.endPadFeet ?? 8) / unitFeet
  return {
    x: minX - pad,
    y: minY - gap - width,
    w: maxX - minX + pad * 2,
    h: width,
  }
}

export function fixtureRevealKey(fixtureId) {
  return `fixture:${fixtureId}`
}

export function doorRevealKey(doorId) {
  return `door:${doorId}`
}

/** Once a room is explored, its door glyphs stay on the plan (even if unopened). */
export function applyRevealDoorsForRoom(building, revealedSet, roomId) {
  if (!building || !roomId) return
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door && (link.from === roomId || link.to === roomId)) {
      revealedSet.add(doorRevealKey(link.door))
    }
  }
  for (const door of building.doors ?? []) {
    if (door.id && door.room === roomId) revealedSet.add(doorRevealKey(door.id))
  }
}

function isDoorPeekOpen(doorId, ctx) {
  if (!doorId || !ctx?.doorState || !ctx?.areaId) return false
  return canPassDoor(ctx.doorState, ctx.areaId, doorId)
}

function canPeekThroughDoor(doorId, ctx) {
  if (!isDoorPeekOpen(doorId, ctx)) return false
  const door = ctx?.building?.doorById?.[doorId]
  // showWhenRoom gates the door glyph (isDoorMapped), not peeking once it is open.
  if (door?.showWhenRevealed) {
    const room = ctx.building?.roomById?.[door.showWhenRevealed]
    if (!room || !isRoomMapped(room, ctx)) return false
  }
  return true
}

function linkPassable(link, doorState, areaId) {
  if (link.kind !== 'door' || !link.door) return true
  if (!doorState) return false
  return canPassDoor(doorState, areaId, link.door)
}

/** Room ids reachable in one step from `roomId` through passable links. */
function passableNeighborIds(building, roomId, doorState, areaId) {
  const out = []
  for (const link of building.links ?? []) {
    let otherId = null
    if (link.from === roomId) otherId = link.to
    else if (link.to === roomId) otherId = link.from
    else continue
    if (!linkPassable(link, doorState, areaId)) continue
    out.push(otherId)
  }
  return out
}

function primaryLevel(room) {
  if (!room) return null
  return room.level ?? room.levels?.[0] ?? null
}

/** True when any explored room shares a same-floor passable link with this room. */
function isAdjacentToDiscovered(roomId, ctx) {
  if (!ctx?.building || !ctx.discovered?.size) return false
  const target = ctx.building.roomById?.[roomId]
  const targetLevel = primaryLevel(target)
  for (const discoveredId of ctx.discovered) {
    const from = ctx.building.roomById?.[discoveredId]
    if (primaryLevel(from) !== targetLevel) continue
    const neighbors = passableNeighborIds(ctx.building, discoveredId, ctx.doorState, ctx.areaId)
    if (neighbors.includes(roomId)) return true
  }
  return false
}

function linkedRoomIdsForDoor(building, door) {
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

/** Room visible through any open door that connects to it (exterior roll-ups, lobby, etc.). */
function roomPeekableThroughOpenDoor(roomId, ctx) {
  if (!ctx?.building || !ctx.doorState) return false
  for (const door of ctx.building.doors ?? []) {
    if (!door.id) continue
    if (!linkedRoomIdsForDoor(ctx.building, door).includes(roomId)) continue
    if (canPeekThroughDoor(door.id, ctx)) return true
  }
  return false
}

/**
 * Room visibility on the floor plan — three states:
 *   unknown — not mapped (draw nothing)
 *   fog     — mapped but not in `discovered` (draw "?" via isRoomFogged)
 *   known   — in `discovered` (name, icon, windows)
 *
 * A room is mapped when discovered, peeked (`revealed`), adjacent to a discovered
 * room through a passable link, peeked through an open door (`revealWhenDoor` or
 * any connecting door), or mirrored from a discovered twin (e.g. the 2F bay overlook).
 */
export function isRoomMapped(room, ctx) {
  if (ctx?.builderView) return true
  if (!room || room.feature) return true
  if (!ctx) return false
  if (ctx.discovered.has(room.id) || ctx.revealed.has(room.id)) return true
  if (room.mirror && ctx.discovered.has(room.mirror)) return true
  if (room.revealWhenDoor && canPeekThroughDoor(room.revealWhenDoor, ctx)) return true
  if (roomPeekableThroughOpenDoor(room.id, ctx)) return true
  return isAdjacentToDiscovered(room.id, ctx)
}

/** Peeked but not yet entered — draw as fog (?). */
export function isRoomFogged(room, ctx) {
  if (ctx?.builderView) return false
  if (!isRoomMapped(room, ctx)) return false
  if (room.mirror && ctx?.discovered.has(room.mirror)) return false
  return !ctx?.discovered.has(room.id)
}

function doorOnLevel(door, levelId) {
  const levels = door.onLevels ?? (door.level != null ? [door.level] : [])
  return levels.includes(levelId)
}

/** True when either end of a multi-floor stair run has been explored. */
function stairEndDiscovered(stairRoom, ctx) {
  if (!stairRoom?.feature || !ctx?.discovered?.size) return false
  const { downRoomId, upRoomId } = stairExitRooms(ctx.building, stairRoom.id)
  return (
    (!!downRoomId && ctx.discovered.has(downRoomId)) ||
    (!!upRoomId && ctx.discovered.has(upRoomId))
  )
}

export function isDoorMapped(door, ctx) {
  if (ctx?.builderView) return true
  if (!door) return true
  if (isOutsideBuilding(ctx) && ctx?.building?.exitByDoorId?.[door.id]) return true
  if (door.showWhenDiscovered && !ctx?.discovered.has(door.showWhenDiscovered)) return false
  // showWhenRoom gates the door glyph until the named room or any linked room is discovered.
  if (door.showWhenRoom) {
    const linkedIds = linkedRoomIdsForDoor(ctx.building, door)
    const linkedDiscovered = linkedIds.some((id) => ctx?.discovered.has(id))
    if (!ctx?.discovered.has(door.showWhenRoom) && !linkedDiscovered) return false
  }
  if (door.showWhenRevealed) {
    const room = ctx?.building?.roomById?.[door.showWhenRevealed]
    if (!room || !isRoomMapped(room, ctx)) return false
  }
  if (ctx?.revealed.has(doorRevealKey(door.id))) return true
  // Draw a door only when joined rooms are on the plan. Stair-landing doors may
  // lead into an unseen room once the player is on the run or has reached the foot.
  const linked = linkedRoomIdsForDoor(ctx.building, door)
    .map((id) => ctx.building?.roomById?.[id])
    .filter(Boolean)
  const onStairLanding = linked.some((r) => isStairLanding(r) && ctx.discovered.has(r.id))
  const onStairRun =
    !!ctx.currentRoom &&
    linked.some((r) => isStairLanding(r) && r.id === ctx.currentRoom)
  const standingInLinkedRoom =
    !!ctx.currentRoom &&
    linked.some((r) => r.id === ctx.currentRoom && ctx.discovered.has(r.id))
  const stairEndKnown = linked.some(
    (r) => isStairLanding(r) && isRoomMapped(r, ctx) && stairEndDiscovered(r, ctx),
  )
  for (const room of linked) {
    if (isStairLanding(room)) {
      if (!isRoomMapped(room, ctx)) return false
      continue
    }
    if (!isRoomMapped(room, ctx)) {
      if (onStairLanding || onStairRun || standingInLinkedRoom || stairEndKnown) continue
      return false
    }
  }
  return true
}

export function isFixtureMapped(fixture, ctx) {
  if (ctx?.builderView) return true
  if (!fixture.revealWhenDoor) {
    const ids = fixture.connects ?? []
    return !ctx || ids.some((id) => ctx.discovered.has(id))
  }
  if (!ctx) return false
  const key = fixtureRevealKey(fixture.id)
  if (ctx.revealed.has(key)) return true
  if (canPeekThroughDoor(fixture.revealWhenDoor, ctx)) return true
  return (fixture.connects ?? []).some((id) => ctx.discovered.has(id))
}

export function isFixtureFogged(fixture, ctx) {
  if (ctx?.builderView) return false
  if (!isFixtureMapped(fixture, ctx)) return false
  if (!fixture.revealWhenDoor) {
    const ids = fixture.connects ?? []
    return !ids.some((id) => ctx?.discovered.has(id))
  }
  const target = fixture.revealRoom
  if (target) {
    const room = ctx?.building?.roomById?.[target]
    return !!room && isRoomMapped(room, ctx) && !ctx.discovered.has(target)
  }
  const key = fixtureRevealKey(fixture.id)
  return (ctx.revealed.has(key) || canPeekThroughDoor(fixture.revealWhenDoor, ctx)) && !ctx.discovered.has(key)
}

/** Opening a door permanently peeks linked rooms / fixtures onto the plan. */
export function applyRevealForDoor(building, revealedSet, doorId) {
  revealedSet.add(doorRevealKey(doorId))
  const door = building.doorById?.[doorId]
  for (const room of building.rooms) {
    if (room.revealWhenDoor === doorId) revealedSet.add(room.id)
  }
  for (const fixture of building.fixtures ?? []) {
    if (fixture.revealWhenDoor === doorId) revealedSet.add(fixtureRevealKey(fixture.id))
  }
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door === doorId) {
      revealedSet.add(link.from)
      revealedSet.add(link.to)
    }
  }
  if (door) {
    for (const id of linkedRoomIdsForDoor(building, door)) {
      revealedSet.add(id)
    }
  }
}

export function isDestinationNamed(roomId, ctx) {
  if (ctx?.builderView) return true
  if (!ctx) return false
  if (ctx.discovered.has(roomId)) return true
  if (ctx.revealed.has(roomId)) return true
  const room = ctx.building?.roomById?.[roomId]
  return !!room && isRoomMapped(room, ctx)
}

// View bounds for rendering: rooms plus fixtures (e.g. spiral semicircle past the wall).
export function levelDisplayBounds(building, levelId, pad = 0.6, visibility = null) {
  const cell = building.cell
  const rooms = roomsOnLevel(building, levelId).filter((r) => isRoomMapped(r, visibility))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let hasPoints = false
  const bump = (x, y) => {
    hasPoints = true
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const room of rooms) {
    const r = roomRect(room, cell)
    bump(r.x, r.y)
    bump(r.x + r.w, r.y + r.h)
  }
  if (!visibility?.builderView) {
    const outline = levelBuildingOutline(building, levelId)
    if (outline) {
      bump(outline.x, outline.y)
      bump(outline.x + outline.w, outline.y + outline.h)
    }
    const river = levelRiverRect(building, levelId)
    if (river) {
      bump(river.x * cell, river.y * cell)
      bump((river.x + river.w) * cell, (river.y + river.h) * cell)
    }
  }
  if (!hasPoints) return { x: 0, y: 0, w: 100, h: 100 }
  for (const f of building.fixtures ?? []) {
    const onLevels = f.onLevels ?? building.levels.map((l) => l.id)
    if (!onLevels.includes(levelId)) continue
    if (visibility && !isFixtureMapped(f, visibility)) continue
    if (f.kind === 'spiral-stairs') {
      const cx = f.at.x * cell
      const cy = f.at.y * cell
      const radius = (f.radius ?? 0.6) * cell
      const base = protrudeAngle(f.protrude ?? 'top')
      bump(cx, cy)
      for (let k = 90; k >= -90; k -= 15) {
        const a = ((base + k) * Math.PI) / 180
        bump(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
      }
    } else if (f.kind === 'straight-stairs' && f.rect) {
      const r = f.rect
      bump(r.x * cell, r.y * cell)
      bump((r.x + r.w) * cell, (r.y + r.h) * cell)
    }
  }
  const p = cell * pad
  return { x: minX - p, y: minY - p, w: maxX - minX + p * 2, h: maxY - minY + p * 2 }
}

// The wall two adjacent rooms share, as a segment + orientation, or null.
export function sharedEdge(a, b, cell) {
  const ra = roomRect(a, cell)
  const rb = roomRect(b, cell)
  const eps = 0.5
  // Vertical shared wall (north of the southern room meets south of the northern room).
  for (const [left, right] of [[ra, rb], [rb, ra]]) {
    if (Math.abs(left.x + left.w - right.x) < eps) {
      const y1 = Math.max(left.y, right.y)
      const y2 = Math.min(left.y + left.h, right.y + right.h)
      if (y2 > y1) return { x: right.x, y1, y2, vertical: true }
    }
  }
  // Horizontal shared wall (east of the western room meets west of the eastern room).
  for (const [top, bot] of [[ra, rb], [rb, ra]]) {
    if (Math.abs(top.y + top.h - bot.y) < eps) {
      const x1 = Math.max(top.x, bot.x)
      const x2 = Math.min(top.x + top.w, bot.x + bot.w)
      if (x2 > x1) return { y: bot.y, x1, x2, vertical: false }
    }
  }
  return null
}

function dirBetween(building, fromRoom, toRoom) {
  const a = building.levelById[roomLevel(fromRoom)]?.order ?? 0
  const b = building.levelById[roomLevel(toRoom)]?.order ?? 0
  if (b > a) return 'up'
  if (b < a) return 'down'
  return 'same'
}

function roomLevel(room, landing = null) {
  if (!room) return landing
  if (room.feature) return landing ?? room.levels?.[0]
  return room.level ?? room.levels?.[0]
}

function moveLabel(kind, dir, from, to) {
  if (to?.feature) {
    const name = (to.name ?? 'stairs').toLowerCase()
    return `onto the ${name}`
  }
  if (from?.feature) {
    if (to.id === 'kitchen') return 'up to the kitchen'
    if (to.id === 'hallway') return 'down to the hallway'
    if (to.id === 'large-bay') return 'down to the large bay'
    const short = (to.name ?? '').split('/')[0].trim().toLowerCase()
    if (dir === 'up') return short ? `up to the ${short}` : 'up the stairs'
    if (dir === 'down') return short ? `down to the ${short}` : 'down the stairs'
    return short ? `into the ${short}` : 'into the next room'
  }
  if (kind === 'door') return 'through the door'
  if (kind === 'open') return 'across the open garage'
  const flight = kind === 'winding-stairs' ? 'the spiral stair' : 'the stairs'
  if (dir === 'up') return `up ${flight}`
  if (dir === 'down') return `down ${flight}`
  return `along ${flight}`
}

function standLevel(room, atLevel) {
  return roomLevel(room, atLevel)
}

function levelOrder(building, levelId) {
  return building.levelById[levelId]?.order ?? 0
}

function spiralLandingsFor(building, room) {
  const levels = room?.levels ?? []
  if (levels.length < 2) return { low: levels[0], high: levels[0] }
  const sorted = [...levels].sort((a, b) => levelOrder(building, a) - levelOrder(building, b))
  return { low: sorted[0], high: sorted[sorted.length - 1] }
}

export function moveKey(move) {
  if (move.onSpiral) return `${move.toRoomId}:${move.dir}`
  if (move.toExteriorNode) return `ext:${move.toExteriorNode}`
  return move.toRoomId
}

// Every room reachable from `roomId` in one step, with a human label.
// `atLevel` is the floor landing the player occupies (required on the spiral stair).
export function movesFrom(building, roomId, atLevel = null, doorState = null, visibility = null) {
  const out = []
  const from = building.roomById[roomId]
  if (!from) return out
  const fromLevel = standLevel(from, atLevel)
  const areaId = building.areaId

  // Map peeking is separate from movement: doors and stairs can reach rooms not yet on the plan.
  function targetReachable(room, link) {
    if (!room || isStairLanding(room)) return true
    if (link.kind === 'door' && link.door) return true
    if (link.kind === 'stairs') return true
    return isRoomMapped(room, visibility)
  }

  if (isStairLanding(from)) {
    for (const link of building.links) {
      let otherId = null
      if (link.from === roomId) otherId = link.to
      else if (link.to === roomId) otherId = link.from
      if (!otherId) continue
      if (!linkPassable(link, doorState, areaId)) continue
      const other = building.roomById[otherId]
      if (!other || isStairLanding(other)) continue
      if (!targetReachable(other, link)) continue
      const otherLevel = roomLevel(other)
      const dir = dirBetween(building, { level: fromLevel }, { level: otherLevel })
      out.push({
        toRoomId: otherId,
        kind: link.kind,
        dir,
        doorId: link.door ?? null,
        label: moveLabel(link.kind, dir, from, other),
        toName: other.name ?? otherId,
        toLevel: otherLevel,
      })
    }
    return out
  }

  for (const link of building.links) {
    let toId = null
    if (link.from === roomId) toId = link.to
    else if (link.to === roomId) toId = link.from
    if (!toId) continue
    if (!linkPassable(link, doorState, areaId)) continue
    const to = building.roomById[toId]
    if (!to) continue
    if (!targetReachable(to, link)) continue
    const toLevel = roomLevel(to, isStairLanding(to) ? fromLevel : null)
    const dir = dirBetween(building, { level: fromLevel }, { level: toLevel })
    out.push({
      toRoomId: toId,
      kind: link.kind,
      dir,
      doorId: link.door ?? null,
      label: moveLabel(link.kind, dir, from, to),
      toName: to.name ?? toId,
      toLevel: isStairLanding(to) ? fromLevel : toLevel,
    })
  }
  return out
}

// Open-bay beams to draw on a level. `open` links have no wall — just a beam
// (the ceiling-height step) with support columns. Hidden until both bays are mapped.
export function levelBeams(building, levelId, visibility = null) {
  const cell = building.cell
  const beams = []
  for (const link of building.links) {
    if (link.kind !== 'open') continue
    const a = building.roomById[link.from]
    const b = building.roomById[link.to]
    if (!a || !b || a.level !== levelId || b.level !== levelId) continue
    if (visibility && (!isRoomMapped(a, visibility) || !isRoomMapped(b, visibility))) {
      continue
    }
    const edge = sharedEdge(a, b, cell)
    if (!edge) continue
    const seg = edge.vertical
      ? { x1: edge.x, y1: edge.y1, x2: edge.x, y2: edge.y2 }
      : { x1: edge.x1, y1: edge.y, x2: edge.x2, y2: edge.y }
    const columns = []
    const steps = 3
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      columns.push({ x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t })
    }
    beams.push({ ...seg, columns })
  }
  return beams
}

// Roll-up door rectangle in layout pixels (from room geometry).
export function rollDoorRect(room, cell) {
  if (!room?.rollDoor) return null
  const r = roomRect(room, cell)
  const edge = room.rollDoor
  const wallLen = edge === 'top' || edge === 'bottom' ? r.w : r.h
  const span = (room.rollSpan ?? 0.6) * wallLen
  let x1, y1, x2, y2
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

/** Default offset (layout units) of the world-map ⬡ icon from exit.at. */
export const EXIT_MAP_OFFSET = { dx: 0.38, dy: -0.38 }

/** Layout position of the world-map exit icon (optional exit.mapAt override). */
export function exitMapAt(exit) {
  if (exit?.mapAt) return exit.mapAt
  if (!exit?.at) return null
  return {
    x: exit.at.x + EXIT_MAP_OFFSET.dx,
    y: exit.at.y + EXIT_MAP_OFFSET.dy,
  }
}

/** Exterior exits whose door glyph is drawn on this floor. */
export function exitsOnLevel(building, levelId) {
  return (building.exits ?? []).filter((exit) => {
    const door = building.doorById?.[exit.door]
    if (!door) return false
    if (door.kind === 'roll') {
      const room = building.roomById[door.room]
      return room?.level === levelId
    }
    return doorOnLevel(door, levelId)
  })
}

/** Step out to the hex travel map. On the exterior footpath, any exit works. */
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

/** Walkway moves between exterior stand spots. */
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

/** Step from an interior room out to its footpath stand spot (exit door must be open). */
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

export function exteriorPathsOnLevel(building, levelId) {
  if (building.exterior?.level !== levelId) return []
  return building.exterior.paths ?? []
}

export function exteriorNodesOnLevel(building, levelId) {
  if (building.exterior?.level !== levelId) return []
  return building.exterior.nodes ?? []
}

// Man-door and roll-up glyphs on a level, with live state for rendering.
export function doorsOnLevel(building, levelId, doorState = null) {
  const cell = building.cell
  const areaId = building.areaId
  const out = []
  for (const door of building.doors ?? []) {
    if (!door.id) continue
    const state = doorState?.[`${areaId}:${door.id}`] ?? door.initial
    if (door.kind === 'man' && doorOnLevel(door, levelId) && door.at) {
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

// Stair fixtures visible on a level: the spiral (glass half-cylinder) and
// the straight garage run. Travel is via room links, not fixture clicks.
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
        protrude: f.protrude ?? 'top',
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
        ascend: f.ascend ?? 'end', // 'end' = high end at far x/y, 'start' = near
      })
    }
  }
  return out
}
