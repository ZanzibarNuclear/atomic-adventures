/**
 * Turn YAML block-scalar prose into display paragraphs.
 * Single newlines (authoring wraps) become spaces; blank lines stay as breaks.
 */
export function proseParagraphs(text) {
  if (text == null || text === "") return [];
  return String(text)
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);
}
