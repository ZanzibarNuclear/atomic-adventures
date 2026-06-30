<script setup>
import { computed, ref, watch } from 'vue'
import { pointsAttr } from '../composables/useRoutes.js'
import { useSvgDragHandles } from '../composables/useSvgDragHandles.js'
import {
  panViewBoxByPixels,
  resolveGridCameraFocus,
  useGridMapTransform,
} from '../composables/useGridMapTransform.js'
import { useGridMapPlacements } from '../composables/useGridMapPlacements.js'
import { useGridMapInteractions } from '../composables/useGridMapInteractions.js'
import MapAvatar from './map/MapAvatar.vue'
import MapEditHandlesLayer from './map/MapEditHandlesLayer.vue'
import GridMapShell from './grid/GridMapShell.vue'
import GridSceneryLayer from './grid/GridSceneryLayer.vue'
import GridExteriorLayer from './grid/GridExteriorLayer.vue'
import GridHydroLayer from './grid/GridHydroLayer.vue'
import GridRoomLayer from './grid/GridRoomLayer.vue'
import GridDoorLayer from './grid/GridDoorLayer.vue'
import GridFixtureLayer from './grid/GridFixtureLayer.vue'
import GridRoomStandLayer from './grid/GridRoomStandLayer.vue'
import { mapVisibilityCtx } from '../composables/useGrid.js'

const props = defineProps({
  building: { type: Object, required: true },
  currentRoom: { type: String, default: '' },
  currentStand: { type: String, default: null },
  exteriorNode: { type: String, default: null },
  avatarWaypoint: { type: Object, default: null },
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
  builderFixtureClickTarget: { type: String, default: 'fixture' },
  builderEdit: { type: Boolean, default: false },
  hydroDiscovered: { type: Boolean, default: false },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  selectedItemId: { type: String, default: null },
  addPointMode: { type: Boolean, default: false },
  mapClickMode: { type: String, default: null },
  expanded: { type: Boolean, default: false },
  viewportMode: { type: String, default: 'gameplay' },
  orientationControls: { type: Boolean, default: true },
  wheelZoom: { type: Boolean, default: false },
  dragPan: { type: Boolean, default: false },
})

const emit = defineEmits([
  'room-click',
  'door-click',
  'exit-click',
  'exterior-node-click',
  'stand-click',
  'select-handle',
  'grid-handle-move',
  'builder-map-click',
  'select-item',
])

const shellRef = ref(null)
const gridmapRef = ref(null)
const panStart = ref(null)
const isPanning = ref(false)
let suppressNextClick = false

watch(
  () => {
    const exposed = shellRef.value?.rootRef
    if (!exposed) return null
    return exposed.value ?? exposed
  },
  (el) => {
    gridmapRef.value = el ?? null
  },
  { immediate: true, flush: 'post' },
)

const cell = computed(() => props.building.cell ?? 64)
const discoveredSet = computed(() => new Set(props.discovered))
const interactableDoorSet = computed(() => new Set(props.interactableDoorIds))
const reachableExteriorSet = computed(() => new Set(props.reachableExteriorNodes))
const cameraFocus = computed(() => resolveGridCameraFocus({
  building: props.building,
  level: props.level,
  cell: cell.value,
  currentRoom: props.currentRoom,
  exteriorNode: props.exteriorNode,
  avatarWaypoint: props.avatarWaypoint,
}))

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
  viewBoxRect,
  placedRiver,
  placedCliffWall,
  placedGridLines,
  swapAxes,
  zoomByWheel,
  setViewBox,
} = useGridMapTransform({
  gridmapRef,
  building: computed(() => props.building),
  level: computed(() => props.level),
  visibility,
  cell,
  expanded: computed(() => props.expanded),
  viewportMode: computed(() => props.viewportMode),
  focusPoint: cameraFocus,
  wheelZoomEnabled: computed(() => props.wheelZoom),
})

function onWheel(event) {
  if (!props.wheelZoom) return
  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  const x = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5
  const y = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5
  zoomByWheel(event.deltaY > 0 ? 1.12 : 0.88, x, y)
}

function onPointerDown(event) {
  if (!props.dragPan || props.addPointMode || event.button !== 0) return
  if (event.target.closest('.edit-handle, .room-stand, .exterior-node')) return
  panStart.value = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    viewBox: { ...viewBoxRect.value },
  }
}

function onPointerMove(event) {
  const start = panStart.value
  if (!start || start.pointerId !== event.pointerId) return
  const dx = event.clientX - start.clientX
  const dy = event.clientY - start.clientY
  if (!isPanning.value && Math.hypot(dx, dy) < 4) return
  if (!isPanning.value) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  isPanning.value = true
  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  setViewBox(panViewBoxByPixels(start.viewBox, dx, dy, rect.width, rect.height))
}

function finishPan(event) {
  const start = panStart.value
  if (!start || start.pointerId !== event.pointerId) return
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }
  panStart.value = null
  if (!isPanning.value) return
  isPanning.value = false
  suppressNextClick = true
  window.setTimeout(() => {
    suppressNextClick = false
  }, 0)
}

function onClickCapture(event) {
  if (!suppressNextClick) return
  suppressNextClick = false
  event.preventDefault()
  event.stopPropagation()
}

const {
  placedBuildingShell,
  placedRooms,
  placedDoors,
  placedBeams,
  placedExteriorPaths,
  placedExteriorNodes,
  placedExits,
  placedFixtures,
  placedRoomStands,
  placedHydroElements,
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
  currentStand: computed(() => props.currentStand),
  exteriorNode: computed(() => props.exteriorNode),
  avatarWaypoint: computed(() => props.avatarWaypoint),
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

function onStandPointerDown(event, stand) {
  onHandleDown(event, {
    role: 'room-stand',
    handleKey: 'room-stand',
    x: stand.cx,
    y: stand.cy,
  })
}

const {
  onSvgClick,
  gridHandleRadius,
  displayEditHandles,
  handleColor,
  handleFill,
  isItemSelected,
  isDiscovered,
  isFogged,
  isOpenVoid,
  isFixtureRevealed,
  onRoomClick,
  onStairFixtureClick,
  onDoorClick,
  onExitClick,
  onExteriorNodeClick,
} = useGridMapInteractions({
  props,
  emit,
  visibility,
  tp,
  clientToSvg,
  discoveredSet,
  interactableDoorSet,
  reachableExteriorSet,
})
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
    :orientation-controls="orientationControls"
    :path-builder-legend="pathBuilderLegend"
    :add-point-hint="addPointHint"
    :add-node-hint="addNodeHint"
    @rotate="rotate"
  >
    <svg
      ref="mapSvgRef"
      :class="{ 'drag-pan-enabled': dragPan && !addPointMode, panning: isPanning }"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="finishPan"
      @pointercancel="finishPan"
      @click.capture="onClickCapture"
      @click="onSvgClick"
      @wheel="onWheel"
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
        :builder-view="builderView"
        @select-item="emit('select-item', $event)"
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

      <GridHydroLayer
        :hydro-elements="placedHydroElements"
        :fog="!hydroDiscovered && !builderView"
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
        :builder-view="builderView"
        :builder-fixture-click-target="builderFixtureClickTarget"
        @select-item="emit('select-item', $event)"
        @stair-fixture-click="onStairFixtureClick"
      />

      <GridRoomStandLayer
        :stands="placedRoomStands"
        :builder-view="builderView"
        @stand-click="(roomId, standId) => emit('stand-click', { roomId, standId })"
        @stand-pointerdown="onStandPointerDown"
      />

      <MapAvatar
        v-if="avatarPos && !builderView"
        :x="avatarPos.x"
        :y="avatarPos.y"
        :scale="avatarScale"
        :instant="viewportMode === 'gameplay' || !!props.avatarWaypoint"
        halo
      />

      <MapEditHandlesLayer
        :visible="builderView && !!selectedItemId"
        :handles="builderEdit ? displayEditHandles : []"
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
            fill="none"
            stroke="#58c4e8"
            stroke-width="2.5"
            stroke-dasharray="6 5"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.95"
            pointer-events="none"
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
              fill="none"
              stroke="rgba(200, 162, 255, 0.85)"
              stroke-width="2"
              stroke-dasharray="6 4"
              vector-effect="non-scaling-stroke"
              pointer-events="none"
              rx="4"
            />
          </template>
        </template>
      </MapEditHandlesLayer>
    </svg>
  </GridMapShell>
</template>

<style scoped>
.drag-pan-enabled {
  cursor: grab;
  touch-action: none;
}

.drag-pan-enabled.panning {
  cursor: grabbing;
}
</style>
