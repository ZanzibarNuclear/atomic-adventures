import { computed, reactive, ref, watch } from "vue";
import {
  listAllGridEditable,
  findGridEditable,
  gridEditModeForSource,
  resolvedPathHandles,
  resolvedPathNodeHandles,
  resolvedRoomHandles,
  resolvedDoorHandle,
  resolvedNodeHandle,
  setPathPoint,
  addPathPoint,
  addPathNode,
  removePathPoint,
  removePathNodeFromPath,
  setRoomFromHandle,
  setDoorAt,
  setNodeAt,
  setExitMapAt,
  resolvedExitHandle,
  exportBuildingYaml,
} from "./useGridBuilder.js";

export function useGridMapBuilder(indoor, ctx) {
  const { builderView, place } = ctx;

  const gridEditSelection = ref("");
  const gridSelectedHandleId = ref(null);
  const gridAddPointMode = ref(false);
  const gridAddNodeMode = ref(false);
  const gridExportStatus = ref("");

  const gridEditableItems = computed(() =>
    listAllGridEditable(indoor.editableBuildingData, indoor.indoor.viewLevel),
  );

  const gridEditParsed = computed(() => {
    if (!gridEditSelection.value) return null;
    const [source, id] = gridEditSelection.value.split(":");
    const entity = findGridEditable(indoor.editableBuildingData, source, id);
    if (!entity) return null;
    return { source, id, entity };
  });

  const gridEditMode = computed(() => {
    if (!gridEditParsed.value) return null;
    return gridEditModeForSource(gridEditParsed.value.source);
  });

  const gridSelectedPathNodeId = computed(() => {
    const m = gridSelectedHandleId.value?.match(/^node-(.+)$/);
    return m?.[1] ?? null;
  });

  const gridSelectedPathNode = computed(() => {
    const id = gridSelectedPathNodeId.value;
    if (!id) return null;
    return (
      indoor.editableBuildingData.exterior?.nodes?.find((n) => n.id === id) ??
      null
    );
  });

  const gridCell = computed(() => indoor.editableBuildingData.cell ?? 64);

  const gridEditHandles = computed(() => {
    const parsed = gridEditParsed.value;
    if (!parsed) return [];
    const cell = gridCell.value;
    if (parsed.source === "paths") {
      return [
        ...resolvedPathHandles(parsed.entity, cell, indoor.editableBuildingData),
        ...resolvedPathNodeHandles(
          indoor.editableBuildingData,
          parsed.entity,
          cell,
        ),
      ];
    }
    if (parsed.source === "rooms") {
      return resolvedRoomHandles(parsed.entity, cell);
    }
    if (parsed.source === "doors") {
      if (parsed.entity.kind === "roll") return [];
      return resolvedDoorHandle(parsed.entity, cell);
    }
    if (parsed.source === "nodes") {
      return resolvedNodeHandle(parsed.entity, cell);
    }
    if (parsed.source === "exits") {
      return resolvedExitHandle(parsed.entity, cell);
    }
    return [];
  });

  const gridBuilderEdit = computed(
    () =>
      builderView.value &&
      place.value === "indoors" &&
      gridEditParsed.value != null,
  );

  const gridRollDoorRoom = computed(() => {
    const door = gridEditParsed.value?.entity;
    if (!door || door.kind !== "roll" || !door.room) return null;
    return (
      indoor.editableBuildingData.rooms?.find((r) => r.id === door.room) ?? null
    );
  });

  watch(builderView, (on) => {
    if (on && place.value === "indoors" && !gridEditSelection.value) {
      const items = gridEditableItems.value;
      if (items.length) {
        gridEditSelection.value = `${items[0].source}:${items[0].id}`;
      }
    }
    if (!on) {
      gridAddPointMode.value = false;
      gridAddNodeMode.value = false;
      gridSelectedHandleId.value = null;
    }
  });

  watch(
    () => place.value,
    (p) => {
      if (p !== "indoors") {
        gridEditSelection.value = "";
        gridSelectedHandleId.value = null;
        gridAddPointMode.value = false;
        gridAddNodeMode.value = false;
      } else if (builderView.value && !gridEditSelection.value) {
        const items = gridEditableItems.value;
        if (items.length) {
          gridEditSelection.value = `${items[0].source}:${items[0].id}`;
        }
      }
    },
  );

  watch(gridAddPointMode, (on) => {
    if (on) gridAddNodeMode.value = false;
  });
  watch(gridAddNodeMode, (on) => {
    if (on) gridAddPointMode.value = false;
  });

  watch(gridEditSelection, () => {
    gridSelectedHandleId.value = null;
    gridAddPointMode.value = false;
    gridAddNodeMode.value = false;
  });

  watch(
    () => indoor.indoor.viewLevel,
    () => {
      if (!gridEditSelection.value) return;
      const [source, id] = gridEditSelection.value.split(":");
      if (!findGridEditable(indoor.editableBuildingData, source, id)) {
        const items = gridEditableItems.value;
        gridEditSelection.value = items.length
          ? `${items[0].source}:${items[0].id}`
          : "";
      }
    },
  );

  function onGridSelectItem({ source, id }) {
    gridEditSelection.value = `${source}:${id}`;
  }

  function onGridHandleMove(payload) {
    const parsed = gridEditParsed.value;
    if (!parsed) return;
    const cell = gridCell.value;
    const xUnits = payload.x / cell;
    const yUnits = payload.y / cell;
    const { role, index } = payload;

    if (parsed.source === "paths") {
      if (role === "path-node" && payload.nodeId) {
        setNodeAt(
          indoor.editableBuildingData,
          payload.nodeId,
          xUnits,
          yUnits,
        );
        return;
      }
      setPathPoint(
        indoor.editableBuildingData,
        parsed.id,
        index,
        xUnits,
        yUnits,
      );
      return;
    }
    if (parsed.source === "rooms") {
      setRoomFromHandle(
        indoor.editableBuildingData,
        parsed.id,
        role,
        xUnits,
        yUnits,
      );
      return;
    }
    if (parsed.source === "doors") {
      setDoorAt(indoor.editableBuildingData, parsed.id, xUnits, yUnits);
      return;
    }
    if (parsed.source === "nodes") {
      setNodeAt(indoor.editableBuildingData, parsed.id, xUnits, yUnits);
      return;
    }
    if (parsed.source === "exits") {
      setExitMapAt(indoor.editableBuildingData, parsed.id, xUnits, yUnits);
    }
  }

  function onGridBuilderMapClick(payload) {
    const parsed = gridEditParsed.value;
    if (!parsed || parsed.source !== "paths") return;
    const kind =
      payload.kind ??
      (gridAddNodeMode.value ? "node" : gridAddPointMode.value ? "point" : null);
    if (!kind) return;

    const cell = gridCell.value;
    const xu = payload.x / cell;
    const yu = payload.y / cell;

    if (kind === "node") {
      const nodeId = addPathNode(
        indoor.editableBuildingData,
        parsed.id,
        xu,
        yu,
      );
      gridSelectedHandleId.value = nodeId ? `node-${nodeId}` : null;
      return;
    }

    if (kind === "point") {
      const idx = addPathPoint(indoor.editableBuildingData, parsed.id, xu, yu);
      gridSelectedHandleId.value = idx >= 0 ? `point-${idx}` : null;
    }
  }

  function deleteGridSelectedPoint() {
    const parsed = gridEditParsed.value;
    if (!parsed || parsed.source !== "paths") return;
    const match = gridSelectedHandleId.value?.match(/^point-(\d+)$/);
    if (!match) return;
    const idx = Number(match[1]);
    if (!removePathPoint(indoor.editableBuildingData, parsed.id, idx)) return;
    const path = parsed.entity;
    const next = Math.min(idx, path.points.length - 1);
    gridSelectedHandleId.value = next >= 0 ? `point-${next}` : null;
  }

  function deleteGridSelectedPathNode() {
    const parsed = gridEditParsed.value;
    if (!parsed || parsed.source !== "paths") return;
    const nodeId = gridSelectedPathNodeId.value;
    if (!nodeId) return;
    if (
      !removePathNodeFromPath(
        indoor.editableBuildingData,
        parsed.id,
        nodeId,
      )
    ) {
      return;
    }
    gridSelectedHandleId.value = null;
  }

  function toggleGridSmooth() {
    const path = gridEditParsed.value?.entity;
    if (!path || gridEditParsed.value.source !== "paths") return;
    path.smooth = !path.smooth;
  }

  async function copyGridYaml(which) {
    const yaml = exportBuildingYaml(indoor.editableBuildingData);
    const text = yaml[which] || yaml.all;
    try {
      await navigator.clipboard.writeText(text);
      gridExportStatus.value = `Copied ${which} YAML`;
    } catch {
      gridExportStatus.value = "Copy failed — try Download";
    }
    setTimeout(() => {
      gridExportStatus.value = "";
    }, 2500);
  }

  function downloadGridYaml() {
    const yaml = exportBuildingYaml(indoor.editableBuildingData);
    const blob = new Blob([yaml.all], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "utility-station-export.yaml";
    a.click();
    URL.revokeObjectURL(url);
    gridExportStatus.value = "Downloaded utility-station-export.yaml";
    setTimeout(() => {
      gridExportStatus.value = "";
    }, 2500);
  }

  function resetGridBuilder() {
    indoor.syncFromBuildingData(indoor.buildingData);
    gridSelectedHandleId.value = null;
    gridExportStatus.value = "Reset to file defaults";
    setTimeout(() => {
      gridExportStatus.value = "";
    }, 2500);
  }

  return reactive({
    gridEditSelection,
    gridSelectedHandleId,
    gridAddPointMode,
    gridAddNodeMode,
    gridExportStatus,
    gridEditableItems,
    gridEditParsed,
    gridEditMode,
    gridSelectedPathNodeId,
    gridSelectedPathNode,
    gridCell,
    gridEditHandles,
    gridBuilderEdit,
    gridRollDoorRoom,
    onGridSelectItem,
    onGridHandleMove,
    onGridBuilderMapClick,
    deleteGridSelectedPoint,
    deleteGridSelectedPathNode,
    toggleGridSmooth,
    copyGridYaml,
    downloadGridYaml,
    resetGridBuilder,
  });
}
