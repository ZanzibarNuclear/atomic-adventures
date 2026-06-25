/** Which point-feature kinds allow crossing each barrier kind. */
export const BARRIER_OPENINGS = {
  fence: ["gate", "hole"],
  river: ["bridge", "ford"],
  cliff: ["stair"],
  ravine: ["bridge"],
};

export const BARRIER_KINDS = Object.keys(BARRIER_OPENINGS);

/** Point features — not drawable / routable polylines. */
export const BARRIER_OPENING_KINDS = new Set(
  Object.values(BARRIER_OPENINGS).flat(),
);

/** All barrier polylines from feature models. */
export function barrierSegments(featureModels) {
  const segs = [];
  for (const model of featureModels) {
    if (!BARRIER_KINDS.includes(model.kind)) continue;
    for (let i = 0; i < model.points.length - 1; i++) {
      segs.push({ a: model.points[i], b: model.points[i + 1], kind: model.kind });
    }
  }
  return segs;
}

export function fenceSegments(featureModels) {
  return barrierSegments(featureModels).filter((segment) => segment.kind === "fence");
}

export function riverSegments(featureModels) {
  return barrierSegments(featureModels).filter((segment) => segment.kind === "river");
}

export function barrierList(ctx) {
  return ctx.barriers ?? [...(ctx.fences ?? []), ...(ctx.rivers ?? [])];
}
