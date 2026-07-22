import { onBeforeUnmount, ref } from "vue";

/**
 * Horizontal split between two panes (e.g. map | inspector).
 * `ratio` is the fraction of the split track taken by the end pane (inspector).
 * Default 0.5 = even map / inspector split of the space after a fixed left rail.
 */
export function useResizableSplit({
  storageKey = null,
  defaultRatio = 0.5,
  minRatio = 0.28,
  maxRatio = 0.72,
} = {}) {
  const initial = readStoredRatio(storageKey, defaultRatio);
  const ratio = ref(clamp(initial, minRatio, maxRatio));
  let drag = null;

  function onHandlePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const handle = event.currentTarget;
    const track = handle?.parentElement;
    if (!track) return;
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    drag = {
      track,
      pointerId: event.pointerId,
      handle,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(event) {
    if (!drag?.track) return;
    const rect = drag.track.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Track is [startPane | handle | endPane]. End-pane share follows pointer from the right.
    const handleWidth = drag.handle?.getBoundingClientRect().width ?? 8;
    const usable = Math.max(1, rect.width - handleWidth);
    const endWidth = rect.right - event.clientX - handleWidth / 2;
    const next = endWidth / usable;
    ratio.value = clamp(next, minRatio, maxRatio);
  }

  function onPointerUp(event) {
    if (drag?.handle && event?.pointerId != null) {
      try {
        drag.handle.releasePointerCapture?.(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    drag = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(ratio.value));
      } catch {
        /* ignore */
      }
    }
  }

  function resetRatio() {
    ratio.value = defaultRatio;
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }

  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  });

  return {
    ratio,
    onHandlePointerDown,
    resetRatio,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function readStoredRatio(storageKey, fallback) {
  if (!storageKey) return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}
