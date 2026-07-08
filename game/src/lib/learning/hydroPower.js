export const GRAVITY_MS2 = 9.80665;
export const WATER_DENSITY_KG_M3 = 1000;

export function netHeadMeters(grossHeadM, headLossM = 0) {
  return Math.max(0, finite(grossHeadM) - Math.max(0, finite(headLossM)));
}

export function hydraulicPowerWatts({
  densityKgM3 = WATER_DENSITY_KG_M3,
  gravityMs2 = GRAVITY_MS2,
  flowM3s,
  headM,
} = {}) {
  return Math.max(0, finite(densityKgM3)) *
    Math.max(0, finite(gravityMs2)) *
    Math.max(0, finite(flowM3s)) *
    Math.max(0, finite(headM));
}

export function electricalPowerWatts({
  efficiency = 1,
  densityKgM3 = WATER_DENSITY_KG_M3,
  gravityMs2 = GRAVITY_MS2,
  flowM3s,
  grossHeadM = null,
  headLossM = 0,
  netHeadM = null,
} = {}) {
  const headM = netHeadM == null
    ? netHeadMeters(grossHeadM, headLossM)
    : Math.max(0, finite(netHeadM));
  return clamp01(efficiency) * hydraulicPowerWatts({
    densityKgM3,
    gravityMs2,
    flowM3s,
    headM,
  });
}

export function formatPowerWatts(watts) {
  const value = finite(watts);
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${formatNumber(value / 1_000_000)} MW`;
  if (absolute >= 1_000) return `${formatNumber(value / 1_000)} kW`;
  return `${formatNumber(value)} W`;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finite(value)));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  const rounded = Math.abs(value) >= 100
    ? Math.round(value)
    : Math.round(value * 10) / 10;
  return rounded.toLocaleString();
}
