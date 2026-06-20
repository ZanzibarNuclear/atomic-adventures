import { computed, readonly, ref } from "vue";
import {
  addContentEventListener,
  addContentEventStatusListener,
  fetchContentJson,
} from "./contentEvents.js";

const fallback = {
  id: "character-main",
  profile: { id: "zanzibar-nuhero", name: "Zanzibar Nuhero" },
  panel: { tabs: [], statGroups: [], inventoryGroups: [] },
  items: [],
  stats: [],
  knowledge: [],
  skills: [],
  quests: [],
  documents: [],
};

const content = ref({
  character: fallback,
  version: 0,
  revision: 0,
  warnings: [],
});
const loading = ref(false);
const error = ref("");
let started = false;
const characterUrl = import.meta.env.PROD
  ? "/content/character.json"
  : "/api/character";

export async function refreshCharacterContent(minimumRevision = 0) {
  if (loading.value) return false;
  if (content.value.revision >= minimumRevision && minimumRevision > 0) return true;
  loading.value = true;
  try {
    const next = await fetchContentJson(characterUrl);
    if (next.revision >= content.value.revision) content.value = next;
    error.value = "";
    return true;
  } catch (cause) {
    error.value = `Character content could not be refreshed: ${cause.message}`;
    return false;
  } finally {
    loading.value = false;
  }
}

function start() {
  if (started) return;
  started = true;
  addContentEventListener("character.updated", (event) => {
    const update = JSON.parse(event.data);
    if (update.revision > content.value.revision) {
      void refreshCharacterContent(update.revision);
    }
  });
  addContentEventStatusListener({
    onError: () => {
      error.value = "Live character updates are disconnected. Existing character data remains available.";
    },
    onOpen: () => {
      if (error.value.startsWith("Live character updates")) error.value = "";
    },
  });
}

export async function preloadCharacterContent() {
  await refreshCharacterContent();
  start();
}

export function useCharacterContent() {
  start();
  return {
    characterData: computed(() => content.value.character),
    version: computed(() => content.value.version),
    revision: computed(() => content.value.revision),
    warnings: computed(() => content.value.warnings ?? []),
    loading: readonly(loading),
    error: readonly(error),
    refresh: refreshCharacterContent,
  };
}
