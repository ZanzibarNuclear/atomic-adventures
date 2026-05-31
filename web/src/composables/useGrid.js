// Top-down building navigation: rooms laid out on stacked grid levels,
// connected by doors (same level) and stairs (between levels).
//
// This is the grid-layout counterpart to useRoutes.js. Where the outdoor map
// derives movement from path geometry, a building's connectivity is authored
// explicitly as `links`, and up/down is inferred from each level's `order`.

// Normalize the raw YAML into a convenient model.
export function buildBuilding(data) {
  const cell = data.cell ?? 64
  const rooms = (data.rooms ?? []).map((r) => ({ w: 1, h: 1, ...r }))
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const levels = [...(data.levels ?? [])].sort((a, b) => b.order - a.order)
  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]))
  const links = data.links ?? []
  const fixtures = data.fixtures ?? []
  const doors = data.doors ?? []
  return {
    name: data.name,
    cell,
    gridFeet: data.gridFeet ?? 10, // spacing of visible grid lines (feet)
    unitFeet: data.unitFeet ?? data.gridFeet ?? 10, // feet per layout grid unit (x, y, w, h)
    north: data.north ?? 'up',
    rooms,
    roomById,
    levels,
    levelById,
    links,
    fixtures,
    doors,
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

// Room ids at the high (▲) and low (▼) ends of the spiral stair.
export function spiralExitRooms(building) {
  const spiral = building.roomById['spiral-stair']
  if (!spiral) return { upRoomId: null, downRoomId: null }
  const { low, high } = spiralLandingsFor(building, spiral)
  let upRoomId = null
  let downRoomId = null
  for (const link of building.links) {
    let otherId = null
    if (link.from === 'spiral-stair') otherId = link.to
    else if (link.to === 'spiral-stair') otherId = link.from
    else continue
    const other = building.roomById[otherId]
    if (!other || other.feature) continue
    const lv = roomLevel(other)
    if (lv === high) upRoomId = otherId
    if (lv === low) downRoomId = otherId
  }
  return { upRoomId, downRoomId }
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
  }
  return roomCenter(room, building.cell)
}

// View bounds for rendering: rooms plus fixtures (e.g. spiral semicircle past the wall).
export function levelDisplayBounds(building, levelId, pad = 0.6) {
  const cell = building.cell
  const rooms = roomsOnLevel(building, levelId)
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
  if (room.feature === 'spiral-stair') return landing ?? room.levels?.[0]
  return room.level ?? room.levels?.[0]
}

function moveLabel(kind, dir, from, to) {
  if (to?.feature === 'spiral-stair') return 'onto the spiral stair'
  if (from?.feature === 'spiral-stair') {
    if (to.id === 'kitchen') return 'up to the kitchen'
    if (to.id === 'library') return 'down to the library'
    const short = (to.name ?? '').split('/')[0].trim().toLowerCase()
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
export function movesFrom(building, roomId, atLevel = null) {
  const out = []
  const from = building.roomById[roomId]
  if (!from) return out
  const fromLevel = standLevel(from, atLevel)

  if (from.feature === 'spiral-stair') {
    for (const link of building.links) {
      let otherId = null
      if (link.from === roomId) otherId = link.to
      else if (link.to === roomId) otherId = link.from
      if (!otherId) continue
      const other = building.roomById[otherId]
      if (!other || other.feature === 'spiral-stair') continue
      const otherLevel = roomLevel(other)
      const dir = dirBetween(building, { level: fromLevel }, { level: otherLevel })
      out.push({
        toRoomId: otherId,
        kind: link.kind,
        dir,
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
    const to = building.roomById[toId]
    if (!to) continue
    const toLevel = roomLevel(to, to.feature === 'spiral-stair' ? fromLevel : null)
    const dir = dirBetween(building, { level: fromLevel }, { level: toLevel })
    out.push({
      toRoomId: toId,
      kind: link.kind,
      dir,
      label: moveLabel(link.kind, dir, from, to),
      toName: to.name ?? toId,
      toLevel: to.feature === 'spiral-stair' ? fromLevel : toLevel,
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

// Authored man-door glyphs on a level. These are purely visual — connectivity
// lives in `links`; this just lets us place each door exactly on its wall.
export function doorsOnLevel(building, levelId) {
  const cell = building.cell
  return (building.doors ?? [])
    .filter((d) => d.level === levelId)
    .map((d) => ({ x: d.at.x * cell, y: d.at.y * cell, vertical: !!d.vertical }))
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
    const here = rooms.find((r) => r.level === levelId)
    const there = rooms.find((r) => r.level !== levelId)
    const dir = here && there ? dirBetween(building, here, there) : 'same'
    const toRoomId = there?.id ?? null
    const connects = (f.connects ?? rooms.map((r) => r.id)).filter(Boolean)
    if (f.kind === 'spiral-stairs') {
      out.push({
        id: f.id,
        kind: f.kind,
        dir,
        toRoomId,
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
        connects,
        rect: { x: r.x * cell, y: r.y * cell, w: r.w * cell, h: r.h * cell },
        run: f.run ?? 'horizontal',
        ascend: f.ascend ?? 'end', // 'end' = high end at far x/y, 'start' = near
      })
    }
  }
  return out
}
