<script setup>
import { computed, ref, onUnmounted } from 'vue'
import {
  axialToPixel,
  hexCornerPoints,
  boundsOf,
  neighborsOf,
} from '../composables/useHexGeometry.js'
import { buildRouteDrawPieces, pointsAttr } from '../composables/useRoutes.js'
import { lineKindColor, placementHandleColor } from '../composables/useMapBuilder.js'
import { resolveAvatarPosition, hasLandmarkMarker } from '../composables/useAvatarStand.js'
import UtilityStationLandmark from './UtilityStationLandmark.vue'

const props = defineProps({
  mapData: { type: Object, required: true },
  routeModels: { type: Array, default: () => [] },
  featureModels: { type: Array, default: () => [] },
  currentHex: { type: String, required: true },
  discovered: { type: [Array, Object], default: () => [] },
  mode: { type: String, default: 'explored' }, // slice | explored | full
  expanded: { type: Boolean, default: false },
  builderView: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  editMode: { type: String, default: null }, // 'line' | 'placement'
  editHandles: { type: Array, default: () => [] },
  editKind: { type: String, default: 'path' },
  selectedHandleId: { type: String, default: null },
  addPointMode: { type: Boolean, default: false },
  standOverride: { type: Object, default: null }, // { hexId, standAt }
})

const emit = defineEmits(['hex-click', 'select-handle', 'waypoint-move', 'builder-map-click', 'building-enter'])

const svgRef = ref(null)
const dragHandle = ref(null)

function svgCoords(clientX, clientY) {
  const svg = svgRef.value
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const local = pt.matrixTransform(ctm.inverse())
  return { x: local.x, y: local.y }
}

function onHandleDown(e, h) {
  e.stopPropagation()
  e.preventDefault()
  dragHandle.value = h
  emit('select-handle', h.handleKey)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!dragHandle.value) return
  const pt = svgCoords(e.clientX, e.clientY)
  if (!pt) return
  const h = dragHandle.value
  emit('waypoint-move', {
    handleKey: h.handleKey,
    index: h.index,
    role: h.role,
    x: pt.x,
    y: pt.y,
  })
}

function onPointerUp() {
  dragHandle.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

onUnmounted(onPointerUp)

function onSvgClick(e) {
  if (!props.builderEdit || !props.addPointMode) return
  if (e.target.closest('.edit-handle')) return
  const pt = svgCoords(e.clientX, e.clientY)
  if (!pt) return
  emit('builder-map-click', pt)
}

function onHexClick(hexId) {
  if (props.addPointMode) return
  emit('hex-click', hexId)
}

function onBuildingClick(hex) {
  if (props.builderEdit || props.addPointMode) return
  if (props.currentHex !== hex.id) return
  if (hex.landmark?.building !== 'utility-station' && hex.area !== 'utility') return
  emit('building-enter', hex.id)
}

const editPolyline = computed(() => {
  if (props.editMode !== 'line') return []
  return props.editHandles.map((h) => ({ x: h.x, y: h.y }))
})
const editStroke = computed(() => lineKindColor(props.editKind))

const placementLink = computed(() => {
  if (props.editMode !== 'placement') return null
  const lm = props.editHandles.find((h) => h.role === 'landmark')
  const st = props.editHandles.find((h) => h.role === 'stand')
  if (!lm || !st) return null
  return [lm, st]
})

function handleColor(h) {
  if (h.role) return placementHandleColor(h.role)
  return lineKindColor(props.editKind)
}

function handleFill(h) {
  if (h.handleKey === props.selectedHandleId) return '#fff'
  if (h.role === 'landmark') return '#e8d4ff'
  if (h.role === 'stand') return '#d4f5e2'
  return '#ffd166'
}

// Pine-mountainside palette.
const TERRAIN_COLORS = {
  forest: '#4f7e57',
  clearing: '#8fae6e',
  rock: '#9a9d94',
  water: '#5f93c4',
}
const FOG_COLOR = '#222a25'

// Legend copy + line swatch styling, keyed to the terrain palette and the
// feature/route CSS below. Order here also sets the legend's row order.
const TERRAIN_LABELS = {
  forest: 'Forest',
  clearing: 'Clearing',
  rock: 'Rocks',
  water: 'Water',
}
const TERRAIN_ORDER = ['forest', 'clearing', 'rock', 'water']
const LINE_STYLE = {
  river: { label: 'River', stroke: '#4a90d9', width: 4, dash: '' },
  road: { label: 'Road', stroke: '#8a8073', width: 5, dash: '' },
  drive: { label: 'Driveway', stroke: '#9b917f', width: 4, dash: '' },
  fence: { label: 'Fence', stroke: '#c9b89a', width: 3, dash: '2 6' },
  path: { label: 'Trail', stroke: '#7a4f2a', width: 3, dash: '3 4' },
  trail: { label: 'Trail', stroke: '#c9b97e', width: 3, dash: '2 5' },
}
const LINE_ORDER = ['river', 'road', 'drive', 'fence', 'path', 'trail']

const size = computed(() => props.mapData.size ?? 44)
const allHexes = computed(() => props.mapData.hexes ?? [])
const hexById = computed(() =>
  Object.fromEntries(allHexes.value.map((h) => [h.id, h])),
)
const discoveredSet = computed(() => new Set(props.discovered))
const current = computed(() => hexById.value[props.currentHex])

const visibleHexes = computed(() => {
  if (props.builderView) return allHexes.value
  if (props.mode === 'full') return allHexes.value
  if (props.mode === 'slice') {
    const ids = new Set([
      props.currentHex,
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
  if (props.builderView || props.mode !== 'explored') return []
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
  const forBounds = props.builderView
    ? allHexes.value
    : [...visibleHexes.value, ...fogHexes.value]
  if (forBounds.length === 0) return '0 0 100 100'
  const b = boundsOf(forBounds, size.value)
  return `${b.x} ${b.y} ${b.width} ${b.height}`
})

const landmarkHexes = computed(() => visibleHexes.value.filter((h) => hasLandmarkMarker(h)))

function fogMaskOpts() {
  if (props.builderView) {
    return { isRevealed: () => true, inView: () => true }
  }
  const visibleIds = new Set(visibleHexes.value.map((h) => h.id))
  const isRevealed =
    props.mode === 'full' ? () => true : (id) => id != null && discoveredSet.value.has(id)
  const inView = props.mode === 'slice' ? (id) => visibleIds.has(id) : () => true
  return { isRevealed, inView }
}

const gateMarkers = computed(() =>
  (props.mapData.features ?? [])
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
  if (props.mode === 'full' || props.builderView) return gateMarkers.value
  return gateMarkers.value.filter(
    (g) => !g.hex || discoveredSet.value.has(g.hex),
  )
})

function center(hex) {
  return axialToPixel(hex.q, hex.r, size.value)
}
// Small figure (~1/4 the old size). On a landmark hex, stand beside the
// building rather than on top of it — see useAvatarStand.js.
const avatarScale = computed(() => (size.value / 44) * 0.28)
const avatarPos = computed(() => {
  const hex = current.value
  if (
    hex &&
    props.standOverride?.hexId === hex.id &&
    props.standOverride?.standAt
  ) {
    return resolveAvatarPosition({ ...hex, standAt: props.standOverride.standAt }, size.value)
  }
  return resolveAvatarPosition(hex, size.value)
})

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

// Flow-direction chevrons on discovered cascade hexes, drawn above the river stroke.
const cascadeChevrons = computed(() => {
  const cascadeIds = new Set(
    (props.mapData.hexes ?? []).filter((h) => h.cascade).map((h) => h.id),
  )
  if (!cascadeIds.size) return []
  const river = props.featureModels.find((m) => m.id === 'mountain-river')
  if (!river?.samples?.length) return []
  const isRevealed =
    props.mode === 'full' || props.builderView
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

function fill(hex) {
  return TERRAIN_COLORS[hex.terrain] ?? '#888'
}

// --- Seeded scatter of pine trees on forest hexes ---
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
  return buildRouteDrawPieces(props.routeModels, {
    isRevealed,
    inView,
    allowStub: props.mode !== 'full',
  })
})

// Geographic features — fog-masked; road/drive may stub into adjacent fog like trails.
const featurePieces = computed(() => {
  const { isRevealed, inView } = fogMaskOpts()
  const linear = props.featureModels.filter((m) => m.kind !== 'gate')
  const roadish = linear.filter((m) => m.kind === 'road' || m.kind === 'drive')
  const other = linear.filter((m) => m.kind !== 'road' && m.kind !== 'drive')
  const stub = props.mode !== 'full'
  return [
    ...buildRouteDrawPieces(roadish, { isRevealed, inView, allowStub: stub }),
    ...buildRouteDrawPieces(other, { isRevealed, inView, allowStub: false }),
  ]
})

// --- Legend: only list what's actually on screen right now ---
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
</script>

<template>
  <div class="hexmap" :class="{ expanded, 'builder-edit': builderEdit, 'add-point': addPointMode }">
    <svg
      ref="svgRef"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      @click="onSvgClick"
    >
      <!-- Fog edge hints -->
      <g class="fog-layer">
        <g
          v-for="hex in fogHexes"
          :key="'fog-' + hex.id"
          class="hex fog"
          @click="onHexClick(hex.id)"
        >
          <polygon
            :points="hexCornerPoints(center(hex).x, center(hex).y, size)"
            :fill="FOG_COLOR"
          />
          <text :x="center(hex).x" :y="center(hex).y + 6" class="fog-mark">?</text>
        </g>
      </g>

      <!-- Terrain -->
      <g class="terrain-layer">
        <g
          v-for="hex in visibleHexes"
          :key="hex.id"
          class="hex"
          :class="{
            current: hex.id === currentHex,
            'builder-unseen': builderView && !discoveredSet.has(hex.id),
          }"
          @click="onHexClick(hex.id)"
        >
          <polygon
            :points="hexCornerPoints(center(hex).x, center(hex).y, size)"
            :fill="fill(hex)"
            class="tile"
          />
        </g>
      </g>

      <!-- Scattered pines -->
      <g class="tree-layer">
        <g
          v-for="t in trees"
          :key="t.key"
          :transform="`translate(${t.x},${t.y}) scale(${t.scale})`"
        >
          <rect x="-1.4" y="-3" width="2.8" height="6" fill="#5b4329" />
          <polygon points="-7,-2 7,-2 0,-13" fill="#2f5e3a" />
          <polygon points="-5,-9 5,-9 0,-19" fill="#356c43" />
        </g>
      </g>

      <!-- Geographic features: river, fence, road (fog-masked) -->
      <g class="feature-layer">
        <polyline
          v-for="(piece, i) in featurePieces"
          :key="'feat-' + i"
          :points="pointsAttr(piece.points)"
          class="feature"
          :class="['feature-' + piece.kind, { stub: piece.partial }]"
        />
      </g>

      <!-- Cascade chevrons on top of the river (hydro intake at utility-yard) -->
      <g class="cascade-layer">
        <path
          v-for="c in cascadeChevrons"
          :key="c.key"
          :d="c.d"
          class="cascade-chevron"
        />
      </g>

      <!-- Guard booth west of the road; "Gate" label below the fence -->
      <g class="gate-layer">
        <g v-for="g in visibleGateMarkers" :key="'gate-' + g.id" class="gate">
          <g class="gate-booth" :transform="`translate(${g.x}, ${g.y})`">
            <rect x="-6.5" y="-8" width="13" height="8" rx="1" class="gate-wall" />
            <polygon points="-7.5,-8 7.5,-8 0,-11.5" class="gate-roof" />
            <rect x="-2.5" y="-6" width="5" height="3.5" rx="0.4" class="gate-window" />
          </g>
          <text :x="g.labelX" :y="g.labelY" class="gate-label">{{ g.name }}</text>
        </g>
      </g>

      <!-- The trail -->
      <g class="routes-layer">
        <polyline
          v-for="(piece, i) in routePieces"
          :key="'piece-' + i"
          :points="pointsAttr(piece.points)"
          class="route"
          :class="['route-' + piece.kind, { stub: piece.partial }]"
        />
      </g>

      <!-- Landmarks -->
      <g class="landmark-layer">
        <g v-for="hex in landmarkHexes" :key="'lm-' + hex.id" class="landmark">
          <g
            v-if="hex.landmark.building === 'utility-station'"
            class="building-enter"
            :class="{ 'can-enter': hex.id === currentHex && !builderEdit }"
            :transform="`translate(${center(hex).x + (hex.landmark.dx ?? 0) * size}, ${center(hex).y + (hex.landmark.dy ?? 0) * size}) scale(1.08)`"
            @click.stop="onBuildingClick(hex)"
          >
            <UtilityStationLandmark />
          </g>
          <text
            v-else-if="hex.landmark.icon"
            :x="center(hex).x + (hex.landmark.dx ?? 0) * size"
            :y="center(hex).y + 2 + (hex.landmark.dy ?? 0) * size"
            class="landmark-icon"
          >
            {{ hex.landmark.icon }}
          </text>
          <text
            v-if="expanded"
            :x="center(hex).x + (hex.landmark.dx ?? 0) * size"
            :y="center(hex).y + size * 0.78"
            class="landmark-label"
          >
            {{ hex.landmark.name }}
          </text>
        </g>
      </g>

      <!-- Builder view: axial coords at every hex center -->
      <g v-if="builderView" class="builder-layer">
        <text
          v-for="hex in allHexes"
          :key="'coord-' + hex.id"
          :x="center(hex).x"
          :y="center(hex).y"
          class="builder-coord"
        >
          ({{ hex.q }}, {{ hex.r }})
        </text>
      </g>

      <!-- Oversized stick-figure avatar -->
      <g
        v-if="current"
        class="avatar"
        :style="{ transform: `translate(${avatarPos.x}px, ${avatarPos.y}px)` }"
      >
        <ellipse :cx="0" :cy="27 * avatarScale" :rx="13 * avatarScale" :ry="3.5 * avatarScale" class="avatar-shadow" />
        <g :transform="`scale(${avatarScale})`" class="figure">
          <circle cx="0" cy="-24" r="7.5" />
          <line x1="0" y1="-16.5" x2="0" y2="6" />
          <line x1="-13" y1="-6" x2="13" y2="-6" />
          <line x1="0" y1="6" x2="-10" y2="26" />
          <line x1="0" y1="6" x2="10" y2="26" />
        </g>
      </g>

      <!-- Builder edit: on top so handles stay grabbable -->
      <g v-if="builderEdit && editHandles.length" class="edit-layer">
        <polyline
          v-if="editMode === 'line'"
          :points="pointsAttr(editPolyline)"
          class="edit-guide"
          :style="{ stroke: editStroke }"
        />
        <line
          v-if="placementLink"
          :x1="placementLink[0].x"
          :y1="placementLink[0].y"
          :x2="placementLink[1].x"
          :y2="placementLink[1].y"
          class="placement-link"
        />
        <circle
          v-for="h in editHandles"
          :key="'handle-' + h.handleKey"
          :cx="h.x"
          :cy="h.y"
          :r="h.handleKey === selectedHandleId ? 7 : 5.5"
          class="edit-handle"
          :class="{
            selected: h.handleKey === selectedHandleId,
            ['role-' + h.role]: !!h.role,
          }"
          :style="{ stroke: handleColor(h), fill: handleFill(h) }"
          @pointerdown="onHandleDown($event, h)"
        />
      </g>
    </svg>

    <!-- Legend, lower-right. Reflects only what's currently on the map. -->
    <div v-if="expanded && hasLegend" class="legend" aria-label="Map legend">
      <div class="legend-title">Legend</div>
      <ul class="legend-items">
        <li v-for="t in legendTerrains" :key="'lt-' + t.key" class="legend-item">
          <span class="legend-swatch" :style="{ background: t.color }" />
          <span class="legend-label">{{ t.label }}</span>
        </li>
        <li v-for="l in legendLines" :key="'ll-' + l.key" class="legend-item">
          <svg class="legend-line" viewBox="0 0 22 8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              :stroke="l.stroke"
              :stroke-width="l.width"
              :stroke-dasharray="l.dash || undefined"
              stroke-linecap="round"
            />
          </svg>
          <span class="legend-label">{{ l.label }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.hexmap {
  position: relative;
  width: 220px;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 25%, #34433a, #1d241f);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  padding: 8px 11px;
  border-radius: 8px;
  background: rgba(20, 28, 22, 0.78);
  border: 1px solid rgba(143, 174, 110, 0.35);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  pointer-events: none;
}
.legend-title {
  margin-bottom: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b9c7ad;
}
.legend-items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 7px;
}
.legend-swatch {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.35);
  flex: 0 0 auto;
}
.legend-line {
  width: 18px;
  height: 8px;
  flex: 0 0 auto;
}
.legend-label {
  font-size: 11px;
  color: #eef2e6;
  white-space: nowrap;
}
.hexmap.expanded {
  width: 100%;
  height: 72vh;
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
.hex {
  cursor: pointer;
}
.tile {
  stroke: rgba(0, 0, 0, 0.3);
  stroke-width: 1.5;
  transition: fill 0.3s ease;
}
.hex.current .tile {
  stroke: #ffd166;
  stroke-width: 3.5;
}
.hex.builder-unseen .tile {
  opacity: 0.38;
}
.hex.fog {
  cursor: default;
}
.fog polygon {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}
.fog-mark {
  fill: rgba(255, 255, 255, 0.3);
  font-size: 22px;
  text-anchor: middle;
  font-weight: 700;
}
.tree-layer {
  pointer-events: none;
}
.cascade-layer {
  pointer-events: none;
}
.cascade-chevron {
  fill: none;
  stroke: #e8f4ff;
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  paint-order: stroke;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.45));
}
.feature {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.feature-river {
  stroke: #4a90d9;
  stroke-width: 5;
  opacity: 0.9;
}
.feature-fence {
  stroke: #c9b89a;
  stroke-width: 3;
  stroke-dasharray: 2 6;
}
.gate-layer {
  pointer-events: none;
}
.gate-wall {
  fill: #6b6358;
  stroke: #3d3832;
  stroke-width: 1.2;
}
.gate-roof {
  fill: #4a4540;
  stroke: #2a2724;
  stroke-width: 1;
  stroke-linejoin: round;
}
.gate-window {
  fill: #8ec8e8;
  stroke: #3d3832;
  stroke-width: 0.8;
  opacity: 0.85;
}
.gate-label {
  fill: #f4f1de;
  font-size: 10px;
  text-anchor: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 3px;
}
.feature-road {
  stroke: #8a8073;
  stroke-width: 7;
  opacity: 0.95;
}
.feature-drive {
  stroke: #9b917f;
  stroke-width: 4.5;
}
.feature-road.stub,
.feature-drive.stub {
  opacity: 0.45;
}
.route {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.route-path {
  stroke: #7a4f2a;
  stroke-width: 3;
  stroke-dasharray: 2.5 5;
}
.route-road {
  stroke: #6b6f76;
  stroke-width: 6;
}
.route-trail {
  stroke: #c9b97e;
  stroke-width: 2.5;
  stroke-dasharray: 1.5 6;
}
.route.stub {
  opacity: 0.45;
}
.building-enter.can-enter {
  cursor: pointer;
}
.building-enter.can-enter:hover :deep(.us-wall) {
  filter: brightness(1.08);
}
.landmark-icon {
  font-size: 26px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.landmark-label {
  fill: #f4f1de;
  font-size: 12px;
  text-anchor: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.6);
  stroke-width: 3px;
  pointer-events: none;
}
.builder-layer {
  pointer-events: none;
}
.builder-coord {
  fill: #ffe08a;
  font-size: 9px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.65);
  stroke-width: 3px;
}
.hexmap.builder-edit.add-point {
  cursor: crosshair;
}
.edit-layer {
  pointer-events: all;
}
.edit-guide {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 4 5;
  opacity: 0.85;
  pointer-events: none;
}
.edit-handle {
  stroke-width: 2.5;
  cursor: grab;
  touch-action: none;
}
.edit-handle.selected {
  stroke-width: 3;
}
.placement-link {
  stroke: rgba(255, 255, 255, 0.35);
  stroke-width: 1.5;
  stroke-dasharray: 3 4;
  pointer-events: none;
}
.edit-handle:active {
  cursor: grabbing;
}
.avatar {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.avatar-shadow {
  fill: rgba(0, 0, 0, 0.28);
}
.figure circle {
  fill: #f4f1de;
  stroke: #1c2620;
  stroke-width: 4;
}
.figure line {
  stroke: #1c2620;
  stroke-width: 5;
  stroke-linecap: round;
}
</style>
