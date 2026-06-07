<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { hexCornerPoints } from '../composables/useHexGeometry.js'
import {
  roomsOnLevel,
  roomRect,
  roomStandPosition,
  spiralStandPoint,
  spiralExitPoint,
  stairExitRooms,
  isStairLanding,
  levelDisplayBounds,
  levelBeams,
  doorsOnLevel,
  exitsOnLevel,
  fixturesOnLevel,
  sharedEdge,
  mapVisibilityCtx,
  isRoomMapped,
  isRoomFogged,
  isDoorMapped,
  isFixtureMapped,
  isFixtureFogged,
} from '../composables/useGrid.js'

const props = defineProps({
  building: { type: Object, required: true },
  currentRoom: { type: String, required: true },
  discovered: { type: [Array, Object], default: () => [] },
  revealed: { type: [Array, Object], default: () => [] },
  level: { type: String, required: true },
  standLevel: { type: String, default: null },
  reachableRooms: { type: Array, default: () => [] },
  doorStates: { type: Object, default: () => ({}) },
  interactableDoorIds: { type: Array, default: () => [] },
  reachableExitDoors: { type: Array, default: () => [] },
  builderView: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['room-click', 'door-click', 'exit-click'])

const cell = computed(() => props.building.cell ?? 64)
const discoveredSet = computed(() => new Set(props.discovered))
const interactableDoorSet = computed(() => new Set(props.interactableDoorIds))
const reachableExitSet = computed(() => new Set(props.reachableExitDoors))
const exitHexRadius = computed(() => cell.value * 0.13)
const visibility = computed(() =>
  mapVisibilityCtx(
    props.discovered,
    props.revealed,
    props.building,
    props.doorStates,
    props.building.areaId,
    props.builderView,
    props.currentRoom,
  ),
)
const current = computed(() => props.building.roomById[props.currentRoom])
const levelRooms = computed(() => roomsOnLevel(props.building, props.level))
const mappedRooms = computed(() => levelRooms.value.filter((r) => isRoomMapped(r, visibility.value)))
const beams = computed(() => levelBeams(props.building, props.level))
const doors = computed(() => doorsOnLevel(props.building, props.level, props.doorStates))
const fixtures = computed(() =>
  fixturesOnLevel(props.building, props.level).filter((f) => isFixtureMapped(f, visibility.value)),
)

// ---- Rotation: the player can spin the plan 90° at a time ----
const rotation = ref(0)
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}
const swapAxes = computed(() => rotation.value % 180 !== 0)
const bounds = computed(() => levelDisplayBounds(props.building, props.level, 0.6, visibility.value))
const center = computed(() => ({
  x: bounds.value.x + bounds.value.w / 2,
  y: bounds.value.y + bounds.value.h / 2,
}))

// Rotate a point about the level center (clockwise on screen).
function tp(x, y) {
  const rad = (rotation.value * Math.PI) / 180
  const cx = center.value.x
  const cy = center.value.y
  const dx = x - cx
  const dy = y - cy
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }
}
// Layout-space sample points (bounds + fixtures) for a tight rotated AABB.
const layoutSamplePoints = computed(() => {
  const pts = []
  const b = bounds.value
  pts.push(
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  )
  for (const f of fixtures.value) {
    if (f.kind === 'spiral-stairs') {
      pts.push({ x: f.x, y: f.y })
      const base = (protrudeAngle(f.protrude ?? 'top') * Math.PI) / 180
      for (let k = 90; k >= -90; k -= 15) {
        const a = base + (k * Math.PI) / 180
        pts.push({ x: f.x + f.radius * Math.cos(a), y: f.y + f.radius * Math.sin(a) })
      }
    } else if (f.rect) {
      const r = f.rect
      pts.push({ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h })
    }
  }
  return pts
})

// `top` = west / river wall when north points right on the plan.
function protrudeAngle(edge) {
  if (edge === 'top') return 270
  if (edge === 'bottom') return 90
  if (edge === 'left') return 180
  return 0
}

// True axis-aligned bounds of all content after rotation.
const rotatedBounds = computed(() => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of layoutSamplePoints.value) {
    const r = tp(p.x, p.y)
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x)
    maxY = Math.max(maxY, r.y)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 100, h: 100 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})

const mapSvgRef = ref(null)
const containerAspect = ref(220 / 200)
let resizeObserver = null

function attachResizeObserver() {
  resizeObserver?.disconnect()
  const el = mapSvgRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  if (height > 0) containerAspect.value = width / height
  resizeObserver = new ResizeObserver((entries) => {
    const cr = entries[0].contentRect
    if (cr.height > 0) containerAspect.value = cr.width / cr.height
  })
  resizeObserver.observe(el)
}

onMounted(() => nextTick(attachResizeObserver))
watch(() => props.expanded, () => nextTick(attachResizeObserver))
onUnmounted(() => resizeObserver?.disconnect())

// Fit whole building in the panel (meet); pad viewBox aspect to reduce empty margins.
const viewBoxRect = computed(() => {
  const c = rotatedBounds.value
  let { x, y, w, h } = c
  if (w < 1 || h < 1) return c
  const contentAspect = w / h
  const boxAspect = containerAspect.value
  if (contentAspect > boxAspect) {
    const nh = w / boxAspect
    y -= (nh - h) / 2
    h = nh
  } else if (contentAspect < boxAspect) {
    const nw = h * boxAspect
    x -= (nw - w) / 2
    w = nw
  }
  return { x, y, w, h }
})

const viewBox = computed(() => {
  const vb = viewBoxRect.value
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
})

const gridStepPx = computed(() => {
  const gridFeet = props.building.gridFeet ?? 10
  const unitFeet = props.building.unitFeet ?? gridFeet
  return cell.value * (gridFeet / unitFeet)
})

// 10' grid lines in screen space — SVG patterns fail to tile across the viewBox.
const placedGridLines = computed(() => {
  const vb = viewBoxRect.value
  const step = gridStepPx.value
  const pivot = tp(center.value.x, center.value.y)
  const cx = pivot.x
  const cy = pivot.y
  const rad = (rotation.value * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const vx = -Math.sin(rad)
  const vy = Math.cos(rad)

  const corners = [
    { x: vb.x, y: vb.y },
    { x: vb.x + vb.w, y: vb.y },
    { x: vb.x + vb.w, y: vb.y + vb.h },
    { x: vb.x, y: vb.y + vb.h },
  ]
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const p of corners) {
    const dx = p.x - cx
    const dy = p.y - cy
    const u = dx * ux + dy * uy
    const v = dx * vx + dy * vy
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }

  const pad = step
  minU -= pad
  maxU += pad
  minV -= pad
  maxV += pad

  const lines = []
  const u0 = Math.floor(minU / step) * step
  for (let u = u0; u <= maxU; u += step) {
    lines.push({
      x1: cx + u * ux + minV * vx,
      y1: cy + u * uy + minV * vy,
      x2: cx + u * ux + maxV * vx,
      y2: cy + u * uy + maxV * vy,
    })
  }
  const v0 = Math.floor(minV / step) * step
  for (let v = v0; v <= maxV; v += step) {
    lines.push({
      x1: cx + minU * ux + v * vx,
      y1: cy + minU * uy + v * vy,
      x2: cx + maxU * ux + v * vx,
      y2: cy + maxU * uy + v * vy,
    })
  }
  return lines
})

// ---- Geometry helpers (original, pre-rotation coordinates) ----
function rect(room) {
  return roomRect(room, cell.value)
}
function wall(room, edge) {
  const r = rect(room)
  if (edge === 'top') return { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y }
  if (edge === 'bottom') return { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h }
  if (edge === 'left') return { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h }
  return { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h }
}
function inward(edge, amount) {
  if (edge === 'top') return { dx: 0, dy: amount }
  if (edge === 'bottom') return { dx: 0, dy: -amount }
  if (edge === 'left') return { dx: amount, dy: 0 }
  return { dx: -amount, dy: 0 }
}
function windowSeg(room, edge) {
  const w = wall(room, edge)
  const { dx, dy } = inward(edge, cell.value * 0.14)
  const mx = (w.x1 + w.x2) / 2
  const my = (w.y1 + w.y2) / 2
  const hx = ((w.x2 - w.x1) / 2) * 0.66
  const hy = ((w.y2 - w.y1) / 2) * 0.66
  return { x1: mx - hx + dx, y1: my - hy + dy, x2: mx + hx + dx, y2: my + hy + dy }
}
function doorCenter(room, edge) {
  const w = wall(room, edge)
  return { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2, vertical: w.x1 === w.x2 }
}

// ---- Placement: turn original geometry into rotated screen geometry ----
function bbox(pts) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
// A small axis-aligned rect stays axis-aligned under 90° turns (w/h swap).
function placeRect(cxOrig, cyOrig, w, h) {
  const c = tp(cxOrig, cyOrig)
  const W = swapAxes.value ? h : w
  const H = swapAxes.value ? w : h
  return { x: c.x - W / 2, y: c.y - H / 2, w: W, h: H }
}

const placedRooms = computed(() =>
  mappedRooms.value.map((room) => {
    const r = rect(room)
    const corners = [
      tp(r.x, r.y),
      tp(r.x + r.w, r.y),
      tp(r.x + r.w, r.y + r.h),
      tp(r.x, r.y + r.h),
    ]
    const windows = (room.windows || []).map((edge) => {
      const s = windowSeg(room, edge)
      const a = tp(s.x1, s.y1)
      const b = tp(s.x2, s.y2)
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    })
    // Railing along the interior edges of an open-to-roof void.
    const railings = []
    if (room.open) {
      for (const other of levelRooms.value) {
        if (other.id === room.id || other.open) continue
        const e = sharedEdge(room, other, cell.value)
        if (!e) continue
        const a = e.vertical ? tp(e.x, e.y1) : tp(e.x1, e.y)
        const b = e.vertical ? tp(e.x, e.y2) : tp(e.x2, e.y)
        railings.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
      }
    }
    return { room, rect: bbox(corners), center: tp(r.x + r.w / 2, r.y + r.h / 2), windows, railings }
  }),
)

const placedDoors = computed(() =>
  doors.value
    .filter((d) => isDoorMapped(props.building.doorById?.[d.id], visibility.value))
    .map((d) => {
    if (d.kind === 'roll') {
      const corners = [
        tp(d.x, d.y),
        tp(d.x + d.w, d.y),
        tp(d.x + d.w, d.y + d.h),
        tp(d.x, d.y + d.h),
      ]
      const box = bbox(corners)
      return {
        id: d.id,
        kind: 'roll',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        open: !!d.state?.open,
        locked: !!d.state?.locked,
        lockBroken: !!d.state?.lockBroken,
      }
    }
    const placed = placeRect(
      d.x,
      d.y,
      d.vertical ? 7 : cell.value * 0.3,
      d.vertical ? cell.value * 0.3 : 7,
    )
    return {
      id: d.id,
      kind: 'man',
      ...placed,
      open: !!d.state?.open,
      locked: !!d.state?.locked,
      lockBroken: !!d.state?.lockBroken,
    }
  }),
)
const placedBeams = computed(() =>
  beams.value.map((b) => {
    const a = tp(b.x1, b.y1)
    const c = tp(b.x2, b.y2)
    return { x1: a.x, y1: a.y, x2: c.x, y2: c.y, columns: b.columns.map((col) => tp(col.x, col.y)) }
  }),
)

const placedExits = computed(() =>
  exitsOnLevel(props.building, props.level)
    .filter((exit) => {
      const door = props.building.doorById?.[exit.door]
      if (!door || !isDoorMapped(door, visibility.value)) return false
      if (props.builderView) return true
      return props.currentRoom === exit.room
    })
    .map((exit) => {
      const layout = {
        x: exit.at.x * cell.value,
        y: exit.at.y * cell.value,
      }
      const c = tp(layout.x, layout.y)
      const r = exitHexRadius.value
      return {
        doorId: exit.door,
        roomId: exit.room,
        cx: c.x,
        cy: c.y,
        points: hexCornerPoints(c.x, c.y, r),
        reachable: reachableExitSet.value.has(exit.door),
      }
    }),
)

// ---- Spiral stair: a half-cylinder of glass bulging toward the river ----
function arcPoints(cx, cy, r, angleDeg) {
  const pts = []
  for (let k = 90; k >= -90; k -= 15) {
    const a = ((angleDeg + k) * Math.PI) / 180
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

// Radial treads centered halfway between hub and arc: short toward library, long toward kitchen.
// Layout-space angles only — map rotation is applied via toScreen (tp).
function spiralTreads(cx, cy, radius, protrude, toScreen) {
  const base = (protrudeAngle(protrude) * Math.PI) / 180
  const westAng = base - Math.PI / 2
  const n = 7
  const midFrac = 0.5
  const minHalf = 0.12 // half-length as a fraction of radius (library end)
  const maxHalf = 0.42 // half-length at kitchen end
  const out = []
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0 // 0 = library (west), 1 = kitchen (east)
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

const placedFixtures = computed(() =>
  fixtures.value.map((f) => {
    if (f.kind === 'spiral-stairs') {
      const c0 = { x: f.x, y: f.y }
      // Bulge is fixed to the building (west / river wall); tp() rotates it with the plan.
      const pts = arcPoints(c0.x, c0.y, f.radius, protrudeAngle(f.protrude))
      const tPts = pts.map((p) => tp(p.x, p.y))
      const c = tp(c0.x, c0.y)
      const fillPath = `M ${c.x} ${c.y} ` + tPts.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
      const arcPath = `M ${tPts[0].x} ${tPts[0].y} ` + tPts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
      const treads = spiralTreads(c0.x, c0.y, f.radius, f.protrude, tp)
      const standLayout = spiralStandPoint(c0.x, c0.y, f.radius, f.protrude)
      const stand = tp(standLayout.x, standLayout.y)
      const stairId = f.featureRoomId ?? 'spiral-stair'
      const { upRoomId, downRoomId } = stairExitRooms(props.building, stairId)
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
    // Straight stairs: parallel tread lines, wider toward the top (plan convention).
    const r = f.rect
    const corners = [tp(r.x, r.y), tp(r.x + r.w, r.y), tp(r.x + r.w, r.y + r.h), tp(r.x, r.y + r.h)]
    const box = bbox(corners)
    const horizontal = f.run === 'horizontal'
    const alongLen = horizontal ? r.w : r.h
    const crossLen = horizontal ? r.h : r.w
    const n = Math.max(5, Math.min(9, Math.round(alongLen / (cell.value * 0.18))))
    const minSpan = cell.value * 0.28
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
      ? stairExitRooms(props.building, stairId)
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
  }),
)

const avatarScale = computed(() => (cell.value / 64) * 0.42)
// Figure feet sit at y = 26 in local coords after scale().
const avatarFootOffset = computed(() => 26 * avatarScale.value)
const stairLandingFixture = computed(() => {
  if (!current.value?.feature) return null
  return placedFixtures.value.find((f) => f.featureRoomId === current.value.id) ?? null
})
const avatarPos = computed(() => {
  if (!current.value) return null
  const landing = props.standLevel ?? props.level
  if (isStairLanding(current.value)) {
    if (landing !== props.level) return null
    const sf = stairLandingFixture.value
    if (!sf) return null
    if (sf.type === 'spiral') {
      return {
        x: sf.standX,
        y: sf.standY - avatarFootOffset.value,
      }
    }
    return {
      x: sf.cx,
      y: sf.cy - avatarFootOffset.value,
    }
  }
  if (current.value.level !== props.level) return null
  const stand = roomStandPosition(props.building, current.value)
  if (!stand) return null
  return tp(stand.x, stand.y)
})

// ---- Compass: a needle pointing to the plan's current north ----
const compassAngle = computed(() => {
  const base = props.building.north === 'right' ? 0 : 270
  return (base + rotation.value) % 360
})
const compassTip = computed(() => {
  const a = (compassAngle.value * Math.PI) / 180
  return { x: 23 + 17 * Math.cos(a), y: 23 + 17 * Math.sin(a) }
})

function isDiscovered(room) {
  if (props.builderView) return true
  if (isRoomFogged(room, visibility.value)) return false
  if (room.mirror && discoveredSet.value.has(room.mirror)) return true
  return discoveredSet.value.has(room.id)
}
function isFogged(room) {
  return isRoomFogged(room, visibility.value)
}
// Open void with no mirror: dark "no floor" styling. Mirrored bays look like normal rooms.
function isOpenVoid(room) {
  return room.open && !room.mirror
}
function isFixtureRevealed(fixture) {
  return !isFixtureFogged(fixture, visibility.value)
}
function onRoomClick(room) {
  if (room.open) return
  if (!props.reachableRooms.includes(room.id)) return
  emit('room-click', room.id)
}
function onStairFixtureClick(f) {
  if (!isFixtureRevealed(f)) return
  const stairId = f.featureRoomId ?? f.toRoomId
  if (!stairId || !props.reachableRooms.includes(stairId)) return
  emit('room-click', stairId)
}
function onStairExitClick(f, roomId) {
  if (!f.featureRoomId || props.currentRoom !== f.featureRoomId) return
  if (!props.reachableRooms.includes(roomId)) return
  emit('room-click', roomId)
}
function onDoorClick(doorId) {
  if (!interactableDoorSet.value.has(doorId)) return
  emit('door-click', doorId)
}
function onExitClick(doorId) {
  if (!reachableExitSet.value.has(doorId)) return
  emit('exit-click', doorId)
}
</script>

<template>
  <div class="gridmap" :class="{ expanded, 'builder-view': builderView }">
    <button class="rotate-btn" title="Rotate 90°" @click="rotate">⟳</button>

    <svg class="compass" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r="20" class="compass-ring" />
      <line x1="23" y1="23" :x2="compassTip.x" :y2="compassTip.y" class="compass-needle" />
      <circle :cx="compassTip.x" :cy="compassTip.y" r="2.4" class="compass-dot" />
      <text :x="compassTip.x" :y="compassTip.y" class="compass-n">N</text>
    </svg>

    <svg ref="mapSvgRef" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
      <g class="grid-layer">
        <line
          v-for="(ln, i) in placedGridLines"
          :key="'grid-' + i"
          :x1="ln.x1"
          :y1="ln.y1"
          :x2="ln.x2"
          :y2="ln.y2"
          class="grid-line"
        />
      </g>

      <!-- Rooms -->
      <g class="room-layer">
        <g
          v-for="p in placedRooms"
          :key="p.room.id"
          class="room"
          :class="{
            current: p.room.id === currentRoom,
            reachable: reachableRooms.includes(p.room.id),
            visited: isDiscovered(p.room),
            unvisited: (isFogged(p.room) || !isDiscovered(p.room)) && !isOpenVoid(p.room),
            open: isOpenVoid(p.room),
            overlook: p.room.open && p.room.mirror,
          }"
          @click="onRoomClick(p.room)"
        >
          <rect :x="p.rect.x" :y="p.rect.y" :width="p.rect.w" :height="p.rect.h" rx="4" class="floor" />

          <!-- Railing at the edge of the open-to-roof void -->
          <line
            v-for="(rl, i) in p.railings"
            :key="p.room.id + '-rail-' + i"
            :x1="rl.x1"
            :y1="rl.y1"
            :x2="rl.x2"
            :y2="rl.y2"
            class="railing"
          />

          <!-- Windows (revealed rooms only) -->
          <line
            v-for="(w, i) in p.windows"
            v-show="isDiscovered(p.room) || isOpenVoid(p.room)"
            :key="p.room.id + '-win-' + i"
            :x1="w.x1"
            :y1="w.y1"
            :x2="w.x2"
            :y2="w.y2"
            class="window"
          />

          <!-- Tall roll-up garage door (drawn in door layer) -->
          <!-- Side man-door (exterior entry) -->
          <rect v-if="p.entry" :x="p.entry.x" :y="p.entry.y" :width="p.entry.w" :height="p.entry.h" class="entry-door" />

          <text
            v-if="!isOpenVoid(p.room) && p.room.icon && isDiscovered(p.room)"
            :x="p.center.x"
            :y="p.center.y - cell * 0.16"
            class="room-icon"
          >
            {{ p.room.icon }}
          </text>
          <text
            :x="p.center.x"
            :y="p.center.y + (isOpenVoid(p.room) ? 0 : isDiscovered(p.room) ? cell * 0.14 : 6)"
            class="room-label"
            :class="{
              'open-label': isOpenVoid(p.room),
              'fog-mark': !isOpenVoid(p.room) && !isDiscovered(p.room),
            }"
          >
            {{ isOpenVoid(p.room) ? p.room.name : isDiscovered(p.room) ? p.room.name : '?' }}
          </text>
          <text
            v-if="p.room.note && isDiscovered(p.room) && !isOpenVoid(p.room)"
            :x="p.center.x"
            :y="p.center.y + cell * 0.34"
            class="room-note"
          >
            {{ p.room.note }}
          </text>
        </g>
      </g>

      <!-- Open-garage beams + support columns -->
      <g class="beam-layer">
        <g v-for="(b, i) in placedBeams" :key="'beam-' + i">
          <line :x1="b.x1" :y1="b.y1" :x2="b.x2" :y2="b.y2" class="beam" />
          <rect
            v-for="(col, j) in b.columns"
            :key="'col-' + i + '-' + j"
            :x="col.x - 4"
            :y="col.y - 4"
            width="8"
            height="8"
            class="column"
          />
        </g>
      </g>

      <!-- Interior + roll-up doors -->
      <g class="door-layer">
        <rect
          v-for="d in placedDoors"
          :key="d.id"
          :x="d.x"
          :y="d.y"
          :width="d.w"
          :height="d.h"
          :class="[
            d.kind === 'roll' ? 'roll-door' : 'man-door',
            {
              open: d.open,
              closed: !d.open,
              locked: d.locked,
              'lock-broken': d.lockBroken,
              'door-clickable': interactableDoorSet.has(d.id),
            },
          ]"
          @click.stop="onDoorClick(d.id)"
        />
      </g>

      <!-- Exterior exit hexes (step out to the world map) -->
      <g class="exit-layer">
        <g
          v-for="ex in placedExits"
          :key="'exit-' + ex.doorId"
          class="exit-hex"
          :class="{ reachable: ex.reachable }"
          @click.stop="onExitClick(ex.doorId)"
        >
          <polygon :points="ex.points" class="exit-hex-fill" />
          <text :x="ex.cx" :y="ex.cy + 4" class="exit-hex-icon">⬡</text>
        </g>
      </g>

      <!-- Stair fixtures: the spiral (glass half-cylinder) and the garage run -->
      <g class="fixture-layer">
        <g
          v-for="f in placedFixtures"
          :key="f.id"
          class="fixture"
          :class="{
            fog: !isFixtureRevealed(f),
            current: f.featureRoomId && currentRoom === f.featureRoomId,
            reachable:
              f.featureRoomId &&
              isFixtureRevealed(f) &&
              reachableRooms.includes(f.featureRoomId),
            'visual-only': f.visualOnly,
            'stair-clickable':
              f.featureRoomId &&
              isFixtureRevealed(f) &&
              !f.visualOnly &&
              currentRoom !== f.featureRoomId &&
              reachableRooms.includes(f.featureRoomId),
          }"
          @click="
            f.visualOnly
              ? undefined
              : f.featureRoomId && currentRoom !== f.featureRoomId
                ? onStairFixtureClick(f)
                : undefined
          "
        >
          <template v-if="!isFixtureRevealed(f)">
            <rect
              :x="(f.fogBox ?? f.box).x"
              :y="(f.fogBox ?? f.box).y"
              :width="(f.fogBox ?? f.box).w"
              :height="(f.fogBox ?? f.box).h"
              rx="4"
              class="fixture-fog-fill"
            />
            <text :x="f.cx" :y="f.cy + 6" class="fog-mark">?</text>
          </template>
          <template v-else-if="f.type === 'spiral'">
            <path :d="f.fillPath" class="spiral-glass" />
            <path :d="f.arcPath" class="spiral-frame" />
            <line
              v-for="(t, i) in f.treads"
              :key="f.id + '-tread-' + i"
              :x1="t.x1"
              :y1="t.y1"
              :x2="t.x2"
              :y2="t.y2"
              class="stair-tread"
              :stroke-width="t.width"
              :opacity="t.opacity"
            />
            <g v-if="f.featureRoomId && currentRoom === f.featureRoomId" class="spiral-exits">
              <g
                v-if="f.exitUpRoomId"
                class="spiral-exit"
                :class="{ reachable: reachableRooms.includes(f.exitUpRoomId) }"
                @click.stop="onStairExitClick(f, f.exitUpRoomId)"
              >
                <circle :cx="f.exitUp.x" :cy="f.exitUp.y" :r="cell * 0.14" class="stair-pad" />
                <text :x="f.exitUp.x" :y="f.exitUp.y" class="stair-icon">▲</text>
              </g>
              <g
                v-if="f.exitDownRoomId"
                class="spiral-exit"
                :class="{ reachable: reachableRooms.includes(f.exitDownRoomId) }"
                @click.stop="onStairExitClick(f, f.exitDownRoomId)"
              >
                <circle :cx="f.exitDown.x" :cy="f.exitDown.y" :r="cell * 0.14" class="stair-pad" />
                <text :x="f.exitDown.x" :y="f.exitDown.y" class="stair-icon">▼</text>
              </g>
            </g>
          </template>
          <template v-else>
            <rect
              v-if="!f.visualOnly"
              :x="f.box.x"
              :y="f.box.y"
              :width="f.box.w"
              :height="f.box.h"
              class="stair-hit"
            />
            <line
              v-for="(t, i) in f.treads"
              :key="f.id + '-tread-' + i"
              :x1="t.x1"
              :y1="t.y1"
              :x2="t.x2"
              :y2="t.y2"
              class="stair-tread"
              :stroke-width="t.width"
            />
            <g v-if="f.featureRoomId && currentRoom === f.featureRoomId" class="spiral-exits">
              <g
                v-if="f.exitUpRoomId"
                class="spiral-exit"
                :class="{ reachable: reachableRooms.includes(f.exitUpRoomId) }"
                @click.stop="onStairExitClick(f, f.exitUpRoomId)"
              >
                <circle :cx="f.exitUp.x" :cy="f.exitUp.y" :r="cell * 0.14" class="stair-pad" />
                <text :x="f.exitUp.x" :y="f.exitUp.y" class="stair-icon">▲</text>
              </g>
              <g
                v-if="f.exitDownRoomId"
                class="spiral-exit"
                :class="{ reachable: reachableRooms.includes(f.exitDownRoomId) }"
                @click.stop="onStairExitClick(f, f.exitDownRoomId)"
              >
                <circle :cx="f.exitDown.x" :cy="f.exitDown.y" :r="cell * 0.14" class="stair-pad" />
                <text :x="f.exitDown.x" :y="f.exitDown.y" class="stair-icon">▼</text>
              </g>
            </g>
            <template v-else-if="f.featureRoomId">
              <circle :cx="f.cx" :cy="f.cy" :r="cell * 0.15" class="stair-pad" />
              <text :x="f.cx" :y="f.cy" class="stair-icon">
                {{ f.dir === 'up' ? '▲' : f.dir === 'down' ? '▼' : '↕' }}
              </text>
            </template>
            <template v-else>
              <circle :cx="f.cx" :cy="f.cy" :r="cell * 0.15" class="stair-pad" />
              <text :x="f.cx" :y="f.cy" class="stair-icon">
                {{ f.dir === 'up' ? '▲' : f.dir === 'down' ? '▼' : '↕' }}
              </text>
            </template>
          </template>
        </g>
      </g>

      <!-- Stick-figure avatar (kept upright; only translated) -->
      <g
        v-if="avatarPos"
        class="avatar"
        :style="{ transform: `translate(${avatarPos.x}px, ${avatarPos.y}px)` }"
      >
        <ellipse :cx="0" :cy="27 * avatarScale" :rx="13 * avatarScale" :ry="3.5 * avatarScale" class="avatar-shadow" />
        <g :transform="`scale(${avatarScale})`" class="figure">
          <circle cx="0" cy="-24" r="7.5" />
          <line x1="0" y1="-16.5" x2="0" y2="6" />
          <line x1="-13" y1="-6" x2="13" y2="-6" />
          <line x1="0" y1="6" x2="-10" y2="26" />
          <line x1="0" y1="6" x2="10" y2="26" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.gridmap {
  position: relative;
  width: 220px;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #2c3340, #181c24);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.gridmap.expanded {
  width: 100%;
  height: 72vh;
}
.gridmap.builder-view {
  box-shadow: inset 0 0 0 2px rgba(200, 162, 255, 0.35);
}
.rotate-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1.05rem;
  line-height: 1;
  border-radius: 7px;
  background: rgba(20, 24, 30, 0.8);
  color: #cdd3dd;
  border: 1px solid #3f4c63;
  cursor: pointer;
}
.rotate-btn:hover {
  background: rgba(40, 48, 60, 0.9);
}
.compass {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 40px;
  height: 40px;
  z-index: 2;
  pointer-events: none;
}
.compass-ring {
  fill: rgba(20, 24, 30, 0.55);
  stroke: #3f4c63;
  stroke-width: 1.5;
}
.compass-needle {
  stroke: #6db97f;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.compass-dot {
  fill: #6db97f;
}
.compass-n {
  fill: #6db97f;
  font-size: 8px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: #181c24;
  stroke-width: 2.5px;
}
svg:not(.compass) {
  width: 100%;
  height: 100%;
  display: block;
}
.grid-layer {
  pointer-events: none;
}
.grid-line {
  stroke: rgba(255, 255, 255, 0.14);
  stroke-width: 1;
}
.room {
  cursor: pointer;
}
.floor {
  fill: #3b4658;
  stroke: #20262f;
  stroke-width: 2;
  transition: fill 0.3s ease, stroke 0.3s ease;
}
.room.visited .floor {
  fill: #50617a;
}
.room.unvisited .floor {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
}
.room.reachable.unvisited .floor {
  stroke: rgba(109, 185, 127, 0.45);
  cursor: pointer;
}
.room.current .floor {
  fill: #5d7090;
  stroke: #ffd166;
  stroke-width: 3.5;
}
.room.open {
  cursor: default;
}
.room.open .floor {
  fill: #14181f;
  stroke: #2b333d;
}
.room.overlook .floor {
  fill: #50617a;
  stroke: #20262f;
}
.room.overlook.unvisited .floor {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
}
.railing {
  stroke: #b9923f;
  stroke-width: 2.5;
  stroke-dasharray: 2 3;
  pointer-events: none;
}
.room-icon {
  font-size: 22px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.room-label {
  fill: #f4f1de;
  font-size: 10px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 3px;
  pointer-events: none;
}
.fog-mark {
  fill: rgba(255, 255, 255, 0.3);
  font-size: 22px;
  text-anchor: middle;
  font-weight: 700;
  paint-order: unset;
  stroke: none;
}
.room-label.open-label {
  fill: #5d6775;
  font-weight: 500;
  font-style: italic;
  font-size: 9px;
  stroke: none;
}
.room-note {
  fill: #aab2c0;
  font-size: 7.5px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-style: italic;
  pointer-events: none;
}
.window {
  stroke: #7ec8ff;
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0.85;
  pointer-events: none;
}
.beam {
  stroke: #6f6657;
  stroke-width: 5;
  stroke-linecap: round;
  opacity: 0.85;
  pointer-events: none;
}
.column {
  fill: #514a3f;
  pointer-events: none;
}
.roll-door {
  fill: #8a8073;
  stroke: #5b5247;
  stroke-width: 1;
  pointer-events: none;
  transition: fill 0.25s ease, opacity 0.25s ease;
}
.roll-door.open {
  fill: #3b4658;
  opacity: 0.55;
}
.roll-door.locked {
  stroke: #a0522d;
  stroke-width: 2;
}
.man-door {
  fill: #c39a6b;
  pointer-events: none;
  transition: fill 0.25s ease;
}
.man-door.open {
  fill: #2a3038;
  stroke: #c39a6b;
  stroke-width: 1.5;
}
.man-door.locked {
  stroke: #a0522d;
  stroke-width: 2.5;
}
.man-door.lock-broken {
  stroke: #7a828e;
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
.man-door.door-clickable,
.roll-door.door-clickable {
  pointer-events: all;
  cursor: pointer;
}
.man-door.door-clickable:hover,
.roll-door.door-clickable:hover {
  filter: brightness(1.15);
}
.entry-door {
  fill: #c39a6b;
  pointer-events: none;
}
.exit-hex {
  pointer-events: none;
  opacity: 0.45;
}
.exit-hex.reachable {
  pointer-events: all;
  cursor: pointer;
  opacity: 1;
}
.exit-hex-fill {
  fill: #3d5a4a;
  stroke: #8ab89a;
  stroke-width: 1.5;
  transition: fill 0.2s ease, stroke 0.2s ease;
}
.exit-hex.reachable:hover .exit-hex-fill {
  fill: #4a7560;
  stroke: #b8e0c8;
}
.exit-hex-icon {
  fill: #c8e6d0;
  font-size: 11px;
  text-anchor: middle;
  pointer-events: none;
  opacity: 0.85;
}
.fixture {
  cursor: default;
}
.fixture.reachable,
.fixture.stair-clickable {
  cursor: pointer;
}
.fixture.visual-only {
  pointer-events: none;
}
.fixture.fog {
  cursor: default;
}
.fixture-fog-fill {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  pointer-events: none;
}
.stair-hit {
  fill: transparent;
  stroke: none;
}
.stair-tread {
  stroke: #c9b88a;
  stroke-linecap: round;
  pointer-events: none;
}
.stair-pad {
  fill: #20262f;
  stroke: #d7c48f;
  stroke-width: 1.5;
  pointer-events: none;
}
.spiral-exit {
  cursor: default;
  opacity: 0.45;
}
.spiral-exit.reachable {
  cursor: pointer;
  opacity: 1;
}
.spiral-exit.reachable .stair-pad {
  pointer-events: all;
}
.spiral-exit .stair-pad {
  pointer-events: all;
}
.stair-icon {
  fill: #d7c48f;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.spiral-glass {
  fill: rgba(126, 200, 255, 0.16);
  stroke: none;
  transition: fill 0.3s ease;
}
.fixture.current .spiral-glass {
  fill: rgba(126, 200, 255, 0.28);
}
.spiral-frame {
  fill: none;
  stroke: #9fd3ff;
  stroke-width: 2.5;
  stroke-linejoin: round;
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}
.fixture.current .spiral-frame {
  stroke: #ffd166;
  stroke-width: 3.5;
}
.avatar {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.avatar-shadow {
  fill: rgba(0, 0, 0, 0.3);
}
.figure circle {
  fill: #f4f1de;
  stroke: #1c2620;
  stroke-width: 4;
}
.figure line {
  stroke: #1c2620;
  stroke-width: 5;
  stroke-linecap: round;
}
</style>
