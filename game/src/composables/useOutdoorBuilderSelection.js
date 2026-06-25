import { computed } from "vue";
import { storyApi } from "../lib/storyApi.js";
import {
  addWaypoint,
  resolvedPlacementHandles,
  resolvedWaypoints,
  setLandmarkWorld,
  setStandWorld,
  setWaypointWorld,
} from "../lib/maps/composables/useMapBuilder.js";
import { axialToPixel } from "../lib/maps/composables/useHexGeometry.js";
import { normalizeStandEntries } from "../lib/maps/composables/useAvatarStand.js";
import { resolveWaypoint } from "../lib/maps/composables/useRoutes.js";
import {
  applyStandPointToDraft,
  landmarkDraftFrom,
  landmarkFromDraft,
  normalizeStand,
  standDraftFrom,
  standFromDraft,
} from "../lib/maps/builder/outdoorDrafts.js";

function splitKey(key) {
  const index = key.indexOf(":");
  return index < 0 ? ["", ""] : [key.slice(0, index), key.slice(index + 1)];
}

function standHexId(id) {
  return String(id ?? "").split(":")[0] ?? "";
}

function standIdFromKey(id) {
  return String(id ?? "").split(":")[1] ?? "";
}

function uniqueId(base, list) {
  const used = new Set(list.map((item) => item.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function removeById(list, id) {
  const index = list.findIndex((item) => item.id === id);
  if (index >= 0) list.splice(index, 1);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function useOutdoorBuilderSelection({
  outdoor,
  passageKinds,
  draftMeta,
  renames,
  currentWorld,
  status,
  selectedKey,
  selectedHandleId,
  tool,
  search,
  landmarkDraft,
  landmarkEditDraft,
  standDraft,
  standEditDraft,
  focusPoint = () => {},
} = {}) {
  const selected = computed(() => {
    const [type, id] = splitKey(selectedKey.value);
    if (type === "hex" || type === "landmark" || type === "stand") {
      return outdoor.editableHexes.find((hex) => hex.id === standHexId(id)) ?? null;
    }
    if (type === "route") return outdoor.editableRoutes.find((route) => route.id === id) ?? null;
    if (type === "feature" || type === "passage") {
      return outdoor.editableFeatures.find((feature) => feature.id === id) ?? null;
    }
    return null;
  });
  const selectedType = computed(() => splitKey(selectedKey.value)[0]);
  const selectedStand = computed(() => {
    if (selectedType.value !== "stand" || !selected.value) return null;
    const standId = standIdFromKey(splitKey(selectedKey.value)[1]);
    return (selected.value.stands ?? []).find((stand) => stand.id === standId) ?? null;
  });
  const selectedStandIndex = computed(() =>
    selected.value?.stands?.findIndex((stand) => stand.id === selectedStand.value?.id) ?? -1,
  );
  const landmarkEditDirty = computed(() =>
    selectedType.value === "landmark" &&
    landmarkEditDraft.value &&
    selected.value?.landmark &&
    JSON.stringify(landmarkFromDraft(landmarkEditDraft.value)) !== JSON.stringify(landmarkFromDraft(selected.value.landmark)),
  );
  const standEditDirty = computed(() =>
    selectedType.value === "stand" &&
    standEditDraft.value &&
    selectedStand.value &&
    JSON.stringify(standFromDraft(standEditDraft.value)) !== JSON.stringify(normalizeStand(selectedStand.value)),
  );
  const selectedIsLine = computed(() =>
    selectedType.value === "route" ||
    (selectedType.value === "feature" && Array.isArray(selected.value?.points)),
  );
  const selectedIsPassage = computed(() => selectedType.value === "passage");
  const selectedIsPlacement = computed(() =>
    ["hex", "landmark", "stand"].includes(selectedType.value),
  );
  const editMode = computed(() => selectedIsLine.value ? "line" : selectedIsPlacement.value ? "placement" : null);
  const editHandles = computed(() => {
    if (!selected.value) return [];
    const editSubject = selectedType.value === "landmark" && landmarkEditDraft.value
      ? { ...selected.value, landmark: landmarkFromDraft(landmarkEditDraft.value) }
      : selectedType.value === "stand" && standEditDraft.value
        ? {
          ...selected.value,
          stands: selected.value.stands.map((stand) =>
            stand.id === selectedStand.value?.id ? standFromDraft(standEditDraft.value) : stand,
          ),
        }
        : selected.value;
    if (selectedIsLine.value) {
      return resolvedWaypoints(selected.value, outdoor.hexById, outdoor.size).map((handle) => ({
        ...handle,
        handleKey: `point-${handle.index}`,
      }));
    }
    if (selectedIsPassage.value && selected.value.at) {
      const point = resolveWaypoint(selected.value.at, outdoor.hexById, outdoor.size);
      const handles = [{ ...point, index: 0, role: "passage", handleKey: "passage" }];
      if (selected.value.boothAt) {
        handles.push({
          ...resolveWaypoint(selected.value.boothAt, outdoor.hexById, outdoor.size),
          index: 1,
          role: "booth",
          handleKey: "booth",
        });
      }
      return handles;
    }
    return resolvedPlacementHandles(editSubject, outdoor.size).map((handle) => ({
      ...handle,
      handleKey: handle.role === "stand" ? `stand-${handle.standId ?? handle.index}` : handle.role,
    }));
  });
  const builderEdit = computed(() => Boolean(selected.value && (editHandles.value.length || selectedIsLine.value)));
  const filteredGroups = computed(() => {
    const term = search.value.trim().toLowerCase();
    const matches = (item) => !term || `${item.id} ${item.label ?? ""} ${item.kind ?? ""}`.toLowerCase().includes(term);
    return [
      { label: "Hexes", type: "hex", items: outdoor.editableHexes.filter(matches) },
      { label: "Routes", type: "route", items: outdoor.editableRoutes.filter(matches) },
      {
        label: "Features & barriers",
        type: "feature",
        items: outdoor.editableFeatures.filter((item) => !passageKinds.has(item.kind)).filter(matches),
      },
      {
        label: "Passages",
        type: "passage",
        items: outdoor.editableFeatures.filter((item) => passageKinds.has(item.kind)).filter(matches),
      },
      {
        label: "Landmarks",
        type: "landmark",
        items: outdoor.editableHexes.filter((item) => item.landmark).filter(matches),
      },
      {
        label: "Stand points",
        type: "stand",
        items: outdoor.editableHexes.flatMap((hex) =>
          normalizeStandEntries(hex).map((stand) => ({
            id: `${hex.id}:${stand.id}`,
            label: stand.label,
            kind: hex.id,
          })),
        ).filter(matches),
      },
    ];
  });

  function select(type, id) {
    if (
      landmarkEditDirty.value &&
      !window.confirm("Discard unsaved landmark changes and leave this landmark?")
    ) {
      return;
    }
    if (
      standEditDirty.value &&
      !window.confirm("Discard unsaved stand changes and leave this stand?")
    ) {
      return;
    }
    selectedKey.value = `${type}:${id}`;
    selectedHandleId.value = null;
    tool.value = "select";
    landmarkDraft.value = null;
    standDraft.value = null;
    landmarkEditDraft.value = type === "landmark"
      ? landmarkDraftFrom(outdoor.editableHexes.find((hex) => hex.id === id)?.landmark)
      : null;
    standEditDraft.value = type === "stand"
      ? standDraftFrom(
        outdoor.editableHexes
          .find((hex) => hex.id === standHexId(id))
          ?.stands
          ?.find((stand) => stand.id === standIdFromKey(id)),
      )
      : null;
  }

  function selectFeature(id) {
    const feature = outdoor.editableFeatures.find((item) => item.id === id);
    select(passageKinds.has(feature?.kind) ? "passage" : "feature", id);
  }

  function onHandleMove({ x, y, role, index }) {
    if (!selected.value) return;
    if (selectedIsLine.value) {
      setWaypointWorld(selected.value, index, x, y, outdoor.hexById, outdoor.size);
    } else if (selectedIsPassage.value) {
      const key = role === "booth" ? "boothAt" : "at";
      if (!selected.value[key]) return;
      const holder = { points: [selected.value[key]] };
      setWaypointWorld(holder, 0, x, y, outdoor.hexById, outdoor.size);
      selected.value[key] = holder.points[0];
    } else if (role === "landmark") {
      if (selectedType.value === "landmark" && landmarkEditDraft.value) {
        const center = axialToPixel(selected.value.q, selected.value.r, outdoor.size);
        landmarkEditDraft.value.dx = Math.round(((x - center.x) / outdoor.size) * 100) / 100;
        landmarkEditDraft.value.dy = Math.round(((y - center.y) / outdoor.size) * 100) / 100;
        return;
      }
      setLandmarkWorld(selected.value, x, y, outdoor.size);
    } else if (role === "stand") {
      if (selectedType.value === "stand" && standEditDraft.value) {
        applyStandPointToDraft(standEditDraft.value, selected.value, x, y, outdoor.size);
        return;
      }
      setStandWorld(selected.value, x, y, outdoor.size, index ?? selectedStandIndex.value);
    }
  }

  function onBuilderMapClick({ x, y }) {
    if (tool.value !== "add-point" || !selectedIsLine.value) return;
    const index = addWaypoint(selected.value, x, y);
    selectedHandleId.value = `point-${index}`;
  }

  function toggleAddPointMode() {
    tool.value = tool.value === "add-point" ? "select" : "add-point";
  }

  function beginAddStand() {
    if (!selected.value || !selectedIsPlacement.value) return;
    const hex = selected.value;
    const center = axialToPixel(hex.q, hex.r, outdoor.size);
    standDraft.value = {
      id: uniqueId("stand", hex.stands ?? []),
      label: "",
      anchor: hex.landmark ? "landmark" : "hex",
      dx: 0,
      dy: 0,
      x: Math.round(center.x),
      y: Math.round(center.y),
    };
  }

  function confirmAddStand() {
    if (!selected.value || !standDraft.value) return;
    const draft = standDraft.value;
    const id = draft.id.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      status.value = "Stand IDs must use kebab-case.";
      return;
    }
    if ((selected.value.stands ?? []).some((stand) => stand.id === id)) {
      status.value = `The stand ID "${id}" already exists on this hex.`;
      return;
    }
    const at = draft.anchor === "world"
      ? { x: Number(draft.x), y: Number(draft.y) }
      : draft.anchor === "landmark"
        ? { from: "landmark", dx: Number(draft.dx), dy: Number(draft.dy) }
        : { dx: Number(draft.dx), dy: Number(draft.dy) };
    selected.value.stands ??= [];
    selected.value.stands.push({ id, label: draft.label.trim() || id, at });
    standDraft.value = null;
    selectedKey.value = `stand:${selected.value.id}:${id}`;
  }

  function cancelStandDraft() {
    standDraft.value = null;
  }

  function beginAddLandmark() {
    const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
    if (!hex) return;
    selectedKey.value = `hex:${hex.id}`;
    selectedHandleId.value = null;
    tool.value = "select";
    standDraft.value = null;
    landmarkDraft.value = {
      icon: "◆",
      label: hex.label ?? hex.id,
      building: "",
      blurb: "",
      dx: 0,
      dy: 0,
    };
  }

  function confirmAddLandmark() {
    if (!selected.value || !landmarkDraft.value) return;
    if (!landmarkDraft.value.icon.trim() && !landmarkDraft.value.building.trim()) {
      status.value = "Landmarks need an icon or building ID.";
      return;
    }
    selected.value.landmark = landmarkFromDraft(landmarkDraft.value);
    landmarkDraft.value = null;
    select("landmark", selected.value.id);
  }

  function cancelLandmarkDraft() {
    landmarkDraft.value = null;
  }

  function saveLandmarkEdit() {
    if (!selected.value || !landmarkEditDraft.value) return;
    if (!landmarkEditDraft.value.icon.trim() && !landmarkEditDraft.value.building.trim()) {
      status.value = "Landmarks need an icon or building ID.";
      return;
    }
    const hexId = selected.value.id;
    selected.value.landmark = landmarkFromDraft(landmarkEditDraft.value);
    landmarkEditDraft.value = null;
    select("hex", hexId);
  }

  function backToHexFromLandmark() {
    if (!selected.value) return;
    const hexId = selected.value.id;
    if (
      landmarkEditDirty.value &&
      !window.confirm("Discard unsaved landmark changes and return to the cell?")
    ) {
      return;
    }
    landmarkEditDraft.value = null;
    select("hex", hexId);
  }

  function saveStandEdit() {
    if (!selected.value || !selectedStand.value || !standEditDraft.value) return;
    const stand = standFromDraft(standEditDraft.value);
    if (!stand.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stand.id)) {
      status.value = "Stand IDs must use kebab-case.";
      return;
    }
    if (
      (selected.value.stands ?? []).some((item) =>
        item.id === stand.id && item.id !== selectedStand.value.id,
      )
    ) {
      status.value = `The stand ID "${stand.id}" already exists on this hex.`;
      return;
    }
    const hexId = selected.value.id;
    const index = selectedStandIndex.value;
    if (index >= 0) selected.value.stands[index] = stand;
    standEditDraft.value = null;
    select("hex", hexId);
  }

  function backToHexFromStand() {
    if (!selected.value) return;
    const hexId = selected.value.id;
    if (
      standEditDirty.value &&
      !window.confirm("Discard unsaved stand changes and return to the cell?")
    ) {
      return;
    }
    standEditDraft.value = null;
    select("hex", hexId);
  }

  function addHex() {
    const occupied = new Set(outdoor.editableHexes.map((hex) => `${hex.q},${hex.r}`));
    let q = 0;
    let r = 0;
    outer: for (let radius = 0; radius < 100; radius += 1) {
      for (q = -radius; q <= radius; q += 1) {
        for (r = -radius; r <= radius; r += 1) {
          if (!occupied.has(`${q},${r}`)) break outer;
        }
      }
    }
    const id = uniqueId("new-hex", outdoor.editableHexes);
    outdoor.editableHexes.push({ id, q, r, terrain: "forest" });
    if (!draftMeta.value.start) draftMeta.value.start = id;
    select("hex", id);
    focusSelection();
  }

  function addRoute() {
    const id = uniqueId("new-route", outdoor.editableRoutes);
    const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
    const points = hex
      ? [{ hex: hex.id, dx: -0.25, dy: 0 }, { hex: hex.id, dx: 0.25, dy: 0 }]
      : [{ x: -20, y: 0 }, { x: 20, y: 0 }];
    outdoor.editableRoutes.push({ id, kind: "path", label: "New route", points });
    select("route", id);
  }

  function addBarrier() {
    const id = uniqueId("new-barrier", outdoor.editableFeatures);
    const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
    const center = hex ? axialToPixel(hex.q, hex.r, outdoor.size) : { x: 0, y: 0 };
    outdoor.editableFeatures.push({
      id,
      kind: "fence",
      points: [
        { x: Math.round(center.x - 20), y: Math.round(center.y) },
        { x: Math.round(center.x + 20), y: Math.round(center.y) },
      ],
    });
    select("feature", id);
  }

  function addCascade() {
    if (selected.value?.kind !== "river") return;
    selected.value.cascades ??= [];
    selected.value.cascades.push({
      id: uniqueId("new-cascade", selected.value.cascades),
      from: 0.35,
      to: 0.65,
    });
  }

  function removeCascade(index) {
    if (!selected.value?.cascades) return;
    selected.value.cascades.splice(index, 1);
  }

  function addPassage() {
    const hex = selectedIsPlacement.value ? selected.value : outdoor.editableHexes[0];
    if (!hex) return;
    const id = uniqueId(`${hex.id}-gate`, outdoor.editableFeatures);
    outdoor.editableFeatures.push({
      id,
      kind: "gate",
      hex: hex.id,
      visibility: "obvious",
      at: { hex: hex.id, dx: 0, dy: 0 },
    });
    select("passage", id);
  }

  function duplicateSelected() {
    if (!selected.value) return;
    const copy = clonePlain(selected.value);
    if (selectedType.value === "hex") {
      copy.id = uniqueId(`${copy.id}-copy`, outdoor.editableHexes);
      copy.q += 1;
      while (outdoor.editableHexes.some((hex) => hex.q === copy.q && hex.r === copy.r)) copy.q += 1;
      outdoor.editableHexes.push(copy);
      select("hex", copy.id);
    } else if (selectedType.value === "route") {
      copy.id = uniqueId(`${copy.id}-copy`, outdoor.editableRoutes);
      outdoor.editableRoutes.push(copy);
      select("route", copy.id);
    } else if (["feature", "passage"].includes(selectedType.value)) {
      copy.id = uniqueId(`${copy.id}-copy`, outdoor.editableFeatures);
      outdoor.editableFeatures.push(copy);
      select(selectedType.value, copy.id);
    }
  }

  function deleteSelected() {
    if (!selected.value) return;
    const [type, id] = splitKey(selectedKey.value);
    if (!window.confirm(`Delete ${type} "${id}"? References will be checked when you save.`)) return;
    if (type === "landmark") {
      delete selected.value.landmark;
      select("hex", id);
    } else if (type === "stand") {
      const hexId = standHexId(id);
      const standId = standIdFromKey(id);
      selected.value.stands = (selected.value.stands ?? []).filter((stand) => stand.id !== standId);
      select("hex", hexId);
    } else if (type === "hex") {
      removeById(outdoor.editableHexes, id);
      selectedKey.value = "";
    } else if (type === "route") {
      removeById(outdoor.editableRoutes, id);
      selectedKey.value = "";
    } else {
      removeById(outdoor.editableFeatures, id);
      selectedKey.value = "";
    }
  }

  async function renameSelected() {
    if (!selected.value) return;
    const [type, oldId] = splitKey(selectedKey.value);
    if (["landmark", "stand"].includes(type)) return;
    const next = window.prompt(`Rename ${type} "${oldId}" to:`, oldId)?.trim();
    if (!next || next === oldId) return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
      status.value = "IDs must use kebab-case.";
      return;
    }
    const collection = type === "hex"
      ? outdoor.editableHexes
      : type === "route"
        ? outdoor.editableRoutes
        : outdoor.editableFeatures;
    if (collection.some((item) => item.id === next)) {
      status.value = `The ID "${next}" already exists.`;
      return;
    }
    if (type === "hex") {
      try {
        const preview = await storyApi("/api/world/outdoors/rename-preview", {
          method: "POST",
          body: JSON.stringify({ from: oldId, to: next, world: currentWorld.value }),
        });
        const lines = preview.references.slice(0, 12).map((reference) =>
          reference.kind === "story"
            ? `${reference.areaId}/${reference.beatId}: ${reference.path}`
            : reference.path,
        );
        const overflow = preview.references.length - lines.length;
        const summary = lines.length
          ? `\n\nReferences to update:\n${lines.join("\n")}${overflow > 0 ? `\n...and ${overflow} more` : ""}`
          : "\n\nNo existing references were found.";
        if (!window.confirm(`Rename "${oldId}" to "${next}"?${summary}`)) return;
      } catch (error) {
        status.value = error.message;
        return;
      }
    }
    selected.value.id = next;
    if (type === "hex") {
      cascadeHexRename(oldId, next);
      let chained = false;
      const updated = renames.value
        .filter((item) => item.from !== oldId)
        .map((item) => {
          if (item.to !== oldId) return item;
          chained = true;
          return { ...item, to: next };
        });
      renames.value = chained
        ? updated
        : [...updated, { kind: "hex", from: oldId, to: next }];
    }
    selectedKey.value = `${type}:${next}`;
  }

  function cascadeHexRename(from, to) {
    if (draftMeta.value.start === from) draftMeta.value.start = to;
    draftMeta.value.journey = (draftMeta.value.journey ?? []).map((id) => id === from ? to : id);
    for (const route of outdoor.editableRoutes) {
      for (const point of route.points ?? []) if (point.hex === from) point.hex = to;
    }
    for (const feature of outdoor.editableFeatures) {
      if (feature.hex === from) feature.hex = to;
      for (const key of ["at", "labelAt", "boothAt"]) if (feature[key]?.hex === from) feature[key].hex = to;
      for (const point of feature.points ?? []) if (point.hex === from) point.hex = to;
    }
  }

  function moveSelected(delta) {
    const [type, id] = splitKey(selectedKey.value);
    const list = type === "hex"
      ? outdoor.editableHexes
      : type === "route"
        ? outdoor.editableRoutes
        : ["feature", "passage"].includes(type)
          ? outdoor.editableFeatures
          : null;
    if (!list) return;
    const index = list.findIndex((item) => item.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
  }

  function pointMode(point) {
    return point.hex != null ? "hex" : "raw";
  }

  function csv(value) {
    return Array.isArray(value) ? value.join(", ") : "";
  }

  function setCsv(target, key, event) {
    target[key] = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  function setPointMode(point, mode) {
    if (mode === "hex") {
      const first = outdoor.editableHexes[0];
      Object.keys(point).forEach((key) => delete point[key]);
      Object.assign(point, { hex: first?.id ?? "", dx: 0, dy: 0 });
    } else {
      const resolved = resolveWaypoint(point, outdoor.hexById, outdoor.size);
      Object.keys(point).forEach((key) => delete point[key]);
      Object.assign(point, { x: Math.round(resolved.x), y: Math.round(resolved.y) });
    }
  }

  function ensureBoothAt() {
    if (!selected.value || !selectedIsPassage.value) return;
    if (selected.value.boothAt) return;
    const at = resolveWaypoint(selected.value.at, outdoor.hexById, outdoor.size);
    selected.value.boothAt = {
      x: Math.round(at.x - 13),
      y: Math.round(at.y - 10),
    };
  }

  function removeBoothAt() {
    if (!selected.value || !selectedIsPassage.value) return;
    delete selected.value.boothAt;
    if (selectedHandleId.value === "booth") selectedHandleId.value = null;
  }

  function removePoint(index) {
    if (!selected.value?.points || selected.value.points.length <= 2) return;
    selected.value.points.splice(index, 1);
  }

  function movePoint(index, delta) {
    const list = selected.value?.points;
    const next = index + delta;
    if (!list || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
  }

  function focusSelection() {
    if (!selected.value) return;
    let point = null;
    if (selectedIsPlacement.value) point = axialToPixel(selected.value.q, selected.value.r, outdoor.size);
    else if (editHandles.value.length) {
      point = {
        x: editHandles.value.reduce((sum, handle) => sum + handle.x, 0) / editHandles.value.length,
        y: editHandles.value.reduce((sum, handle) => sum + handle.y, 0) / editHandles.value.length,
      };
    }
    if (point) focusPoint(point);
  }

  return {
    selected,
    selectedType,
    selectedStand,
    landmarkEditDirty,
    standEditDirty,
    selectedIsLine,
    selectedIsPassage,
    selectedIsPlacement,
    editMode,
    editHandles,
    builderEdit,
    filteredGroups,
    select,
    selectFeature,
    onHandleMove,
    onBuilderMapClick,
    toggleAddPointMode,
    beginAddStand,
    confirmAddStand,
    cancelStandDraft,
    beginAddLandmark,
    confirmAddLandmark,
    cancelLandmarkDraft,
    saveLandmarkEdit,
    backToHexFromLandmark,
    saveStandEdit,
    backToHexFromStand,
    addHex,
    addRoute,
    addBarrier,
    addCascade,
    removeCascade,
    addPassage,
    duplicateSelected,
    deleteSelected,
    renameSelected,
    moveSelected,
    pointMode,
    csv,
    setCsv,
    setPointMode,
    ensureBoothAt,
    removeBoothAt,
    removePoint,
    movePoint,
    focusSelection,
  };
}
