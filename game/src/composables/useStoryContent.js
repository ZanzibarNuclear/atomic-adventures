import { computed, readonly, ref } from "vue";

const content = ref({ revision: 0, areas: {} });
const loading = ref(false);
const error = ref("");
let started = false;
let events = null;
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
    const response = await fetch(storyUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Story service returned ${response.status}.`);
    const next = await response.json();
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
  if (import.meta.env.PROD || typeof EventSource === "undefined") return;
  events = new EventSource("/api/content/events");
  events.addEventListener("story.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) refresh(update.revision);
  });
  events.onerror = () => {
    error.value = "Live story updates are disconnected. The game will keep using the last loaded content.";
  };
  events.addEventListener("open", () => {
    if (error.value.startsWith("Live story updates")) error.value = "";
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
