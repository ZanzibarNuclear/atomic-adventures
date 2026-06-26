import { onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";

export function useDirtyDocumentNavigation({
  dirty,
  router = null,
  save,
  discard = () => {},
  keep = () => {},
  onError = () => {},
} = {}) {
  const promptVisible = ref(false);
  const saving = ref(false);
  const pendingAction = ref(null);

  function isDirty() {
    return Boolean(dirty?.value ?? dirty);
  }

  function warnBeforeUnload(event) {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  }

  function closePrompt() {
    promptVisible.value = false;
    pendingAction.value = null;
  }

  function requestChange(action) {
    if (!isDirty()) return Promise.resolve(action?.());
    pendingAction.value = action;
    promptVisible.value = true;
    return Promise.resolve(false);
  }

  function keepEditing() {
    keep();
    closePrompt();
  }

  async function discardAndContinue() {
    const action = pendingAction.value;
    closePrompt();
    try {
      await discard();
      await action?.();
    } catch (error) {
      onError(error);
    }
  }

  async function saveAndContinue() {
    const action = pendingAction.value;
    saving.value = true;
    let saved = false;
    try {
      saved = await save?.();
    } catch (error) {
      onError(error);
    } finally {
      saving.value = false;
    }
    if (!saved) return;
    closePrompt();
    try {
      await action?.();
    } catch (error) {
      onError(error);
    }
  }

  onMounted(() => window.addEventListener("beforeunload", warnBeforeUnload));
  onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload));

  if (router) {
    onBeforeRouteLeave((to) => {
      if (!isDirty()) return true;
      void requestChange(() => router.push(to.fullPath));
      return false;
    });
  }

  return {
    promptVisible,
    saving,
    requestChange,
    keepEditing,
    discardAndContinue,
    saveAndContinue,
    closePrompt,
  };
}
