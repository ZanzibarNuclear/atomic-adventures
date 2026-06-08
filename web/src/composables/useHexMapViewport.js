import { computed } from 'vue'
import { axialToPixel, boundsOf, neighborsOf } from './useHexGeometry.js'

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

  const visibleHexes = computed(() => {
    if (builderView.value) return allHexes.value
    if (mode.value === 'full') return allHexes.value
    if (mode.value === 'slice') {
      const ids = new Set([
        currentHex.value,
        ...neighborsOf(current.value ?? { q: 0, r: 0 }).map((n) => {
          const f = allHexes.value.find((h) => h.q === n.q && h.r === n.r)
          return f?.id
        }),
      ])
      return allHexes.value.filter(
        (h) => discoveredSet.value.has(h.id) && ids.has(h.id),
      )
    }
    return allHexes.value.filter((h) => discoveredSet.value.has(h.id))
  })

  const fogHexes = computed(() => {
    if (builderView.value || mode.value !== 'explored') return []
    const edge = new Map()
    for (const h of visibleHexes.value) {
      for (const n of neighborsOf(h)) {
        const found = allHexes.value.find((x) => x.q === n.q && x.r === n.r)
        if (found && !discoveredSet.value.has(found.id)) edge.set(found.id, found)
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
    const visibleIds = new Set(visibleHexes.value.map((h) => h.id))
    const isRevealed =
      mode.value === 'full'
        ? () => true
        : (id) => id != null && discoveredSet.value.has(id)
    const inView =
      mode.value === 'slice' ? (id) => visibleIds.has(id) : () => true
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
