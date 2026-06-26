import { hexCorners, axialToPixel } from "../composables/useHexGeometry.js";
import { sideOfLine } from "../geometry/segments.js";

export function hexPolygon(hex, size) {
  if (!hex || size == null) return [];
  const center = axialToPixel(hex.q, hex.r, size);
  return hexCorners(center.x, center.y, size);
}

export function pointInHexPolygon(point, hex, size) {
  if (!point || !hex || size == null) return false;
  const corners = hexPolygon(hex, size);
  if (corners.length < 3) return false;
  const eps = 1e-6;
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const cross = sideOfLine(point, a, b);
    if (Math.abs(cross) <= eps) continue;
    const nextSign = Math.sign(cross);
    if (sign && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

export function segmentInsideHex(a, b, hex, size, interpolate) {
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    if (!pointInHexPolygon(interpolate(a, b, t), hex, size)) return false;
  }
  return true;
}
