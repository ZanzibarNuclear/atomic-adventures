/** Do segments AB and CD intersect (strict crossing, not collinear touch)? */
export function segmentsCross(a, b, c, d) {
  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Intersection of segment AB with segment CD; t is param along AB in [0, 1]. */
export function segmentIntersection(a, b, c, d) {
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) return null;
  const t =
    ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  const u =
    ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    t,
  };
}

/** Signed area — which side of line AB point P lies on. */
export function sideOfLine(p, a, b) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
