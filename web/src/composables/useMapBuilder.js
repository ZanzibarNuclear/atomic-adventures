import { axialToPixel } from './useHexGeometry.js'
import { resolveWaypoint } from './useRoutes.js'
import {
  landmarkAnchor,
  resolveAvatarPosition,
  DEFAULT_BESIDE_LANDMARK,
  hasLandmarkMarker,
} from './useAvatarStand.js'

const LINE_KINDS = new Set(['river', 'road', 'drive', 'fence', 'path', 'trail'])

function round2(n) {
  return Math.round(n * 100) / 100
}

function roundInt(n) {
  return Math.round(n)
}

/** Hexes with a landmark icon and/or standAt — editable placements. */
export function listEditablePlacements(hexes) {
  return (hexes ?? [])
    .filter((h) => hasLandmarkMarker(h) || h.standAt || h.landmark?.name)
    .map((h) => ({
      source: 'hexes',
      id: h.id,
      kind: 'placement',
      label: h.landmark?.name ?? h.id,
    }))
}

export function findEditablePlacement(hexes, id) {
  return hexes?.find((h) => h.id === id) ?? null
}

/** Draggable handles for building icon + player stand on a hex. */
export function resolvedPlacementHandles(hex, size) {
  if (!hex) return []
  const handles = []
  if (hasLandmarkMarker(hex)) {
    const p = landmarkAnchor(hex, size)
    handles.push({ role: 'landmark', x: p.x, y: p.y })
  }
  if (
    hasLandmarkMarker(hex) ||
    hex.standAt ||
    hex.landmark?.name
  ) {
    const p = resolveAvatarPosition(hex, size)
    handles.push({ role: 'stand', x: p.x, y: p.y })
  }
  return handles
}

export function setLandmarkWorld(hex, x, y, size) {
  if (!hex.landmark) hex.landmark = {}
  const c = axialToPixel(hex.q, hex.r, size)
  hex.landmark.dx = round2((x - c.x) / size)
  hex.landmark.dy = round2((y - c.y) / size)
}

export function setStandWorld(hex, x, y, size) {
  const c = axialToPixel(hex.q, hex.r, size)
  const stand = hex.standAt

  if (stand?.from !== 'landmark' && stand?.x != null && stand?.y != null) {
    hex.standAt = { x: roundInt(x), y: roundInt(y) }
    return
  }

  if (hasLandmarkMarker(hex)) {
    const anchor = landmarkAnchor(hex, size)
    hex.standAt = {
      from: 'landmark',
      dx: round2((x - anchor.x) / size),
      dy: round2((y - anchor.y) / size),
    }
    return
  }

  hex.standAt = {
    dx: round2((x - c.x) / size),
    dy: round2((y - c.y) / size),
  }
}

export function ensureDefaultStandAt(hex) {
  if (hex.standAt || !hasLandmarkMarker(hex)) return
  hex.standAt = {
    from: 'landmark',
    dx: DEFAULT_BESIDE_LANDMARK.dx,
    dy: DEFAULT_BESIDE_LANDMARK.dy,
  }
}

/** Lines with a points array — editable in the map builder. */
export function listEditableLines(routes, features) {
  const items = []
  for (const r of routes ?? []) {
    if (!r.points?.length) continue
    items.push({
      source: 'routes',
      id: r.id,
      kind: r.kind,
      label: r.name ? `${r.name} (${r.id})` : r.id,
    })
  }
  for (const f of features ?? []) {
    if (!f.points?.length) continue
    items.push({
      source: 'features',
      id: f.id,
      kind: f.kind,
      label: f.id,
    })
  }
  return items
}

export function findEditableLine(routes, features, source, id) {
  const list = source === 'routes' ? routes : features
  return list?.find((l) => l.id === id) ?? null
}

/** Resolved pixel positions for waypoint handles. */
export function resolvedWaypoints(line, hexById, size) {
  return (line?.points ?? []).map((wp, index) => ({
    index,
    ...resolveWaypoint(wp, hexById, size),
  }))
}

/** Update a waypoint after dragging; preserve hex-anchored vs raw coords. */
export function setWaypointWorld(line, pointIndex, x, y, hexById, size) {
  const wp = line.points[pointIndex]
  if (!wp) return
  if (wp.hex !== undefined) {
    const h = hexById[wp.hex]
    if (h) {
      const c = axialToPixel(h.q, h.r, size)
      wp.dx = round2((x - c.x) / size)
      wp.dy = round2((y - c.y) / size)
      delete wp.x
      delete wp.y
      return
    }
  }
  wp.x = roundInt(x)
  wp.y = roundInt(y)
  delete wp.hex
  delete wp.dx
  delete wp.dy
}

export function addWaypoint(line, x, y) {
  const pt = { x: roundInt(x), y: roundInt(y) }
  line.points.push(pt)
  return line.points.length - 1
}

export function removeWaypoint(line, pointIndex) {
  if (!line?.points || line.points.length <= 2) return false
  line.points.splice(pointIndex, 1)
  return true
}

function fmtWaypoint(wp) {
  if (wp.hex !== undefined) {
    const parts = [`hex: ${wp.hex}`]
    if (wp.dx !== undefined && wp.dx !== 0) parts.push(`dx: ${round2(wp.dx)}`)
    if (wp.dy !== undefined && wp.dy !== 0) parts.push(`dy: ${round2(wp.dy)}`)
    return `{ ${parts.join(', ')} }`
  }
  return `{ x: ${roundInt(wp.x)}, y: ${roundInt(wp.y)} }`
}

function serializeLine(line, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}- id: ${line.id}`, `${inner}kind: ${line.kind}`]
  if (line.name) lines.push(`${inner}name: ${JSON.stringify(line.name)}`)
  if (line.smooth === false) lines.push(`${inner}smooth: false`)
  else if (line.smooth) lines.push(`${inner}smooth: true`)
  if (line.flow) lines.push(`${inner}flow: ${line.flow}`)
  lines.push(`${inner}points:`)
  for (const p of line.points ?? []) {
    lines.push(`${inner}  - ${fmtWaypoint(p)}`)
  }
  return lines.join('\n')
}

function serializeGate(feature, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [
    `${pad}- id: ${feature.id}`,
    `${inner}kind: gate`,
    `${inner}hex: ${feature.hex}`,
    `${inner}at: { x: ${roundInt(feature.at.x)}, y: ${roundInt(feature.at.y)} }`,
  ]
  if (feature.labelAt) {
    lines.push(
      `${inner}labelAt: { x: ${roundInt(feature.labelAt.x)}, y: ${roundInt(feature.labelAt.y)} }`,
    )
  }
  if (feature.name) lines.push(`${inner}name: ${feature.name}`)
  return lines.join('\n')
}

function serializeFeature(feature, indent) {
  if (feature.kind === 'gate') return serializeGate(feature, indent)
  if (!feature.points?.length) return null
  return serializeLine(feature, indent)
}

function fmtStandAt(stand) {
  if (stand.from === 'landmark') {
    const parts = ['from: landmark']
    if (stand.dx !== undefined && stand.dx !== 0) parts.push(`dx: ${round2(stand.dx)}`)
    if (stand.dy !== undefined && stand.dy !== 0) parts.push(`dy: ${round2(stand.dy)}`)
    return `{ ${parts.join(', ')} }`
  }
  if (stand.x != null && stand.y != null) {
    return `{ x: ${roundInt(stand.x)}, y: ${roundInt(stand.y)} }`
  }
  const parts = []
  if (stand.dx !== undefined && stand.dx !== 0) parts.push(`dx: ${round2(stand.dx)}`)
  if (stand.dy !== undefined && stand.dy !== 0) parts.push(`dy: ${round2(stand.dy)}`)
  return `{ ${parts.join(', ')} }`
}

function serializeHexBlock(hex, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [
    `${pad}- id: ${hex.id}`,
    `${inner}q: ${hex.q}`,
    `${inner}r: ${hex.r}`,
    `${inner}terrain: ${hex.terrain}`,
  ]
  if (hex.area) lines.push(`${inner}area: ${hex.area}`)
  if (hex.cascade) lines.push(`${inner}cascade: true`)
  if (hex.puzzle) lines.push(`${inner}puzzle: ${hex.puzzle}`)
  if (hex.standAt) lines.push(`${inner}standAt: ${fmtStandAt(hex.standAt)}`)
  if (hex.landmark) {
    lines.push(`${inner}landmark:`)
    const lm = hex.landmark
    if (lm.building) lines.push(`${inner}  building: ${lm.building}`)
    if (lm.icon) lines.push(`${inner}  icon: ${JSON.stringify(lm.icon)}`)
    if (lm.name) lines.push(`${inner}  name: ${JSON.stringify(lm.name)}`)
    if (lm.dx !== undefined && lm.dx !== 0) lines.push(`${inner}  dx: ${round2(lm.dx)}`)
    if (lm.dy !== undefined && lm.dy !== 0) lines.push(`${inner}  dy: ${round2(lm.dy)}`)
    if (lm.blurb) lines.push(`${inner}  blurb: ${JSON.stringify(lm.blurb)}`)
  }
  return lines.join('\n')
}

function fmtLandmarkInline(lm) {
  const parts = []
  if (lm.building) parts.push(`building: ${lm.building}`)
  if (lm.icon) parts.push(`icon: ${JSON.stringify(lm.icon)}`)
  if (lm.name) parts.push(`name: ${JSON.stringify(lm.name)}`)
  if (lm.dx !== undefined && lm.dx !== 0) parts.push(`dx: ${round2(lm.dx)}`)
  if (lm.dy !== undefined && lm.dy !== 0) parts.push(`dy: ${round2(lm.dy)}`)
  return parts.join(', ')
}

/** Serialize one hex entry for map.yaml export. */
export function serializeHex(hex, indent = 2) {
  const pad = ' '.repeat(indent)
  const simple =
    !hex.standAt &&
    !hex.area &&
    !hex.cascade &&
    !hex.puzzle &&
    !hex.landmark
  if (simple) {
    return `${pad}- { id: ${hex.id}, q: ${hex.q}, r: ${hex.r}, terrain: ${hex.terrain} }`
  }
  const lm = hex.landmark
  if (
    lm &&
    !hex.standAt &&
    !hex.area &&
    !hex.cascade &&
    !hex.puzzle &&
    !lm.blurb
  ) {
    return `${pad}- { id: ${hex.id}, q: ${hex.q}, r: ${hex.r}, terrain: ${hex.terrain}, landmark: { ${fmtLandmarkInline(lm)} } }`
  }
  return serializeHexBlock(hex, indent)
}

/** YAML snippets ready to paste into map.yaml. */
export function exportMapYaml(routes, features, hexes) {
  const hexBlocks = (hexes ?? []).map((h) => serializeHex(h, 2))
  const featureBlocks = (features ?? [])
    .map((f) => serializeFeature(f, 2))
    .filter(Boolean)
  const routeBlocks = (routes ?? [])
    .filter((r) => r.points?.length)
    .map((r) => serializeLine(r, 2))

  const hexesYaml = hexBlocks.length ? `hexes:\n${hexBlocks.join('\n\n')}` : ''
  const featuresYaml = featureBlocks.length ? `features:\n${featureBlocks.join('\n\n')}` : ''
  const routesYaml = routeBlocks.length ? `routes:\n${routeBlocks.join('\n\n')}` : ''

  return {
    hexes: hexesYaml,
    features: featuresYaml,
    routes: routesYaml,
    both: [hexesYaml, featuresYaml, routesYaml].filter(Boolean).join('\n\n'),
  }
}

export function placementHandleColor(role) {
  return role === 'landmark' ? '#c792ea' : '#7dcea0'
}

export function lineKindColor(kind) {
  const colors = {
    river: '#4a90d9',
    road: '#8a8073',
    drive: '#9b917f',
    fence: '#c9b89a',
    path: '#7a4f2a',
    trail: '#c9b97e',
  }
  return colors[kind] ?? '#ffd166'
}

export { LINE_KINDS }
