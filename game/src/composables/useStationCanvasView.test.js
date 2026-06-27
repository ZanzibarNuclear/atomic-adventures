import { describe, expect, it } from "vitest";
import { useStationCanvasView } from "./useStationCanvasView.js";

describe("useStationCanvasView", () => {
  it("owns viewport state", () => {
    const view = useStationCanvasView();

    expect(view.viewportMode.value).toBe("fit-all");
  });
});
