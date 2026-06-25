import { computed, ref, unref } from "vue";
import { boundsOf } from "../lib/maps/composables/useHexGeometry.js";

const DEFAULT_FRAME = { x: -250, y: -220, width: 500, height: 440 };
const FIT_MARGIN_RATIO = 0.05;

export function expandToAspect(frame, aspect) {
  const current = frame.width / frame.height;
  if (current < aspect) {
    const width = frame.height * aspect;
    return { ...frame, x: frame.x - (width - frame.width) / 2, width };
  }
  const height = frame.width / aspect;
  return { ...frame, y: frame.y - (height - frame.height) / 2, height };
}

export function useWorldBuilderCamera() {
  const mapHost = ref(null);
  const camera = ref({ ...DEFAULT_FRAME });
  const fitFrame = ref({ ...DEFAULT_FRAME });
  const zoomAction = ref("fit");
  const panning = ref(null);

  const viewBoxString = computed(() => {
    const box = camera.value;
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  });
  const editHandleScale = computed(() => camera.value.width / Math.max(fitFrame.value.width, 1));

  function fitMap({ hexes = [], routes = [], features = [], size = 44 } = {}, updateCamera = true) {
    const mapSize = unref(size);
    const mapHexes = unref(hexes);
    if (!mapHexes.length) {
      fitFrame.value = { ...DEFAULT_FRAME };
      if (updateCamera) camera.value = { ...DEFAULT_FRAME };
      return;
    }
    const bounds = boundsOf(mapHexes, mapSize);
    const scale = 1 / (1 - FIT_MARGIN_RATIO * 2);
    const width = Math.max(bounds.width * scale, mapSize * 2.5);
    const height = Math.max(bounds.height * scale, mapSize * 2.5);
    const rawFrame = {
      x: bounds.x - (width - bounds.width) / 2,
      y: bounds.y - (height - bounds.height) / 2,
      width,
      height,
    };
    const rect = mapHost.value?.getBoundingClientRect();
    const aspect = rect?.width && rect?.height ? rect.width / rect.height : 1.3;
    const frame = expandToAspect(rawFrame, aspect);
    fitFrame.value = frame;
    if (updateCamera) camera.value = frame;
  }

  function focusPoint(point) {
    if (!point) return;
    const width = fitFrame.value.width * 0.42;
    const height = width / (camera.value.width / camera.value.height);
    camera.value = { x: point.x - width / 2, y: point.y - height / 2, width, height };
  }

  function zoomBy(factor, clientX = null, clientY = null) {
    const rect = mapHost.value?.getBoundingClientRect();
    const fx = rect && clientX != null ? (clientX - rect.left) / rect.width : 0.5;
    const fy = rect && clientY != null ? (clientY - rect.top) / rect.height : 0.5;
    const current = camera.value;
    const minWidth = fitFrame.value.width * 0.12;
    const maxWidth = fitFrame.value.width * 3;
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
    zoomBy(event.deltaY > 0 ? 1.12 : 0.88, event.clientX, event.clientY);
  }

  function applyZoomAction(actionOrEvent, actions = {}) {
    const action = typeof actionOrEvent === "string" ? actionOrEvent : actionOrEvent.target.value;
    zoomAction.value = action;
    if (action === "fit") actions.fit?.();
    else if (action === "focus") actions.focus?.();
  }

  function startPan(event) {
    if (event.target.closest(".edit-handle") || event.button === 2) return;
    if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) return;
    event.preventDefault();
    panning.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      camera: { ...camera.value },
    };
    window.addEventListener("pointermove", movePan);
    window.addEventListener("pointerup", stopPan);
  }

  function movePan(event) {
    if (!panning.value || !mapHost.value) return;
    const rect = mapHost.value.getBoundingClientRect();
    const dx = (event.clientX - panning.value.clientX) * panning.value.camera.width / rect.width;
    const dy = (event.clientY - panning.value.clientY) * panning.value.camera.height / rect.height;
    camera.value = {
      ...panning.value.camera,
      x: panning.value.camera.x - dx,
      y: panning.value.camera.y - dy,
    };
  }

  function stopPan() {
    panning.value = null;
    window.removeEventListener("pointermove", movePan);
    window.removeEventListener("pointerup", stopPan);
  }

  return {
    mapHost,
    camera,
    fitFrame,
    zoomAction,
    panning,
    viewBoxString,
    editHandleScale,
    fitMap,
    focusPoint,
    zoomBy,
    onWheel,
    applyZoomAction,
    startPan,
    movePan,
    stopPan,
  };
}
