<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { hexCornerPoints } from '../composables/useHexGeometry.js'
import { catmullRomSpline, pointsAttr } from '../composables/useRoutes.js'
import { pathHandleColor, roomHandleColor } from '../composables/useGridBuilder.js'
import {
  roomsOnLevel,
  roomRect,
  roomStandPosition,
  spiralStandPoint,
  spiralExitPoint,
  stairExitRooms,
  isStairLanding,
  levelBeams,
  doorsOnLevel,
  exitsOnLevel,
  exteriorNodesOnLevel,
  exteriorPathsOnLevel,
  fixturesOnLevel,
  sharedEdge,
  mapVisibilityCtx,
  levelBuildingPerimeter,
  levelMapLayoutBounds,
  levelCliffWall,
  isRoomMapped,
  isRoomFogged,
  isDoorMapped,
  isFixtureMapped,
  isFixtureFogged,
  exitMapAt,
} from '../composables/useGrid.js'

const props = defineProps({
  building: { type: Object, required: true },
  currentRoom: { type: String, default: '' },
  exteriorNode: { type: String, default: null },
  discovered: { type: [Array, Object], default: () => [] },
  revealed: { type: [Array, Object], default: () => [] },
  level: { type: String, required: true },
  standLevel: { type: String, default: null },
  reachableRooms: { type: Array, default: () => [] },
  doorStates: { type: Object, default: () => ({}) },
  interactableDoorIds: { type: Array, default: () => [] },
  reachableExitDoors: { type: Array, default: () => [] },
  reachableExteriorNodes: { type: Array, default: () => [] },
  builderView: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  selectedItemId: { type: String, default: null },
  addPointMode: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits([
  'room-click',
  'door-click',
  'exit-click',
  'exterior-node-click',
  'select-handle',
  'grid-handle-move',
  'builder-map-click',
  'select-item',
])

const cell = computed(() => props.building.cell ?? 64)
const discoveredSet = computed(() => new Set(props.discovered))
const interactableDoorSet = computed(() => new Set(props.interactableDoorIds))
const reachableExitSet = computed(() => new Set(props.reachableExitDoors))
const reachableExteriorSet = computed(() => new Set(props.reachableExteriorNodes))
const exitHexRadius = computed(() => cell.value * 0.13)
const visibility = computed(() =>
  mapVisibilityCtx(
    props.discovered,
    props.revealed,
    props.building,
    props.doorStates,
    props.building.areaId,
    props.builderView,
    props.currentRoom || null,
    props.exteriorNode,
  ),
)
const current = computed(() =>
  props.currentRoom ? props.building.roomById[props.currentRoom] : null,
)
const levelRooms = computed(() => roomsOnLevel(props.building, props.level))
const mappedRooms = computed(() => levelRooms.value.filter((r) => isRoomMapped(r, visibility.value)))
const placedBuildingShell = computed(() => {
  if (props.builderView) return []
  return levelBuildingPerimeter(props.building, props.level).map((ring) =>
    ring.map((p) => tp(p.x * cell.value, p.y * cell.value)),
  )
})
function shellRingPath(ring) {
  if (ring.length === 0) return ''
  return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
}
const beams = computed(() => levelBeams(props.building, props.level, visibility.value))
const doors = computed(() =>
  doorsOnLevel(props.building, props.level, props.doorStates, props.currentRoom || null),
)
const fixtures = computed(() =>
  fixturesOnLevel(props.building, props.level).filter((f) => isFixtureMapped(f, visibility.value)),
)

// ---- Rotation: the player can spin the plan 90° at a time ----
const rotation = ref(0)
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}
const swapAxes = computed(() => rotation.value % 180 !== 0)

const mapLayout = computed(() =>
  levelMapLayoutBounds(props.building, props.level, visibility.value),
)

const gridmapRef = ref(null)
const containerAspect = ref(220 / 200)
let resizeObserver = null

function attachResizeObserver() {
  resizeObserver?.disconnect()
  const el = gridmapRef.value
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

/** Expand the minimum frame to the panel aspect ratio, centered on the building. */
function expandFrameToAspect(frame, aspect) {
  const { minX, maxX, minY, maxY, bcx, bcy } = frame
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  let halfW = 0
  let halfH = 0
  for (const p of corners) {
    halfW = Math.max(halfW, Math.abs(p.x - bcx))
    halfH = Math.max(halfH, Math.abs(p.y - bcy))
  }
  if (halfH <= 0) halfH = 1
  if (halfW / halfH < aspect) halfW = halfH * aspect
  else halfH = halfW / aspect
  return {
    minX: bcx - halfW,
    maxX: bcx + halfW,
    minY: bcy - halfH,
    maxY: bcy + halfH,
    w: halfW * 2,
    h: halfH * 2,
    bcx,
    bcy,
  }
}

const minFramePx = computed(() => {
  const m = mapLayout.value
  const c = cell.value
  return {
    minX: m.minX * c,
    maxX: m.maxX * c,
    minY: m.minY * c,
    maxY: m.maxY * c,
    bcx: m.centerX * c,
    bcy: m.centerY * c,
  }
})

const layoutViewFrame = computed(() =>
  expandFrameToAspect(minFramePx.value, containerAspect.value),
)

const center = computed(() => ({
  x: layoutViewFrame.value.bcx,
  y: layoutViewFrame.value.bcy,
}))

// Rotate a point about the building center (clockwise on screen).
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

function unTp(x, y) {
  const rad = (rotation.value * Math.PI) / 180
  const cx = center.value.x
  const cy = center.value.y
  const dx = x - cx
  const dy = y - cy
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return { x: cx + dx * c + dy * s, y: cy - dx * s + dy * c }
}

const placedRiver = computed(() => {
  const river = mapLayout.value.river
  if (!river) return null
  const cellV = cell.value
  const f = layoutViewFrame.value
  const x0 = f.minX
  const y0 = river.y * cellV
  const w = f.w
  const h = river.h * cellV
  const corners = [tp(x0, y0), tp(x0 + w, y0), tp(x0 + w, y0 + h), tp(x0, y0 + h)]
  const cy = river.y + river.h / 2
  const halfSpan = river.h * 0.22
  const depth = 0.35 // layout units toward south (−x); flow is north → south
  const spanLayout = f.w / cellV
  const n = Math.max(4, Math.min(8, Math.round(spanLayout / 0.9)))
  const chevrons = []
  for (let i = 0; i < n; i++) {
    const x = f.minX / cellV + ((i + 0.5) / n) * spanLayout
    const wingA = tp(x * cellV, (cy - halfSpan) * cellV)
    const tip = tp((x - depth) * cellV, cy * cellV)
    const wingB = tp(x * cellV, (cy + halfSpan) * cellV)
    chevrons.push(`M ${wingA.x} ${wingA.y} L ${tip.x} ${tip.y} L ${wingB.x} ${wingB.y}`)
  }
  return { rect: bbox(corners), chevrons }
})

/** Stone strip offset west (−y) from each spine segment. */
function cliffWallSegmentPoly(p1, p2, thickness) {
  return [
    { x: p1.x, y: p1.y },
    { x: p2.x, y: p2.y },
    { x: p2.x, y: p2.y - thickness },
    { x: p1.x, y: p1.y - thickness },
  ]
}

function cliffWallPolygonPath(points) {
  if (!points.length) return ''
  const [first, ...rest] = points
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`
}

const placedCliffWall = computed(() => {
  const wall = levelCliffWall(props.building, props.level, visibility.value)
  if (!wall) return null
  const cellV = cell.value
  const t = wall.thickness
  const segments = []
  for (let i = 0; i < wall.points.length - 1; i++) {
    const a = wall.points[i]
    const b = wall.points[i + 1]
    const poly = cliffWallSegmentPoly(a, b, t).map((p) => tp(p.x * cellV, p.y * cellV))
    segments.push({ d: cliffWallPolygonPath(poly), key: `seg-${i}` })
  }
  return segments.length ? { segments } : null
})

// Viewing area = panel aspect, centered on the building; grid fills this rect.
const viewBoxRect = computed(() => {
  const f = layoutViewFrame.value
  const corners = [
    tp(f.minX, f.minY),
    tp(f.maxX, f.minY),
    tp(f.maxX, f.maxY),
    tp(f.minX, f.maxY),
  ]
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 100, h: 100 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})

const mapSvgRef = ref(null)
const dragHandle = ref(null)

function svgCoords(clientX, clientY) {
  const svg = mapSvgRef.value
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const local = pt.matrixTransform(ctm.inverse())
  return { x: local.x, y: local.y }
}

function onHandleDown(e, h) {
  e.stopPropagation()
  e.preventDefault()
  dragHandle.value = h
  emit('select-handle', h.handleKey)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!dragHandle.value) return
  const pt = svgCoords(e.clientX, e.clientY)
  if (!pt) return
  const layout = unTp(pt.x, pt.y)
  const h = dragHandle.value
  emit('grid-handle-move', {
    handleKey: h.handleKey,
    index: h.index,
    role: h.role,
    nodeId: h.nodeId,
    x: layout.x,
    y: layout.y,
  })
}

function onPointerUp() {
  dragHandle.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

onUnmounted(onPointerUp)

function onSvgClick(e) {
  if (!props.builderEdit || !props.addPointMode) return
  if (e.target.closest('.edit-handle')) return
  const pt = svgCoords(e.clientX, e.clientY)
  if (!pt) return
  const layout = unTp(pt.x, pt.y)
  emit('builder-map-click', layout)
}

const displayEditHandles = computed(() =>
  props.editHandles.map((h) => {
    const p = tp(h.x, h.y)
    return { ...h, x: p.x, y: p.y }
  }),
)

const editPolyline = computed(() => {
  if (props.editMode !== 'line') return []
  return displayEditHandles.value.map((h) => ({ x: h.x, y: h.y }))
})

const editStroke = computed(() => pathHandleColor())

function handleColor(h) {
  if (h.role === 'point') return pathHandleColor()
  if (h.role === 'path-node' || h.role === 'node-at' || h.role === 'door-at' || h.role === 'exit-map') {
    return '#7dcea0'
  }
  return roomHandleColor(h.role)
}

function handleFill(h) {
  if (h.handleKey === props.selectedHandleId) return '#fff'
  if (h.role === 'move') return '#e8d4ff'
  if (h.role === 'path-node' || h.role === 'node-at' || h.role === 'door-at' || h.role === 'exit-map') {
    return '#d4f5e2'
  }
  return '#ffd166'
}

function isItemSelected(id) {
  return props.builderView && id === props.selectedItemId
}

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

const placedExteriorPaths = computed(() =>
  exteriorPathsOnLevel(props.building, props.level).map((path) => {
    const layout = (path.points ?? []).map((p) => ({
      x: p.x * cell.value,
      y: p.y * cell.value,
    }))
    const drawn =
      path.smooth !== false && layout.length >= 2
        ? catmullRomSpline(layout)
        : layout
    const points = drawn
      .map((p) => tp(p.x, p.y))
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
    return { id: path.id, points }
  }),
)

const placedExteriorNodes = computed(() =>
  exteriorNodesOnLevel(props.building, props.level).map((node) => {
    const c = tp(node.at.x * cell.value, node.at.y * cell.value)
    const r = cell.value * 0.11
    return {
      id: node.id,
      label: node.label,
      cx: c.x,
      cy: c.y,
      r,
      current: props.exteriorNode === node.id,
      reachable: reachableExteriorSet.value.has(node.id),
      hasDoor: !!node.door,
    }
  }),
)

const placedExits = computed(() =>
  exitsOnLevel(props.building, props.level)
    .filter((exit) => {
      const door = props.building.doorById?.[exit.door]
      if (!door) return false
      if (props.builderView || props.exteriorNode) return true
      if (!isDoorMapped(door, visibility.value)) return false
      return props.currentRoom === exit.room
    })
    .map((exit) => {
      const mapAt = exitMapAt(exit)
      if (!mapAt) return null
      const c = tp(mapAt.x * cell.value, mapAt.y * cell.value)
      const r = exitHexRadius.value
      return {
        doorId: exit.door,
        roomId: exit.room,
        cx: c.x,
        cy: c.y,
        points: hexCornerPoints(c.x, c.y, r),
        reachable: reachableExitSet.value.has(exit.door),
      }
    })
    .filter(Boolean),
)

// ---- Spiral stair: a half-cylinder of glass bulging toward the river ----
// `top` = west / river wall when north points right on the plan.
function protrudeAngle(edge) {
  if (edge === 'top') return 270
  if (edge === 'bottom') return 90
  if (edge === 'left') return 180
  return 0
}

function arcPoints(cx, cy, r, angleDeg) {
  const pts = []
  for (let k = 90; k >= -90; k -= 15) {
    const a = ((angleDeg + k) * Math.PI) / 180
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

// Radial treads centered halfway between hub and arc: short toward hallway (south), long toward kitchen (north).
// Layout-space angles only — map rotation is applied via toScreen (tp).
function spiralTreads(cx, cy, radius, protrude, toScreen) {
  const base = (protrudeAngle(protrude) * Math.PI) / 180
  const westAng = base - Math.PI / 2
  const n = 7
  const midFrac = 0.5
  const minHalf = 0.12 // half-length as a fraction of radius (hallway / south end)
  const maxHalf = 0.42 // half-length at kitchen / north end
  const out = []
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0 // 0 = hallway (south), 1 = kitchen (north)
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
  if (props.exteriorNode) {
    const node = props.building.exterior?.nodeById?.[props.exteriorNode]
    if (!node || props.building.exterior?.level !== props.level) return null
    const stand = tp(node.at.x * cell.value, node.at.y * cell.value)
    return {
      x: stand.x,
      y: stand.y - avatarFootOffset.value,
    }
  }
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
function compassLabelPoint(baseDeg, offsetDeg) {
  const a = ((baseDeg + offsetDeg) * Math.PI) / 180
  return { x: 23 + 17 * Math.cos(a), y: 23 + 17 * Math.sin(a) }
}
const compassCardinals = computed(() => {
  const n = compassAngle.value
  return [
    { id: 'E', ...compassLabelPoint(n, 90) },
    { id: 'S', ...compassLabelPoint(n, 180) },
    { id: 'W', ...compassLabelPoint(n, 270) },
  ]
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
  if (props.builderView) {
    emit('select-item', { source: 'rooms', id: room.id })
    return
  }
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
  if (props.builderView) {
    emit('select-item', { source: 'doors', id: doorId })
    return
  }
  if (!interactableDoorSet.value.has(doorId)) return
  emit('door-click', doorId)
}
function onExitClick(e, doorId) {
  if (props.builderView) {
    e.preventDefault()
    emit('select-item', { source: 'exits', id: doorId })
    return
  }
  emit('exit-click', doorId)
}
function onExteriorNodeClick(nodeId) {
  if (props.builderView) {
    emit('select-item', { source: 'nodes', id: nodeId })
    return
  }
  if (nodeId === props.exteriorNode) return
  if (!reachableExteriorSet.value.has(nodeId)) return
  emit('exterior-node-click', nodeId)
}
</script>

<template>
  <div
    ref="gridmapRef"
    class="gridmap"
    :class="{
      expanded,
      'builder-view': builderView,
      'builder-edit': builderEdit,
      'add-point': addPointMode,
    }"
  >
    <div class="map-controls">
      <button class="rotate-btn" title="Rotate 90°" @click="rotate">⟳</button>
      <svg class="compass" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="20" class="compass-ring" />
        <line x1="23" y1="23" :x2="compassTip.x" :y2="compassTip.y" class="compass-needle" />
        <circle :cx="compassTip.x" :cy="compassTip.y" r="2.4" class="compass-dot" />
        <text
          v-for="label in compassCardinals"
          :key="label.id"
          :x="label.x"
          :y="label.y"
          class="compass-cardinal"
        >{{ label.id }}</text>
        <text :x="compassTip.x" :y="compassTip.y" class="compass-n">N</text>
      </svg>
    </div>

    <svg
      ref="mapSvgRef"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      @click="onSvgClick"
    >
      <defs>
        <pattern
          id="cliff-wall-stone"
          patternUnits="userSpaceOnUse"
          width="18"
          height="12"
        >
          <rect width="18" height="12" fill="#7a7672" />
          <rect x="0.5" y="0.5" width="8" height="5" rx="0.4" fill="#8f8b86" stroke="#5c5854" stroke-width="0.5" />
          <rect x="9.5" y="0.5" width="8" height="5" rx="0.4" fill="#6e6a66" stroke="#5c5854" stroke-width="0.5" />
          <rect x="5" y="6.5" width="8" height="5" rx="0.4" fill="#75716d" stroke="#5c5854" stroke-width="0.5" />
          <rect x="0.5" y="6.5" width="4" height="5" rx="0.4" fill="#85817c" stroke="#5c5854" stroke-width="0.5" />
        </pattern>
      </defs>

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

      <!-- River cascade west of the building -->
      <g v-if="placedRiver" class="river-layer" pointer-events="none">
        <rect
          :x="placedRiver.rect.x"
          :y="placedRiver.rect.y"
          :width="placedRiver.rect.w"
          :height="placedRiver.rect.h"
          class="river-fill"
        />
        <path
          v-for="(d, i) in placedRiver.chevrons"
          :key="'river-flow-' + i"
          :d="d"
          class="river-flow"
        />
      </g>

      <!-- Retaining wall — cliff edge west of the driveway -->
      <g v-if="placedCliffWall" class="cliff-wall-layer" pointer-events="none">
        <path
          v-for="seg in placedCliffWall.segments"
          :key="'cliff-' + seg.key"
          :d="seg.d"
          class="cliff-wall-fill"
        />
      </g>

      <!-- Building shell — true footprint, always behind interactive layers -->
      <g v-if="placedBuildingShell.length" class="building-shell-layer" pointer-events="none">
        <path
          v-for="(ring, i) in placedBuildingShell"
          :key="'shell-' + i"
          :d="shellRingPath(ring)"
          class="building-shell"
          pointer-events="none"
        />
      </g>

      <!-- Exterior footpaths -->
      <g class="exterior-path-layer">
        <polyline
          v-for="path in placedExteriorPaths"
          :key="'ext-path-' + path.id"
          :points="path.points"
          class="exterior-path"
        />
      </g>

      <!-- Exterior stand spots along the footpath -->
      <g class="exterior-node-layer">
        <g
          v-for="node in placedExteriorNodes"
          :key="'ext-node-' + node.id"
          class="exterior-node"
          :class="{
            current: node.current,
            reachable: node.reachable || builderView,
            'builder-selected': isItemSelected(node.id),
          }"
          @click.stop="onExteriorNodeClick(node.id)"
        >
          <circle
            :cx="node.cx"
            :cy="node.cy"
            :r="node.r"
            class="exterior-node-fill"
          />
          <circle
            v-if="node.current"
            :cx="node.cx"
            :cy="node.cy"
            :r="node.r + 4"
            class="exterior-node-ring"
          />
          <text
            v-if="node.current || node.reachable"
            :x="node.cx"
            :y="node.cy - node.r - 6"
            class="exterior-node-label"
          >
            {{ node.label }}
          </text>
        </g>
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
            'builder-selected': isItemSelected(p.room.id),
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
              'door-clickable': interactableDoorSet.has(d.id) || builderView,
              'builder-selected': isItemSelected(d.id),
            },
          ]"
          @click.stop="onDoorClick(d.id)"
        />
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
        <circle
          :cx="0"
          :cy="1 * avatarScale"
          :r="37.5 * avatarScale"
          class="avatar-halo"
        />
        <ellipse :cx="0" :cy="27 * avatarScale" :rx="13 * avatarScale" :ry="3.5 * avatarScale" class="avatar-shadow" />
        <g :transform="`scale(${avatarScale})`" class="figure">
          <circle cx="0" cy="-24" r="7.5" />
          <line x1="0" y1="-16.5" x2="0" y2="6" />
          <line x1="-13" y1="-6" x2="13" y2="-6" />
          <line x1="0" y1="6" x2="-10" y2="26" />
          <line x1="0" y1="6" x2="10" y2="26" />
        </g>
      </g>

      <!-- Step out to the hex travel map (on top for reliable clicks) -->
      <g class="exit-layer">
        <g
          v-for="ex in placedExits"
          :key="'exit-' + ex.doorId"
          class="exit-hex"
          :class="{
            reachable: ex.reachable,
            playable: !builderView,
            'builder-selected': isItemSelected(ex.doorId),
            'builder-pick': builderView,
          }"
          @click.stop="onExitClick($event, ex.doorId)"
        >
          <polygon :points="ex.points" class="exit-hex-fill" />
          <text :x="ex.cx" :y="ex.cy + 1" class="exit-hex-icon">⬡</text>
          <text :x="ex.cx" :y="ex.cy + 14" class="exit-hex-label">map</text>
        </g>
      </g>

      <!-- Builder edit layer -->
      <g v-if="builderEdit" class="edit-layer">
        <polyline
          v-if="editMode === 'line' && editPolyline.length"
          :points="pointsAttr(editPolyline)"
          class="edit-guide"
          :style="{ stroke: editStroke }"
        />
        <template v-if="editMode === 'room' && selectedItemId">
          <rect
            v-for="p in placedRooms.filter((r) => r.room.id === selectedItemId)"
            :key="'sel-' + p.room.id"
            :x="p.rect.x"
            :y="p.rect.y"
            :width="p.rect.w"
            :height="p.rect.h"
            class="room-selection-outline"
            rx="4"
          />
        </template>
        <circle
          v-for="h in displayEditHandles"
          :key="'handle-' + h.handleKey"
          :cx="h.x"
          :cy="h.y"
          :r="h.role === 'move' || h.role === 'path-node' ? 9 : 7"
          class="edit-handle"
          :class="{
            selected: h.handleKey === selectedHandleId,
            ['role-' + h.role]: !!h.role,
          }"
          :style="{ stroke: handleColor(h), fill: handleFill(h) }"
          @pointerdown="onHandleDown($event, h)"
        />
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
  container-type: size;
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
.gridmap.builder-view:not(.expanded) {
  width: 100%;
  height: min(58vh, 560px);
}
.gridmap.builder-edit.add-point {
  cursor: crosshair;
}
.room.builder-selected .floor,
.man-door.builder-selected,
.roll-door.builder-selected,
.exterior-node.builder-selected .exterior-node-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 3;
}
.edit-layer {
  pointer-events: all;
}
.edit-guide {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 4 5;
  opacity: 0.85;
  pointer-events: none;
}
.room-selection-outline {
  fill: rgba(200, 162, 255, 0.08);
  stroke: rgba(200, 162, 255, 0.75);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}
.edit-handle {
  stroke-width: 2.5;
  cursor: grab;
  touch-action: none;
}
.edit-handle.selected {
  stroke-width: 3;
}
.edit-handle:active {
  cursor: grabbing;
}
.map-controls {
  position: absolute;
  right: clamp(6px, 2.5cqmin, 14px);
  top: clamp(6px, 2.5cqmin, 14px);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: clamp(4px, 1.5cqmin, 10px);
  --ctrl-size: clamp(28px, 13cqmin, 54px);
}
.rotate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ctrl-size);
  height: var(--ctrl-size);
  padding: 0;
  font-size: calc(var(--ctrl-size) * 0.62);
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
  width: calc(var(--ctrl-size) * 1.35);
  height: calc(var(--ctrl-size) * 1.35);
  pointer-events: none;
  flex-shrink: 0;
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
.compass-cardinal {
  fill: #9aa3b2;
  font-size: 7px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: #181c24;
  stroke-width: 2px;
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
.building-shell-layer {
  pointer-events: none;
}
.river-layer {
  pointer-events: none;
}
.river-fill {
  fill: #2a5578;
  opacity: 0.92;
}
.river-flow {
  fill: none;
  stroke: rgba(200, 230, 255, 0.5);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cliff-wall-layer {
  pointer-events: none;
}
.cliff-wall-fill {
  fill: url(#cliff-wall-stone);
  stroke: #5c5854;
  stroke-width: 2;
  stroke-linejoin: bevel;
}
.building-shell {
  fill: #14181f;
  stroke: rgba(255, 255, 255, 0.22);
  stroke-width: 2.5;
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
.exit-hex.playable,
.exit-hex.builder-pick {
  pointer-events: all;
  cursor: pointer;
}
.exit-hex.reachable {
  opacity: 1;
}
.exit-hex.playable:not(.reachable) {
  opacity: 0.55;
  cursor: not-allowed;
}
.gridmap.builder-view .exit-hex.builder-pick {
  cursor: grab;
}
.gridmap.builder-view .exit-hex.builder-selected {
  cursor: grab;
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
.exit-hex.builder-selected .exit-hex-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 2.5;
}
.exit-hex-icon {
  fill: #c8e6d0;
  font-size: 11px;
  text-anchor: middle;
  pointer-events: none;
  opacity: 0.85;
}
.exit-hex-label {
  fill: #9ab89a;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-anchor: middle;
  pointer-events: none;
}
.exterior-path {
  fill: none;
  stroke: #c9b97e;
  stroke-width: 2.8;
  stroke-dasharray: 1.5 6;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.82;
  pointer-events: none;
}
.exterior-node {
  pointer-events: none;
  opacity: 0.4;
}
.exterior-node.reachable {
  pointer-events: all;
  cursor: pointer;
  opacity: 0.9;
}
.exterior-node.current {
  opacity: 1;
}
.exterior-node-fill {
  fill: #5c7058;
  stroke: #c9b97e;
  stroke-width: 2;
  transition: fill 0.2s ease, stroke 0.2s ease;
}
.exterior-node-ring {
  fill: none;
  stroke: rgba(224, 212, 168, 0.55);
  stroke-width: 2;
  pointer-events: none;
}
.exterior-node-label {
  fill: #e0d4a8;
  font-size: 8px;
  font-weight: 600;
  text-anchor: middle;
  pointer-events: none;
}
.exterior-node.reachable:hover .exterior-node-fill {
  fill: #6a8066;
  stroke: #e0d4a8;
}
.exterior-node.current .exterior-node-fill {
  fill: #7a9474;
  stroke: #fff;
  stroke-width: 2.5;
}
.exterior-node.builder-selected .exterior-node-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 3;
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
.avatar-halo {
  fill: #ffd166;
  stroke: #c9970a;
  stroke-width: 1.5;
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
