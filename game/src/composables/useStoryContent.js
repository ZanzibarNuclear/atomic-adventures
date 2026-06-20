import { computed, readonly, ref } from "vue";
import {
  addContentEventListener,
  addContentEventStatusListener,
  fetchContentJson,
} from "./contentEvents.js";

const content = ref({ revision: 0, areas: {} });
const loading = ref(false);
const error = ref("");
let started = false;
const storyUrl = import.meta.env.PROD ? "/content/story.json" : "/api/story";

const storyData = computed(() => {
  const areas = Object.values(content.value.areas ?? {});
  return {
    beats: Object.assign({}, ...areas.map((area) => area.beats ?? {})),
  };
});

async function refresh(minimumRevision = 0) {
  if (loading.value) return;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return;
  loading.value = true;
  try {
    const next = await fetchContentJson(storyUrl);
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
  } catch (cause) {
    error.value = `Story content could not be refreshed: ${cause.message}`;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  refresh();
  addContentEventListener("story.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) refresh(update.revision);
  });
  addContentEventStatusListener({
    onError: () => {
      error.value = "Live story updates are disconnected. The game will keep using the last loaded content.";
    },
    onOpen: () => {
      if (error.value.startsWith("Live story updates")) error.value = "";
    },
  });
}

export function useStoryContent() {
  start();
  return {
    storyData,
    revision: computed(() => content.value.revision),
    loading: readonly(loading),
    error: readonly(error),
    refresh,
  };
}
