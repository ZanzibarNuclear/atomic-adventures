import { computed } from 'vue'
import { axialToPixel, boundsOf, neighborsOf } from './useHexGeometry.js'

/**
 * Hexes in the 1-ring around the current position (slice view).
 * Returns all map hexes at current + axial neighbors, regardless of discovery.
 */
export function sliceRingHexes(allHexes, currentHex, currentHexId) {
  const coordMap = new Map(allHexes.map((h) => [`${h.q},${h.r}`, h]))
  const origin = currentHex ?? { q: 0, r: 0 }
  const ringHexes = []
  const ringIds = new Set()

  const add = (hex) => {
    if (!hex || ringIds.has(hex.id)) return
    ringIds.add(hex.id)
    ringHexes.push(hex)
  }

  if (currentHexId) {
    add(allHexes.find((h) => h.id === currentHexId))
  }

  for (const n of neighborsOf(origin)) {
    add(coordMap.get(`${n.q},${n.r}`))
  }

  return { ringIds, ringHexes }
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
}) {
  const size = computed(() => mapData.value.size ?? 44)
  const allHexes = computed(() => mapData.value.hexes ?? [])
  const hexById = computed(() =>
    Object.fromEntries(allHexes.value.map((h) => [h.id, h])),
  )
  const discoveredSet = computed(() => new Set(discovered.value))
  const current = computed(() => hexById.value[currentHex.value])

  const sliceRing = computed(() => {
    if (mode.value !== 'slice' || builderView.value) {
      return { ringIds: new Set(), ringHexes: [] }
    }
    return sliceRingHexes(
      allHexes.value,
      current.value,
      currentHex.value,
    )
  })

  const visibleHexes = computed(() => {
    const standingOn = currentHex.value
    const revealed = discoveredSet.value
    const isVisible = (hex) => revealed.has(hex.id) || hex.id === standingOn

    if (builderView.value) return allHexes.value
    if (mode.value === 'full') return allHexes.value
    if (mode.value === 'slice') {
      return sliceRing.value.ringHexes.filter(isVisible)
    }
    return allHexes.value.filter(isVisible)
  })

  const fogHexes = computed(() => {
    if (builderView.value) return []

    const standingOn = currentHex.value
    const revealed = discoveredSet.value

    if (mode.value === 'slice') {
      return sliceRing.value.ringHexes.filter(
        (h) => !revealed.has(h.id) && h.id !== standingOn,
      )
    }

    if (mode.value !== 'explored') return []

    const edge = new Map()
    for (const h of visibleHexes.value) {
      for (const n of neighborsOf(h)) {
        const found = allHexes.value.find((x) => x.q === n.q && x.r === n.r)
        if (
          found &&
          !revealed.has(found.id) &&
          found.id !== standingOn
        ) {
          edge.set(found.id, found)
        }
      }
    }
    return [...edge.values()]
  })

  const viewBox = computed(() => {
    const forBounds = builderView.value
      ? allHexes.value
      : [...visibleHexes.value, ...fogHexes.value]
    if (forBounds.length === 0) return '0 0 100 100'
    const b = boundsOf(forBounds, size.value)
    return `${b.x} ${b.y} ${b.width} ${b.height}`
  })

  function fogMaskOpts() {
    if (builderView.value) {
      return { isRevealed: () => true, inView: () => true }
    }
    const standingOn = currentHex.value
    const revealed = discoveredSet.value
    const isRevealed =
      mode.value === 'full'
        ? () => true
        : (id) =>
            id != null && (revealed.has(id) || id === standingOn)
    const inView =
      mode.value === 'slice'
        ? (id) => sliceRing.value.ringIds.has(id)
        : () => true
    return { isRevealed, inView }
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
    fogMaskOpts,
    center,
  }
}
