import { computed } from 'vue'
import { buildRouteDrawPieces } from './useRoutes.js'
import { riverSegments, barrierSegments } from './useTravelBarriers.js'
import { resolveAvatarPosition, hasLandmarkMarker } from './useAvatarStand.js'
import { buildForestTrees } from './forestTreePlacement.js'
import {
  buildPassageMarkers,
  visiblePassageMarkers,
} from './useBarrierOpenings.js'
import {
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  TERRAIN_ORDER,
  LINE_STYLE,
  LINE_ORDER,
  PASSAGE_LABELS,
  PASSAGE_ORDER,
} from './hexMapPalette.js'

function chevronPath(x, y, dx, dy, scale = 1) {
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const s = 5.5 * scale
  const tipX = x + ux * s * 0.55
  const tipY = y + uy * s * 0.55
  const bx = x - ux * s * 0.25
  const by = y - uy * s * 0.25
  return `M ${bx - px * s * 0.45} ${by - py * s * 0.45} L ${tipX} ${tipY} L ${bx + px * s * 0.45} ${by + py * s * 0.45}`
}

/**
 * Screen-space placements for HexMap layers (terrain scatter, routes, avatar, legend).
 */
export function useHexMapPlacements({
  mapData,
  routeModels,
  featureModels,
  mode,
  builderView,
  standOverride,
  discoveredSet,
  discoveredOpenings,
  visibleHexes,
  fogMaskOpts,
  flags,
  size,
  center,
  current,
}) {
  const landmarkHexes = computed(() =>
    visibleHexes.value.filter((h) => hasLandmarkMarker(h)),
  )

  const passageMarkers = computed(() =>
    buildPassageMarkers(mapData.value.features ?? [], hexByIdFromMap(), size.value, {
      flags: flags?.value ?? flags ?? null,
      barriers: barrierSegments(featureModels.value ?? []),
    }),
  )

  function hexByIdFromMap() {
    return Object.fromEntries((mapData.value.hexes ?? []).map((h) => [h.id, h]))
  }

  const visiblePassageMarkersList = computed(() =>
    visiblePassageMarkers(passageMarkers.value, {
      mode: mode.value,
      builderView: builderView.value,
      discoveredHexes: discoveredSet.value,
      discoveredOpenings: discoveredOpenings?.value ?? discoveredOpenings ?? [],
    }),
  )

  // Legacy alias — gate-only consumers
  const gateMarkers = passageMarkers
  const visibleGateMarkers = visiblePassageMarkersList

  const avatarScale = computed(() => (size.value / 44) * 0.28)

  const rivers = computed(() => riverSegments(featureModels.value ?? []))

  const avatarPos = computed(() => {
    const hex = current.value
    if (
      hex &&
      standOverride.value?.hexId === hex.id &&
      standOverride.value?.standAt
    ) {
      return resolveAvatarPosition(
        { ...hex, standAt: standOverride.value.standAt },
        size.value,
      )
    }
    return resolveAvatarPosition(hex, size.value)
  })

  const cascadeChevrons = computed(() => {
    const cascadeIds = new Set(
      (mapData.value.hexes ?? []).filter((h) => h.cascade).map((h) => h.id),
    )
    if (!cascadeIds.size) return []
    const riverModels = featureModels.value.filter(
      (model) => model.kind === 'river' && model.samples?.length,
    )
    if (!riverModels.length) return []
    const isRevealed =
      mode.value === 'full' || builderView.value
        ? () => true
        : (id) => discoveredSet.value.has(id)
    const out = []
    for (const hexId of cascadeIds) {
      if (!isRevealed(hexId)) continue
      const river = riverModels.find((model) =>
        model.samples.some((sample) => sample.hexId === hexId),
      )
      if (!river) continue
      const pts = river.samples.filter((s) => s.hexId === hexId)
      if (pts.length < 4) continue
      const picks = [0.35, 0.55, 0.75].map((t) =>
        Math.min(pts.length - 2, Math.max(1, Math.floor(pts.length * t))),
      )
      for (const i of picks) {
        const p = pts[i]
        const prev = pts[i - 1]
        const next = pts[i + 1]
        out.push({
          key: `${hexId}-${i}`,
          d: chevronPath(p.x, p.y, next.x - prev.x, next.y - prev.y),
        })
      }
    }
    return out
  })

  const trees = computed(() =>
    buildForestTrees({
      visibleHexes: visibleHexes.value,
      routeModels: routeModels.value,
      featureModels: featureModels.value,
      mapFeatures: mapData.value.features,
      hexById: hexByIdFromMap(),
      size: size.value,
      center,
    }),
  )

  const routePieces = computed(() => {
    const { isRevealed, inView } = fogMaskOpts()
    const featureIds = new Set(
      (mapData.value.features ?? []).map((f) => f.id),
    )
    const drawableRoutes = routeModels.value.filter(
      (m) => !featureIds.has(m.id),
    )
    return buildRouteDrawPieces(drawableRoutes, {
      isRevealed,
      inView,
      allowStub: mode.value !== 'full',
    })
  })

  const featurePieces = computed(() => {
    const { isRevealed, inView } = fogMaskOpts()
    const linear = featureModels.value.filter(
      (m) => !['gate', 'hole', 'bridge', 'ford'].includes(m.kind),
    )
    const roadish = linear.filter((m) => m.kind === 'road' || m.kind === 'drive')
    const other = linear.filter((m) => m.kind !== 'road' && m.kind !== 'drive')
    const stub = mode.value !== 'full'
    return [
      ...buildRouteDrawPieces(roadish, { isRevealed, inView, allowStub: stub }),
      ...buildRouteDrawPieces(other, { isRevealed, inView, allowStub: false }),
    ]
  })

  const legendTerrains = computed(() => {
    const present = new Set(visibleHexes.value.map((h) => h.terrain))
    return TERRAIN_ORDER.filter((t) => present.has(t)).map((t) => ({
      key: t,
      color: TERRAIN_COLORS[t] ?? '#888',
      label: TERRAIN_LABELS[t] ?? t,
    }))
  })

  const legendLines = computed(() => {
    const kinds = new Set()
    for (const p of featurePieces.value) kinds.add(p.kind)
    for (const p of routePieces.value) kinds.add(p.kind)
    return LINE_ORDER.filter((k) => kinds.has(k) && LINE_STYLE[k]).map((k) => ({
      key: k,
      ...LINE_STYLE[k],
    }))
  })

  const legendPassages = computed(() => {
    const kinds = new Set(visiblePassageMarkersList.value.map((m) => m.kind))
    return PASSAGE_ORDER.filter((k) => kinds.has(k)).map((k) => ({
      key: k,
      kind: k,
      label: PASSAGE_LABELS[k] ?? k,
    }))
  })

  const hasLegend = computed(
    () =>
      legendTerrains.value.length > 0 ||
      legendLines.value.length > 0 ||
      legendPassages.value.length > 0,
  )

  return {
    landmarkHexes,
    gateMarkers,
    visibleGateMarkers,
    passageMarkers,
    visiblePassageMarkers: visiblePassageMarkersList,
    avatarScale,
    avatarPos,
    cascadeChevrons,
    trees,
    routePieces,
    featurePieces,
    legendTerrains,
    legendLines,
    legendPassages,
    hasLegend,
  }
}
