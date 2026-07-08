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
  const safeId = eventId || [
    "hydro-event",
    formatEventTime(safeElapsedMinutes),
    slug(safeType),
    slug(payload?.actionId || payload?.diagnosticId || label || source),
  ].filter(Boolean).join("-");
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
  const existingEvents = state?.eventLog ?? [];
  const safeEvent = {
    ...event,
    eventId: uniqueEventId(event.eventId, existingEvents),
  };
  return sortHydroEvents([...existingEvents, safeEvent]);
}

export function sortHydroEvents(events = []) {
  return events
    .map((event, insertionIndex) => ({ event, insertionIndex }))
    .sort((left, right) => {
      const timeDelta = finite(left.event.elapsedMinutes) - finite(right.event.elapsedMinutes);
      if (timeDelta !== 0) return timeDelta;
      return left.insertionIndex - right.insertionIndex;
    })
    .map(({ event }) => event);
}

function formatEventTime(value) {
  return String(Math.round(finite(value) * 1000)).padStart(8, "0");
}

function uniqueEventId(eventId, events) {
  const baseId = String(eventId || "hydro-event");
  const used = new Set(events.map((event) => String(event.eventId || "")));
  if (!used.has(baseId)) return baseId;
  let suffix = 2;
  while (used.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
