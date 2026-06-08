<script setup>
import { computed, ref } from 'vue'
import { hexCornerPoints } from '../composables/useHexGeometry.js'
import { catmullRomSpline, pointsAttr } from '../composables/useRoutes.js'
import {
  pathCurvePointColor,
  pathNodeHandleColor,
  roomHandleColor,
} from '../composables/useGridBuilder.js'
import { useSvgDragHandles } from '../composables/useSvgDragHandles.js'
import { useGridMapTransform } from '../composables/useGridMapTransform.js'
import { bbox, layoutPlacedFixtures } from '../composables/useGridFixtureLayout.js'
import MapAvatar from './map/MapAvatar.vue'
import MapEditHandlesLayer from './map/MapEditHandlesLayer.vue'
import GridSceneryLayer from './grid/GridSceneryLayer.vue'
import GridExteriorLayer from './grid/GridExteriorLayer.vue'
import GridRoomLayer from './grid/GridRoomLayer.vue'
import GridDoorLayer from './grid/GridDoorLayer.vue'
import GridFixtureLayer from './grid/GridFixtureLayer.vue'
import {
  roomsOnLevel,
  roomRect,
  roomStandPosition,
  isStairLanding,
  levelBeams,
  doorsOnLevel,
  exitsOnLevel,
  exteriorNodesOnLevel,
  exteriorPathsOnLevel,
  fixturesOnLevel,
  sharedEdge,
  mapVisibilityCtx,
  levelBuildingPerimeter,
  isRoomMapped,
  isRoomFogged,
  isDoorMapped,
  isFixtureMapped,
  isFixtureFogged,
  exitMapAt,
} from '../composables/useGrid.js'

const props = defineProps({
  building: { type: Object, required: true },
  currentRoom: { type: String, default: '' },
  exteriorNode: { type: String, default: null },
  discovered: { type: [Array, Object], default: () => [] },
  revealed: { type: [Array, Object], default: () => [] },
  level: { type: String, required: true },
  standLevel: { type: String, default: null },
  reachableRooms: { type: Array, default: () => [] },
  doorStates: { type: Object, default: () => ({}) },
  interactableDoorIds: { type: Array, default: () => [] },
  reachableExitDoors: { type: Array, default: () => [] },
  reachableExteriorNodes: { type: Array, default: () => [] },
  builderView: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  selectedItemId: { type: String, default: null },
  addPointMode: { type: Boolean, default: false },
  mapClickMode: { type: String, default: null },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits([
  'room-click',
  'door-click',
  'exit-click',
  'exterior-node-click',
  'select-handle',
  'grid-handle-move',
  'builder-map-click',
  'select-item',
])

const cell = computed(() => props.building.cell ?? 64)
const discoveredSet = computed(() => new Set(props.discovered))
const interactableDoorSet = computed(() => new Set(props.interactableDoorIds))
const reachableExitSet = computed(() => new Set(props.reachableExitDoors))
const reachableExteriorSet = computed(() => new Set(props.reachableExteriorNodes))
const exitHexRadius = computed(() => cell.value * 0.13)
const visibility = computed(() =>
  mapVisibilityCtx(
    props.discovered,
    props.revealed,
    props.building,
    props.doorStates,
    props.building.areaId,
    props.builderView,
    props.currentRoom || null,
    props.exteriorNode,
  ),
)
const current = computed(() =>
  props.currentRoom ? props.building.roomById[props.currentRoom] : null,
)
const levelRooms = computed(() => roomsOnLevel(props.building, props.level))
const mappedRooms = computed(() => levelRooms.value.filter((r) => isRoomMapped(r, visibility.value)))
const placedBuildingShell = computed(() => {
  if (props.builderView) return []
  return levelBuildingPerimeter(props.building, props.level).map((ring) =>
    ring.map((p) => tp(p.x * cell.value, p.y * cell.value)),
  )
})
const beams = computed(() => levelBeams(props.building, props.level, visibility.value))
const doors = computed(() =>
  doorsOnLevel(props.building, props.level, props.doorStates, props.currentRoom || null),
)
const fixtures = computed(() =>
  fixturesOnLevel(props.building, props.level).filter((f) => isFixtureMapped(f, visibility.value)),
)

const gridmapRef = ref(null)

const {
  rotation,
  rotate,
  tp,
  unTp,
  viewBox,
  placedRiver,
  placedCliffWall,
  placedGridLines,
  swapAxes,
} = useGridMapTransform({
  gridmapRef,
  building: computed(() => props.building),
  level: computed(() => props.level),
  visibility,
  cell,
  expanded: computed(() => props.expanded),
})

const mapSvgRef = ref(null)

const { onHandleDown, clientToSvg } = useSvgDragHandles(mapSvgRef, {
  onSelect: (handleKey) => emit('select-handle', handleKey),
  onMove: (payload) => emit('grid-handle-move', payload),
  mapPoint: (pt) => unTp(pt.x, pt.y),
})

function onSvgClick(e) {
  if (!props.builderEdit || !props.mapClickMode) return
  if (e.target.closest('.edit-handle')) return
  const layout = clientToSvg(e.clientX, e.clientY)
  if (!layout) return
  emit('builder-map-click', { ...layout, kind: props.mapClickMode })
}

function gridHandleRadius(h) {
  if (h.role === 'path-node') return 10
  if (h.role === 'move') return 9
  return 7
}

const displayEditHandles = computed(() =>
  props.editHandles.map((h) => {
    const p = tp(h.x, h.y)
    return { ...h, x: p.x, y: p.y }
  }),
)

function handleColor(h) {
  if (h.role === 'point') return pathCurvePointColor()
  if (
    h.role === 'path-node' ||
    h.role === 'node-at' ||
    h.role === 'door-at' ||
    h.role === 'exit-map'
  ) {
    return pathNodeHandleColor()
  }
  return roomHandleColor(h.role)
}

function handleFill(h) {
  if (h.handleKey === props.selectedHandleId) return '#fff'
  if (h.role === 'move') return '#e8d4ff'
  if (h.role === 'point') return '#ffe8cc'
  if (h.role === 'path-node') return '#9fdfb8'
  if (
    h.role === 'node-at' ||
    h.role === 'door-at' ||
    h.role === 'exit-map'
  ) {
    return '#d4f5e2'
  }
  return '#ffd166'
}

function isItemSelected(id) {
  return props.builderView && id === props.selectedItemId
}

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
function placeRect(cxOrig, cyOrig, w, h) {
  const c = tp(cxOrig, cyOrig)
  const W = swapAxes.value ? h : w
  const H = swapAxes.value ? w : h
  return { x: c.x - W / 2, y: c.y - H / 2, w: W, h: H }
}

const placedRooms = computed(() =>
  mappedRooms.value.map((room) => {
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
    return { room, rect: bbox(corners), center: tp(r.x + r.w / 2, r.y + r.h / 2), windows, railings }
  }),
)

const placedDoors = computed(() =>
  doors.value
    .filter((d) => isDoorMapped(props.building.doorById?.[d.id], visibility.value))
    .map((d) => {
    if (d.kind === 'roll') {
      const corners = [
        tp(d.x, d.y),
        tp(d.x + d.w, d.y),
        tp(d.x + d.w, d.y + d.h),
        tp(d.x, d.y + d.h),
      ]
      const box = bbox(corners)
      return {
        id: d.id,
        kind: 'roll',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        open: !!d.state?.open,
        locked: !!d.state?.locked,
        lockBroken: !!d.state?.lockBroken,
      }
    }
    const placed = placeRect(
      d.x,
      d.y,
      d.vertical ? 7 : cell.value * 0.3,
      d.vertical ? cell.value * 0.3 : 7,
    )
    return {
      id: d.id,
      kind: 'man',
      ...placed,
      open: !!d.state?.open,
      locked: !!d.state?.locked,
      lockBroken: !!d.state?.lockBroken,
    }
  }),
)
const placedBeams = computed(() =>
  beams.value.map((b) => {
    const a = tp(b.x1, b.y1)
    const c = tp(b.x2, b.y2)
    return { x1: a.x, y1: a.y, x2: c.x, y2: c.y, columns: b.columns.map((col) => tp(col.x, col.y)) }
  }),
)

const placedExteriorPaths = computed(() =>
  exteriorPathsOnLevel(props.building, props.level).map((path) => {
    const layout = (path.points ?? []).map((p) => ({
      x: p.x * cell.value,
      y: p.y * cell.value,
    }))
    const drawn =
      path.smooth !== false && layout.length >= 2
        ? catmullRomSpline(layout)
        : layout
    const points = drawn
      .map((p) => tp(p.x, p.y))
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
    const pathEditing =
      props.builderEdit && props.editMode === 'line' && props.selectedItemId
    const isSelected = pathEditing && path.id === props.selectedItemId
    const dimmed = pathEditing && !isSelected
    return { id: path.id, points, isSelected, dimmed }
  }),
)

/** Control polygon for the path being edited (point order, not handle list order). */
const editPathControlLine = computed(() => {
  if (!props.builderEdit || props.editMode !== 'line' || !props.selectedItemId) {
    return []
  }
  const path = props.building.exterior?.paths?.find(
    (p) => p.id === props.selectedItemId,
  )
  if (!path?.points?.length) return []
  return path.points.map((p) => tp(p.x * cell.value, p.y * cell.value))
})

const pathBuilderLegend = computed(
  () => props.builderEdit && props.editMode === 'line',
)

const addPointHint = computed(
  () =>
    props.builderEdit &&
    props.editMode === 'line' &&
    props.mapClickMode === 'point',
)

const addNodeHint = computed(
  () =>
    props.builderEdit &&
    props.editMode === 'line' &&
    props.mapClickMode === 'node',
)

const placedExteriorNodes = computed(() => {
  const editingPathId =
    props.builderEdit && props.editMode === 'line' ? props.selectedItemId : null
  const editingNodeIds = new Set(
    editingPathId
      ? (props.building.exterior?.paths ?? []).find((p) => p.id === editingPathId)
          ?.nodes ?? []
      : [],
  )

  return exteriorNodesOnLevel(props.building, props.level)
    .filter((node) => !editingNodeIds.has(node.id))
    .map((node) => {
    const c = tp(node.at.x * cell.value, node.at.y * cell.value)
    const r = cell.value * 0.11
    return {
      id: node.id,
      label: node.label,
      cx: c.x,
      cy: c.y,
      r,
      current: props.exteriorNode === node.id,
      reachable: reachableExteriorSet.value.has(node.id),
      hasDoor: !!node.door,
    }
  })
})

const placedExits = computed(() =>
  exitsOnLevel(props.building, props.level)
    .filter((exit) => {
      const door = props.building.doorById?.[exit.door]
      if (!door) return false
      if (props.builderView || props.exteriorNode) return true
      if (!isDoorMapped(door, visibility.value)) return false
      return props.currentRoom === exit.room
    })
    .map((exit) => {
      const mapAt = exitMapAt(exit)
      if (!mapAt) return null
      const c = tp(mapAt.x * cell.value, mapAt.y * cell.value)
      const r = exitHexRadius.value
      return {
        doorId: exit.door,
        roomId: exit.room,
        cx: c.x,
        cy: c.y,
        points: hexCornerPoints(c.x, c.y, r),
        reachable: reachableExitSet.value.has(exit.door),
      }
    })
    .filter(Boolean),
)

const placedFixtures = computed(() =>
  layoutPlacedFixtures(fixtures.value, props.building, cell.value, tp),
)

const avatarScale = computed(() => (cell.value / 64) * 0.42)
// Figure feet sit at y = 26 in local coords after scale().
const avatarFootOffset = computed(() => 26 * avatarScale.value)
const stairLandingFixture = computed(() => {
  if (!current.value?.feature) return null
  return placedFixtures.value.find((f) => f.featureRoomId === current.value.id) ?? null
})
const avatarPos = computed(() => {
  if (props.exteriorNode) {
    const node = props.building.exterior?.nodeById?.[props.exteriorNode]
    if (!node || props.building.exterior?.level !== props.level) return null
    const stand = tp(node.at.x * cell.value, node.at.y * cell.value)
    return {
      x: stand.x,
      y: stand.y - avatarFootOffset.value,
    }
  }
  if (!current.value) return null
  const landing = props.standLevel ?? props.level
  if (isStairLanding(current.value)) {
    if (landing !== props.level) return null
    const sf = stairLandingFixture.value
    if (!sf) return null
    if (sf.type === 'spiral') {
      return {
        x: sf.standX,
        y: sf.standY - avatarFootOffset.value,
      }
    }
    return {
      x: sf.cx,
      y: sf.cy - avatarFootOffset.value,
    }
  }
  if (current.value.level !== props.level) return null
  const stand = roomStandPosition(props.building, current.value)
  if (!stand) return null
  return tp(stand.x, stand.y)
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
function compassLabelPoint(baseDeg, offsetDeg) {
  const a = ((baseDeg + offsetDeg) * Math.PI) / 180
  return { x: 23 + 17 * Math.cos(a), y: 23 + 17 * Math.sin(a) }
}
const compassCardinals = computed(() => {
  const n = compassAngle.value
  return [
    { id: 'E', ...compassLabelPoint(n, 90) },
    { id: 'S', ...compassLabelPoint(n, 180) },
    { id: 'W', ...compassLabelPoint(n, 270) },
  ]
})

function isDiscovered(room) {
  if (props.builderView) return true
  if (isRoomFogged(room, visibility.value)) return false
  if (room.mirror && discoveredSet.value.has(room.mirror)) return true
  return discoveredSet.value.has(room.id)
}
function isFogged(room) {
  return isRoomFogged(room, visibility.value)
}
// Open void with no mirror: dark "no floor" styling. Mirrored bays look like normal rooms.
function isOpenVoid(room) {
  return room.open && !room.mirror
}
function isFixtureRevealed(fixture) {
  return !isFixtureFogged(fixture, visibility.value)
}
function onRoomClick(room) {
  if (props.builderView) {
    emit('select-item', { source: 'rooms', id: room.id })
    return
  }
  if (room.open) return
  if (!props.reachableRooms.includes(room.id)) return
  emit('room-click', room.id)
}
function onStairFixtureClick(f) {
  if (!isFixtureRevealed(f)) return
  const stairId = f.featureRoomId ?? f.toRoomId
  if (!stairId || !props.reachableRooms.includes(stairId)) return
  emit('room-click', stairId)
}
function onStairExitClick(f, roomId) {
  if (!f.featureRoomId || props.currentRoom !== f.featureRoomId) return
  if (!props.reachableRooms.includes(roomId)) return
  emit('room-click', roomId)
}
function onDoorClick(doorId) {
  if (props.builderView) {
    emit('select-item', { source: 'doors', id: doorId })
    return
  }
  if (!interactableDoorSet.value.has(doorId)) return
  emit('door-click', doorId)
}
function onExitClick(e, doorId) {
  if (props.builderView) {
    e.preventDefault()
    emit('select-item', { source: 'exits', id: doorId })
    return
  }
  emit('exit-click', doorId)
}
function onExteriorNodeClick(nodeId) {
  if (props.builderView) {
    emit('select-item', { source: 'nodes', id: nodeId })
    return
  }
  if (nodeId === props.exteriorNode) return
  if (!reachableExteriorSet.value.has(nodeId)) return
  emit('exterior-node-click', nodeId)
}
</script>

<template>
  <div
    ref="gridmapRef"
    class="gridmap"
    :class="{
      expanded,
      'builder-view': builderView,
      'builder-edit': builderEdit,
      'add-point': addPointMode,
    }"
  >
    <div class="map-controls">
      <button class="rotate-btn" title="Rotate 90°" @click="rotate">⟳</button>
      <svg class="compass" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="20" class="compass-ring" />
        <line x1="23" y1="23" :x2="compassTip.x" :y2="compassTip.y" class="compass-needle" />
        <circle :cx="compassTip.x" :cy="compassTip.y" r="2.4" class="compass-dot" />
        <text
          v-for="label in compassCardinals"
          :key="label.id"
          :x="label.x"
          :y="label.y"
          class="compass-cardinal"
        >{{ label.id }}</text>
        <text :x="compassTip.x" :y="compassTip.y" class="compass-n">N</text>
      </svg>
    </div>

    <svg
      ref="mapSvgRef"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      @click="onSvgClick"
    >
      <defs>
        <pattern
          id="cliff-wall-stone"
          patternUnits="userSpaceOnUse"
          width="18"
          height="12"
        >
          <rect width="18" height="12" fill="#7a7672" />
          <rect x="0.5" y="0.5" width="8" height="5" rx="0.4" fill="#8f8b86" stroke="#5c5854" stroke-width="0.5" />
          <rect x="9.5" y="0.5" width="8" height="5" rx="0.4" fill="#6e6a66" stroke="#5c5854" stroke-width="0.5" />
          <rect x="5" y="6.5" width="8" height="5" rx="0.4" fill="#75716d" stroke="#5c5854" stroke-width="0.5" />
          <rect x="0.5" y="6.5" width="4" height="5" rx="0.4" fill="#85817c" stroke="#5c5854" stroke-width="0.5" />
        </pattern>
      </defs>

      <GridSceneryLayer
        :grid-lines="placedGridLines"
        :river="placedRiver"
        :cliff-wall="placedCliffWall"
        :building-shell="placedBuildingShell"
        :beams="placedBeams"
      />

      <GridExteriorLayer
        :paths="placedExteriorPaths"
        :nodes="placedExteriorNodes"
        :exits="placedExits"
        :builder-view="builderView"
        :is-item-selected="isItemSelected"
        @exterior-node-click="onExteriorNodeClick"
        @exit-click="onExitClick"
      />

      <GridRoomLayer
        :rooms="placedRooms"
        :current-room="currentRoom"
        :reachable-rooms="reachableRooms"
        :cell="cell"
        :is-discovered="isDiscovered"
        :is-fogged="isFogged"
        :is-open-void="isOpenVoid"
        :is-item-selected="isItemSelected"
        @room-click="onRoomClick"
      />

      <GridDoorLayer
        :doors="placedDoors"
        :interactable-door-ids="interactableDoorSet"
        :builder-view="builderView"
        :is-item-selected="isItemSelected"
        @door-click="onDoorClick"
      />

      <GridFixtureLayer
        :fixtures="placedFixtures"
        :cell="cell"
        :current-room="currentRoom"
        :reachable-rooms="reachableRooms"
        :is-fixture-revealed="isFixtureRevealed"
        @stair-fixture-click="onStairFixtureClick"
        @stair-exit-click="onStairExitClick"
      />

      <MapAvatar
        v-if="avatarPos"
        :x="avatarPos.x"
        :y="avatarPos.y"
        :scale="avatarScale"
        halo
      />

      <MapEditHandlesLayer
        :visible="builderEdit"
        :handles="displayEditHandles"
        :selected-handle-id="selectedHandleId"
        :stroke-color="handleColor"
        :fill-color="handleFill"
        :handle-radius="gridHandleRadius"
        @handle-down="onHandleDown"
      >
        <template #overlay>
          <polyline
            v-if="editMode === 'line' && editPathControlLine.length"
            :points="pointsAttr(editPathControlLine)"
            class="edit-path-control"
          />
          <template v-if="editMode === 'room' && selectedItemId">
            <rect
              v-for="p in placedRooms.filter((r) => r.room.id === selectedItemId)"
              :key="'sel-' + p.room.id"
              :x="p.rect.x"
              :y="p.rect.y"
              :width="p.rect.w"
              :height="p.rect.h"
              class="room-selection-outline"
              rx="4"
            />
          </template>
        </template>
      </MapEditHandlesLayer>
    </svg>

    <div v-if="pathBuilderLegend" class="path-builder-legend" aria-label="Path editor legend">
      <div class="path-builder-legend-title">Path editor</div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-preview" />
        <span>Smoothed preview (selected path)</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-control" />
        <span>Control polygon (straight segments between points)</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-curve" />
        <span>Curve waypoint — drag to bend</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-node" />
        <span>Path node — stand spot on the route</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-dim" />
        <span>Other paths (background)</span>
      </div>
      <p v-if="addPointHint" class="path-builder-add-hint">
        Click the map: adds an orange waypoint on the nearest cyan segment.
      </p>
      <p v-else-if="addNodeHint" class="path-builder-add-hint path-builder-add-hint-node">
        Click the map: adds a green path node (stand spot) on the route.
      </p>
    </div>
  </div>
</template>

<style>
.gridmap {
  position: relative;
  width: 220px;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  container-type: size;
  background: radial-gradient(circle at 50% 30%, #2c3340, #181c24);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.gridmap.expanded {
  width: 100%;
  height: 72vh;
}
.gridmap.builder-view {
  box-shadow: inset 0 0 0 2px rgba(200, 162, 255, 0.35);
}
.gridmap.builder-view:not(.expanded) {
  width: 100%;
  height: min(58vh, 560px);
}
.gridmap.builder-edit.add-point {
  cursor: crosshair;
}
.room.builder-selected .floor,
.man-door.builder-selected,
.roll-door.builder-selected,
.exterior-node.builder-selected .exterior-node-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 3;
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
.edit-path-control {
  fill: none;
  stroke: #58c4e8;
  stroke-width: 2.5;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.95;
  pointer-events: none;
}
.room-selection-outline {
  fill: rgba(200, 162, 255, 0.08);
  stroke: rgba(200, 162, 255, 0.75);
  stroke-width: 2;
  stroke-dasharray: 6 4;
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
.edit-handle.path-node-handle {
  stroke-width: 3;
}
.edit-handle.path-node-handle.selected {
  stroke-width: 3.5;
}
.edit-handle:active {
  cursor: grabbing;
}
.path-builder-legend {
  position: absolute;
  left: clamp(6px, 2.5cqmin, 14px);
  bottom: clamp(6px, 2.5cqmin, 14px);
  z-index: 2;
  max-width: min(240px, 88%);
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(12, 14, 18, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 10px;
  line-height: 1.35;
  color: #d8dde6;
  pointer-events: none;
}
.path-builder-legend-title {
  font-weight: 700;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a8b0bd;
  margin-bottom: 6px;
}
.path-builder-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.path-builder-legend .swatch {
  flex-shrink: 0;
  width: 22px;
  height: 0;
  border-top-width: 3px;
  border-top-style: solid;
  border-radius: 1px;
}
.path-builder-legend .swatch-preview {
  border-top-color: #e878a8;
}
.path-builder-legend .swatch-control {
  border-top-color: #58c4e8;
  border-top-style: dashed;
}
.path-builder-legend .swatch-curve {
  width: 10px;
  height: 10px;
  border: 2.5px solid #f4a261;
  border-radius: 50%;
  border-top: 2.5px solid #f4a261;
}
.path-builder-legend .swatch-node {
  width: 10px;
  height: 10px;
  border: 2.5px solid #7dcea0;
  border-radius: 50%;
  border-top: 2.5px solid #7dcea0;
}
.path-builder-legend .swatch-dim {
  border-top-color: #5c574e;
  border-top-style: dashed;
  opacity: 0.7;
}
.path-builder-add-hint {
  margin: 8px 0 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #f4a261;
  font-size: 9px;
  line-height: 1.4;
}
.path-builder-add-hint-node {
  color: #7dcea0;
}
.map-controls {
  position: absolute;
  right: clamp(6px, 2.5cqmin, 14px);
  top: clamp(6px, 2.5cqmin, 14px);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: clamp(4px, 1.5cqmin, 10px);
  --ctrl-size: clamp(28px, 13cqmin, 54px);
}
.rotate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ctrl-size);
  height: var(--ctrl-size);
  padding: 0;
  font-size: calc(var(--ctrl-size) * 0.62);
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
  width: calc(var(--ctrl-size) * 1.35);
  height: calc(var(--ctrl-size) * 1.35);
  pointer-events: none;
  flex-shrink: 0;
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
.compass-cardinal {
  fill: #9aa3b2;
  font-size: 7px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: #181c24;
  stroke-width: 2px;
}
svg:not(.compass) {
  width: 100%;
  height: 100%;
  display: block;
}
.grid-layer {
  pointer-events: none;
}
.grid-line {
  stroke: rgba(255, 255, 255, 0.14);
  stroke-width: 1;
}
.building-shell-layer {
  pointer-events: none;
}
.river-layer {
  pointer-events: none;
}
.river-fill {
  fill: #2a5578;
  opacity: 0.92;
}
.river-flow {
  fill: none;
  stroke: rgba(200, 230, 255, 0.5);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cliff-wall-layer {
  pointer-events: none;
}
.cliff-wall-fill {
  fill: url(#cliff-wall-stone);
  stroke: #5c5854;
  stroke-width: 2;
  stroke-linejoin: bevel;
}
.building-shell {
  fill: #14181f;
  stroke: rgba(255, 255, 255, 0.22);
  stroke-width: 2.5;
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
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
}
.room.reachable.unvisited .floor {
  stroke: rgba(109, 185, 127, 0.45);
  cursor: pointer;
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
.room.overlook .floor {
  fill: #50617a;
  stroke: #20262f;
}
.room.overlook.unvisited .floor {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
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
.fog-mark {
  fill: rgba(255, 255, 255, 0.3);
  font-size: 22px;
  text-anchor: middle;
  font-weight: 700;
  paint-order: unset;
  stroke: none;
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
  transition: fill 0.25s ease, opacity 0.25s ease;
}
.roll-door.open {
  fill: #3b4658;
  opacity: 0.55;
}
.roll-door.locked {
  stroke: #a0522d;
  stroke-width: 2;
}
.man-door {
  fill: #c39a6b;
  pointer-events: none;
  transition: fill 0.25s ease;
}
.man-door.open {
  fill: #2a3038;
  stroke: #c39a6b;
  stroke-width: 1.5;
}
.man-door.locked {
  stroke: #a0522d;
  stroke-width: 2.5;
}
.man-door.lock-broken {
  stroke: #7a828e;
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
.man-door.door-clickable,
.roll-door.door-clickable {
  pointer-events: all;
  cursor: pointer;
}
.man-door.door-clickable:hover,
.roll-door.door-clickable:hover {
  filter: brightness(1.15);
}
.entry-door {
  fill: #c39a6b;
  pointer-events: none;
}
.exit-hex {
  pointer-events: none;
  opacity: 0.45;
}
.exit-hex.playable,
.exit-hex.builder-pick {
  pointer-events: all;
  cursor: pointer;
}
.exit-hex.reachable {
  opacity: 1;
}
.exit-hex.playable:not(.reachable) {
  opacity: 0.55;
  cursor: not-allowed;
}
.gridmap.builder-view .exit-hex.builder-pick {
  cursor: grab;
}
.gridmap.builder-view .exit-hex.builder-selected {
  cursor: grab;
}
.exit-hex-fill {
  fill: #3d5a4a;
  stroke: #8ab89a;
  stroke-width: 1.5;
  transition: fill 0.2s ease, stroke 0.2s ease;
}
.exit-hex.reachable:hover .exit-hex-fill {
  fill: #4a7560;
  stroke: #b8e0c8;
}
.exit-hex.builder-selected .exit-hex-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 2.5;
}
.exit-hex-icon {
  fill: #c8e6d0;
  font-size: 11px;
  text-anchor: middle;
  pointer-events: none;
  opacity: 0.85;
}
.exit-hex-label {
  fill: #9ab89a;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-anchor: middle;
  pointer-events: none;
}
.exterior-path {
  fill: none;
  stroke: #c9b97e;
  stroke-width: 2.8;
  stroke-dasharray: 1.5 6;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.82;
  pointer-events: none;
}
.exterior-path-builder-dim {
  stroke: #5c574e;
  stroke-width: 2;
  stroke-dasharray: 2 8;
  opacity: 0.45;
}
.exterior-path-builder-active {
  stroke: #e878a8;
  stroke-width: 3.5;
  stroke-dasharray: none;
  opacity: 0.95;
}
.exterior-node {
  pointer-events: none;
  opacity: 0.4;
}
.exterior-node.reachable {
  pointer-events: all;
  cursor: pointer;
  opacity: 0.9;
}
.exterior-node.current {
  opacity: 1;
}
.exterior-node-fill {
  fill: #5c7058;
  stroke: #c9b97e;
  stroke-width: 2;
  transition: fill 0.2s ease, stroke 0.2s ease;
}
.exterior-node-ring {
  fill: none;
  stroke: rgba(224, 212, 168, 0.55);
  stroke-width: 2;
  pointer-events: none;
}
.exterior-node-label {
  fill: #e0d4a8;
  font-size: 8px;
  font-weight: 600;
  text-anchor: middle;
  pointer-events: none;
}
.exterior-node.reachable:hover .exterior-node-fill {
  fill: #6a8066;
  stroke: #e0d4a8;
}
.exterior-node.current .exterior-node-fill {
  fill: #7a9474;
  stroke: #fff;
  stroke-width: 2.5;
}
.exterior-node.builder-selected .exterior-node-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 3;
}
.fixture {
  cursor: default;
}
.fixture.reachable,
.fixture.stair-clickable {
  cursor: pointer;
}
.fixture.visual-only {
  pointer-events: none;
}
.fixture.fog {
  cursor: default;
}
.fixture-fog-fill {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  pointer-events: none;
}
.stair-hit {
  fill: transparent;
  stroke: none;
}
.stair-tread {
  stroke: #c9b88a;
  stroke-linecap: round;
  pointer-events: none;
}
.stair-pad {
  fill: #20262f;
  stroke: #d7c48f;
  stroke-width: 1.5;
  pointer-events: none;
}
.spiral-exit {
  cursor: default;
  opacity: 0.45;
}
.spiral-exit.reachable {
  cursor: pointer;
  opacity: 1;
}
.spiral-exit.reachable .stair-pad {
  pointer-events: all;
}
.spiral-exit .stair-pad {
  pointer-events: all;
}
.stair-icon {
  fill: #d7c48f;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.spiral-glass {
  fill: rgba(126, 200, 255, 0.16);
  stroke: none;
  transition: fill 0.3s ease;
}
.fixture.current .spiral-glass {
  fill: rgba(126, 200, 255, 0.28);
}
.spiral-frame {
  fill: none;
  stroke: #9fd3ff;
  stroke-width: 2.5;
  stroke-linejoin: round;
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}
.fixture.current .spiral-frame {
  stroke: #ffd166;
  stroke-width: 3.5;
}
</style>
