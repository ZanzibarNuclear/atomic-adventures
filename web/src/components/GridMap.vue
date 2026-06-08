<script setup>
import { computed, ref } from 'vue'
import { pointsAttr } from '../composables/useRoutes.js'
import {
  pathCurvePointColor,
  pathNodeHandleColor,
  roomHandleColor,
} from '../composables/useGridBuilder.js'
import { useSvgDragHandles } from '../composables/useSvgDragHandles.js'
import { useGridMapTransform } from '../composables/useGridMapTransform.js'
import { useGridMapPlacements } from '../composables/useGridMapPlacements.js'
import MapAvatar from './map/MapAvatar.vue'
import MapEditHandlesLayer from './map/MapEditHandlesLayer.vue'
import GridMapShell from './grid/GridMapShell.vue'
import GridSceneryLayer from './grid/GridSceneryLayer.vue'
import GridExteriorLayer from './grid/GridExteriorLayer.vue'
import GridRoomLayer from './grid/GridRoomLayer.vue'
import GridDoorLayer from './grid/GridDoorLayer.vue'
import GridFixtureLayer from './grid/GridFixtureLayer.vue'
import {
  mapVisibilityCtx,
  isRoomFogged,
  isFixtureFogged,
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

const shellRef = ref(null)
const gridmapRef = computed(() => shellRef.value?.$el ?? null)

const cell = computed(() => props.building.cell ?? 64)
const discoveredSet = computed(() => new Set(props.discovered))
const interactableDoorSet = computed(() => new Set(props.interactableDoorIds))
const reachableExteriorSet = computed(() => new Set(props.reachableExteriorNodes))

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

const {
  placedBuildingShell,
  placedRooms,
  placedDoors,
  placedBeams,
  placedExteriorPaths,
  placedExteriorNodes,
  placedExits,
  placedFixtures,
  editPathControlLine,
  pathBuilderLegend,
  addPointHint,
  addNodeHint,
  avatarPos,
  avatarScale,
} = useGridMapPlacements({
  building: computed(() => props.building),
  level: computed(() => props.level),
  currentRoom: computed(() => props.currentRoom),
  exteriorNode: computed(() => props.exteriorNode),
  standLevel: computed(() => props.standLevel),
  doorStates: computed(() => props.doorStates),
  builderView: computed(() => props.builderView),
  builderEdit: computed(() => props.builderEdit),
  editMode: computed(() => props.editMode),
  selectedItemId: computed(() => props.selectedItemId),
  mapClickMode: computed(() => props.mapClickMode),
  reachableExteriorNodes: computed(() => props.reachableExteriorNodes),
  reachableExitDoors: computed(() => props.reachableExitDoors),
  visibility,
  cell,
  tp,
  swapAxes,
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

function isDiscovered(room) {
  if (props.builderView) return true
  if (isRoomFogged(room, visibility.value)) return false
  if (room.mirror && discoveredSet.value.has(room.mirror)) return true
  return discoveredSet.value.has(room.id)
}

function isFogged(room) {
  return isRoomFogged(room, visibility.value)
}

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
  <GridMapShell
    ref="shellRef"
    :expanded="expanded"
    :builder-view="builderView"
    :builder-edit="builderEdit"
    :add-point-mode="addPointMode"
    :north="building.north"
    :rotation="rotation"
    :path-builder-legend="pathBuilderLegend"
    :add-point-hint="addPointHint"
    :add-node-hint="addNodeHint"
    @rotate="rotate"
  >
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
  </GridMapShell>
</template>
