import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { levelCliffWall, levelMapLayoutBounds } from './useGrid.js'
import { northOrientationBase } from './grid/useGridCompass.js'
import { bbox } from './useGridFixtureLayout.js'

export function expandFrameToAspect(frame, aspect, zoom = 1) {
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
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  halfW /= safeZoom
  halfH /= safeZoom
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

export function focusedViewBox(focus, aspect, cell, spanCells = 5.2) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const height = cell * spanCells
  const width = height * safeAspect
  return {
    x: focus.x - width / 2,
    y: focus.y - height / 2,
    w: width,
    h: height,
  }
}

export function rotatePointAround(point, pivot, degrees) {
  const rad = (degrees * Math.PI) / 180
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return {
    x: pivot.x + dx * c - dy * s,
    y: pivot.y + dx * s + dy * c,
  }
}

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

/**
 * Viewport rotation, layout bounds, and coordinate transforms for GridMap.
 */
export function useGridMapTransform({
  gridmapRef,
  building,
  level,
  visibility,
  cell,
  expanded,
  viewportMode,
  focusPoint,
}) {
  const rotation = ref(0)
  function rotate() {
    rotation.value = (rotation.value + 90) % 360
  }

  const baseRotation = computed(() => northOrientationBase(building.value?.north))
  const mapRotation = computed(() => (baseRotation.value + rotation.value) % 360)

  const swapAxes = computed(() => mapRotation.value % 180 !== 0)

  const layoutVisibility = computed(() => ({
    ...visibility.value,
    builderView: false,
  }))

  const mapLayout = computed(() =>
    levelMapLayoutBounds(building.value, level.value, layoutVisibility.value),
  )

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
  watch(expanded, () => nextTick(attachResizeObserver))
  onUnmounted(() => resizeObserver?.disconnect())

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

  const viewportZoom = computed(() => viewportMode.value === 'fit-all' ? 0.82 : 1)

  const layoutViewFrame = computed(() =>
    expandFrameToAspect(minFramePx.value, containerAspect.value, viewportZoom.value),
  )

  const gameplayFocus = computed(() => focusPoint.value ?? ({
    x: layoutViewFrame.value.bcx,
    y: layoutViewFrame.value.bcy,
  }))

  // Rotation belongs to the authored floor plan, so its pivot must remain
  // stable while the camera follows the player.
  const center = computed(() => ({
    x: layoutViewFrame.value.bcx,
    y: layoutViewFrame.value.bcy,
  }))

  function tp(x, y) {
    return rotatePointAround({ x, y }, center.value, mapRotation.value)
  }

  function unTp(x, y) {
    return rotatePointAround({ x, y }, center.value, -mapRotation.value)
  }

  const viewBoxRect = computed(() => {
    if (viewportMode.value === 'gameplay') {
      const focus = tp(gameplayFocus.value.x, gameplayFocus.value.y)
      return focusedViewBox(focus, containerAspect.value, cell.value)
    }
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

  const viewBox = computed(() => {
    const vb = viewBoxRect.value
    return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
  })

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
    const depth = 0.35
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

  const placedCliffWall = computed(() => {
    const wall = levelCliffWall(building.value, level.value, visibility.value)
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

  const gridStepPx = computed(() => {
    const gridFeet = building.value.gridFeet ?? 10
    const unitFeet = building.value.unitFeet ?? gridFeet
    return cell.value * (gridFeet / unitFeet)
  })

  const placedGridLines = computed(() => {
    const vb = viewBoxRect.value
    const step = gridStepPx.value
    const pivot = tp(center.value.x, center.value.y)
    const cx = pivot.x
    const cy = pivot.y
    const rad = (mapRotation.value * Math.PI) / 180
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

  return {
    rotation,
    rotate,
    swapAxes,
    mapLayout,
    layoutViewFrame,
    center,
    tp,
    unTp,
    viewBoxRect,
    viewBox,
    placedRiver,
    placedCliffWall,
    placedGridLines,
  }
}
