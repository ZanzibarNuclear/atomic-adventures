import { computed, ref, toRaw } from "vue";
import { storyApi } from "../lib/storyApi.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(toRaw(value)));
}

function ensureEditableBeat(value) {
  const next = clonePlain(value);
  next.match ??= { originHex: null, mapTransition: null, transitionDirection: null };
  next.match.originHex = stringList(next.match.originHex);
  next.match.mapTransition ??= null;
  next.match.transitionDirection ??= null;
  next.time ??= {};
  next.time.days ??= [];
  next.time.dayFrom ??= null;
  next.time.dayTo ??= null;
  next.time.minuteOfDayFrom ??= null;
  next.time.minuteOfDayTo ??= null;
  next.time.phase ??= null;
  next.time.elapsedFrom ??= null;
  next.time.elapsedTo ??= null;
  next.time.afterMilestone ??= null;
  next.time.beforeMilestone ??= null;
  for (const choice of next.choices ?? []) {
    choice.timeUntil ??= null;
  }
  return next;
}

function nullableText(value) {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStageView(value) {
  if (!value || typeof value !== "object") return null;
  const kind = nullableText(value.kind);
  if (!kind) return null;
  return {
    kind,
    focus: nullableText(value.focus),
    id: nullableText(value.id),
    tab: nullableText(value.tab),
  };
}

function normalizeForDirty(value) {
  if (!value) return null;
  const beat = value;
  const trigger = beat.trigger ?? {};
  return {
    id: String(beat.id ?? "").trim(),
    once: beat.once !== false,
    eyebrow: nullableText(beat.eyebrow),
    heading: nullableText(beat.heading),
    text: String(beat.text ?? ""),
    revisit: nullableText(beat.revisit),
    trigger: {
      place: nullableText(trigger.place),
      hex: nullableText(trigger.hex),
      room: nullableText(trigger.room),
      exteriorNode: nullableText(trigger.exteriorNode),
      event: nullableText(trigger.event),
      flag: nullableText(trigger.flag),
    },
    match: {
      originHex: stringList(beat.match?.originHex),
      mapTransition: nullableText(beat.match?.mapTransition),
      transitionDirection: nullableText(beat.match?.transitionDirection),
    },
    time: normalizeBeatTime(beat.time),
    choices: (beat.choices ?? []).map((choice, index) => ({
      id: choice.id ?? "",
      order: Number.isFinite(Number(choice.order)) ? Number(choice.order) : index,
      text: String(choice.text ?? ""),
      timeMinutes: finiteNumber(choice.timeMinutes, 0),
      timeUntil: normalizeTimeUntil(choice.timeUntil),
      activity: nullableText(choice.activity) ?? "light",
      sets: stringList(choice.sets),
      set_flags: stringList(choice.set_flags),
      go_hex: nullableText(choice.go_hex),
      go_room: nullableText(choice.go_room),
      go_exterior_node: nullableText(choice.go_exterior_node),
      enter: nullableText(choice.enter),
      view: normalizeStageView(choice.view),
    })),
  };
}

function normalizeBeatTime(value = {}) {
  return {
    days: Array.isArray(value.days) ? value.days.map(Number).filter(Number.isFinite) : [],
    dayFrom: nullableNumber(value.dayFrom),
    dayTo: nullableNumber(value.dayTo),
    minuteOfDayFrom: nullableNumber(value.minuteOfDayFrom),
    minuteOfDayTo: nullableNumber(value.minuteOfDayTo),
    phase: nullableText(value.phase),
    elapsedFrom: nullableNumber(value.elapsedFrom),
    elapsedTo: nullableNumber(value.elapsedTo),
    afterMilestone: nullableText(value.afterMilestone),
    beforeMilestone: nullableText(value.beforeMilestone),
  };
}

function normalizeTimeUntil(value) {
  if (!value || typeof value !== "object") return null;
  return {
    day: nullableNumber(value.day),
    dayOffset: nullableNumber(value.dayOffset),
    minuteOfDay: nullableNumber(value.minuteOfDay),
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dirtySnapshot(value) {
  return JSON.stringify(normalizeForDirty(value));
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
  const dirtyBaseline = ref("");
  const isNew = ref(false);
  const errors = ref({});
  const status = ref("");
  const revisions = ref([]);
  const showRevisions = ref(false);
  let beatLoadRequest = 0;

  const dirty = computed(() =>
    Boolean(draft.value) && (isNew.value || dirtySnapshot(draft.value) !== dirtyBaseline.value),
  );

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
    dirtyBaseline.value = dirtySnapshot(draft.value);
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
    dirtyBaseline.value = "";
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
    if (!mode || !location) {
      clearBeatSelection();
      return;
    }
    const selectionKey = `${mode}:${location}`;
    const firstBeat = getBeatsForLocation(mode, location)[0];
    if (!firstBeat) {
      clearBeatSelection();
      return;
    }
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
      const submittedOrigin = stringList(submitted.match?.originHex);
      const savedOrigin = stringList(result.beat.match?.originHex);
      const submittedMapTransition = submitted.match?.mapTransition ?? null;
      const savedMapTransition = result.beat.match?.mapTransition ?? null;
      const submittedDirection = submitted.match?.transitionDirection ?? null;
      const savedDirection = result.beat.match?.transitionDirection ?? null;
      if (
        JSON.stringify(submittedOrigin) !== JSON.stringify(savedOrigin) ||
        submittedMapTransition !== savedMapTransition ||
        submittedDirection !== savedDirection
      ) {
        const saved = clonePlain(result.beat);
        const editable = clonePlain(result.beat);
        editable.match = {
          ...(editable.match ?? {}),
          originHex: submittedOrigin,
          mapTransition: submittedMapTransition,
          transitionDirection: submittedDirection,
        };
        draft.value = editable;
        baseline.value = JSON.stringify(saved);
        dirtyBaseline.value = dirtySnapshot(saved);
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
    dirtyBaseline.value = "";
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
