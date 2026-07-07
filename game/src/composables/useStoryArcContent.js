import { computed, readonly, ref } from "vue";
import {
  addContentEventListener,
  addContentEventStatusListener,
  fetchContentJson,
} from "./contentEvents.js";
import { normalizeStoryArcContent } from "./storyArcModel.js";

const content = ref({
  story: normalizeStoryArcContent(),
  version: 0,
  revision: 0,
  warnings: [],
});
const loading = ref(false);
const error = ref("");
let started = false;
const storyArcUrl = import.meta.env.PROD
  ? "/content/story-arcs.json"
  : "/api/story-arcs";

export async function refreshStoryArcContent(minimumRevision = 0) {
  if (loading.value) return false;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return true;
  loading.value = true;
  try {
    const next = await fetchContentJson(storyArcUrl);
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
    return true;
  } catch (cause) {
    error.value = `Story arc content could not be refreshed: ${cause.message}`;
    return false;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  addContentEventListener("story-arcs.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) {
      void refreshStoryArcContent(update.revision);
    }
  });
  addContentEventStatusListener({
    onError: () => {
      error.value = "Live story arc updates are disconnected. Existing story arc data remains available.";
    },
    onOpen: () => {
      if (error.value.startsWith("Live story arc updates")) error.value = "";
    },
  });
}

export async function preloadStoryArcContent() {
  await refreshStoryArcContent();
  start();
}

export function useStoryArcContent() {
  start();
  const normalizedStory = computed(() =>
    normalizeStoryArcContent(content.value.story),
  );
  return {
    storyArcDocument: computed(() => normalizedStory.value),
    storyData: normalizedStory,
    storyArcs: computed(() => normalizedStory.value.storyArcs),
    version: computed(() => content.value.version),
    revision: computed(() => content.value.revision),
    warnings: computed(() => content.value.warnings ?? []),
    loading: readonly(loading),
    error: readonly(error),
    refresh: refreshStoryArcContent,
  };
}
