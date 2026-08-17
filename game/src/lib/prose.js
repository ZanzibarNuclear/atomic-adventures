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

/**
 * Safe inline markdown for scene prose: **bold** and _italic_ / *italic*.
 * Escapes HTML first so authored text cannot inject markup.
 */
export function formatInlineMarkdown(text) {
  if (text == null || text === "") return "";
  return applyInlineMarkdown(escapeHtml(String(text)));
}

export function proseParagraphHtml(text) {
  return proseParagraphs(text).map((paragraph) => formatInlineMarkdown(paragraph));
}

function applyInlineMarkdown(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
