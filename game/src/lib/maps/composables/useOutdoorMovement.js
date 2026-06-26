import { ref } from "vue";
import {
  availableMoves,
  buildMovePath,
  routeLegBetween,
} from "./useRoutes.js";
import { hexDistance } from "./useHexGeometry.js";
import { resolveNeighborStand } from "./useAvatarStand.js";
import { barrierHintAtStand } from "./useBarrierStand.js";
import { resolveMove } from "./useTravelBarriers.js";

export function useOutdoorMovement({
  state,
  hexById,
  size,
  routeModels,
  moves,
  travelOpts,
  avatarFromPos,
  travelBarrierCtx,
  hexAtPoint,
  applyMove,
  advanceTime = () => {},
}) {
  const traveling = ref(false);

  function isAdjacentHex(hexId) {
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return false;
    return hexDistance(fromHex, toHex) === 1;
  }

  function resolveRouteLeg(toHexId) {
    const opts = travelOpts.value;
    const fromId = state.currentId;
    return (
      moves.value.find((m) => m.toHexId === toHexId) ??
      availableMoves(fromId, routeModels.value, opts).find(
        (m) => m.toHexId === toHexId,
      ) ??
      routeLegBetween(fromId, toHexId, routeModels.value)
    );
  }

  // "Reach" in the outdoor UI means "enter the destination cell"; the final
  // stand may still be an accessible-side barrier stop inside that cell.
  function previewMove(hexId) {
    if (hexId === state.currentId || !isAdjacentHex(hexId)) return null;
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return null;

    const fromPos = avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const toPos = resolveNeighborStand(fromHex, toHex, fromPos, size.value, ctx);
    const routeLeg = resolveRouteLeg(hexId);
    const path = buildMovePath(
      fromPos,
      fromHex,
      toHex,
      toPos,
      routeLeg,
      routeModels.value,
    );
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path,
      ctx,
      hexAtPoint,
      size: size.value,
    });
    return { fromHex, toHex, fromPos, toPos, routeLeg, path, result };
  }

  function canReachHex(hexId) {
    if (hexId === state.currentId) return true;
    const preview = previewMove(hexId);
    return preview?.result.activeHexId === preview?.toHex.id;
  }

  function moveTo(hexId) {
    if (traveling.value || !hexById.value[hexId]) return;
    const preview = previewMove(hexId);
    if (!preview || preview.result.activeHexId !== preview.toHex.id) return;
    const { fromHex, toHex, fromPos, result } = preview;
    const ctx = travelBarrierCtx.value;

    traveling.value = true;
    setTimeout(() => {
      traveling.value = false;
    }, 650);

    const enteredDest = result.activeHexId === toHex.id;
    const failedCrossing = result.blockedKind && !enteredDest;
    const blockedInPlace =
      result.blockedKind &&
      result.activeHexId === fromHex.id &&
      !enteredDest;
    let atBarrier =
      result.blockedKind && enteredDest ? result.blockedKind : null;
    if (!atBarrier && enteredDest) {
      atBarrier = barrierHintAtStand(result.stand, ctx.barriers);
    }

    applyMove({
      hexId: result.activeHexId,
      stand: blockedInPlace ? fromPos : result.stand,
      blocked: failedCrossing || blockedInPlace ? result.blockedKind : null,
      atBarrier: blockedInPlace ? result.blockedKind : atBarrier,
      previousId: fromHex.id,
    });
    if (enteredDest) advanceTime();
  }

  return {
    traveling,
    isAdjacentHex,
    previewMove,
    canReachHex,
    moveTo,
  };
}
