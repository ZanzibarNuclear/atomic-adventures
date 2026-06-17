<script setup>
import { computed, ref } from 'vue'
import { pointsAttr } from '../composables/useRoutes.js'
import { useSvgDragHandles } from '../composables/useSvgDragHandles.js'
import { useHexMapViewport } from '../composables/useHexMapViewport.js'
import { useHexMapPlacements } from '../composables/useHexMapPlacements.js'
import { useHexMapInteractions } from '../composables/useHexMapInteractions.js'
import MapAvatar from './map/MapAvatar.vue'
import MapEditHandlesLayer from './map/MapEditHandlesLayer.vue'
import HexMapShell from './hex/HexMapShell.vue'
import HexFogLayer from './hex/HexFogLayer.vue'
import HexTerrainLayer from './hex/HexTerrainLayer.vue'
import HexSceneryLayer from './hex/HexSceneryLayer.vue'
import HexFeatureLayer from './hex/HexFeatureLayer.vue'
import HexCascadeLayer from './hex/HexCascadeLayer.vue'
import HexPassageLayer from './hex/HexPassageLayer.vue'
import HexRouteLayer from './hex/HexRouteLayer.vue'
import HexLandmarkLayer from './hex/HexLandmarkLayer.vue'
import HexBuilderLayer from './hex/HexBuilderLayer.vue'

const props = defineProps({
  mapData: { type: Object, required: true },
  routeModels: { type: Array, default: () => [] },
  featureModels: { type: Array, default: () => [] },
  currentHex: { type: String, required: true },
  discovered: { type: [Array, Object], default: () => [] },
  discoveredOpenings: { type: Array, default: () => [] },
  /** Story flags — drives gate open/closed symbols. */
  flags: { type: [Set, Array, Object], default: null },
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
  avatarInstant: { type: Boolean, default: false },
  buildingEnterable: { type: Boolean, default: false },
})

const emit = defineEmits(['hex-click', 'select-handle', 'waypoint-move', 'builder-map-click', 'building-enter'])

const mapSvgRef = ref(null)

const { onHandleDown, clientToSvg } = useSvgDragHandles(mapSvgRef, {
  onSelect: (handleKey) => emit('select-handle', handleKey),
  onMove: (payload) => emit('waypoint-move', payload),
})

const {
  size,
  allHexes,
  discoveredSet,
  current,
  visibleHexes,
  fogHexes,
  viewBox,
  fogMaskOpts,
  center,
} = useHexMapViewport({
  mapData: computed(() => props.mapData),
  currentHex: computed(() => props.currentHex),
  discovered: computed(() => props.discovered),
  discoveredOpenings: computed(() => props.discoveredOpenings),
  mode: computed(() => props.mode),
  builderView: computed(() => props.builderView),
})

const {
  landmarkHexes,
  visiblePassageMarkers,
  avatarScale,
  avatarPos,
  cascadeChevrons,
  trees,
  routePieces,
  featurePieces,
  legendTerrains,
  legendLines,
  legendPassages,
  hasLegend,
} = useHexMapPlacements({
  mapData: computed(() => props.mapData),
  routeModels: computed(() => props.routeModels),
  featureModels: computed(() => props.featureModels),
  mode: computed(() => props.mode),
  builderView: computed(() => props.builderView),
  standOverride: computed(() => props.standOverride),
  discoveredSet,
  discoveredOpenings: computed(() => props.discoveredOpenings),
  flags: computed(() => props.flags),
  visibleHexes,
  fogMaskOpts,
  size,
  center,
  current,
})

const {
  onSvgClick,
  onHexClick,
  onBuildingClick,
  editPolyline,
  editStroke,
  placementLink,
  handleColor,
  handleFill,
  fill,
} = useHexMapInteractions({ props, emit, clientToSvg })
</script>

<template>
  <HexMapShell
    :expanded="expanded"
    :builder-edit="builderEdit"
    :add-point-mode="addPointMode"
    :has-legend="hasLegend"
    :legend-terrains="legendTerrains"
    :legend-lines="legendLines"
    :legend-passages="legendPassages"
  >
    <svg
      ref="mapSvgRef"
      class="map-svg"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      @click="onSvgClick"
    >
      <HexFogLayer
        :fog-hexes="fogHexes"
        :size="size"
        :center-of="center"
        :clickable="mode === 'slice'"
        @hex-click="onHexClick"
      />

      <HexTerrainLayer
        :visible-hexes="visibleHexes"
        :size="size"
        :center-of="center"
        :fill-of="fill"
        :current-hex="currentHex"
        :builder-view="builderView"
        :discovered-set="discoveredSet"
        @hex-click="onHexClick"
      />

      <HexSceneryLayer :trees="trees" />

      <HexFeatureLayer :feature-pieces="featurePieces" />

      <HexCascadeLayer :cascade-chevrons="cascadeChevrons" />

      <HexPassageLayer :passage-markers="visiblePassageMarkers" />

      <HexRouteLayer :route-pieces="routePieces" />

      <HexLandmarkLayer
        :landmark-hexes="landmarkHexes"
        :size="size"
        :center-of="center"
        :current-hex="currentHex"
        :building-enterable="buildingEnterable"
        :builder-edit="builderEdit"
        :expanded="expanded"
        @building-enter="onBuildingClick"
      />

      <HexBuilderLayer
        :builder-view="builderView"
        :all-hexes="allHexes"
        :center-of="center"
      />

      <MapAvatar
        v-if="current"
        :x="avatarPos.x"
        :y="avatarPos.y"
        :scale="avatarScale"
        :instant="props.avatarInstant"
      />

      <MapEditHandlesLayer
        :visible="builderEdit && editHandles.length > 0"
        :handles="editHandles"
        :selected-handle-id="selectedHandleId"
        :stroke-color="handleColor"
        :fill-color="handleFill"
        @handle-down="onHandleDown"
      >
        <template #overlay>
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
        </template>
      </MapEditHandlesLayer>
    </svg>
  </HexMapShell>
</template>
