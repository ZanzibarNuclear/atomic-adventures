import { describe, expect, it } from "vitest";
import BuilderPageHeader from "../components/builder/BuilderPageHeader.vue";
import BuilderWorkspaceTabs from "../components/builder/BuilderWorkspaceTabs.vue";
import StoryBuilder from "./BuilderView.vue";
import CharacterBuilder from "./CharacterBuilderView.vue";
import UtilityStationBuilder from "./UtilityStationBuilderView.vue";
import WorldBuilder from "./WorldBuilderView.vue";

describe("development builder views", () => {
  it("compile as Vue components", () => {
    expect(BuilderPageHeader).toBeTruthy();
    expect(BuilderWorkspaceTabs).toBeTruthy();
    expect(StoryBuilder).toBeTruthy();
    expect(WorldBuilder).toBeTruthy();
    expect(CharacterBuilder).toBeTruthy();
    expect(UtilityStationBuilder).toBeTruthy();
  });
});
