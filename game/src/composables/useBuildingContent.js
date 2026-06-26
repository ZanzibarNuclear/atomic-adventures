import { computed, readonly, ref } from "vue";
import {
  addContentEventListener,
  addContentEventStatusListener,
  fetchContentJson,
} from "./contentEvents.js";

const fallback = {
  id: "utility-station",
  label: "Utility Station",
  cell: 64,
  levels: [],
  rooms: [],
  links: [],
  doors: [],
  fixtures: [],
  transitions: [],
};

const content = ref({
  building: fallback,
  version: 0,
  revision: 0,
  warnings: [],
});
const loading = ref(false);
const error = ref("");
let started = false;
const buildingUrl = import.meta.env.PROD
  ? "/content/utility-station.json"
  : "/api/world/buildings/utility-station";

export async function refreshBuildingContent(minimumRevision = 0) {
  if (loading.value) return false;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return true;
  loading.value = true;
  try {
    const next = await fetchContentJson(buildingUrl);
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
    return true;
  } catch (cause) {
    error.value = `Building content could not be refreshed: ${cause.message}`;
    return false;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  addContentEventListener("building.updated", (event) => {
    const update = JSON.parse(event.data);
    if (
      update.buildingId === "utility-station" &&
      update.revision > content.value.revision
    ) {
      void refreshBuildingContent(update.revision);
    }
  });
  addContentEventStatusListener({
    onError: () => {
      error.value = "Live building updates are disconnected. The last loaded map remains available.";
    },
    onOpen: () => {
      if (error.value.startsWith("Live building updates")) error.value = "";
    },
  });
}

export async function preloadBuildingContent() {
  await refreshBuildingContent();
  start();
}

export function useBuildingContent() {
  start();
  return {
    buildingData: computed(() => content.value.building),
    version: computed(() => content.value.version),
    revision: computed(() => content.value.revision),
    warnings: computed(() => content.value.warnings ?? []),
    loading: readonly(loading),
    error: readonly(error),
    refresh: refreshBuildingContent,
  };
}
