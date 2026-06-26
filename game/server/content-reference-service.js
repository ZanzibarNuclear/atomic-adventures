export function collectWorldHexReferences(world, from) {
  const references = [];
  if (world.start === from) references.push({ kind: "world", path: "start" });
  (world.journey ?? []).forEach((id, index) => {
    if (id === from) references.push({ kind: "world", path: `journey.${index}` });
  });
  (world.routes ?? []).forEach((route, routeIndex) => {
    (route.points ?? []).forEach((point, pointIndex) => {
      if (point.hex === from) {
        references.push({ kind: "world", path: `routes.${routeIndex}.points.${pointIndex}.hex` });
      }
    });
  });
  (world.features ?? []).forEach((feature, featureIndex) => {
    if (feature.hex === from) references.push({ kind: "world", path: `features.${featureIndex}.hex` });
    for (const key of ["at", "labelAt", "boothAt"]) {
      if (feature[key]?.hex === from) {
        references.push({ kind: "world", path: `features.${featureIndex}.${key}.hex` });
      }
    }
    (feature.points ?? []).forEach((point, pointIndex) => {
      if (point.hex === from) {
        references.push({ kind: "world", path: `features.${featureIndex}.points.${pointIndex}.hex` });
      }
    });
  });
  return references;
}

export class ContentReferenceService {
  constructor({ storyRepository = null } = {}) {
    this.storyRepository = storyRepository;
  }

  setStoryRepository(repository) {
    this.storyRepository = repository;
  }

  previewHexRename(world, from, to) {
    return {
      from,
      to,
      references: [
        ...collectWorldHexReferences(world, from),
        ...(this.storyRepository?.findHexReferences(from) ?? []),
      ],
    };
  }

  previewBuildingRename(building, kind, from, to) {
    return {
      kind,
      from,
      to,
      references: this.storyRepository?.findBuildingReferences(kind, from) ?? [],
      building,
    };
  }

  validateWorldReferences(worldCatalog, renames = []) {
    return this.storyRepository?.validateAgainstWorld(worldCatalog, renames) ?? { errors: {} };
  }

  cascadeHexRenames(renames = [], worldCatalog) {
    return this.storyRepository?.cascadeHexRenames(renames, worldCatalog) ?? {
      affected: [],
      revision: this.storyRepository?.getGlobalRevision?.() ?? 0,
    };
  }

  cascadeBuildingRenames(renames = [], worldCatalog) {
    return this.storyRepository?.cascadeBuildingRenames(renames, worldCatalog) ?? {
      affected: [],
      revision: this.storyRepository?.getGlobalRevision?.() ?? 0,
    };
  }
}
