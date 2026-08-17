import { describe, expect, it } from "vitest";
import { formatInlineMarkdown, proseParagraphHtml } from "./prose.js";

describe("scene prose markdown", () => {
  it("turns _title_ into italics and escapes HTML", () => {
    expect(formatInlineMarkdown("_Micro-Hydro Power Generator: Operational Guide_"))
      .toBe("<em>Micro-Hydro Power Generator: Operational Guide</em>");
    expect(formatInlineMarkdown("He reads <script>alert(1)</script>"))
      .toBe("He reads &lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("keeps paragraph breaks and applies markdown inside them", () => {
    expect(proseParagraphHtml("First **bold** line.\n\nSecond _italic_ line."))
      .toEqual([
        "First <strong>bold</strong> line.",
        "Second <em>italic</em> line.",
      ]);
  });
});
