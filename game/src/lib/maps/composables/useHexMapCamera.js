import { computed, ref, unref, watch } from "vue";
import { gameplayViewDimensions } from "./useHexGeometry.js";

/**
 * Interactive camera for the playable outdoor hex map.
 * - Wheel zoom (cursor-anchored)
 * - Drag pan (primary button)
 * - Recenter on focus (avatar) when the focus point changes
 *
 * Builder keeps its own camera; this is player-map only.
 */
export function useHexMapCamera({
  mapSvgRef,
  focusPoint,
  size,
  panelAspect,
  enabled,
}) {
  /** @type {import('vue').Ref<null | { x: number, y: number, width: number, height: number }>} */
  const camera = ref(null);
  const panning = ref(null);
  let suppressClick = false;

  const baseFrame = computed(() => {
    const focus = unref(focusPoint);
    const hexSize = unref(size) ?? 44;
    const aspect = unref(panelAspect);
    const dims = gameplayViewDimensions(hexSize);
    const height = dims.height;
    const width = aspect > 0 ? height * aspect : dims.width;
    if (!focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.y)) {
      return { x: -width / 2, y: -height / 2, width, height };
    }
    return {
      x: focus.x - width / 2,
      y: focus.y - height / 2,
      width,
      height,
    };
  });

  const viewBoxObject = computed(() => camera.value ?? baseFrame.value);

  const viewBoxString = computed(() => {
    const box = viewBoxObject.value;
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  });

  function ensureCamera() {
    if (!camera.value) {
      camera.value = { ...baseFrame.value };
    }
    return camera.value;
  }

  function recenterOnFocus() {
    if (!unref(enabled)) return;
    const focus = unref(focusPoint);
    if (!focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.y)) return;
    const current = camera.value ?? baseFrame.value;
    camera.value = {
      x: focus.x - current.width / 2,
      y: focus.y - current.height / 2,
      width: current.width,
      height: current.height,
    };
  }

  // Avatar / hex moved → keep them centered (preserve zoom)
  watch(
    () => {
      const p = unref(focusPoint);
      return p ? `${p.x},${p.y}` : "";
    },
    () => {
      if (!unref(enabled)) return;
      recenterOnFocus();
    },
  );

  // Panel aspect change → re-fit base width around current center
  watch(
    () => unref(panelAspect),
    () => {
      if (!unref(enabled) || !camera.value) return;
      const focus = unref(focusPoint);
      const box = camera.value;
      const cx = focus?.x ?? box.x + box.width / 2;
      const cy = focus?.y ?? box.y + box.height / 2;
      const base = baseFrame.value;
      const zoom = base.width / box.width;
      const width = base.width / Math.max(zoom, 0.01);
      const height = base.height / Math.max(zoom, 0.01);
      camera.value = {
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
      };
    },
  );

  function zoomBy(factor, clientX = null, clientY = null) {
    if (!unref(enabled)) return;
    const svg = unref(mapSvgRef);
    const rect = svg?.getBoundingClientRect?.();
    const fx =
      rect && clientX != null && rect.width > 0
        ? (clientX - rect.left) / rect.width
        : 0.5;
    const fy =
      rect && clientY != null && rect.height > 0
        ? (clientY - rect.top) / rect.height
        : 0.5;

    const current = ensureCamera();
    const base = baseFrame.value;
    const minWidth = base.width * 0.2;
    const maxWidth = base.width * 3.5;
    const width = Math.max(minWidth, Math.min(maxWidth, current.width * factor));
    const height = width * (current.height / current.width);
    const anchorX = current.x + current.width * fx;
    const anchorY = current.y + current.height * fy;
    camera.value = {
      x: anchorX - width * fx,
      y: anchorY - height * fy,
      width,
      height,
    };
  }

  function onWheel(event) {
    if (!unref(enabled)) return;
    event.preventDefault();
    // Scroll down → zoom out (larger viewBox), same as outdoor builder
    zoomBy(event.deltaY > 0 ? 1.12 : 0.88, event.clientX, event.clientY);
  }

  function onPointerDown(event) {
    if (!unref(enabled)) return;
    if (event.button !== 0) return;
    // Don't steal clicks from interactive map chrome
    if (event.target?.closest?.("button, a, .legend, .edit-handle")) return;
    panning.value = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      camera: { ...ensureCamera() },
      moved: false,
    };
  }

  function onPointerMove(event) {
    const start = panning.value;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.clientX;
    const dy = event.clientY - start.clientY;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) {
      start.moved = true;
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    const svg = unref(mapSvgRef);
    const rect = svg?.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return;
    const worldDx = (dx * start.camera.width) / rect.width;
    const worldDy = (dy * start.camera.height) / rect.height;
    camera.value = {
      ...start.camera,
      x: start.camera.x - worldDx,
      y: start.camera.y - worldDy,
    };
  }

  function onPointerUp(event) {
    const start = panning.value;
    if (!start || start.pointerId !== event.pointerId) return;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (start.moved) {
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    panning.value = null;
  }

  function onClickCapture(event) {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function resetCamera() {
    camera.value = null;
    recenterOnFocus();
  }

  return {
    viewBoxObject,
    viewBoxString,
    panning,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClickCapture,
    zoomBy,
    recenterOnFocus,
    resetCamera,
  };
}
