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
  constructor({ storyRepository = null, storylineRepository = null } = {}) {
    this.storyRepository = storyRepository;
    this.storylineRepository = storylineRepository;
  }

  setStoryRepository(repository) {
    this.storyRepository = repository;
  }

  setStorylineRepository(repository) {
    this.storylineRepository = repository;
  }

  previewHexRename(world, from, to) {
    return {
      from,
      to,
      references: [
        ...collectWorldHexReferences(world, from),
        ...(this.storyRepository?.findHexReferences(from) ?? []),
        ...(this.storylineRepository?.findHexReferences(from) ?? []),
      ],
    };
  }

  previewBuildingRename(building, kind, from, to) {
    return {
      kind,
      from,
      to,
      references: [
        ...(this.storyRepository?.findBuildingReferences(kind, from) ?? []),
        ...(this.storylineRepository?.findBuildingReferences(kind, from) ?? []),
      ],
      building,
    };
  }

  validateWorldReferences(worldCatalog, renames = []) {
    const story = this.storyRepository?.validateAgainstWorld(worldCatalog, renames) ?? { errors: {} };
    const storyline = this.storylineRepository?.validateAgainstWorld(worldCatalog, renames) ?? { errors: {} };
    return {
      valid: !Object.keys(story.errors ?? {}).length && !Object.keys(storyline.errors ?? {}).length,
      errors: {
        ...(story.errors ?? {}),
        ...(storyline.errors ?? {}),
      },
    };
  }

  cascadeHexRenames(renames = [], worldCatalog) {
    const story = this.storyRepository?.cascadeHexRenames(renames, worldCatalog) ?? {
      affected: [],
      revision: this.storyRepository?.getGlobalRevision?.() ?? 0,
    };
    const storyline = this.storylineRepository?.cascadeHexRenames(renames, worldCatalog) ?? {
      affected: [],
      revision: this.storylineRepository?.getGlobalRevision?.() ?? 0,
    };
    return { story, storyline, affected: [...story.affected, ...storyline.affected] };
  }

  cascadeBuildingRenames(renames = [], worldCatalog) {
    const story = this.storyRepository?.cascadeBuildingRenames(renames, worldCatalog) ?? {
      affected: [],
      revision: this.storyRepository?.getGlobalRevision?.() ?? 0,
    };
    const storyline = this.storylineRepository?.cascadeBuildingRenames(renames, worldCatalog) ?? {
      affected: [],
      revision: this.storylineRepository?.getGlobalRevision?.() ?? 0,
    };
    return { story, storyline, affected: [...story.affected, ...storyline.affected] };
  }
}
