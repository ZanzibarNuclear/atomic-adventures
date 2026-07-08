import { computed, readonly, ref } from "vue";
import {
  addContentEventListener,
  addContentEventStatusListener,
  fetchContentJson,
} from "./contentEvents.js";

const fallback = {
  id: "learning-main",
  lessons: [],
};

const content = ref({
  learning: fallback,
  version: 0,
  revision: 0,
  warnings: [],
});
const loading = ref(false);
const error = ref("");
let started = false;
const learningUrl = import.meta.env.PROD
  ? "/content/learning.json"
  : "/api/learning";

export async function refreshLearningContent(minimumRevision = 0) {
  if (loading.value) return false;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return true;
  loading.value = true;
  try {
    const next = await fetchContentJson(learningUrl);
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
    return true;
  } catch (cause) {
    error.value = `Learning content could not be refreshed: ${cause.message}`;
    return false;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  addContentEventListener("learning.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) {
      void refreshLearningContent(update.revision);
    }
  });
  addContentEventStatusListener({
    onError: () => {
      error.value = "Live learning updates are disconnected. Existing lesson data remains available.";
    },
    onOpen: () => {
      if (error.value.startsWith("Live learning updates")) error.value = "";
    },
  });
}

export async function preloadLearningContent() {
  await refreshLearningContent();
  start();
}

export function useLearningContent() {
  start();
  return {
    learningData: computed(() => content.value.learning),
    lessons: computed(() => content.value.learning?.lessons ?? []),
    version: computed(() => content.value.version),
    revision: computed(() => content.value.revision),
    warnings: computed(() => content.value.warnings ?? []),
    loading: readonly(loading),
    error: readonly(error),
    refresh: refreshLearningContent,
  };
}
