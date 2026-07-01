export function createHydroEvent({
  elapsedMinutes = 0,
  type,
  source = "host",
  actor = "system",
  label = "",
  payload = {},
  eventId = null,
} = {}) {
  const safeType = String(type || "facility-change");
  const safeElapsedMinutes = finite(elapsedMinutes);
  const safeId = eventId || `hydro-event-${formatEventTime(safeElapsedMinutes)}-${safeType}`;
  return {
    eventId: safeId,
    plantId: "upper-penstock",
    elapsedMinutes: safeElapsedMinutes,
    type: safeType,
    source,
    actor,
    label,
    payload: { ...payload },
  };
}

export function appendHydroEvent(state, event) {
  return sortHydroEvents([...(state?.eventLog ?? []), event]);
}

export function sortHydroEvents(events = []) {
  return events
    .map((event, insertionIndex) => ({ event, insertionIndex }))
    .sort((left, right) => {
      const timeDelta = finite(left.event.elapsedMinutes) - finite(right.event.elapsedMinutes);
      if (timeDelta !== 0) return timeDelta;
      const idDelta = String(left.event.eventId || "").localeCompare(String(right.event.eventId || ""));
      if (idDelta !== 0) return idDelta;
      return left.insertionIndex - right.insertionIndex;
    })
    .map(({ event }) => event);
}

function formatEventTime(value) {
  return String(Math.round(finite(value) * 1000)).padStart(8, "0");
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
