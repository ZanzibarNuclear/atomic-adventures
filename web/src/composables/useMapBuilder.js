import { axialToPixel } from './useHexGeometry.js'
import { resolveWaypoint } from './useRoutes.js'

const LINE_KINDS = new Set(['river', 'road', 'drive', 'fence', 'path', 'trail'])

function round2(n) {
  return Math.round(n * 100) / 100
}

function roundInt(n) {
  return Math.round(n)
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
  if (line.smooth) lines.push(`${inner}smooth: true`)
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

/** YAML snippets ready to paste into map.yaml. */
export function exportMapYaml(routes, features) {
  const featureBlocks = (features ?? [])
    .map((f) => serializeFeature(f, 2))
    .filter(Boolean)
  const routeBlocks = (routes ?? [])
    .filter((r) => r.points?.length)
    .map((r) => serializeLine(r, 2))

  return {
    features: featureBlocks.length ? `features:\n${featureBlocks.join('\n\n')}` : '',
    routes: routeBlocks.length ? `routes:\n${routeBlocks.join('\n\n')}` : '',
    both: [
      featureBlocks.length ? `features:\n${featureBlocks.join('\n\n')}` : '',
      routeBlocks.length ? `routes:\n${routeBlocks.join('\n\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  }
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
