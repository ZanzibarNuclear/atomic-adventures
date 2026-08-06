import { computed } from 'vue'
import {
  axialToPixel,
  boundsOf,
  gameplayViewBox,
  hexIntersectsViewBox,
  neighborsOf,
} from './useHexGeometry.js'

export function normalizeMapMode(mode) {
  if (mode === 'full') return 'full'
  if (mode === 'gameplay') return 'gameplay'
  return 'gameplay'
}

function buildCoordMap(allHexes) {
  return new Map(allHexes.map((h) => [`${h.q},${h.r}`, h]))
}

/**
 * Pure viewport evaluation for tests and composable.
 */
export function evaluateMapViewport({
  allHexes,
  currentHexId,
  discovered,
  mode,
  builderView = false,
  size = 44,
  panelAspect = null,
  /** Optional player camera box (after zoom/pan). Used for culling when set. */
  cameraViewBox = null,
  /** Optional world focus (avatar stand). Centers gameplay framing when set. */
  focusPoint = null,
}) {
  const hexById = Object.fromEntries(allHexes.map((h) => [h.id, h]))
  const discoveredSet = new Set(discovered)
  const current = hexById[currentHexId]
  const standingOn = currentHexId
  const isDiscovered = (hex) =>
    hex && (discoveredSet.has(hex.id) || hex.id === standingOn)

  if (builderView) {
    const b = boundsOf(allHexes, size)
    return {
      visibleHexes: allHexes,
      fogHexes: [],
      viewBox: b,
      viewBoxString: `${b.x} ${b.y} ${b.width} ${b.height}`,
    }
  }

  const mapMode = normalizeMapMode(mode)
  const coordMap = buildCoordMap(allHexes)

  if (mapMode === 'full') {
    const visibleHexes = allHexes.filter(isDiscovered)
    const b = boundsOf(visibleHexes.length ? visibleHexes : allHexes, size)
    return {
      visibleHexes,
      fogHexes: [],
      viewBox: b,
      viewBoxString: `${b.x} ${b.y} ${b.width} ${b.height}`,
    }
  }

  // gameplay: default framing from hex (with optional avatar focus), then optional camera
  let viewBox = current
    ? gameplayViewBox(current, size, {
        discovered,
        allHexes,
        panelAspect,
      })
    : { x: 0, y: 0, width: 100, height: 100 }

  if (
    focusPoint &&
    Number.isFinite(focusPoint.x) &&
    Number.isFinite(focusPoint.y)
  ) {
    viewBox = {
      ...viewBox,
      x: focusPoint.x - viewBox.width / 2,
      y: focusPoint.y - viewBox.height / 2,
    }
  }

  if (
    cameraViewBox &&
    Number.isFinite(cameraViewBox.width) &&
    cameraViewBox.width > 0
  ) {
    viewBox = {
      x: cameraViewBox.x,
      y: cameraViewBox.y,
      width: cameraViewBox.width,
      height: cameraViewBox.height,
    }
  }

  const inView = (hex) => hexIntersectsViewBox(hex, viewBox, size)

  const visibleHexes = allHexes.filter(
    (h) => isDiscovered(h) && inView(h),
  )

  const fogHexes = current
    ? neighborsOf(current)
        .map((n) => coordMap.get(`${n.q},${n.r}`))
        .filter(
          (h) =>
            h &&
            !discoveredSet.has(h.id) &&
            h.id !== standingOn &&
            inView(h),
        )
    : []

  return {
    visibleHexes,
    fogHexes,
    viewBox,
    viewBoxString: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
  }
}

/**
 * HexMap viewport: visible hex set, fog edge, viewBox, and center helper.
 */
export function useHexMapViewport({
  mapData,
  currentHex,
  discovered,
  mode,
  builderView,
  panelAspect,
  cameraViewBox = null,
  focusPoint = null,
}) {
  const size = computed(() => mapData.value.size ?? 44)
  const allHexes = computed(() => mapData.value.hexes ?? [])
  const hexById = computed(() =>
    Object.fromEntries(allHexes.value.map((h) => [h.id, h])),
  )
  const discoveredSet = computed(() => new Set(discovered.value))
  const current = computed(() => hexById.value[currentHex.value])

  const evaluated = computed(() =>
    evaluateMapViewport({
      allHexes: allHexes.value,
      currentHexId: currentHex.value,
      discovered: discovered.value,
      mode: mode.value,
      builderView: builderView.value,
      size: size.value,
      panelAspect: panelAspect?.value ?? panelAspect ?? null,
      cameraViewBox: cameraViewBox?.value ?? cameraViewBox ?? null,
      focusPoint: focusPoint?.value ?? focusPoint ?? null,
    }),
  )

  const visibleHexes = computed(() => evaluated.value.visibleHexes)
  const fogHexes = computed(() => evaluated.value.fogHexes)
  const viewBox = computed(() => evaluated.value.viewBoxString)
  const viewBoxObject = computed(() => evaluated.value.viewBox)

  const gameplayBox = computed(() => {
    if (builderView.value || normalizeMapMode(mode.value) !== 'gameplay') {
      return null
    }
    return evaluated.value.viewBox
  })

  function hexInGameplayView(hex) {
    if (!hex) return false
    const box = gameplayBox.value
    if (!box) return true
    return hexIntersectsViewBox(hex, box, size.value)
  }

  function fogMaskOpts() {
    if (builderView.value) {
      return { isRevealed: () => true, inView: () => true }
    }

    const standingOn = currentHex.value
    const revealed = discoveredSet.value
    const isRevealed = (id) =>
      id != null && (revealed.has(id) || id === standingOn)

    if (normalizeMapMode(mode.value) === 'gameplay') {
      return {
        isRevealed,
        inView: (id) => hexInGameplayView(hexById.value[id]),
      }
    }

    // full: all discovered hexes shown; routes/features unmasked by view
    return { isRevealed, inView: () => true }
  }

  function center(hex) {
    return axialToPixel(hex.q, hex.r, size.value)
  }

  return {
    size,
    allHexes,
    hexById,
    discoveredSet,
    current,
    visibleHexes,
    fogHexes,
    viewBox,
    viewBoxObject,
    fogMaskOpts,
    center,
  }
}
