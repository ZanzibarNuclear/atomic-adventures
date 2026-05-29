<script setup>
import { computed } from 'vue'
import {
  axialToPixel,
  hexCornerPoints,
  boundsOf,
  neighborsOf,
  hexDistance,
} from '../composables/useHexGeometry.js'
import { buildRouteDrawPieces, pointsAttr } from '../composables/useRoutes.js'

const props = defineProps({
  mapData: { type: Object, required: true },
  routeModels: { type: Array, default: () => [] },
  currentHex: { type: String, required: true },
  // Set/array of discovered hex ids (fog-of-war).
  discovered: { type: [Array, Object], default: () => [] },
  // 'slice'      -> tight view around the player (embedded snippet)
  // 'explored'   -> everything discovered so far, with fog hints at the edges
  // 'full'       -> the "been everywhere" overview
  mode: { type: String, default: 'explored' },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['hex-click'])

const TERRAIN_COLORS = {
  meadow: '#9ccc79',
  hills: '#c9b97e',
  mountain: '#9aa0a6',
  marsh: '#6f8f6f',
  plains: '#ddd08a',
  structure: '#b9876a',
  forest: '#5f8a5f',
  water: '#6fa8dc',
}
const FOG_COLOR = '#2b303b'

const size = computed(() => props.mapData.size ?? 44)
const allHexes = computed(() => props.mapData.hexes ?? [])
const hexById = computed(() =>
  Object.fromEntries(allHexes.value.map((h) => [h.id, h])),
)
const discoveredSet = computed(() => new Set(props.discovered))
const current = computed(() => hexById.value[props.currentHex])

// Which hexes are drawn as real (explored) tiles.
const visibleHexes = computed(() => {
  if (props.mode === 'full') return allHexes.value
  if (props.mode === 'slice') {
    return allHexes.value.filter(
      (h) =>
        discoveredSet.value.has(h.id) &&
        current.value &&
        hexDistance(h, current.value) <= 1,
    )
  }
  // explored
  return allHexes.value.filter((h) => discoveredSet.value.has(h.id))
})

// Fog silhouettes: undiscovered hexes adjacent to discovered ones.
// Only shown in 'explored' mode to hint there's more to find.
const fogHexes = computed(() => {
  if (props.mode !== 'explored') return []
  const edge = new Map()
  for (const h of visibleHexes.value) {
    for (const n of neighborsOf(h)) {
      const found = allHexes.value.find((x) => x.q === n.q && x.r === n.r)
      if (found && !discoveredSet.value.has(found.id)) {
        edge.set(found.id, found)
      }
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

function center(hex) {
  return axialToPixel(hex.q, hex.r, size.value)
}

const avatarPos = computed(() =>
  current.value ? center(current.value) : { x: 0, y: 0 },
)

function fill(hex) {
  return TERRAIN_COLORS[hex.terrain] ?? '#888'
}
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
          <text :x="center(hex).x" :y="center(hex).y + 6" class="fog-mark">
            ?
          </text>
        </g>
      </g>

      <!-- Explored / visible terrain -->
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

      <!-- Routes: continuous polylines; stubs fade into fog -->
      <g class="routes-layer">
        <polyline
          v-for="(piece, i) in routePieces"
          :key="'piece-' + i"
          :points="pointsAttr(piece.points)"
          class="route"
          :class="['route-' + piece.kind, { stub: piece.partial }]"
        />
      </g>

      <!-- Landmarks, drawn above routes -->
      <g class="landmark-layer">
        <g v-for="hex in landmarkHexes" :key="'lm-' + hex.id" class="landmark">
          <text :x="center(hex).x" :y="center(hex).y + 2" class="landmark-icon">
            {{ hex.landmark.icon }}
          </text>
          <text
            v-if="expanded"
            :x="center(hex).x"
            :y="center(hex).y + size * 0.72"
            class="landmark-label"
          >
            {{ hex.landmark.name }}
          </text>
        </g>
      </g>

      <!-- Player avatar -->
      <g
        v-if="current"
        class="avatar"
        :style="{ transform: `translate(${avatarPos.x}px, ${avatarPos.y}px)` }"
      >
        <circle :r="size * 0.34" class="avatar-ring" />
        <text class="avatar-icon" y="2">🧭</text>
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
  background: radial-gradient(circle at 50% 30%, #3b4252, #232831);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.hexmap.expanded {
  width: 100%;
  height: 70vh;
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
  stroke: rgba(0, 0, 0, 0.35);
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
.fog .polygon,
.fog polygon {
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}
.fog-mark {
  fill: rgba(255, 255, 255, 0.35);
  font-size: 22px;
  text-anchor: middle;
  font-weight: 700;
}
.route {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.route-road {
  stroke: #6b6f76;
  stroke-width: 6;
}
.route-path {
  stroke: #c39a6b;
  stroke-width: 3;
  stroke-dasharray: 7 5;
}
.route-trail {
  stroke: #d7c48f;
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
.avatar-ring {
  fill: rgba(255, 209, 102, 0.25);
  stroke: #ffd166;
  stroke-width: 2.5;
}
.avatar-icon {
  font-size: 22px;
  text-anchor: middle;
  dominant-baseline: middle;
}
</style>
