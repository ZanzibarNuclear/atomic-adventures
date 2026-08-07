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
import { planKnownHexPath } from "./knownAreaOutdoorTravel.js";

const STEP_MS = 650;

function prefersReducedMapMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function outdoorStepWaitMs() {
  if (prefersReducedMapMotion()) return 0;
  return STEP_MS;
}

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
  let travelToken = 0;

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
  function previewMove(
    hexId,
    { fromHexId = null, fromPos = null, allowOpenings = null } = {},
  ) {
    const fromId = fromHexId ?? state.currentId;
    if (hexId === fromId || !isAdjacentBetween(fromId, hexId)) return null;
    const fromHex = hexById.value[fromId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return null;

    const stand = fromPos ?? avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const toPos = resolveNeighborStand(fromHex, toHex, stand, size.value, ctx);
    const routeLeg = resolveRouteLeg(hexId);
    const path = buildMovePath(
      stand,
      fromHex,
      toHex,
      toPos,
      routeLeg,
      routeModels.value,
    );
    // Discovery adjacent: openings only on authored routes.
    // Known-area multi-hop steps pass allowOpenings: true explicitly.
    const openings =
      allowOpenings == null ? Boolean(routeLeg) : Boolean(allowOpenings);
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos: stand,
      toPos,
      path,
      ctx,
      hexAtPoint,
      size: size.value,
      allowOpenings: openings,
    });
    return { fromHex, toHex, fromPos: stand, toPos, routeLeg, path, result };
  }

  function isAdjacentBetween(fromId, toId) {
    const fromHex = hexById.value[fromId];
    const toHex = hexById.value[toId];
    if (!fromHex || !toHex) return false;
    return hexDistance(fromHex, toHex) === 1;
  }

  function planToHex(hexId) {
    return planKnownHexPath({
      fromHexId: state.currentId,
      fromStand: avatarFromPos.value,
      toHexId: hexId,
      discovered: state.discovered,
      hexById: hexById.value,
      size: size.value,
      travelCtx: travelBarrierCtx.value,
      hexAtPoint,
      routeModels: routeModels.value,
    });
  }

  function canReachHex(hexId) {
    if (hexId === state.currentId) return true;
    if (!hexById.value[hexId]) return false;
    const discovered = state.discovered;
    const known =
      discovered instanceof Set
        ? discovered.has(hexId)
        : Array.isArray(discovered)
          ? discovered.includes(hexId)
          : false;
    if (!known) {
      // Undiscovered: adjacent discovery travel only.
      const preview = previewMove(hexId);
      return preview?.result.activeHexId === preview?.toHex.id;
    }
    // Discovered: multi-hop known-area path, or single adjacent step.
    if (planToHex(hexId)) return true;
    const preview = previewMove(hexId);
    return preview?.result.activeHexId === preview?.toHex.id;
  }

  function commitStep(preview, options = {}) {
    const { fromHex, toHex, fromPos, result } = preview;
    const ctx = travelBarrierCtx.value;
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
    if (enteredDest && !options.suppressDefaultTime) advanceTime();
    return enteredDest;
  }

  function moveTo(hexId, options = {}) {
    if (traveling.value || !hexById.value[hexId]) return;
    if (hexId === state.currentId) return;

    const discovered = state.discovered;
    const targetKnown =
      discovered instanceof Set
        ? discovered.has(hexId)
        : Array.isArray(discovered)
          ? discovered.includes(hexId)
          : false;

    // Known multi-hop when destination is discovered and farther / path exists.
    if (targetKnown) {
      const plan = planToHex(hexId);
      if (plan?.steps?.length) {
        runMultiHop(plan.steps, options);
        return;
      }
    }

    const preview = previewMove(hexId);
    if (!preview || preview.result.activeHexId !== preview.toHex.id) return;

    traveling.value = true;
    const token = ++travelToken;
    const wait = outdoorStepWaitMs();
    if (wait === 0) {
      traveling.value = false;
    } else {
      setTimeout(() => {
        if (token === travelToken) traveling.value = false;
      }, wait);
    }

    commitStep(preview, options);
  }

  function runMultiHop(steps, options = {}) {
    if (!steps.length) return;
    traveling.value = true;
    const token = ++travelToken;
    const wait = outdoorStepWaitMs();
    let i = 0;

    function stepOnce() {
      if (token !== travelToken) return;
      if (i >= steps.length) {
        traveling.value = false;
        return;
      }
      const step = steps[i];
      const fromId = i === 0 ? state.currentId : steps[i - 1].hexId;
      // Prefer live stand after previous commit.
      const fromPos = state.stand;
      const preview = previewMove(step.hexId, {
        fromHexId: fromId,
        fromPos,
        allowOpenings: true,
      });
      if (!preview || preview.result.activeHexId !== preview.toHex.id) {
        traveling.value = false;
        return;
      }
      const isLast = i === steps.length - 1;
      commitStep(preview, {
        // Advance time once on the final hop of free travel.
        suppressDefaultTime: !isLast || options.suppressDefaultTime,
      });
      i += 1;
      if (i < steps.length) {
        if (wait === 0) {
          stepOnce();
        } else {
          setTimeout(stepOnce, wait);
        }
      } else if (wait === 0) {
        traveling.value = false;
      } else {
        setTimeout(() => {
          if (token === travelToken) traveling.value = false;
        }, wait);
      }
    }

    stepOnce();
  }

  return {
    traveling,
    isAdjacentHex,
    previewMove,
    canReachHex,
    moveTo,
    planToHex,
  };
}
