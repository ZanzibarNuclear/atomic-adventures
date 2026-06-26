import { describe, expect, it } from "vitest";
import StoryBuilder from "./BuilderView.vue";
import CharacterBuilder from "./CharacterBuilderView.vue";
import UtilityStationBuilder from "./UtilityStationBuilderView.vue";

describe("development builder views", () => {
  it("compile as Vue components", () => {
    expect(StoryBuilder).toBeTruthy();
    expect(CharacterBuilder).toBeTruthy();
    expect(UtilityStationBuilder).toBeTruthy();
  });
});
