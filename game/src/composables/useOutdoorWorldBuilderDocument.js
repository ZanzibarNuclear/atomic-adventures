import { computed, ref } from "vue";
import yaml from "js-yaml";
import { storyApi } from "../lib/storyApi.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function dumpYaml(world) {
  return yaml.dump(world, { noRefs: true, lineWidth: 100, noCompatMode: true, sortKeys: false });
}

export function useOutdoorWorldBuilderDocument({
  outdoor,
  refreshSharedWorld = async () => {},
  runMovementAudit = () => null,
  hasSelection = () => false,
  selectInitial = () => {},
} = {}) {
  const loaded = ref(null);
  const draftMeta = ref({});
  const baseline = ref("");
  const version = ref(0);
  const status = ref("");
  const errors = ref({});
  const warnings = ref([]);
  const yamlPreview = ref("");
  const revisions = ref([]);
  const showHistory = ref(false);
  const renames = ref([]);
  const auditEntries = ref([]);
  const auditSummary = ref(null);

  const currentWorld = computed(() => ({
    ...clonePlain(draftMeta.value),
    hexes: clonePlain(outdoor.editableHexes),
    features: clonePlain(outdoor.editableFeatures),
    routes: clonePlain(outdoor.editableRoutes),
  }));

  const dirty = computed(
    () => Boolean(baseline.value) && JSON.stringify(currentWorld.value) !== baseline.value,
  );

  function clearAudit() {
    auditEntries.value = [];
    auditSummary.value = null;
  }

  function applyLoaded(result) {
    loaded.value = result;
    version.value = result.version;
    warnings.value = result.warnings ?? [];
    yamlPreview.value = result.yaml ?? dumpYaml(result.world);
    errors.value = {};
    renames.value = [];
    clearAudit();
    const world = clonePlain(result.world);
    const { hexes, features, routes, ...meta } = world;
    draftMeta.value = meta;
    outdoor.syncFromMapData({ ...meta, hexes, features, routes });
    baseline.value = JSON.stringify(currentWorld.value);
    if (!hasSelection()) selectInitial(world.start);
  }

  async function loadWorld() {
    const result = await storyApi("/api/world/outdoors");
    applyLoaded(result);
  }

  function discardWorld() {
    if (loaded.value) applyLoaded(loaded.value);
  }

  function revertWorld() {
    if (!loaded.value) return;
    applyLoaded(loaded.value);
    status.value = "Reverted unsaved changes.";
  }

  async function saveWorld() {
    errors.value = {};
    status.value = "";
    const audit = runMovementAudit(false);
    if (audit?.invalid > 0 && !window.confirm(
      `The movement audit reports ${audit.invalid} invalid case(s). Save this deliberate geometry change anyway?`,
    )) return false;
    try {
      const result = await storyApi("/api/world/outdoors", {
        method: "PUT",
        body: JSON.stringify({
          world: currentWorld.value,
          expectedVersion: version.value,
          renames: renames.value,
        }),
      });
      applyLoaded(result);
      await refreshSharedWorld(result.revision);
      status.value = `Saved world version ${result.version}.`;
      return true;
    } catch (error) {
      errors.value = error.errors ?? {};
      status.value = error.status === 409
        ? "This world changed in another window. Revert or reload before saving."
        : error.message;
      return false;
    }
  }

  async function loadHistory() {
    revisions.value = await storyApi("/api/world/outdoors/revisions");
    showHistory.value = true;
  }

  async function restoreRevision(revision) {
    if (dirty.value && !window.confirm("Discard unsaved edits and restore this revision?")) return;
    if (!window.confirm(`Restore world revision ${revision} as a new revision?`)) return;
    try {
      const result = await storyApi(`/api/world/outdoors/revisions/${revision}/restore`, {
        method: "POST",
        body: "{}",
      });
      applyLoaded(result);
      await refreshSharedWorld(result.revision);
      status.value = `Restored revision ${revision}.`;
    } catch (error) {
      errors.value = error.errors ?? {};
      status.value = error.message;
    }
  }

  return {
    loaded,
    draftMeta,
    baseline,
    version,
    status,
    errors,
    warnings,
    yamlPreview,
    revisions,
    showHistory,
    renames,
    auditEntries,
    auditSummary,
    currentWorld,
    dirty,
    dumpYaml,
    applyLoaded,
    loadWorld,
    discardWorld,
    revertWorld,
    saveWorld,
    loadHistory,
    restoreRevision,
  };
}
