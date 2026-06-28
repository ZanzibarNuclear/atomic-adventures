import { describe, expect, it } from "vitest";
import { listPublicImages } from "./public-asset-catalog.js";

describe("public asset catalog", () => {
  it("lists image files from allowed public folders", () => {
    const images = listPublicImages("items");
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((path) => path.startsWith("items/"))).toBe(true);
    expect(images).toContain("items/field-backpack.png");
  });

  it("rejects unknown folders", () => {
    expect(() => listPublicImages("secrets")).toThrow(/Unknown public asset folder/);
  });
});
