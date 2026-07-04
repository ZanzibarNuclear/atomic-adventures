import { computed } from "vue";
import { hasFlag, requireSatisfied, setFlags } from "../useFlags.js";
import { evaluateRequirements } from "../../../character/requirements.js";
import { applyEffectsAtomically } from "../../../character/effects.js";
import { advanceGameTime } from "../../../character/gameTime.js";
import { applyHydroStartupAction } from "../../../../composables/useHydroFacility.js";

export function createIndoorActions({
  building,
  indoor,
  setHydroOnline,
  builderView,
  flagsAreShared = false,
  character,
  gameState,
}) {
  const availableActions = computed(() => {
    if (builderView.value) return [];
    const actions = building.value.actions ?? [];
    const roomId = indoor.currentRoom;
    const nodeId = indoor.exteriorNode;

    return actions.filter((action) => {
      if (action.room && action.room !== roomId) return false;
      if (action.stand && action.stand !== indoor.currentStand) return false;
      if (action.exteriorNode && action.exteriorNode !== nodeId) return false;
      if (!action.room && !action.exteriorNode) return false;
      if (action.once !== false && indoor.completedActions.has(action.id)) {
        return false;
      }
      return character
        ? evaluateRequirements(action.require, { character, flags: indoor.flags }).ok
        : requireSatisfied(action.require, indoor.flags);
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
    if (!action) return { ok: false, error: "Unknown indoor action." };
    if (!availableActions.value.some((a) => a.id === actionId)) {
      return { ok: false, error: "Indoor action is not available." };
    }

    if (character) {
      const effects = [
        ...(action.effects ?? []),
        ...(action.sets ?? []).map((id) => ({ op: "flag.set", id })),
        ...(action.set_flags ?? []).map((id) => ({ op: "flag.set", id })),
      ];
      const result = applyEffectsAtomically(effects, {
        character,
        flags: indoor.flags,
      });
      if (!result.ok) return result;
    } else {
      setFlags(indoor.flags, action.sets);
      setFlags(indoor.flags, action.set_flags);
    }
    if (gameState && Number(action.timeMinutes) > 0) {
      const timeResult = advanceGameTime(gameState, Number(action.timeMinutes), action.activity ?? "light");
      if (!timeResult.ok) return timeResult;
    }
    applyHydroStartupAction(gameState, action.id);
    if (action.powerOn) setHydroOnline(true);
    if (action.once !== false) {
      indoor.completedActions.add(actionId);
    }
    return {
      ok: true,
      view: action.view && typeof action.view === "object" ? { ...action.view } : null,
    };
  }

  function resetActions() {
    if (!flagsAreShared) {
      indoor.flags.clear();
    }
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
