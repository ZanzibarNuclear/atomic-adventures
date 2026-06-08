import { ref, onUnmounted } from 'vue'

/** Map SVG client coordinates to local SVG space. */
export function svgPointFromClient(svgEl, clientX, clientY) {
  if (!svgEl) return null
  const pt = svgEl.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svgEl.getScreenCTM()
  if (!ctm) return null
  const local = pt.matrixTransform(ctm.inverse())
  return { x: local.x, y: local.y }
}

/**
 * Pointer-drag for builder edit handles on an SVG map.
 * @param {import('vue').Ref} svgRef - ref to the root SVG element
 * @param {{ onSelect?: (handleKey: string, handle: object) => void, onMove?: (payload: object) => void, mapPoint?: (pt: {x:number,y:number}) => {x:number,y:number} }} options
 */
export function useSvgDragHandles(svgRef, options = {}) {
  const { onSelect, onMove, mapPoint = (pt) => pt } = options
  const dragHandle = ref(null)

  function clientToSvg(clientX, clientY) {
    const pt = svgPointFromClient(svgRef.value, clientX, clientY)
    if (!pt) return null
    return mapPoint(pt)
  }

  function onHandleDown(e, h) {
    e.stopPropagation()
    e.preventDefault()
    dragHandle.value = h
    onSelect?.(h.handleKey, h)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e) {
    if (!dragHandle.value) return
    const pt = clientToSvg(e.clientX, e.clientY)
    if (!pt) return
    const h = dragHandle.value
    onMove?.({
      handleKey: h.handleKey,
      index: h.index,
      role: h.role,
      nodeId: h.nodeId,
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

  return { dragHandle, onHandleDown, onPointerUp, clientToSvg }
}
