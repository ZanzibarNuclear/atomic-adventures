import { computed } from 'vue'
import { lineKindColor, placementHandleColor } from './useMapBuilder.js'
import { TERRAIN_COLORS } from './hexMapPalette.js'

/**
 * HexMap click routing, terrain fill, and builder edit-handle presentation.
 */
export function useHexMapInteractions({ props, emit, clientToSvg }) {
  function onSvgClick(e) {
    if (!props.builderEdit || !props.addPointMode) return
    if (e.target.closest('.edit-handle')) return
    const pt = clientToSvg(e.clientX, e.clientY)
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
    if (!props.buildingEnterable) return
    if (hex.landmark?.building !== 'utility-station') return
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

  function fill(hex) {
    return TERRAIN_COLORS[hex.terrain] ?? '#888'
  }

  return {
    onSvgClick,
    onHexClick,
    onBuildingClick,
    editPolyline,
    editStroke,
    placementLink,
    handleColor,
    handleFill,
    fill,
  }
}
