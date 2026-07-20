function clone(value) {
  return structuredClone(value);
}

export function moveStoryBeat(document, { beatId, fromArcId, toArcId, toIndex }) {
  const next = clone(document);
  const source = next.storyArcs?.find((arc) => arc.id === fromArcId);
  const destination = next.storyArcs?.find((arc) => arc.id === toArcId);
  if (!source || !destination) return failure("Choose existing source and destination arcs.");
  const sourceIndex = source.beats?.findIndex((beat) => beat.id === beatId) ?? -1;
  if (sourceIndex < 0) return failure("Choose an existing story beat.");

  const [beat] = source.beats.splice(sourceIndex, 1);
  let insertionIndex = Math.max(0, Math.min(Number(toIndex), destination.beats?.length ?? 0));
  if (source === destination && insertionIndex > sourceIndex) insertionIndex -= 1;
  destination.beats ??= [];

  if (source === destination) {
    destination.beats.splice(insertionIndex, 0, beat);
    destination.startBeat ||= destination.beats[0]?.id ?? "";
    return { ok: true, document: next, summary: `Moved ${beatId} to position ${insertionIndex + 1} in ${destination.title || destination.id}.` };
  }

  const destinationNext = destination.beats[insertionIndex] ?? null;
  const destinationPrevious = destination.beats[insertionIndex - 1] ?? null;
  const oldDestinationNext = insertionIndex === destination.beats.length
    ? destinationPrevious?.next ?? null
    : null;

  const conflicts = [];
  if (destinationPrevious && destinationNext && destinationPrevious.next && destinationPrevious.next !== destinationNext.id) {
    conflicts.push(`${destinationPrevious.id} already points to ${destinationPrevious.next}.`);
  }
  if (destinationPrevious && !destinationNext && destinationPrevious.next) {
    conflicts.push(`${destinationPrevious.id} already points to ${destinationPrevious.next}.`);
  }
  if (conflicts.length) return failure("The destination has non-linear flow that cannot be rewired automatically.", conflicts);

  const sourcePrevious = source.beats[sourceIndex - 1] ?? null;
  if (sourcePrevious?.next === beat.id) {
    sourcePrevious.next = beat.next;
  }
  if (source.startBeat === beat.id) source.startBeat = source.beats[0]?.id ?? "";

  destination.beats.splice(insertionIndex, 0, beat);
  if (!destination.startBeat || insertionIndex === 0) destination.startBeat = destination.beats[0]?.id ?? "";

  if (destinationPrevious) {
    destinationPrevious.next = beat.id;
  }
  if (destinationNext) {
    beat.next = destinationNext.id;
  } else {
    beat.next = oldDestinationNext;
  }

  return {
    ok: true,
    document: next,
    summary: `Moved ${beatId} from ${source.title || source.id} to position ${insertionIndex + 1} in ${destination.title || destination.id}.`,
  };
}

export function reorderStoryBeat(document, { arcId, beatId, toIndex }) {
  return moveStoryBeat(document, { beatId, fromArcId: arcId, toArcId: arcId, toIndex });
}

export function splitStoryBeat(document, { arcId, beatId, newBeatId, newBeatTitle, sceneIds, splitIndex }) {
  const next = clone(document);
  const arc = next.storyArcs?.find((item) => item.id === arcId);
  const beatIndex = arc?.beats?.findIndex((item) => item.id === beatId) ?? -1;
  if (!arc || beatIndex < 0) return failure("Choose an existing story beat.");
  const id = String(newBeatId ?? "").trim();
  const title = String(newBeatTitle ?? "").trim();
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return failure("Use a unique kebab-case ID for the new beat.");
  if (next.storyArcs.some((item) => item.beats?.some((beat) => beat.id === id))) return failure("That story beat ID already exists.");
  if (!title) return failure("Enter a title for the new beat.");
  const scenes = Array.isArray(sceneIds) ? sceneIds : [];
  const index = Number(splitIndex);
  if (!Number.isInteger(index) || index < 1 || index >= scenes.length) return failure("Choose a scene boundary inside this beat.");

  const original = arc.beats[beatIndex];
  const movedSceneIds = scenes.slice(index);
  const retainedSceneIds = scenes.slice(0, index);
  const newBeat = emptyStoryBeat(id, title);
  newBeat.scene = movedSceneIds[0] ?? null;
  newBeat.next = original.next;
  original.scene = retainedSceneIds.includes(original.scene) ? original.scene : retainedSceneIds[0] ?? null;
  original.next = id;
  arc.beats.splice(beatIndex + 1, 0, newBeat);
  return {
    ok: true,
    document: next,
    movedSceneIds,
    retainedSceneIds,
    summary: `Split ${beatId} before ${movedSceneIds[0]} and created ${id}.`,
  };
}

function emptyStoryBeat(id, title) {
  return {
    id, title, scene: null, choices: [],
    allowed: {
      movement: { mode: null, hexes: [], rooms: [], exteriorNodes: [], transitions: [] },
      storyForwardActions: [], optionalActions: [], storyChoices: [], stageViews: [],
      indoorActions: [], outdoorActions: [], itemActions: [], developerActions: [],
    },
    completesWhen: null, onEnter: null, onComplete: null, next: null,
  };
}

function failure(message, conflicts = []) {
  return { ok: false, message, conflicts };
}
