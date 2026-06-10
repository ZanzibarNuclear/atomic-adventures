import { computed } from "vue";
import { hasFlag, requireSatisfied, setFlags } from "../useFlags.js";

export function createIndoorActions({
  building,
  indoor,
  setHydroOnline,
  builderView,
}) {
  const availableActions = computed(() => {
    if (builderView.value) return [];
    const actions = building.value.actions ?? [];
    const roomId = indoor.currentRoom;
    const nodeId = indoor.exteriorNode;

    return actions.filter((action) => {
      if (action.room && action.room !== roomId) return false;
      if (action.exteriorNode && action.exteriorNode !== nodeId) return false;
      if (!action.room && !action.exteriorNode) return false;
      if (action.once !== false && indoor.completedActions.has(action.id)) {
        return false;
      }
      return requireSatisfied(action.require, indoor.flags);
    });
  });

  const hydroDiscovered = computed(
    () => hasFlag(indoor.flags, "hydro.discovered") || indoor.facility.hydroOnline,
  );

  const powerOn = computed(
    () =>
      indoor.facility.hydroOnline || hasFlag(indoor.flags, "hub.hydro_online"),
  );

  function performAction(actionId) {
    const action = (building.value.actions ?? []).find((a) => a.id === actionId);
    if (!action) return;
    if (!availableActions.value.some((a) => a.id === actionId)) return;

    setFlags(indoor.flags, action.sets);
    if (action.powerOn) setHydroOnline(true);
    if (action.once !== false) {
      indoor.completedActions.add(actionId);
    }
  }

  function resetActions() {
    indoor.flags.clear();
    indoor.completedActions.clear();
  }

  return {
    availableActions,
    hydroDiscovered,
    powerOn,
    performAction,
    resetActions,
  };
}
