<script setup>
import { computed, ref } from 'vue'
import {
  roomsOnLevel,
  roomRect,
  roomCenter,
  levelBounds,
  levelConnectors,
  fixturesOnLevel,
  sharedEdge,
} from '../composables/useGrid.js'

const props = defineProps({
  building: { type: Object, required: true },
  currentRoom: { type: String, required: true },
  discovered: { type: [Array, Object], default: () => [] },
  level: { type: String, required: true },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['room-click'])

const cell = computed(() => props.building.cell ?? 64)
const discoveredSet = computed(() => new Set(props.discovered))
const current = computed(() => props.building.roomById[props.currentRoom])
const levelRooms = computed(() => roomsOnLevel(props.building, props.level))
const connectors = computed(() => levelConnectors(props.building, props.level))
const fixtures = computed(() => fixturesOnLevel(props.building, props.level))

// ---- Rotation: the player can spin the plan 90° at a time ----
const rotation = ref(0)
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}
const swapAxes = computed(() => rotation.value % 180 !== 0)

const bounds = computed(() => levelBounds(levelRooms.value, cell.value))
const center = computed(() => ({
  x: bounds.value.x + bounds.value.w / 2,
  y: bounds.value.y + bounds.value.h / 2,
}))

// Rotate a point about the level center (clockwise on screen).
function tp(x, y) {
  const rad = (rotation.value * Math.PI) / 180
  const cx = center.value.x
  const cy = center.value.y
  const dx = x - cx
  const dy = y - cy
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }
}

const viewBox = computed(() => {
  const b = bounds.value
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const W = swapAxes.value ? b.h : b.w
  const H = swapAxes.value ? b.w : b.h
  return `${cx - W / 2} ${cy - H / 2} ${W} ${H}`
})

// ---- Geometry helpers (original, pre-rotation coordinates) ----
function rect(room) {
  return roomRect(room, cell.value)
}
function wall(room, edge) {
  const r = rect(room)
  if (edge === 'top') return { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y }
  if (edge === 'bottom') return { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h }
  if (edge === 'left') return { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h }
  return { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h }
}
function inward(edge, amount) {
  if (edge === 'top') return { dx: 0, dy: amount }
  if (edge === 'bottom') return { dx: 0, dy: -amount }
  if (edge === 'left') return { dx: amount, dy: 0 }
  return { dx: -amount, dy: 0 }
}
function windowSeg(room, edge) {
  const w = wall(room, edge)
  const { dx, dy } = inward(edge, cell.value * 0.14)
  const mx = (w.x1 + w.x2) / 2
  const my = (w.y1 + w.y2) / 2
  const hx = ((w.x2 - w.x1) / 2) * 0.66
  const hy = ((w.y2 - w.y1) / 2) * 0.66
  return { x1: mx - hx + dx, y1: my - hy + dy, x2: mx + hx + dx, y2: my + hy + dy }
}
function doorCenter(room, edge) {
  const w = wall(room, edge)
  return { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2, vertical: w.x1 === w.x2 }
}

// ---- Placement: turn original geometry into rotated screen geometry ----
function bbox(pts) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
// A small axis-aligned rect stays axis-aligned under 90° turns (w/h swap).
function placeRect(cxOrig, cyOrig, w, h) {
  const c = tp(cxOrig, cyOrig)
  const W = swapAxes.value ? h : w
  const H = swapAxes.value ? w : h
  return { x: c.x - W / 2, y: c.y - H / 2, w: W, h: H }
}

const placedRooms = computed(() =>
  levelRooms.value.map((room) => {
    const r = rect(room)
    const corners = [
      tp(r.x, r.y),
      tp(r.x + r.w, r.y),
      tp(r.x + r.w, r.y + r.h),
      tp(r.x, r.y + r.h),
    ]
    const windows = (room.windows || []).map((edge) => {
      const s = windowSeg(room, edge)
      const a = tp(s.x1, s.y1)
      const b = tp(s.x2, s.y2)
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    })
    const entry = room.entry
      ? placeRect(
          doorCenter(room, room.entry).x,
          doorCenter(room, room.entry).y,
          doorCenter(room, room.entry).vertical ? 7 : cell.value * 0.32,
          doorCenter(room, room.entry).vertical ? cell.value * 0.32 : 7,
        )
      : null
    const roll = room.rollDoor
      ? placeRect(
          doorCenter(room, room.rollDoor).x,
          doorCenter(room, room.rollDoor).y,
          doorCenter(room, room.rollDoor).vertical ? 10 : cell.value * 0.7,
          doorCenter(room, room.rollDoor).vertical ? cell.value * 0.7 : 10,
        )
      : null
    // Railing along the interior edges of an open-to-roof void.
    const railings = []
    if (room.open) {
      for (const other of levelRooms.value) {
        if (other.id === room.id || other.open) continue
        const e = sharedEdge(room, other, cell.value)
        if (!e) continue
        const a = e.vertical ? tp(e.x, e.y1) : tp(e.x1, e.y)
        const b = e.vertical ? tp(e.x, e.y2) : tp(e.x2, e.y)
        railings.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
      }
    }
    return { room, rect: bbox(corners), center: tp(r.x + r.w / 2, r.y + r.h / 2), windows, entry, roll, railings }
  }),
)

const placedDoors = computed(() =>
  connectors.value.doors.map((d) =>
    placeRect(d.x, d.y, d.vertical ? 7 : cell.value * 0.28, d.vertical ? cell.value * 0.28 : 7),
  ),
)
const placedBeams = computed(() =>
  connectors.value.beams.map((b) => {
    const a = tp(b.x1, b.y1)
    const c = tp(b.x2, b.y2)
    return { x1: a.x, y1: a.y, x2: c.x, y2: c.y, columns: b.columns.map((col) => tp(col.x, col.y)) }
  }),
)
const placedStairs = computed(() =>
  connectors.value.stairs.map((s) => {
    const p = tp(s.x, s.y)
    return { x: p.x, y: p.y, dir: s.dir, toRoomId: s.toRoomId }
  }),
)

// ---- Spiral stair: a half-cylinder of glass bulging toward the river ----
function protrudeAngle(edge) {
  if (edge === 'top') return 270
  if (edge === 'bottom') return 90
  if (edge === 'left') return 180
  return 0 // right
}
function arcPoints(cx, cy, r, angle) {
  const pts = []
  for (let k = 90; k >= -90; k -= 15) {
    const a = ((angle + k) * Math.PI) / 180
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}
const placedFixtures = computed(() =>
  fixtures.value.map((f) => {
    const c = tp(f.x, f.y)
    const angle = (protrudeAngle(f.protrude) + rotation.value) % 360
    const pts = arcPoints(c.x, c.y, f.radius, angle)
    const fillPath = `M ${c.x} ${c.y} ` + pts.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
    const arcPath = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
    const mullions = pts.filter((_, i) => i % 2 === 1).map((p) => ({ x1: c.x, y1: c.y, x2: p.x, y2: p.y }))
    return { ...f, cx: c.x, cy: c.y, fillPath, arcPath, mullions }
  }),
)

const avatarScale = computed(() => (cell.value / 64) * 0.42)
const avatarPos = computed(() => {
  if (!current.value || current.value.level !== props.level) return null
  const c = roomCenter(current.value, cell.value)
  return tp(c.x, c.y)
})

// ---- Compass: a needle pointing to the plan's current north ----
const compassAngle = computed(() => {
  const base = props.building.north === 'right' ? 0 : 270
  return (base + rotation.value) % 360
})
const compassTip = computed(() => {
  const a = (compassAngle.value * Math.PI) / 180
  return { x: 23 + 17 * Math.cos(a), y: 23 + 17 * Math.sin(a) }
})

function isDiscovered(room) {
  return discoveredSet.value.has(room.id)
}
function onRoomClick(room) {
  if (room.open) return
  emit('room-click', room.id)
}
</script>

<template>
  <div class="gridmap" :class="{ expanded }">
    <button class="rotate-btn" title="Rotate 90°" @click="rotate">⟳</button>

    <svg class="compass" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r="20" class="compass-ring" />
      <line x1="23" y1="23" :x2="compassTip.x" :y2="compassTip.y" class="compass-needle" />
      <circle :cx="compassTip.x" :cy="compassTip.y" r="2.4" class="compass-dot" />
      <text :x="compassTip.x" :y="compassTip.y" class="compass-n">N</text>
    </svg>

    <svg :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
      <!-- Rooms -->
      <g class="room-layer">
        <g
          v-for="p in placedRooms"
          :key="p.room.id"
          class="room"
          :class="{
            current: p.room.id === currentRoom,
            visited: isDiscovered(p.room),
            unvisited: !isDiscovered(p.room) && !p.room.open,
            open: p.room.open,
          }"
          @click="onRoomClick(p.room)"
        >
          <rect :x="p.rect.x" :y="p.rect.y" :width="p.rect.w" :height="p.rect.h" rx="4" class="floor" />

          <!-- Railing at the edge of the open-to-roof void -->
          <line
            v-for="(rl, i) in p.railings"
            :key="p.room.id + '-rail-' + i"
            :x1="rl.x1"
            :y1="rl.y1"
            :x2="rl.x2"
            :y2="rl.y2"
            class="railing"
          />

          <!-- Windows -->
          <line
            v-for="(w, i) in p.windows"
            :key="p.room.id + '-win-' + i"
            :x1="w.x1"
            :y1="w.y1"
            :x2="w.x2"
            :y2="w.y2"
            class="window"
          />

          <!-- Tall roll-up garage door -->
          <rect v-if="p.roll" :x="p.roll.x" :y="p.roll.y" :width="p.roll.w" :height="p.roll.h" class="roll-door" />
          <!-- Side man-door (exterior entry) -->
          <rect v-if="p.entry" :x="p.entry.x" :y="p.entry.y" :width="p.entry.w" :height="p.entry.h" class="entry-door" />

          <text v-if="!p.room.open" :x="p.center.x" :y="p.center.y - cell * 0.16" class="room-icon">
            {{ p.room.icon }}
          </text>
          <text
            :x="p.center.x"
            :y="p.center.y + (p.room.open ? 0 : cell * 0.14)"
            class="room-label"
            :class="{ 'open-label': p.room.open }"
          >
            {{ p.room.open ? p.room.name : isDiscovered(p.room) ? p.room.name : '???' }}
          </text>
          <text
            v-if="p.room.note && isDiscovered(p.room) && !p.room.open"
            :x="p.center.x"
            :y="p.center.y + cell * 0.34"
            class="room-note"
          >
            {{ p.room.note }}
          </text>
        </g>
      </g>

      <!-- Open-garage beams + support columns -->
      <g class="beam-layer">
        <g v-for="(b, i) in placedBeams" :key="'beam-' + i">
          <line :x1="b.x1" :y1="b.y1" :x2="b.x2" :y2="b.y2" class="beam" />
          <rect
            v-for="(col, j) in b.columns"
            :key="'col-' + i + '-' + j"
            :x="col.x - 4"
            :y="col.y - 4"
            width="8"
            height="8"
            class="column"
          />
        </g>
      </g>

      <!-- Interior doors -->
      <g class="door-layer">
        <rect
          v-for="(d, i) in placedDoors"
          :key="'door-' + i"
          :x="d.x"
          :y="d.y"
          :width="d.w"
          :height="d.h"
          class="door"
        />
      </g>

      <!-- Spiral stair: half-cylinder of glass -->
      <g class="spiral-layer">
        <g v-for="f in placedFixtures" :key="f.id" class="spiral" @click="f.toRoomId && emit('room-click', f.toRoomId)">
          <path :d="f.fillPath" class="spiral-glass" />
          <line
            v-for="(m, i) in f.mullions"
            :key="f.id + '-mul-' + i"
            :x1="m.x1"
            :y1="m.y1"
            :x2="m.x2"
            :y2="m.y2"
            class="spiral-mullion"
          />
          <path :d="f.arcPath" class="spiral-frame" />
          <circle :cx="f.cx" :cy="f.cy" :r="cell * 0.16" class="spiral-pad" />
          <text :x="f.cx" :y="f.cy" class="spiral-icon">
            ↻{{ f.dir === 'up' ? '▲' : f.dir === 'down' ? '▼' : '↕' }}
          </text>
        </g>
      </g>

      <!-- Straight stairs -->
      <g class="stair-layer">
        <g
          v-for="(s, i) in placedStairs"
          :key="'stair-' + i"
          class="stair"
          @click="emit('room-click', s.toRoomId)"
        >
          <circle :cx="s.x" :cy="s.y" :r="cell * 0.16" class="stair-pad" />
          <text :x="s.x" :y="s.y" class="stair-icon">{{ s.dir === 'up' ? '▲' : s.dir === 'down' ? '▼' : '↕' }}</text>
        </g>
      </g>

      <!-- Stick-figure avatar (kept upright; only translated) -->
      <g
        v-if="avatarPos"
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
.gridmap {
  position: relative;
  width: 220px;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #2c3340, #181c24);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.gridmap.expanded {
  width: 100%;
  height: 72vh;
}
.rotate-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1.05rem;
  line-height: 1;
  border-radius: 7px;
  background: rgba(20, 24, 30, 0.8);
  color: #cdd3dd;
  border: 1px solid #3f4c63;
  cursor: pointer;
}
.rotate-btn:hover {
  background: rgba(40, 48, 60, 0.9);
}
.compass {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 40px;
  height: 40px;
  z-index: 2;
  pointer-events: none;
}
.compass-ring {
  fill: rgba(20, 24, 30, 0.55);
  stroke: #3f4c63;
  stroke-width: 1.5;
}
.compass-needle {
  stroke: #6db97f;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.compass-dot {
  fill: #6db97f;
}
.compass-n {
  fill: #6db97f;
  font-size: 8px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: #181c24;
  stroke-width: 2.5px;
}
svg:not(.compass) {
  width: 100%;
  height: 100%;
  display: block;
}
.room {
  cursor: pointer;
}
.floor {
  fill: #3b4658;
  stroke: #20262f;
  stroke-width: 2;
  transition: fill 0.3s ease, stroke 0.3s ease;
}
.room.visited .floor {
  fill: #50617a;
}
.room.unvisited .floor {
  fill: #2a3038;
  stroke-dasharray: 4 4;
  stroke: #4a5360;
}
.room.current .floor {
  fill: #5d7090;
  stroke: #ffd166;
  stroke-width: 3.5;
}
.room.open {
  cursor: default;
}
.room.open .floor {
  fill: #14181f;
  stroke: #2b333d;
}
.railing {
  stroke: #b9923f;
  stroke-width: 2.5;
  stroke-dasharray: 2 3;
  pointer-events: none;
}
.room-icon {
  font-size: 22px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.room.unvisited .room-icon {
  opacity: 0.25;
}
.room-label {
  fill: #f4f1de;
  font-size: 10px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 3px;
  pointer-events: none;
}
.room.unvisited .room-label {
  fill: #8b94a3;
}
.room-label.open-label {
  fill: #5d6775;
  font-weight: 500;
  font-style: italic;
  font-size: 9px;
  stroke: none;
}
.room-note {
  fill: #aab2c0;
  font-size: 7.5px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-style: italic;
  pointer-events: none;
}
.window {
  stroke: #7ec8ff;
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0.85;
  pointer-events: none;
}
.beam {
  stroke: #6f6657;
  stroke-width: 5;
  stroke-linecap: round;
  opacity: 0.85;
  pointer-events: none;
}
.column {
  fill: #514a3f;
  pointer-events: none;
}
.roll-door {
  fill: #8a8073;
  stroke: #5b5247;
  stroke-width: 1;
  pointer-events: none;
}
.entry-door,
.door {
  fill: #c39a6b;
  pointer-events: none;
}
.spiral {
  cursor: pointer;
}
.spiral-glass {
  fill: rgba(126, 200, 255, 0.16);
  stroke: none;
}
.spiral-mullion {
  stroke: #7ec8ff;
  stroke-width: 1;
  opacity: 0.6;
}
.spiral-frame {
  fill: none;
  stroke: #9fd3ff;
  stroke-width: 2.5;
  stroke-linejoin: round;
}
.spiral-pad {
  fill: #20262f;
  stroke: #c9a3e0;
  stroke-width: 1.5;
}
.spiral-icon {
  fill: #d7c48f;
  font-size: 9px;
  text-anchor: middle;
  dominant-baseline: middle;
}
.stair {
  cursor: pointer;
}
.stair-pad {
  fill: #20262f;
  stroke: #d7c48f;
  stroke-width: 1.5;
}
.stair-icon {
  fill: #d7c48f;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: middle;
}
.avatar {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.avatar-shadow {
  fill: rgba(0, 0, 0, 0.3);
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
