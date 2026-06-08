import {
  exteriorNodesOnLevel,
  exteriorPathsOnLevel,
  protrudeAngle,
  roomsOnLevel,
  sharedEdge,
} from './useGridModel.js'
import { isFixtureMapped, isRoomMapped } from './useGridVisibility.js'

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

export function levelBuildingPerimeter(building, levelId) {
  const rooms = roomsOnLevel(building, levelId)
  if (rooms.length === 0) return []
  const segments = mergeCollinearSegments(collectExteriorSegments(rooms))
  return segmentsToRings(segments)
}

/** Gap left between a window run and a spiral-stair arc tangent (layout units). */
const SPIRAL_WINDOW_MARGIN = 0.12

/** Clearance at room corners for posts / jambs (feet). */
const WINDOW_CORNER_FEET = 2

function windowCornerInset(building) {
  const unitFeet = building.unitFeet ?? 10
  return WINDOW_CORNER_FEET / unitFeet
}

function trimWindowCornerInsets(intervals, fullStart, fullEnd, inset) {
  return intervals
    .map(([a, b]) => {
      let start = a
      let end = b
      if (Math.abs(start - fullStart) < LAYOUT_EPS) start += inset
      if (Math.abs(end - fullEnd) < LAYOUT_EPS) end -= inset
      return [start, end]
    })
    .filter(([a, b]) => b - a > LAYOUT_EPS)
}

function spiralOpeningsOnEdge(building, levelId, edge, wallCoord) {
  const covered = []
  for (const f of building.fixtures ?? []) {
    if (f.kind !== 'spiral-stairs' || !f.at) continue
    const onLevels = f.onLevels ?? building.levels?.map((l) => l.id) ?? []
    if (!onLevels.includes(levelId)) continue
    if ((f.protrude ?? 'top') !== edge) continue
    const cx = f.at.x
    const cy = f.at.y
    const r = f.radius ?? 0.6
    const m = SPIRAL_WINDOW_MARGIN
    if (edge === 'top' || edge === 'bottom') {
      if (Math.abs(cy - wallCoord) > LAYOUT_EPS) continue
      covered.push([cx - r - m, cx + r + m])
    } else {
      if (Math.abs(cx - wallCoord) > LAYOUT_EPS) continue
      covered.push([cy - r - m, cy + r + m])
    }
  }
  return covered
}

function intervalsToWallSegments(room, edge, intervals) {
  const r = layoutRect(room)
  const segs = []
  for (const [a, b] of intervals) {
    if (b - a <= LAYOUT_EPS) continue
    if (edge === 'top') segs.push({ x1: a, y1: r.y, x2: b, y2: r.y })
    else if (edge === 'bottom') segs.push({ x1: a, y1: r.y + r.h, x2: b, y2: r.y + r.h })
    else if (edge === 'left') segs.push({ x1: r.x, y1: a, x2: r.x, y2: b })
    else segs.push({ x1: r.x + r.w, y1: a, x2: r.x + r.w, y2: b })
  }
  return segs
}

/** Exterior wall runs where a room may show windows (layout coordinates). */
export function roomWindowSegments(room, edge, building, levelId) {
  const rooms = roomsOnLevel(building, levelId)
  const r = layoutRect(room)
  const covered = []
  for (const o of rooms) {
    if (o.id === room.id) continue
    const span = neighborCoverOnSide(room, o, edge)
    if (span) covered.push(span)
  }
  let fullStart
  let fullEnd
  let wallCoord
  if (edge === 'left' || edge === 'right') {
    fullStart = r.y
    fullEnd = r.y + r.h
    wallCoord = edge === 'left' ? r.x : r.x + r.w
  } else {
    fullStart = r.x
    fullEnd = r.x + r.w
    wallCoord = edge === 'top' ? r.y : r.y + r.h
  }
  covered.push(...spiralOpeningsOnEdge(building, levelId, edge, wallCoord))
  const intervals = trimWindowCornerInsets(
    subtractIntervals(fullStart, fullEnd, covered),
    fullStart,
    fullEnd,
    windowCornerInset(building),
  )
  return intervalsToWallSegments(room, edge, intervals)
}

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

function mapMarginLayoutUnits(building) {
  const unitFeet = building.unitFeet ?? 10
  const gridFeet = building.gridFeet ?? unitFeet
  return building.exterior?.pad ?? gridFeet / unitFeet
}

function bumpLayoutExtents(ext, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  ext.minX = Math.min(ext.minX, x)
  ext.maxX = Math.max(ext.maxX, x)
  ext.minY = Math.min(ext.minY, y)
  ext.maxY = Math.max(ext.maxY, y)
  ext.has = true
}

export function levelContentExtentsLayout(building, levelId, visibility = null) {
  const ext = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, has: false }
  const rooms = roomsOnLevel(building, levelId).filter((r) => isRoomMapped(r, visibility))
  for (const room of rooms) {
    bumpLayoutExtents(ext, room.x, room.y)
    bumpLayoutExtents(ext, room.x + (room.w ?? 1), room.y + (room.h ?? 1))
  }
  if (!visibility?.builderView) {
    for (const ring of levelBuildingPerimeter(building, levelId)) {
      for (const p of ring) bumpLayoutExtents(ext, p.x, p.y)
    }
    for (const path of exteriorPathsOnLevel(building, levelId)) {
      for (const p of path.points ?? []) bumpLayoutExtents(ext, p.x, p.y)
    }
    for (const node of exteriorNodesOnLevel(building, levelId)) {
      bumpLayoutExtents(ext, node.at.x, node.at.y)
    }
  }
  for (const f of building.fixtures ?? []) {
    const onLevels = f.onLevels ?? building.levels.map((l) => l.id)
    if (!onLevels.includes(levelId)) continue
    if (visibility && !isFixtureMapped(f, visibility)) continue
    if (f.kind === 'spiral-stairs') {
      const cx = f.at.x
      const cy = f.at.y
      const radius = f.radius ?? 0.6
      const base = protrudeAngle(f.protrude ?? 'top')
      bumpLayoutExtents(ext, cx, cy)
      for (let k = 90; k >= -90; k -= 15) {
        const a = ((base + k) * Math.PI) / 180
        bumpLayoutExtents(ext, cx + radius * Math.cos(a), cy + radius * Math.sin(a))
      }
    } else if (f.kind === 'straight-stairs' && f.rect) {
      const r = f.rect
      bumpLayoutExtents(ext, r.x, r.y)
      bumpLayoutExtents(ext, r.x + r.w, r.y + r.h)
    }
  }
  return ext.has ? ext : null
}

function levelBuildingCenterLayout(building, levelId) {
  const rings = levelBuildingPerimeter(building, levelId)
  if (rings.length) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const ring of rings) {
      for (const p of ring) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      }
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  }
  const content = levelContentExtentsLayout(building, levelId, { builderView: true })
  if (!content) return { x: 0, y: 0 }
  return { x: (content.minX + content.maxX) / 2, y: (content.minY + content.maxY) / 2 }
}

export function levelMapLayoutBounds(building, levelId, visibility = null) {
  const content = levelContentExtentsLayout(building, levelId, visibility)
  if (!content) return { minX: 0, maxX: 10, minY: 0, maxY: 10, centerX: 5, centerY: 5, river: null }
  const margin = mapMarginLayoutUnits(building)
  const center = levelBuildingCenterLayout(building, levelId)
  const minX = content.minX - margin
  const maxX = content.maxX + margin
  const maxY = content.maxY + margin
  let minY = content.minY - margin
  let river = null
  const cfg = building.river
  if (cfg) {
    const onLevels = cfg.onLevels ?? [building.exterior?.level ?? 'first']
    if (onLevels.includes(levelId)) {
      const unitFeet = building.unitFeet ?? 10
      const gap = (cfg.offsetFeet ?? 20) / unitFeet
      const width = (cfg.widthFeet ?? 25) / unitFeet
      const visibleFraction = cfg.visibleFraction ?? 0.5
      const riverY = content.minY - gap - width
      minY = riverY + width * (1 - visibleFraction)
      river = { x: minX, y: riverY, w: maxX - minX, h: width }
    }
  }
  return { minX, maxX, minY, maxY, centerX: center.x, centerY: center.y, river }
}

export function levelRiverRect(building, levelId, visibility = null) {
  return levelMapLayoutBounds(building, levelId, visibility).river
}

export function levelCliffWall(building, levelId, visibility = null) {
  const cfg = building.cliffWall
  if (!cfg) return null
  const onLevels = cfg.onLevels ?? [building.exterior?.level ?? 'first']
  if (!onLevels.includes(levelId)) return null

  let points = (cfg.points ?? []).map((p) => ({ x: p.x, y: p.y }))
  if (points.length < 1) return null

  if (cfg.extendNorthToMapEdge ?? cfg.extendWestToMapEdge) {
    const bounds = levelMapLayoutBounds(building, levelId, visibility)
    const southEnd = points.reduce((best, p) => (!best || p.x < best.x ? p : best))
    points = [{ x: bounds.maxX + 0.45, y: southEnd.y }, ...points]
  }

  if (points.length < 2) return null
  const unitFeet = building.unitFeet ?? 10
  const thickness = (cfg.thicknessFeet ?? 6) / unitFeet
  return { points, thickness }
}

export function levelDisplayBounds(building, levelId, pad = 0, visibility = null) {
  const cell = building.cell
  const map = levelMapLayoutBounds(building, levelId, visibility)
  const extra = cell * pad
  return {
    x: map.minX * cell - extra,
    y: map.minY * cell - extra,
    w: (map.maxX - map.minX) * cell + extra * 2,
    h: (map.maxY - map.minY) * cell + extra * 2,
  }
}

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
