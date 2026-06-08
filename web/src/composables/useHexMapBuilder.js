import { computed, reactive, ref, watch } from "vue";
import {
  listEditableLines,
  findEditableLine,
  resolvedWaypoints,
  setWaypointWorld,
  addWaypoint,
  removeWaypoint,
  exportMapYaml,
  listEditablePlacements,
  findEditablePlacement,
  resolvedPlacementHandles,
  setLandmarkWorld,
  setStandWorld,
  ensureDefaultStandAt,
} from "./useMapBuilder.js";
import {
  landmarkAnchor,
  resolveAvatarPosition,
  hasLandmarkMarker,
} from "./useAvatarStand.js";

export function useHexMapBuilder(outdoor, builderView) {
  const size = outdoor.size;

  const editableItems = computed(() => [
    ...listEditablePlacements(outdoor.editableHexes),
    ...listEditableLines(outdoor.editableRoutes, outdoor.editableFeatures),
  ]);

  const editSelection = ref("");
  const selectedHandleId = ref(null);
  const addPointMode = ref(false);
  const exportStatus = ref("");

  const editParsed = computed(() => {
    if (!editSelection.value) return null;
    const [source, id] = editSelection.value.split(":");
    if (source === "hexes") {
      const hex = findEditablePlacement(outdoor.editableHexes, id);
      if (!hex) return null;
      return { source, id, hex };
    }
    const line = findEditableLine(
      outdoor.editableRoutes,
      outdoor.editableFeatures,
      source,
      id,
    );
    if (!line) return null;
    return { source, id, line };
  });

  const editMode = computed(() => {
    if (!editParsed.value) return null;
    return editParsed.value.source === "hexes" ? "placement" : "line";
  });

  const editHandles = computed(() => {
    const parsed = editParsed.value;
    if (!parsed) return [];
    if (parsed.source === "hexes") {
      return resolvedPlacementHandles(parsed.hex, size).map((h) => ({
        ...h,
        handleKey: h.role,
      }));
    }
    return resolvedWaypoints(parsed.line, outdoor.hexById, size).map((h) => ({
      ...h,
      handleKey: `point-${h.index}`,
    }));
  });

  const builderEdit = computed(
    () => builderView.value && editParsed.value != null,
  );

  const standAnchoredToLandmark = computed(
    () => editParsed.value?.hex?.standAt?.from === "landmark",
  );

  watch(builderView, (on) => {
    if (on && !editSelection.value && editableItems.value.length) {
      const first = editableItems.value[0];
      editSelection.value = `${first.source}:${first.id}`;
    }
    if (!on) {
      addPointMode.value = false;
      selectedHandleId.value = null;
    }
  });

  watch(editSelection, (sel) => {
    selectedHandleId.value = null;
    addPointMode.value = false;
    if (!sel.startsWith("hexes:")) return;
    const id = sel.split(":")[1];
    const hex = findEditablePlacement(outdoor.editableHexes, id);
    if (hex) {
      ensureDefaultStandAt(hex);
      outdoor.state.currentId = id;
    }
  });

  function onSelectHandle(handleKey) {
    selectedHandleId.value = handleKey;
  }

  function onWaypointMove(payload) {
    const parsed = editParsed.value;
    if (!parsed) return;
    const { x, y, role, index } = payload;

    if (parsed.source === "hexes") {
      if (role === "landmark") setLandmarkWorld(parsed.hex, x, y, size);
      else if (role === "stand") setStandWorld(parsed.hex, x, y, size);
      return;
    }

    setWaypointWorld(parsed.line, index, x, y, outdoor.hexById, size);
  }

  function onBuilderMapClick({ x, y }) {
    const parsed = editParsed.value;
    if (!parsed || parsed.source === "hexes") return;
    const idx = addWaypoint(parsed.line, x, y);
    selectedHandleId.value = `point-${idx}`;
  }

  function deleteSelectedPoint() {
    const parsed = editParsed.value;
    if (!parsed || parsed.source === "hexes") return;
    const match = selectedHandleId.value?.match(/^point-(\d+)$/);
    if (!match) return;
    const idx = Number(match[1]);
    if (!removeWaypoint(parsed.line, idx)) return;
    const next = Math.min(idx, parsed.line.points.length - 1);
    selectedHandleId.value = next >= 0 ? `point-${next}` : null;
  }

  function toggleSmooth() {
    const parsed = editParsed.value;
    if (!parsed?.line) return;
    parsed.line.smooth = !parsed.line.smooth;
  }

  function toggleStandAnchor() {
    const hex = editParsed.value?.hex;
    if (!hasLandmarkMarker(hex)) return;
    const pos = resolveAvatarPosition(hex, size);
    if (hex.standAt?.from === "landmark") {
      hex.standAt = { x: Math.round(pos.x), y: Math.round(pos.y) };
    } else {
      const anchor = landmarkAnchor(hex, size);
      hex.standAt = {
        from: "landmark",
        dx: Math.round(((pos.x - anchor.x) / size) * 100) / 100,
        dy: Math.round(((pos.y - anchor.y) / size) * 100) / 100,
      };
    }
  }

  async function copyYaml(which) {
    const yaml = exportMapYaml(
      outdoor.editableRoutes,
      outdoor.editableFeatures,
      outdoor.editableHexes,
    );
    const text = yaml[which] || yaml.both;
    try {
      await navigator.clipboard.writeText(text);
      exportStatus.value = `Copied ${which} YAML`;
    } catch {
      exportStatus.value = "Copy failed — try Download";
    }
    setTimeout(() => {
      exportStatus.value = "";
    }, 2500);
  }

  function downloadYaml() {
    const yaml = exportMapYaml(
      outdoor.editableRoutes,
      outdoor.editableFeatures,
      outdoor.editableHexes,
    );
    const blob = new Blob([yaml.both], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map-export.yaml";
    a.click();
    URL.revokeObjectURL(url);
    exportStatus.value = "Downloaded map-export.yaml";
    setTimeout(() => {
      exportStatus.value = "";
    }, 2500);
  }

  function resetMapBuilder() {
    outdoor.syncFromMapData(outdoor.mapData);
    selectedHandleId.value = null;
    exportStatus.value = "Reset to file defaults";
    setTimeout(() => {
      exportStatus.value = "";
    }, 2500);
  }

  return reactive({
    editableItems,
    editSelection,
    selectedHandleId,
    addPointMode,
    exportStatus,
    editParsed,
    editMode,
    editHandles,
    builderEdit,
    standAnchoredToLandmark,
    onSelectHandle,
    onWaypointMove,
    onBuilderMapClick,
    deleteSelectedPoint,
    toggleSmooth,
    toggleStandAnchor,
    copyYaml,
    downloadYaml,
    resetMapBuilder,
    hasLandmarkMarker,
  });
}
