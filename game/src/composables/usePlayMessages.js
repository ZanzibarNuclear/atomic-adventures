import { computed, reactive } from "vue";

/**
 * Session UI message bus for the play HUD.
 *
 * Decouples action/runtime code from how notices are rendered. Handlers return
 * or push short player-facing lines; the status/message area reads them.
 * Not part of save state — ephemeral feedback only.
 */

const state = reactive({
  /** @type {{ id: number, text: string, tone: string, source: string|null }[]} */
  items: [],
});

let nextId = 1;

/**
 * @param {string} text
 * @param {{ tone?: string, source?: string|null, replace?: boolean }} [options]
 *   - replace (default true): clear previous notices before adding
 *   - tone: visual hint for the HUD ("notice" | "warning" | "error" | …)
 *   - source: optional tag so callers can clear only their own messages
 */
export function pushPlayMessage(text, options = {}) {
  const body = String(text ?? "").trim();
  if (!body) return null;
  const {
    tone = "notice",
    source = null,
    replace = true,
  } = options;
  if (replace) {
    state.items = source
      ? state.items.filter((item) => item.source !== source)
      : [];
  }
  const item = {
    id: nextId++,
    text: body,
    tone: String(tone || "notice"),
    source: source == null ? null : String(source),
  };
  state.items.push(item);
  return item;
}

/** Clear all notices, or only those matching `source`. */
export function clearPlayMessages(source = null) {
  if (source == null) {
    state.items = [];
    return;
  }
  const tag = String(source);
  state.items = state.items.filter((item) => item.source !== tag);
}

export function playMessageLines() {
  return state.items.map((item) => item.text);
}

export function usePlayMessages() {
  const messages = computed(() => state.items.slice());
  const lines = computed(() => state.items.map((item) => item.text));
  return {
    messages,
    lines,
    pushPlayMessage,
    clearPlayMessages,
  };
}
