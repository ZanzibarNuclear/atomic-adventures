import { computed } from "vue";
import {
  availablePassageCrossings,
  resolvePassageStand,
  shouldOfferPassageCrossing,
} from "./usePassageCrossing.js";
import {
  applyPassageCrossEffects,
  applyPassageUnlock,
  passageRequirementSatisfied,
} from "./usePassageState.js";
import { barrierHintAtStand } from "./useBarrierStand.js";

function isGatePassage(opening) {
  return opening?.kind === "gate";
}

export function useOutdoorPassages({
  state,
  gameState,
  editableFeatures,
  hexById,
  size,
  hexAtPoint,
  getTravelBarrierCtx,
  getCurrentHex,
  getAvatarFromPos,
  applyMove,
}) {
  function isPassageOpen(opening) {
    if (!isGatePassage(opening)) return true;
    if (!gameState) return true;
    if (Object.hasOwn(state.passageStates, opening.id)) {
      return state.passageStates[opening.id] === true;
    }
    return false;
  }

  function isPassageAvailable(opening) {
    if (isGatePassage(opening)) return isPassageOpen(opening);
    return passageRequirementSatisfied(opening, gameState?.flags);
  }

  const passageCrossings = computed(() => {
    const ctx = getTravelBarrierCtx();
    const fromPos = getAvatarFromPos();
    return availablePassageCrossings({
      hexId: state.currentId,
      fromPos,
      mapFeatures: editableFeatures.value,
      ctx,
      hexById: hexById.value,
      size: size.value,
      discoveredOpenings: state.discoveredOpenings,
      atBarrier:
        barrierHintAtStand(fromPos, ctx.barriers) ??
        state.atBarrier ??
        state.lastBlocked,
    });
  });

  const lockedPassageActions = computed(() => {
    const ctx = getTravelBarrierCtx();
    const fromPos = getAvatarFromPos();
    const atBarrier =
      barrierHintAtStand(fromPos, ctx.barriers) ??
      state.atBarrier ??
      state.lastBlocked;
    return ctx.allOpenings
      .filter((opening) => opening.hex === state.currentId)
      .filter((opening) => !isGatePassage(opening))
      .filter((opening) => opening.unlock)
      .filter((opening) => !passageRequirementSatisfied(opening, gameState?.flags))
      .filter((opening) => shouldOfferPassageCrossing(opening, fromPos, ctx, atBarrier))
      .map((opening) => ({
        openingId: opening.id,
        label: opening.unlock.label ?? "Unlock the passage",
        status: opening.unlock.status ?? null,
      }));
  });

  const passageMarkerStates = computed(() =>
    Object.fromEntries(
      editableFeatures.value
        .filter((feature) => feature.kind === "gate")
        .map((feature) => [feature.id, isPassageOpen(feature)]),
    ),
  );

  const passageToggleActions = computed(() => {
    const ctx = getTravelBarrierCtx();
    const fromPos = getAvatarFromPos();
    const atBarrier =
      barrierHintAtStand(fromPos, ctx.barriers) ??
      state.atBarrier ??
      state.lastBlocked;
    return ctx.allOpenings
      .filter((opening) => opening.hex === state.currentId)
      .filter((opening) => isGatePassage(opening))
      .filter((opening) => shouldOfferPassageCrossing(opening, fromPos, ctx, atBarrier))
      .map((opening) => ({
        openingId: opening.id,
        label: isPassageOpen(opening) ? "Close the gate" : "Open the gate",
        open: isPassageOpen(opening),
      }));
  });

  function crossPassage(openingId) {
    const fromHex = getCurrentHex();
    if (!fromHex || !openingId) return;
    const fromPos = getAvatarFromPos();
    const ctx = getTravelBarrierCtx();
    const opening = ctx.openings.find((o) => o.id === openingId);
    if (!opening) return;
    const feature = editableFeatures.value.find((f) => f.id === openingId);
    if (feature?.hex !== fromHex.id) return;
    if (
      !shouldOfferPassageCrossing(
        opening,
        fromPos,
        ctx,
        barrierHintAtStand(fromPos, ctx.barriers) ??
          state.atBarrier ??
          state.lastBlocked,
      )
    ) {
      return;
    }

    const stand = resolvePassageStand(opening, fromPos, ctx, size.value, fromHex);
    if (!stand) return;
    if (hexAtPoint(stand, fromHex.id) !== fromHex.id) return;

    applyMove({
      hexId: fromHex.id,
      stand,
      blocked: null,
      atBarrier: barrierHintAtStand(stand, ctx.barriers),
    });

    applyPassageCrossEffects(opening, gameState?.flags);
  }

  function unlockPassage(openingId) {
    if (!lockedPassageActions.value.some((action) => action.openingId === openingId)) {
      return false;
    }
    const opening = getTravelBarrierCtx().allOpenings.find(
      (candidate) => candidate.id === openingId,
    );
    return applyPassageUnlock(opening, gameState?.flags);
  }

  function togglePassage(openingId) {
    const action = passageToggleActions.value.find(
      (candidate) => candidate.openingId === openingId,
    );
    if (!action) return false;
    state.passageStates = {
      ...state.passageStates,
      [openingId]: !action.open,
    };
    return true;
  }

  function setPassageOpen(openingId, open = true) {
    const opening = getTravelBarrierCtx().allOpenings.find(
      (candidate) => candidate.id === openingId,
    );
    if (!opening || !isGatePassage(opening)) return false;
    state.passageStates = {
      ...state.passageStates,
      [openingId]: Boolean(open),
    };
    return true;
  }

  return {
    isPassageAvailable,
    passageCrossings,
    lockedPassageActions,
    passageToggleActions,
    passageMarkerStates,
    unlockPassage,
    togglePassage,
    setPassageOpen,
    crossPassage,
  };
}
