import { computed } from 'vue'
import { buildRouteDrawPieces } from './useRoutes.js'
import { riverSegments, barrierSegments } from './useTravelBarriers.js'
import { resolveAvatarPosition, hasLandmarkMarker } from './useAvatarStand.js'
import { buildForestTrees } from './forestTreePlacement.js'
import { buildRockyShrubScenery } from './rockyShrubPlacement.js'
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

function clamp01(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.max(0, Math.min(1, number))
}

function cascadeSampleIndexes(samples, cascade) {
  if (samples.length < 4) return []
  const from = clamp01(cascade?.from)
  const to = clamp01(cascade?.to)
  if (from == null || to == null || from === to) return []
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return [0.25, 0.5, 0.75]
    .map((t) => lo + (hi - lo) * t)
    .map((t) => Math.min(samples.length - 2, Math.max(1, Math.floor((samples.length - 1) * t))))
}

const FEATURE_DRAW_ORDER = {
  road: 0,
  drive: 0,
  path: 0,
  trail: 0,
  river: 1,
  cliff: 2,
  ravine: 2,
  fence: 3,
}

function featureDrawOrder(piece) {
  return FEATURE_DRAW_ORDER[piece.kind] ?? 1
}

export function sortFeatureDrawPieces(pieces) {
  return [...pieces].sort((a, b) => featureDrawOrder(a) - featureDrawOrder(b))
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
  passageStates,
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
      passageStates: passageStates?.value ?? passageStates ?? {},
    }),
  )

  function hexByIdFromMap() {
    return Object.fromEntries((mapData.value.hexes ?? []).map((h) => [h.id, h]))
  }

  const visiblePassageMarkersList = computed(() => {
    const { inView } = fogMaskOpts()
    return visiblePassageMarkers(passageMarkers.value, {
      mode: mode.value,
      builderView: builderView.value,
      discoveredHexes: discoveredSet.value,
      discoveredOpenings: discoveredOpenings?.value ?? discoveredOpenings ?? [],
      inView,
    })
  })

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
      return standOverride.value.standAt
    }
    return resolveAvatarPosition(hex, size.value)
  })

  const cascadeChevrons = computed(() => {
    const riverModels = featureModels.value.filter(
      (model) => model.kind === 'river' && model.samples?.length && model.cascades?.length,
    )
    if (!riverModels.length) return []
    const { isRevealed, inView } = fogMaskOpts()
    const out = []
    for (const river of riverModels) {
      for (const cascade of river.cascades ?? []) {
        for (const i of cascadeSampleIndexes(river.samples, cascade)) {
          const p = river.samples[i]
          if (!p?.hexId || !isRevealed(p.hexId) || !inView(p.hexId)) continue
          const prev = river.samples[i - 1]
          const next = river.samples[i + 1]
          out.push({
            key: `${river.id}-${cascade.id ?? 'cascade'}-${i}`,
            d: chevronPath(p.x, p.y, next.x - prev.x, next.y - prev.y),
          })
        }
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

  const rockyShrubs = computed(() =>
    buildRockyShrubScenery({
      visibleHexes: visibleHexes.value,
      routeModels: routeModels.value,
      featureModels: featureModels.value,
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
    const stub = mode.value !== 'full'
    return sortFeatureDrawPieces(
      buildRouteDrawPieces(linear, { isRevealed, inView, allowStub: stub }),
    )
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
    rockyShrubs,
    routePieces,
    featurePieces,
    legendTerrains,
    legendLines,
    legendPassages,
    hasLegend,
  }
}
