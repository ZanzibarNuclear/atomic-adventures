import { computed } from 'vue'
import { buildRouteDrawPieces } from './useRoutes.js'
import { resolveAvatarPosition, hasLandmarkMarker } from './useAvatarStand.js'
import {
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  TERRAIN_ORDER,
  LINE_STYLE,
  LINE_ORDER,
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

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
  visibleHexes,
  fogMaskOpts,
  size,
  center,
  current,
}) {
  const landmarkHexes = computed(() =>
    visibleHexes.value.filter((h) => hasLandmarkMarker(h)),
  )

  const gateMarkers = computed(() =>
    (mapData.value.features ?? [])
      .filter((f) => f.kind === 'gate' && f.at)
      .map((f) => ({
        id: f.id,
        hex: f.hex ?? null,
        x: f.at.x,
        y: f.at.y,
        labelX: f.labelAt?.x ?? f.at.x,
        labelY: f.labelAt?.y ?? f.at.y + 12,
        name: f.name ?? 'Gate',
      })),
  )

  const visibleGateMarkers = computed(() => {
    if (mode.value === 'full' || builderView.value) return gateMarkers.value
    return gateMarkers.value.filter(
      (g) => !g.hex || discoveredSet.value.has(g.hex),
    )
  })

  const avatarScale = computed(() => (size.value / 44) * 0.28)

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
    const river = featureModels.value.find((m) => m.id === 'mountain-river')
    if (!river?.samples?.length) return []
    const isRevealed =
      mode.value === 'full' || builderView.value
        ? () => true
        : (id) => discoveredSet.value.has(id)
    const out = []
    for (const hexId of cascadeIds) {
      if (!isRevealed(hexId)) continue
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

  const trees = computed(() => {
    const out = []
    const s = size.value
    for (const hex of visibleHexes.value) {
      if (hex.terrain !== 'forest') continue
      const rng = mulberry32(hashStr(hex.id))
      const c = center(hex)
      const n = 3 + Math.floor(rng() * 3)
      for (let i = 0; i < n; i++) {
        const ang = rng() * Math.PI * 2
        const rad = rng() * 0.55 * s
        out.push({
          key: hex.id + '-' + i,
          x: c.x + Math.cos(ang) * rad,
          y: c.y + Math.sin(ang) * rad * 0.85,
          scale: (0.7 + rng() * 0.5) * (s / 44),
        })
      }
    }
    return out.sort((a, b) => a.y - b.y)
  })

  const routePieces = computed(() => {
    const { isRevealed, inView } = fogMaskOpts()
    return buildRouteDrawPieces(routeModels.value, {
      isRevealed,
      inView,
      allowStub: mode.value !== 'full',
    })
  })

  const featurePieces = computed(() => {
    const { isRevealed, inView } = fogMaskOpts()
    const linear = featureModels.value.filter((m) => m.kind !== 'gate')
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

  const hasLegend = computed(
    () => legendTerrains.value.length > 0 || legendLines.value.length > 0,
  )

  return {
    landmarkHexes,
    gateMarkers,
    visibleGateMarkers,
    avatarScale,
    avatarPos,
    cascadeChevrons,
    trees,
    routePieces,
    featurePieces,
    legendTerrains,
    legendLines,
    hasLegend,
  }
}
