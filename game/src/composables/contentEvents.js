const listeners = new Map();
const errorListeners = new Set();
const openListeners = new Set();
let events = null;
let started = false;

export async function fetchContentJson(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`service returned ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function addContentEventListener(eventName, handler) {
  startContentEvents();
  const eventListeners = listeners.get(eventName) ?? new Set();
  eventListeners.add(handler);
  listeners.set(eventName, eventListeners);
  return () => {
    eventListeners.delete(handler);
    if (eventListeners.size === 0) listeners.delete(eventName);
  };
}

export function addContentEventStatusListener({ onOpen, onError } = {}) {
  startContentEvents();
  if (onOpen) openListeners.add(onOpen);
  if (onError) errorListeners.add(onError);
  return () => {
    if (onOpen) openListeners.delete(onOpen);
    if (onError) errorListeners.delete(onError);
  };
}

function startContentEvents() {
  if (started) return;
  started = true;
  if (import.meta.env.PROD || typeof EventSource === "undefined") return;
  events = new EventSource("/api/content/events");
  events.addEventListener("open", () => {
    for (const handler of openListeners) handler();
  });
  events.onerror = () => {
    for (const handler of errorListeners) handler();
  };
  for (const eventName of [
    "story.updated",
    "world.updated",
    "building.updated",
    "character.updated",
    "learning.updated",
  ]) {
    events.addEventListener(eventName, (event) => {
      for (const handler of listeners.get(eventName) ?? []) handler(event);
    });
  }
}
