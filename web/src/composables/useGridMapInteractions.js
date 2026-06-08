import { computed } from 'vue'
import {
  pathCurvePointColor,
  pathNodeHandleColor,
  roomHandleColor,
} from './useGridBuilder.js'
import { isRoomFogged, isFixtureFogged } from './useGrid.js'

/**
 * GridMap click routing, visibility predicates, and builder edit-handle presentation.
 */
export function useGridMapInteractions({
  props,
  emit,
  visibility,
  tp,
  clientToSvg,
  discoveredSet,
  interactableDoorSet,
  reachableExteriorSet,
}) {
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

  return {
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
    onStairExitClick,
    onDoorClick,
    onExitClick,
    onExteriorNodeClick,
  }
}
