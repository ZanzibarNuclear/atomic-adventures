import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPlayMessages,
  playMessageLines,
  pushPlayMessage,
  usePlayMessages,
} from "./usePlayMessages.js";

describe("usePlayMessages", () => {
  beforeEach(() => {
    clearPlayMessages();
  });

  it("stores ephemeral notices for the HUD without save coupling", () => {
    pushPlayMessage("You flip the switch, but nothing happens.");
    expect(playMessageLines()).toEqual([
      "You flip the switch, but nothing happens.",
    ]);
    const { lines } = usePlayMessages();
    expect(lines.value).toEqual([
      "You flip the switch, but nothing happens.",
    ]);
  });

  it("replaces notices by default and can scope clear by source", () => {
    pushPlayMessage("First", { source: "action" });
    pushPlayMessage("Second", { source: "action" });
    expect(playMessageLines()).toEqual(["Second"]);

    pushPlayMessage("System note", { source: "system", replace: false });
    expect(playMessageLines()).toEqual(["Second", "System note"]);

    clearPlayMessages("action");
    expect(playMessageLines()).toEqual(["System note"]);
    clearPlayMessages();
    expect(playMessageLines()).toEqual([]);
  });
});
