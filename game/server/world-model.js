const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PASSAGE_KINDS = new Set(["gate", "hole", "bridge", "ford", "stair"]);
export const ROUTE_KINDS = new Set(["road", "drive", "path", "trail"]);

export function normalizeWorld(input = {}) {
  const world = structuredClone(input && typeof input === "object" ? input : {});
  world.orientation = String(world.orientation ?? "pointy");
  world.size = finiteNumber(world.size, 44);
  world.start = nullableText(world.start);
  world.journey = stringList(world.journey);
  delete world.movementAuditRenames;
  world.hexes = Array.isArray(world.hexes) ? world.hexes : [];
  world.hexes.forEach(normalizeHexStands);
  world.features = Array.isArray(world.features) ? world.features : [];
  world.routes = Array.isArray(world.routes) ? world.routes : [];
  world.artifactPlacements = Array.isArray(world.artifactPlacements)
    ? world.artifactPlacements.map((placement) => ({
        ...placement,
        id: text(placement.id),
        hex: nullableText(placement.hex),
        stand: nullableText(placement.stand),
        item: text(placement.item),
        label: nullableText(placement.label),
      }))
    : [];
  return world;
}

function normalizeHexStands(hex) {
  if (!hex || typeof hex !== "object") return;
  const stands = Array.isArray(hex.stands) ? hex.stands : [];
  if (hex.standAt && !stands.length) {
    hex.stands = [{ id: "default", label: "Default stand", at: hex.standAt }];
  } else if (stands.length) {
    hex.stands = stands;
  } else {
    delete hex.stands;
  }
  delete hex.standAt;
}

export function validateWorld(input) {
  const world = normalizeWorld(input);
  const errors = {};
  const warnings = [];
  const add = (path, message) => ((errors[path] ??= []).push(message));
  const warn = (path, message) => warnings.push({ path, message });

  if (world.orientation !== "pointy") add("orientation", "Only pointy-top maps are supported.");
  if (!(world.size > 0)) add("size", "Hex size must be greater than zero.");

  const hexIds = new Set();
  const coordinates = new Set();
  const standIdsByHex = new Map();
  for (const hex of world.hexes) {
    const id = String(hex.id ?? "").trim();
    if (ID_PATTERN.test(id)) hexIds.add(id);
  }
  world.hexes.forEach((hex, index) => {
    const base = `hexes.${index}`;
    hex.id = String(hex.id ?? "").trim();
    hex.q = finiteNumber(hex.q, NaN);
    hex.r = finiteNumber(hex.r, NaN);
    hex.terrain = String(hex.terrain ?? "forest").trim() || "forest";
    if (!ID_PATTERN.test(hex.id)) add(`${base}.id`, "Use a unique kebab-case hex ID.");
    if (world.hexes.findIndex((item) => String(item.id ?? "").trim() === hex.id) !== index) {
      add(`${base}.id`, "Hex IDs must be unique.");
    }
    if (!Number.isInteger(hex.q) || !Number.isInteger(hex.r)) {
      add(`${base}.coordinates`, "Axial q and r coordinates must be integers.");
    } else {
      const key = `${hex.q},${hex.r}`;
      if (coordinates.has(key)) add(`${base}.coordinates`, "Another hex already occupies these coordinates.");
      coordinates.add(key);
    }
    const standIds = new Set();
    (hex.stands ?? []).forEach((stand, standIndex) => {
      const standBase = `${base}.stands.${standIndex}`;
      stand.id = String(stand.id ?? "").trim();
      if (!ID_PATTERN.test(stand.id)) add(`${standBase}.id`, "Use a unique kebab-case stand ID.");
      if (standIds.has(stand.id)) add(`${standBase}.id`, "Stand IDs must be unique within a hex.");
      standIds.add(stand.id);
      if (!validStand(stand.at)) {
        add(`${standBase}.at`, "Stand points need x/y, dx/dy, or a landmark-relative offset.");
      }
      (stand.entryFrom ?? []).forEach((hexId, entryIndex) => {
        if (!hexIds.has(hexId)) {
          warn(`${standBase}.entryFrom.${entryIndex}`, `Unknown outdoor hex "${hexId}".`);
        }
      });
    });
    standIdsByHex.set(hex.id, standIds);
    if (hex.landmark && typeof hex.landmark !== "object") {
      add(`${base}.landmark`, "Landmark must be an object.");
    }
  });

  if (!world.start || !hexIds.has(world.start)) add("start", "Choose an existing start hex.");
  world.journey.forEach((id, index) => {
    if (!hexIds.has(id)) add(`journey.${index}`, "Journey entries must reference existing hexes.");
  });
  validateIds(world.artifactPlacements, "artifactPlacements", errors);
  world.artifactPlacements.forEach((placement, index) => {
    const base = `artifactPlacements.${index}`;
    if (!placement.hex || !hexIds.has(placement.hex)) add(`${base}.hex`, "Artifact placement hex must exist.");
    if (!ID_PATTERN.test(placement.item)) add(`${base}.item`, "Artifact placement item must reference a kebab-case item ID.");
    if (placement.stand && !standIdsByHex.get(placement.hex)?.has(placement.stand)) {
      add(`${base}.stand`, "Artifact placement stand must exist on the placement hex.");
    }
  });

  validateCollection(world.routes, "routes", hexIds, errors, warnings, {
    requirePoints: true,
  });
  validateCollection(world.features, "features", hexIds, errors, warnings);

  world.features.forEach((feature, index) => {
    const base = `features.${index}`;
    if (PASSAGE_KINDS.has(feature.kind)) {
      if (!feature.hex || !hexIds.has(feature.hex)) add(`${base}.hex`, "Passages require an existing hex.");
      if (!validPoint(feature.at, hexIds)) add(`${base}.at`, "Passages require a valid location.");
      if (!["obvious", "hidden"].includes(feature.visibility ?? "obvious")) {
        add(`${base}.visibility`, "Visibility must be obvious or hidden.");
      }
    } else if (ROUTE_KINDS.has(feature.kind)) {
      add(`${base}.kind`, "Roads, drives, paths, and trails belong in routes, not features.");
    } else if (!Array.isArray(feature.points) || feature.points.length < 2) {
      add(`${base}.points`, "Line features require at least two points.");
    }
  });

  world.hexes.forEach((hex, index) => {
    for (const [standIndex, stand] of (hex.stands ?? []).entries()) {
      if (stand.at?.x == null || stand.at?.y == null) continue;
      const centerX = world.size * Math.sqrt(3) * (hex.q + hex.r / 2);
      const centerY = world.size * -1.5 * hex.r;
      const distance = Math.hypot(stand.at.x - centerX, stand.at.y - centerY);
      if (distance > world.size * 1.15) {
        warn(`hexes.${index}.stands.${standIndex}.at`, "The stand point appears to be outside its hex.");
      }
    }
  });

  return {
    world,
    errors,
    warnings,
    valid: Object.keys(errors).length === 0,
  };
}

function validateIds(items, path, errors) {
  const ids = new Set();
  const add = (field, message) => ((errors[field] ??= []).push(message));
  items.forEach((item, index) => {
    const base = `${path}.${index}`;
    item.id = text(item.id);
    if (!ID_PATTERN.test(item.id)) add(`${base}.id`, "Use a unique kebab-case ID.");
    if (ids.has(item.id)) add(`${base}.id`, "IDs must be unique within this group.");
    ids.add(item.id);
  });
  return ids;
}

function validateCollection(items, path, hexIds, errors, warnings, options = {}) {
  const add = (field, message) => ((errors[field] ??= []).push(message));
  validateIds(items, path, errors);
  items.forEach((item, index) => {
    const base = `${path}.${index}`;
    item.kind = String(item.kind ?? "").trim();
    if (!item.kind) add(`${base}.kind`, "Choose an object kind.");
    if (options.requirePoints && (!Array.isArray(item.points) || item.points.length < 2)) {
      add(`${base}.points`, "Routes require at least two points.");
    }
    (item.points ?? []).forEach((point, pointIndex) => {
      if (!validPoint(point, hexIds)) {
        add(`${base}.points.${pointIndex}`, "Use either an existing hex anchor or numeric x/y coordinates.");
      }
    });
    if (item.kind === "river") {
      (item.cascades ?? []).forEach((cascade, cascadeIndex) => {
        if (!cascade || typeof cascade !== "object") {
          add(`${base}.cascades.${cascadeIndex}`, "Cascade entries must be objects.");
          return;
        }
        if (cascade.id != null && !ID_PATTERN.test(String(cascade.id).trim())) {
          add(`${base}.cascades.${cascadeIndex}.id`, "Use a kebab-case cascade ID.");
        }
        const from = Number(cascade.from);
        const to = Number(cascade.to);
        if (!Number.isFinite(from) || from < 0 || from > 1) {
          add(`${base}.cascades.${cascadeIndex}.from`, "Cascade start must be between 0 and 1.");
        }
        if (!Number.isFinite(to) || to < 0 || to > 1) {
          add(`${base}.cascades.${cascadeIndex}.to`, "Cascade end must be between 0 and 1.");
        }
        if (Number.isFinite(from) && Number.isFinite(to) && from === to) {
          add(`${base}.cascades.${cascadeIndex}.to`, "Cascade end must differ from start.");
        }
      });
    } else if (item.cascades?.length) {
      add(`${base}.cascades`, "Only river features can have cascades.");
    }
    if (item.points?.length > 60) {
      warnings.push({ path: `${base}.points`, message: "This line has many control points and may be difficult to edit." });
    }
  });
}

function validPoint(point, hexIds) {
  if (!point || typeof point !== "object") return false;
  if (point.hex != null) {
    return hexIds.has(String(point.hex)) &&
      optionalFinite(point.dx) &&
      optionalFinite(point.dy);
  }
  return Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function validStand(stand) {
  if (!stand || typeof stand !== "object") return false;
  if (stand.from === "landmark") return optionalFinite(stand.dx) && optionalFinite(stand.dy);
  if (stand.x != null || stand.y != null) {
    return Number.isFinite(Number(stand.x)) && Number.isFinite(Number(stand.y));
  }
  return optionalFinite(stand.dx) && optionalFinite(stand.dy);
}

function optionalFinite(value) {
  return value == null || Number.isFinite(Number(value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableText(value) {
  return text(value) || null;
}

function stringList(value) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function renameMapFor(renames, domain) {
  return new Map(
    renames
      .filter((rename) => rename?.domain === domain && rename.from && rename.to)
      .map((rename) => [String(rename.from), String(rename.to)]),
  );
}

function resolveRename(map, value) {
  let current = value;
  const seen = new Set();
  while (map.has(current) && !seen.has(current)) {
    seen.add(current);
    current = map.get(current);
  }
  return current;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

export function applyHexRenames(world, renames = []) {
  const map = new Map(
    renames
      .filter((rename) => rename?.kind === "hex" && rename.from && rename.to)
      .map((rename) => [String(rename.from), String(rename.to)]),
  );
  if (!map.size) return world;
  const rename = (value) => {
    let current = value;
    const seen = new Set();
    while (map.has(current) && !seen.has(current)) {
      seen.add(current);
      current = map.get(current);
    }
    return current;
  };
  world.start = rename(world.start);
  world.journey = (world.journey ?? []).map(rename);
  for (const hex of world.hexes ?? []) {
    for (const stand of hex.stands ?? []) {
      if (stand.entryFrom) stand.entryFrom = stand.entryFrom.map(rename);
    }
  }
  for (const placement of world.artifactPlacements ?? []) {
    if (placement.hex) placement.hex = rename(placement.hex);
  }
  for (const route of world.routes ?? []) {
    for (const point of route.points ?? []) if (point.hex) point.hex = rename(point.hex);
  }
  for (const feature of world.features ?? []) {
    if (feature.hex) feature.hex = rename(feature.hex);
    for (const key of ["at", "labelAt", "boothAt"]) {
      if (feature[key]?.hex) feature[key].hex = rename(feature[key].hex);
    }
    for (const point of feature.points ?? []) if (point.hex) point.hex = rename(point.hex);
  }
  return world;
}

export function applyWorldCharacterRenames(world, renames = []) {
  const itemMap = renameMapFor(renames, "items");
  if (!itemMap.size) return world;
  const rename = (value) => resolveRename(itemMap, value);
  for (const placement of world.artifactPlacements ?? []) {
    if (placement.item) placement.item = rename(placement.item);
  }
  return world;
}

export function changedWorldObjectIds(before, after) {
  const identify = (world) => new Map([
    ...(world.hexes ?? []).map((item) => [`hex:${item.id}`, JSON.stringify(item)]),
    ...(world.routes ?? []).map((item) => [`route:${item.id}`, JSON.stringify(item)]),
    ...(world.features ?? []).map((item) => [`feature:${item.id}`, JSON.stringify(item)]),
  ]);
  const left = identify(before);
  const right = identify(after);
  return [...new Set([...left.keys(), ...right.keys()])].filter((id) => left.get(id) !== right.get(id));
}
