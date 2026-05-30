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
  return building.rooms.filter((r) => r.level === levelId)
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

// Padded pixel bounds covering every room on a level: { x, y, w, h }.
export function levelBounds(rooms, cell, pad = 0.6) {
  if (rooms.length === 0) return { x: 0, y: 0, w: 100, h: 100 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const room of rooms) {
    const r = roomRect(room, cell)
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
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
  const a = building.levelById[fromRoom.level]?.order ?? 0
  const b = building.levelById[toRoom.level]?.order ?? 0
  if (b > a) return 'up'
  if (b < a) return 'down'
  return 'same'
}

function moveLabel(kind, dir) {
  if (kind === 'door') return 'through the door'
  if (kind === 'open') return 'across the open garage'
  const flight = kind === 'winding-stairs' ? 'the spiral stair' : 'the stairs'
  if (dir === 'up') return `up ${flight}`
  if (dir === 'down') return `down ${flight}`
  return `along ${flight}`
}

// Every room reachable from `roomId` in one step, with a human label.
export function movesFrom(building, roomId) {
  const out = []
  const from = building.roomById[roomId]
  if (!from) return out
  for (const link of building.links) {
    let toId = null
    if (link.from === roomId) toId = link.to
    else if (link.to === roomId) toId = link.from
    if (!toId) continue
    const to = building.roomById[toId]
    if (!to) continue
    const dir = dirBetween(building, from, to)
    out.push({
      toRoomId: toId,
      kind: link.kind,
      dir,
      label: moveLabel(link.kind, dir),
      toName: to.name ?? toId,
      toLevel: to.level,
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

// Stair fixtures visible on a level: the spiral (half-cylinder of glass) and
// the straight garage run. Clicking one travels to the connected off-floor room.
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
    if (f.kind === 'spiral-stairs') {
      out.push({
        id: f.id,
        kind: f.kind,
        dir,
        toRoomId,
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
        rect: { x: r.x * cell, y: r.y * cell, w: r.w * cell, h: r.h * cell },
        run: f.run ?? 'horizontal',
        ascend: f.ascend ?? 'end', // 'end' = high end at far x/y, 'start' = near
      })
    }
  }
  return out
}
