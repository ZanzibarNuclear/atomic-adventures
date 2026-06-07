// Top-down building navigation: rooms laid out on stacked grid levels,
// connected by doors (same level) and stairs (between levels).
//
// This is the grid-layout counterpart to useRoutes.js. Where the outdoor map
// derives movement from path geometry, a building's connectivity is authored
// explicitly as `links`, and up/down is inferred from each level's `order`.

import { canPassDoor, normalizeDoorInitial } from './useDoors.js'

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
  const areaId = data.id ?? data.area ?? 'building'
  return {
    id: areaId,
    areaId,
    name: data.name,
    cell,
    gridFeet: data.gridFeet ?? 10,
    unitFeet: data.unitFeet ?? data.gridFeet ?? 10,
    north: data.north ?? 'up',
    rooms,
    roomById,
    levels,
    levelById,
    links,
    fixtures,
    doors,
    doorById,
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
) {
  return {
    discovered: discovered instanceof Set ? discovered : new Set(discovered),
    revealed: revealed instanceof Set ? revealed : new Set(revealed),
    building,
    doorState,
    areaId: areaId ?? building?.areaId ?? null,
    builderView,
    currentRoom: currentRoom ?? null,
  }
}

export function fixtureRevealKey(fixtureId) {
  return `fixture:${fixtureId}`
}

function isDoorPeekOpen(doorId, ctx) {
  if (!doorId || !ctx?.doorState || !ctx?.areaId) return false
  return canPassDoor(ctx.doorState, ctx.areaId, doorId)
}

function canPeekThroughDoor(doorId, ctx) {
  if (!isDoorPeekOpen(doorId, ctx)) return false
  const door = ctx?.building?.doorById?.[doorId]
  // showWhenRoom only gates the door glyph (isDoorMapped), not peeking once it is open.
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

/**
 * Room visibility on the floor plan — three states:
 *   unknown — not mapped (draw nothing)
 *   fog     — mapped but not in `discovered` (draw "?" via isRoomFogged)
 *   known   — in `discovered` (name, icon, windows)
 *
 * A room is mapped when discovered, peeked (`revealed`), adjacent to a discovered
 * room through a passable link, peeked through an open door (`revealWhenDoor`),
 * or mirrored from a discovered twin (e.g. the 2F bay overlook).
 */
export function isRoomMapped(room, ctx) {
  if (ctx?.builderView) return true
  if (!room || room.feature) return true
  if (!ctx) return false
  if (ctx.discovered.has(room.id) || ctx.revealed.has(room.id)) return true
  if (room.mirror && ctx.discovered.has(room.mirror)) return true
  if (room.revealWhenDoor && canPeekThroughDoor(room.revealWhenDoor, ctx)) return true
  return isAdjacentToDiscovered(room.id, ctx)
}

/** Peeked but not yet entered — draw as fog (?). */
export function isRoomFogged(room, ctx) {
  if (ctx?.builderView) return false
  if (!isRoomMapped(room, ctx)) return false
  if (room.mirror && ctx?.discovered.has(room.mirror)) return false
  return !ctx?.discovered.has(room.id)
}

function linkedRoomIdsForDoor(building, door) {
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

export function isDoorMapped(door, ctx) {
  if (ctx?.builderView) return true
  if (!door) return true
  if (door.showWhenDiscovered && !ctx?.discovered.has(door.showWhenDiscovered)) return false
  if (door.showWhenRoom && !ctx?.discovered.has(door.showWhenRoom)) return false
  if (door.showWhenRevealed) {
    const room = ctx?.building?.roomById?.[door.showWhenRevealed]
    if (!room || !isRoomMapped(room, ctx)) return false
  }
  // Draw a door only when joined rooms are on the plan. Stair-landing doors may
  // lead into an unseen room once the player is standing on the run.
  const linked = linkedRoomIdsForDoor(ctx.building, door)
    .map((id) => ctx.building?.roomById?.[id])
    .filter(Boolean)
  const onStairLanding = linked.some((r) => isStairLanding(r) && ctx.discovered.has(r.id))
  const standingInLinkedRoom =
    !!ctx.currentRoom &&
    linked.some((r) => r.id === ctx.currentRoom && ctx.discovered.has(r.id))
  for (const room of linked) {
    if (isStairLanding(room)) {
      if (!isRoomMapped(room, ctx)) return false
      continue
    }
    if (!isRoomMapped(room, ctx)) {
      if (onStairLanding || standingInLinkedRoom) continue
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
  for (const room of building.rooms) {
    if (room.revealWhenDoor === doorId) revealedSet.add(room.id)
  }
  for (const fixture of building.fixtures ?? []) {
    if (fixture.revealWhenDoor === doorId) revealedSet.add(fixtureRevealKey(fixture.id))
  }
  // Keep rooms on the far side visible as fog after the door closes again.
  for (const link of building.links ?? []) {
    if (link.kind === 'door' && link.door === doorId) {
      revealedSet.add(link.from)
      revealedSet.add(link.to)
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
  if (rooms.length === 0) return { x: 0, y: 0, w: 100, h: 100 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const bump = (x, y) => {
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
  // Vertical shared wall (a east == b west, or vice versa).
  for (const [left, right] of [[ra, rb], [rb, ra]]) {
    if (Math.abs(left.x + left.w - right.x) < eps) {
      const y1 = Math.max(left.y, right.y)
      const y2 = Math.min(left.y + left.h, right.y + right.h)
      if (y2 > y1) return { x: right.x, y1, y2, vertical: true }
    }
  }
  // Horizontal shared wall (a south == b north, or vice versa).
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
  return move.onSpiral ? `${move.toRoomId}:${move.dir}` : move.toRoomId
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
// (the ceiling-height step) with support columns.
export function levelBeams(building, levelId) {
  const cell = building.cell
  const beams = []
  for (const link of building.links) {
    if (link.kind !== 'open') continue
    const a = building.roomById[link.from]
    const b = building.roomById[link.to]
    if (!a || !b || a.level !== levelId || b.level !== levelId) continue
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

// Man-door and roll-up glyphs on a level, with live state for rendering.
export function doorsOnLevel(building, levelId, doorState = null) {
  const cell = building.cell
  const areaId = building.areaId
  const out = []
  for (const door of building.doors ?? []) {
    if (!door.id) continue
    const state = doorState?.[`${areaId}:${door.id}`] ?? door.initial
    if (door.kind === 'man' && door.level === levelId && door.at) {
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
