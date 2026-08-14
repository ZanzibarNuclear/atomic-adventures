import { computed, ref } from "vue";
import { storyApi } from "../lib/storyApi.js";
import { migrateCliffWallToFixture } from "../lib/maps/composables/useGrid.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBuilding(building) {
  return migrateCliffWallToFixture(clonePlain(building));
}

export function useBuildingBuilderDocument({
  emptyBuilding,
  buildingId = "utility-station",
  level = null,
  buildDoorState = () => null,
  onDocumentReset = () => {},
} = {}) {
  const source = ref(clonePlain(emptyBuilding));
  const draft = ref(clonePlain(source.value));
  const baseline = ref(JSON.stringify(source.value));
  const version = ref(0);
  const loaded = ref(false);
  const status = ref("");
  const errors = ref({});
  const warnings = ref([]);
  const revisions = ref([]);
  const showHistory = ref(false);
  const renames = ref([]);
  const auditResult = ref(null);
  const doorStates = ref(buildDoorState(source.value));

  const dirty = computed(
    () => loaded.value && JSON.stringify(draft.value) !== baseline.value,
  );

  function resetRouteState(building) {
    doorStates.value = buildDoorState(building);
    onDocumentReset(building);
  }

  function discardDraft() {
    draft.value = clonePlain(source.value);
    baseline.value = JSON.stringify(source.value);
    errors.value = {};
    renames.value = [];
    auditResult.value = null;
    resetRouteState(source.value);
  }

  function revertDraft() {
    discardDraft();
    status.value = "Reverted unsaved utility station changes.";
  }

  function applyLoaded(result) {
    const building = normalizeBuilding(result.building);
    source.value = clonePlain(building);
    draft.value = clonePlain(building);
    baseline.value = JSON.stringify(building);
    version.value = result.version;
    warnings.value = result.warnings ?? [];
    errors.value = {};
    loaded.value = true;
    renames.value = [];
    auditResult.value = null;
    if (
      level &&
      !building.levels?.some((item) => item.id === level.value)
    ) {
      level.value =
        building.exterior?.level ?? building.levels?.at(-1)?.id ?? "";
    }
    resetRouteState(building);
  }

  async function saveDraft() {
    errors.value = {};
    status.value = "";
    try {
      const result = await storyApi(`/api/world/buildings/${buildingId}`, {
        method: "PUT",
        body: JSON.stringify({
          building: draft.value,
          expectedVersion: version.value,
          renames: renames.value,
        }),
      });
      applyLoaded(result);
      status.value = `Saved utility station version ${result.version}.`;
      return true;
    } catch (error) {
      errors.value = error.errors ?? {};
      status.value = error.status === 409
        ? "This building changed in another window. Revert or reload before saving."
        : error.message;
      return false;
    }
  }

  async function loadHistory() {
    revisions.value = await storyApi(`/api/world/buildings/${buildingId}/revisions`);
    showHistory.value = true;
  }

  async function restoreRevision(revision) {
    if (dirty.value && !window.confirm("Discard unsaved edits and restore this revision?")) return;
    if (!window.confirm(`Restore utility station revision ${revision} as a new revision?`)) return;
    try {
      const result = await storyApi(
        `/api/world/buildings/${buildingId}/revisions/${revision}/restore`,
        { method: "POST", body: "{}" },
      );
      applyLoaded(result);
      status.value = `Restored utility station revision ${revision}.`;
    } catch (error) {
      errors.value = error.errors ?? {};
      status.value = error.message;
    }
  }

  return {
    source,
    draft,
    baseline,
    version,
    loaded,
    status,
    errors,
    warnings,
    revisions,
    showHistory,
    renames,
    auditResult,
    doorStates,
    dirty,
    discardDraft,
    revertDraft,
    applyLoaded,
    saveDraft,
    loadHistory,
    restoreRevision,
  };
}
