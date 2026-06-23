import { hexLabel, landmarkLabel, routeLabel, displayLabel } from '../../displayLabel.js'
import { axialToPixel } from './useHexGeometry.js'
import { resolveWaypoint } from './useRoutes.js'
import {
  landmarkAnchor,
  resolveAvatarPosition,
  resolveStandPoint,
  normalizeStandEntries,
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

/** Hexes with a landmark icon and/or authored stands — editable placements. */
export function listEditablePlacements(hexes) {
  return (hexes ?? [])
    .filter((h) => hasLandmarkMarker(h) || h.stands?.length || h.landmark?.label)
    .map((h) => ({
      source: 'hexes',
      id: h.id,
      kind: 'placement',
      label: h.landmark ? landmarkLabel(h.landmark) : hexLabel(h),
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
  const stands = normalizeStandEntries(hex)
  if (stands.length) {
    for (const stand of stands) {
      const p = resolveStandPoint(hex, stand.at, size)
      if (p) {
        handles.push({
          role: 'stand',
          index: stand.index,
          standId: stand.id,
          x: p.x,
          y: p.y,
        })
      }
    }
  } else if (hasLandmarkMarker(hex) || hex.landmark?.label) {
    const p = resolveAvatarPosition(hex, size)
    handles.push({ role: 'stand', index: -1, standId: 'default', x: p.x, y: p.y })
  }
  return handles
}

export function setLandmarkWorld(hex, x, y, size) {
  if (!hex.landmark) hex.landmark = {}
  const c = axialToPixel(hex.q, hex.r, size)
  hex.landmark.dx = round2((x - c.x) / size)
  hex.landmark.dy = round2((y - c.y) / size)
}

export function setStandWorld(hex, x, y, size, index = -1) {
  const c = axialToPixel(hex.q, hex.r, size)
  const stand = index >= 0 ? hex.stands?.[index]?.at : hex.stands?.[0]?.at

  if (stand?.from !== 'landmark' && stand?.x != null && stand?.y != null) {
    setHexStandPoint(hex, { x: roundInt(x), y: roundInt(y) }, index)
    return
  }

  if (hasLandmarkMarker(hex)) {
    const anchor = landmarkAnchor(hex, size)
    setHexStandPoint(hex, {
      from: 'landmark',
      dx: round2((x - anchor.x) / size),
      dy: round2((y - anchor.y) / size),
    }, index)
    return
  }

  setHexStandPoint(hex, {
    dx: round2((x - c.x) / size),
    dy: round2((y - c.y) / size),
  }, index)
}

function setHexStandPoint(hex, at, index) {
  if (index >= 0 && hex.stands?.[index]) {
    hex.stands[index].at = at
  } else {
    hex.stands ??= []
    if (hex.stands[0]) hex.stands[0].at = at
    else hex.stands.push({ id: 'default', label: 'Default stand', at })
  }
}

export function ensureDefaultStandAt(hex) {
  if (hex.stands?.length || !hasLandmarkMarker(hex)) return
  hex.stands = [{
    id: 'default',
    label: 'Default stand',
    at: {
      from: 'landmark',
      dx: DEFAULT_BESIDE_LANDMARK.dx,
      dy: DEFAULT_BESIDE_LANDMARK.dy,
    },
  }]
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
      label: `${routeLabel(r)} (${r.id})`,
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
  if (line.label) lines.push(`${inner}label: ${JSON.stringify(line.label)}`)
  if (line.smooth === false) lines.push(`${inner}smooth: false`)
  else if (line.smooth) lines.push(`${inner}smooth: true`)
  if (line.flow) lines.push(`${inner}flow: ${line.flow}`)
  lines.push(`${inner}points:`)
  for (const p of line.points ?? []) {
    lines.push(`${inner}  - ${fmtWaypoint(p)}`)
  }
  if (line.kind === 'river' && line.cascades?.length) {
    lines.push(`${inner}cascades:`)
    for (const cascade of line.cascades) {
      const parts = []
      if (cascade.id) parts.push(`id: ${cascade.id}`)
      if (cascade.label) parts.push(`label: ${JSON.stringify(cascade.label)}`)
      parts.push(`from: ${round2(cascade.from ?? 0)}`)
      parts.push(`to: ${round2(cascade.to ?? 1)}`)
      lines.push(`${inner}  - { ${parts.join(', ')} }`)
    }
  }
  return lines.join('\n')
}

function serializeFlagRequirement(require, indent) {
  if (!require) return []
  const pad = ' '.repeat(indent)
  const lines = [`${pad}require:`]
  for (const key of ['all', 'any', 'not']) {
    if (require[key]?.length) {
      lines.push(`${pad}  ${key}: [${require[key].join(', ')}]`)
    }
  }
  return lines
}

function serializePassageAction(key, action, indent) {
  if (!action) return []
  const pad = ' '.repeat(indent)
  const lines = [`${pad}${key}:`]
  if (action.label) lines.push(`${pad}  label: ${JSON.stringify(action.label)}`)
  if (action.status) lines.push(`${pad}  status: ${JSON.stringify(action.status)}`)
  if (action.set_flags?.length) {
    lines.push(`${pad}  set_flags: [${action.set_flags.join(', ')}]`)
  }
  return lines
}

function serializePassage(feature, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [
    `${pad}- id: ${feature.id}`,
    `${inner}kind: ${feature.kind}`,
    `${inner}hex: ${feature.hex}`,
    `${inner}visibility: ${feature.visibility ?? 'obvious'}`,
    `${inner}at: ${fmtWaypoint(feature.at)}`,
  ]
  if (feature.labelAt) {
    lines.push(`${inner}labelAt: ${fmtWaypoint(feature.labelAt)}`)
  }
  if (feature.boothAt) lines.push(`${inner}boothAt: ${fmtWaypoint(feature.boothAt)}`)
  if (feature.radius != null) lines.push(`${inner}radius: ${feature.radius}`)
  if (feature.label) lines.push(`${inner}label: ${JSON.stringify(feature.label)}`)
  lines.push(...serializeFlagRequirement(feature.require, indent + 2))
  lines.push(...serializePassageAction('unlock', feature.unlock, indent + 2))
  lines.push(...serializePassageAction('on_cross', feature.on_cross, indent + 2))
  return lines.join('\n')
}

function serializeFeature(feature, indent) {
  if (feature.at && ['gate', 'hole', 'bridge', 'ford', 'stair'].includes(feature.kind)) {
    return serializePassage(feature, indent)
  }
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

function serializeStand(stand, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)
  const lines = [`${pad}- id: ${stand.id}`]
  if (stand.label) lines.push(`${inner}label: ${JSON.stringify(stand.label)}`)
  lines.push(`${inner}at: ${fmtStandAt(stand.at)}`)
  return lines.join('\n')
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
  if (hex.puzzle) lines.push(`${inner}puzzle: ${hex.puzzle}`)
  if (hex.stands?.length) {
    lines.push(`${inner}stands:`)
    for (const stand of hex.stands) lines.push(serializeStand(stand, indent + 4))
  }
  if (hex.landmark) {
    lines.push(`${inner}landmark:`)
    const lm = hex.landmark
    if (lm.building) lines.push(`${inner}  building: ${lm.building}`)
    if (lm.icon) lines.push(`${inner}  icon: ${JSON.stringify(lm.icon)}`)
    if (lm.label) lines.push(`${inner}  label: ${JSON.stringify(lm.label)}`)
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
  if (lm.label) parts.push(`label: ${JSON.stringify(lm.label)}`)
  if (lm.dx !== undefined && lm.dx !== 0) parts.push(`dx: ${round2(lm.dx)}`)
  if (lm.dy !== undefined && lm.dy !== 0) parts.push(`dy: ${round2(lm.dy)}`)
  return parts.join(', ')
}

/** Serialize one hex entry for world YAML export. */
export function serializeHex(hex, indent = 2) {
  const pad = ' '.repeat(indent)
  const simple =
    !hex.stands?.length &&
    !hex.puzzle &&
    !hex.landmark
  if (simple) {
    return `${pad}- { id: ${hex.id}, q: ${hex.q}, r: ${hex.r}, terrain: ${hex.terrain} }`
  }
  const lm = hex.landmark
  if (
    lm &&
    !hex.stands?.length &&
    !hex.puzzle &&
    !lm.blurb
  ) {
    return `${pad}- { id: ${hex.id}, q: ${hex.q}, r: ${hex.r}, terrain: ${hex.terrain}, landmark: { ${fmtLandmarkInline(lm)} } }`
  }
  return serializeHexBlock(hex, indent)
}

/** YAML snippets for world snapshot export. */
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
