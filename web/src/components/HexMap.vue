<script setup>
import { computed } from 'vue'
import {
  axialToPixel,
  hexCornerPoints,
  boundsOf,
  neighborsOf,
} from '../composables/useHexGeometry.js'
import { buildRouteDrawPieces, pointsAttr } from '../composables/useRoutes.js'

const props = defineProps({
  mapData: { type: Object, required: true },
  routeModels: { type: Array, default: () => [] },
  featureModels: { type: Array, default: () => [] },
  currentHex: { type: String, required: true },
  discovered: { type: [Array, Object], default: () => [] },
  mode: { type: String, default: 'explored' }, // slice | explored | full
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['hex-click'])

// Pine-mountainside palette.
const TERRAIN_COLORS = {
  forest: '#4f7e57',
  clearing: '#8fae6e',
  rock: '#9a9d94',
  water: '#5f93c4',
}
const FOG_COLOR = '#222a25'

const size = computed(() => props.mapData.size ?? 44)
const allHexes = computed(() => props.mapData.hexes ?? [])
const hexById = computed(() =>
  Object.fromEntries(allHexes.value.map((h) => [h.id, h])),
)
const discoveredSet = computed(() => new Set(props.discovered))
const current = computed(() => hexById.value[props.currentHex])

const visibleHexes = computed(() => {
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
  if (props.mode !== 'explored') return []
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
  const forBounds = [...visibleHexes.value, ...fogHexes.value]
  if (forBounds.length === 0) return '0 0 100 100'
  const b = boundsOf(forBounds, size.value)
  return `${b.x} ${b.y} ${b.width} ${b.height}`
})

const landmarkHexes = computed(() => visibleHexes.value.filter((h) => h.landmark))

function center(hex) {
  return axialToPixel(hex.q, hex.r, size.value)
}
// Small figure (~1/4 the old size). On a landmark hex, stand beside the
// building rather than on top of it — we view this while outside.
const avatarScale = computed(() => (size.value / 44) * 0.28)
const avatarPos = computed(() => {
  if (!current.value) return { x: 0, y: 0 }
  const c = center(current.value)
  if (current.value.landmark) {
    return { x: c.x + size.value * 0.34, y: c.y + size.value * 0.42 }
  }
  return c
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
  const visibleIds = new Set(visibleHexes.value.map((h) => h.id))
  const isRevealed =
    props.mode === 'full' ? () => true : (id) => discoveredSet.value.has(id)
  const inView = props.mode === 'slice' ? (id) => visibleIds.has(id) : () => true
  return buildRouteDrawPieces(props.routeModels, {
    isRevealed,
    inView,
    allowStub: props.mode !== 'full',
  })
})
</script>

<template>
  <div class="hexmap" :class="{ expanded }">
    <svg :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
      <!-- Fog edge hints -->
      <g class="fog-layer">
        <g
          v-for="hex in fogHexes"
          :key="'fog-' + hex.id"
          class="hex fog"
          @click="emit('hex-click', hex.id)"
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
          :class="{ current: hex.id === currentHex }"
          @click="emit('hex-click', hex.id)"
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

      <!-- Geographic features: river + fence -->
      <g class="feature-layer">
        <polyline
          v-for="f in featureModels"
          :key="'feat-' + f.id"
          :points="pointsAttr(f.points)"
          class="feature"
          :class="'feature-' + f.kind"
        />
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
          <text
            :x="center(hex).x"
            :y="center(hex).y + 2 + (hex.landmark.dy ?? 0) * size"
            class="landmark-icon"
          >
            {{ hex.landmark.icon }}
          </text>
          <text
            v-if="expanded"
            :x="center(hex).x"
            :y="center(hex).y + size * 0.78"
            class="landmark-label"
          >
            {{ hex.landmark.name }}
          </text>
        </g>
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
    </svg>
  </div>
</template>

<style scoped>
.hexmap {
  width: 220px;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 25%, #34433a, #1d241f);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
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
  stroke: #20211f;
  stroke-width: 3;
  stroke-dasharray: 1.5 5;
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
