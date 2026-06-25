import { computed, ref, toRaw } from "vue";
import { storyApi } from "../lib/storyApi.js";
import { storyBeatYaml } from "../lib/storyYamlPreview.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(toRaw(value)));
}

function ensureEditableBeat(value) {
  const next = clonePlain(value);
  next.match ??= { originHex: null, localExit: null };
  next.match.originHex ??= null;
  next.match.localExit ??= null;
  return next;
}

export function useStoryBeatDocument({
  areaId,
  getCurrentLocation,
  getSelectedLocationKey,
  getBeatsForLocation,
  createEmptyBeat,
  suggestedId,
}) {
  const beats = ref([]);
  const selectedBeatId = ref("");
  const draft = ref(null);
  const baseline = ref("");
  const isNew = ref(false);
  const errors = ref({});
  const status = ref("");
  const revisions = ref([]);
  const showRevisions = ref(false);
  let beatLoadRequest = 0;

  const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== baseline.value);
  const yamlPreview = computed(() => storyBeatYaml(draft.value));

  function uniqueId(base) {
    const used = new Set(beats.value.map((beat) => beat.id));
    let candidate = base || "new-beat";
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}-${suffix++}`;
    return candidate;
  }

  function setDraft(value) {
    draft.value = ensureEditableBeat(value);
    baseline.value = JSON.stringify(draft.value);
    errors.value = {};
    status.value = "";
    revisions.value = [];
    showRevisions.value = false;
  }

  function clearBeatSelection() {
    beatLoadRequest += 1;
    selectedBeatId.value = "";
    draft.value = null;
    baseline.value = "";
    isNew.value = false;
    errors.value = {};
    status.value = "";
  }

  async function refreshBeatList() {
    beats.value = await storyApi(`/api/story/areas/${areaId}/beats`);
  }

  async function loadBeat(id, selectionKey = getSelectedLocationKey()) {
    const request = ++beatLoadRequest;
    const result = await storyApi(
      `/api/story/areas/${areaId}/beats/${encodeURIComponent(id)}`,
    );
    if (request !== beatLoadRequest || selectionKey !== getSelectedLocationKey()) return;
    selectedBeatId.value = id;
    isNew.value = false;
    setDraft(result.beat);
  }

  async function openFirstBeatForSelectedLocation(mode = null, location = null) {
    const current = getCurrentLocation?.() ?? {};
    mode ??= current.mode;
    location ??= current.location;
    if (!mode || !location) return;
    const selectionKey = `${mode}:${location}`;
    const firstBeat = getBeatsForLocation(mode, location)[0];
    if (!firstBeat) return;
    const request = ++beatLoadRequest;

    try {
      const result = await storyApi(
        `/api/story/areas/${areaId}/beats/${encodeURIComponent(firstBeat.id)}`,
      );
      if (request !== beatLoadRequest || selectionKey !== getSelectedLocationKey()) return;
      selectedBeatId.value = firstBeat.id;
      isNew.value = false;
      setDraft(result.beat);
    } catch (error) {
      if (request === beatLoadRequest && selectionKey === getSelectedLocationKey()) {
        status.value = error.message;
      }
    }
  }

  async function loadBeats(selectId = "", fallbackMode = null, fallbackLocation = null) {
    await refreshBeatList();
    if (selectId) await loadBeat(selectId);
    else {
      const current = getCurrentLocation?.() ?? {};
      const mode = fallbackMode ?? current.mode;
      const location = fallbackLocation ?? current.location;
      if (mode && location) await openFirstBeatForSelectedLocation(mode, location);
    }
  }

  function beginNewBeat(copy = null) {
    const source = copy ? clonePlain(copy) : createEmptyBeat();
    source.id = uniqueId(copy ? `${copy.id}-copy` : suggestedId());
    source.version = undefined;
    source.choices = (source.choices ?? []).map((choice) => ({
      ...choice,
      id: crypto.randomUUID(),
    }));
    selectedBeatId.value = "";
    isNew.value = true;
    setDraft(source);
  }

  function revertDraft() {
    draft.value = JSON.parse(baseline.value);
    errors.value = {};
  }

  async function saveBeat() {
    if (!draft.value) return false;
    errors.value = {};
    status.value = "Saving...";
    try {
      const submitted = clonePlain(draft.value);
      let result;
      if (isNew.value) {
        result = await storyApi(`/api/story/areas/${areaId}/beats`, {
          method: "POST",
          body: JSON.stringify(submitted),
        });
      } else {
        result = await storyApi(
          `/api/story/areas/${areaId}/beats/${encodeURIComponent(selectedBeatId.value)}`,
          {
            method: "PUT",
            body: JSON.stringify({ beat: submitted, expectedVersion: submitted.version }),
          },
        );
      }
      selectedBeatId.value = result.beat.id;
      isNew.value = false;
      const submittedOrigin = submitted.match?.originHex ?? null;
      const savedOrigin = result.beat.match?.originHex ?? null;
      const submittedLocalExit = submitted.match?.localExit ?? null;
      const savedLocalExit = result.beat.match?.localExit ?? null;
      if (submittedOrigin !== savedOrigin || submittedLocalExit !== savedLocalExit) {
        const saved = clonePlain(result.beat);
        const editable = clonePlain(result.beat);
        editable.match = {
          ...(editable.match ?? {}),
          originHex: submittedOrigin,
          localExit: submittedLocalExit,
        };
        draft.value = editable;
        baseline.value = JSON.stringify(saved);
        await refreshBeatList();
        status.value = "The content API did not preserve the match criteria. Restart the game dev server, then save again.";
        return false;
      }
      setDraft(result.beat);
      await refreshBeatList();
      status.value = result.renamedFrom
        ? `Renamed ${result.renamedFrom} to ${result.beat.id} and saved revision ${result.beat.version}.`
        : `Saved revision ${result.beat.version}.`;
      return true;
    } catch (error) {
      errors.value = error.errors ?? {};
      status.value = error.status === 409
        ? "This beat changed elsewhere. Reload it before saving."
        : error.message;
      return false;
    }
  }

  async function deleteBeat() {
    if (!draft.value || isNew.value) return;
    const beatId = selectedBeatId.value;
    if (!window.confirm(`Delete "${beatId}"? Its revision history will remain available.`)) return;
    await storyApi(
      `/api/story/areas/${areaId}/beats/${encodeURIComponent(beatId)}`,
      { method: "DELETE", body: JSON.stringify({ expectedVersion: draft.value.version }) },
    );
    draft.value = null;
    selectedBeatId.value = "";
    baseline.value = "";
    await loadBeats();
  }

  async function loadRevisions() {
    if (!draft.value || isNew.value) return;
    revisions.value = await storyApi(
      `/api/story/areas/${areaId}/beats/${encodeURIComponent(selectedBeatId.value)}/revisions`,
    );
    showRevisions.value = true;
  }

  async function restoreRevision(revision) {
    if (!window.confirm(`Restore revision ${revision}? This creates a new revision.`)) return;
    const result = await storyApi(
      `/api/story/areas/${areaId}/beats/${encodeURIComponent(selectedBeatId.value)}/revisions/${revision}/restore`,
      { method: "POST" },
    );
    selectedBeatId.value = result.beat.id;
    setDraft(result.beat);
    await loadBeats();
    await loadRevisions();
  }

  return {
    beats,
    selectedBeatId,
    draft,
    baseline,
    isNew,
    errors,
    status,
    revisions,
    showRevisions,
    dirty,
    yamlPreview,
    clearBeatSelection,
    refreshBeatList,
    loadBeat,
    loadBeats,
    openFirstBeatForSelectedLocation,
    beginNewBeat,
    revertDraft,
    saveBeat,
    deleteBeat,
    loadRevisions,
    restoreRevision,
  };
}
