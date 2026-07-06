import { computed, readonly, ref } from "vue";
import {
  addContentEventListener,
  addContentEventStatusListener,
  fetchContentJson,
} from "./contentEvents.js";

const fallback = {
  id: "storyline-main",
  scenarios: [],
};

const content = ref({
  storyline: fallback,
  version: 0,
  revision: 0,
  warnings: [],
});
const loading = ref(false);
const error = ref("");
let started = false;
const storylineUrl = import.meta.env.PROD
  ? "/content/storyline.json"
  : "/api/storyline";

export async function refreshStorylineContent(minimumRevision = 0) {
  if (loading.value) return false;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return true;
  loading.value = true;
  try {
    const next = await fetchContentJson(storylineUrl);
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
    return true;
  } catch (cause) {
    error.value = `Storyline content could not be refreshed: ${cause.message}`;
    return false;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  addContentEventListener("storyline.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) {
      void refreshStorylineContent(update.revision);
    }
  });
  addContentEventStatusListener({
    onError: () => {
      error.value = "Live storyline updates are disconnected. Existing scenario data remains available.";
    },
    onOpen: () => {
      if (error.value.startsWith("Live storyline updates")) error.value = "";
    },
  });
}

export async function preloadStorylineContent() {
  await refreshStorylineContent();
  start();
}

export function useStorylineContent() {
  start();
  return {
    storylineData: computed(() => content.value.storyline),
    scenarios: computed(() => content.value.storyline?.scenarios ?? []),
    version: computed(() => content.value.version),
    revision: computed(() => content.value.revision),
    warnings: computed(() => content.value.warnings ?? []),
    loading: readonly(loading),
    error: readonly(error),
    refresh: refreshStorylineContent,
  };
}
