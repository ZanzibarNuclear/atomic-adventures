import { reactive } from "vue";

/**
 * Promise-based confirm for builder destructive actions.
 * Pair with ConfirmDialog in the host view/component template.
 */
export function useConfirmDialog() {
  const state = reactive({
    visible: false,
    eyebrow: "Confirm",
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: true,
    _resolve: null,
  });

  function requestConfirm(options = {}) {
    return new Promise((resolve) => {
      if (typeof state._resolve === "function") {
        state._resolve(false);
      }
      state.visible = true;
      state.eyebrow = options.eyebrow ?? "Confirm";
      state.title = options.title ?? "Are you sure?";
      state.message = options.message ?? "";
      state.confirmLabel = options.confirmLabel ?? "Confirm";
      state.cancelLabel = options.cancelLabel ?? "Cancel";
      state.danger = options.danger !== false;
      state._resolve = resolve;
    });
  }

  function accept() {
    const resolve = state._resolve;
    state.visible = false;
    state._resolve = null;
    resolve?.(true);
  }

  function dismiss() {
    const resolve = state._resolve;
    state.visible = false;
    state._resolve = null;
    resolve?.(false);
  }

  return {
    state,
    requestConfirm,
    accept,
    dismiss,
  };
}

/** Prefer injected modal confirm; fall back to window.confirm for tests. */
export async function askConfirm(requestConfirm, options = {}) {
  if (typeof requestConfirm === "function") {
    return requestConfirm(options);
  }
  const title = options.title ?? "Are you sure?";
  const message = options.message ?? "";
  return window.confirm(message ? `${title}\n\n${message}` : title);
}
