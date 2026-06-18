import { computed, readonly, ref } from "vue";

const content = ref({
  world: {
    orientation: "pointy",
    size: 44,
    start: null,
    journey: [],
    hexes: [],
    features: [],
    routes: [],
  },
  version: 0,
  revision: 0,
  warnings: [],
});
const loading = ref(false);
const error = ref("");
let started = false;
let events = null;
const worldUrl = import.meta.env.PROD ? "/content/world.json" : "/api/world/outdoors";

export async function refreshWorldContent(minimumRevision = 0) {
  if (loading.value) return false;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return true;
  loading.value = true;
  try {
    const response = await fetch(worldUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`World service returned ${response.status}.`);
    const next = await response.json();
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
    return true;
  } catch (cause) {
    error.value = `World content could not be refreshed: ${cause.message}`;
    return false;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  if (import.meta.env.PROD || typeof EventSource === "undefined") return;
  events = new EventSource("/api/content/events");
  events.addEventListener("world.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) {
      void refreshWorldContent(update.revision);
    }
  });
  events.onerror = () => {
    error.value = "Live world updates are disconnected. The last loaded map remains available.";
  };
  events.addEventListener("open", () => {
    if (error.value.startsWith("Live world updates")) error.value = "";
  });
}

export async function preloadWorldContent() {
  await refreshWorldContent();
  start();
}

export function useWorldContent() {
  start();
  return {
    worldData: computed(() => content.value.world),
    version: computed(() => content.value.version),
    revision: computed(() => content.value.revision),
    warnings: computed(() => content.value.warnings ?? []),
    loading: readonly(loading),
    error: readonly(error),
    refresh: refreshWorldContent,
  };
}
