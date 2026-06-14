import {
  protrudeAngle,
  spiralExitPoint,
  spiralStandPoint,
  stairExitRooms,
} from './grid/useGridModel.js'

function bbox(pts) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function arcPoints(cx, cy, r, angleDeg) {
  const out = []
  for (let k = 90; k >= -90; k -= 15) {
    const a = ((angleDeg + k) * Math.PI) / 180
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}

function spiralTreads(cx, cy, radius, protrude, toScreen) {
  const base = (protrudeAngle(protrude) * Math.PI) / 180
  const westAng = base - Math.PI / 2
  const n = 7
  const midFrac = 0.5
  const minHalf = 0.12
  const maxHalf = 0.42
  const out = []
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const ang = westAng + Math.PI * t
    let half = minHalf + t * (maxHalf - minHalf)
    half = Math.min(half, midFrac, 1 - midFrac)
    const r0 = midFrac - half
    const r1 = midFrac + half
    const a = toScreen(cx + radius * r0 * Math.cos(ang), cy + radius * r0 * Math.sin(ang))
    const b = toScreen(cx + radius * r1 * Math.cos(ang), cy + radius * r1 * Math.sin(ang))
    out.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      width: 1.1 + t * 1.8,
      opacity: 0.5 + t * 0.5,
    })
  }
  return out
}

/** Screen-space fixture shapes for the indoor map renderer. */
export function layoutPlacedFixtures(fixtures, building, cell, tp) {
  return fixtures.map((f) => {
    if (f.kind === 'spiral-stairs') {
      const c0 = { x: f.x, y: f.y }
      const pts = arcPoints(c0.x, c0.y, f.radius, protrudeAngle(f.protrude))
      const tPts = pts.map((p) => tp(p.x, p.y))
      const c = tp(c0.x, c0.y)
      const fillPath = `M ${c.x} ${c.y} ` + tPts.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
      const arcPath = `M ${tPts[0].x} ${tPts[0].y} ` + tPts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
      const treads = spiralTreads(c0.x, c0.y, f.radius, f.protrude, tp)
      const standLayout = spiralStandPoint(c0.x, c0.y, f.radius, f.protrude)
      const stand = tp(standLayout.x, standLayout.y)
      const stairId = f.featureRoomId ?? 'spiral-stair'
      const { upRoomId, downRoomId } = stairExitRooms(building, stairId)
      const exitUpLayout = spiralExitPoint(c0.x, c0.y, f.radius, f.protrude, 'up')
      const exitDownLayout = spiralExitPoint(c0.x, c0.y, f.radius, f.protrude, 'down')
      const exitUp = tp(exitUpLayout.x, exitUpLayout.y)
      const exitDown = tp(exitDownLayout.x, exitDownLayout.y)
      const fogBox = bbox([c, ...tPts])
      return {
        id: f.id,
        type: 'spiral',
        dir: f.dir,
        toRoomId: f.toRoomId,
        featureRoomId: stairId,
        connects: f.connects ?? [],
        cx: c.x,
        cy: c.y,
        standX: stand.x,
        standY: stand.y,
        exitUp,
        exitDown,
        exitUpRoomId: upRoomId,
        exitDownRoomId: downRoomId,
        fillPath,
        arcPath,
        treads,
        fogBox,
      }
    }

    const r = f.rect
    const corners = [tp(r.x, r.y), tp(r.x + r.w, r.y), tp(r.x + r.w, r.y + r.h), tp(r.x, r.y + r.h)]
    const box = bbox(corners)
    const horizontal = f.run === 'horizontal'
    const alongLen = horizontal ? r.w : r.h
    const crossLen = horizontal ? r.h : r.w
    const n = Math.max(5, Math.min(9, Math.round(alongLen / (cell * 0.18))))
    const minSpan = cell * 0.28
    const maxSpan = crossLen * 0.88
    const treads = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const towardTop = f.ascend === 'end' ? t : 1 - t
      const span = minSpan + towardTop * (maxSpan - minSpan)
      const pos = f.ascend === 'end' ? t : 1 - t
      let a, b
      if (horizontal) {
        const x = r.x + pos * r.w
        const cy = r.y + r.h / 2
        a = tp(x, cy - span / 2)
        b = tp(x, cy + span / 2)
      } else {
        const y = r.y + pos * r.h
        const cx = r.x + r.w / 2
        a = tp(cx - span / 2, y)
        b = tp(cx + span / 2, y)
      }
      treads.push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        width: 1.2 + towardTop * 1.8,
      })
    }
    const cen = tp(r.x + r.w / 2, r.y + r.h / 2)
    const highPos = f.ascend === 'end' ? 1 : 0
    const lowPos = f.ascend === 'end' ? 0 : 1
    let exitUpLayout
    let exitDownLayout
    if (horizontal) {
      const cy = r.y + r.h / 2
      exitUpLayout = { x: r.x + highPos * r.w, y: cy }
      exitDownLayout = { x: r.x + lowPos * r.w, y: cy }
    } else {
      const cx = r.x + r.w / 2
      exitUpLayout = { x: cx, y: r.y + highPos * r.h }
      exitDownLayout = { x: cx, y: r.y + lowPos * r.h }
    }
    const exitUp = tp(exitUpLayout.x, exitUpLayout.y)
    const exitDown = tp(exitDownLayout.x, exitDownLayout.y)
    const stairId = f.featureRoomId
    const { upRoomId, downRoomId } = stairId
      ? stairExitRooms(building, stairId)
      : { upRoomId: null, downRoomId: null }
    return {
      id: f.id,
      type: 'straight',
      dir: f.dir,
      toRoomId: f.toRoomId,
      featureRoomId: stairId,
      connects: f.connects ?? [],
      visualOnly: !!f.visualOnly,
      box,
      treads,
      cx: cen.x,
      cy: cen.y,
      exitUp,
      exitDown,
      exitUpRoomId: upRoomId,
      exitDownRoomId: downRoomId,
    }
  })
}

export { bbox }
