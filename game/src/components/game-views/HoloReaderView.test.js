// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HoloReaderView from "./HoloReaderView.vue";

const lesson = {
  id: "hydro-power-intro",
  title: "Hydro Power, Water You Waiting For?",
  summary: "Learn hydro power.",
  completion: { awardTitle: "Hydro Power Theory", awardText: "Done." },
  pages: [],
};

function mountReader(props = {}) {
  return mount(HoloReaderView, {
    props: {
      lessons: [lesson],
      selectedLessonId: null,
      gameState: { lessons: {} },
      ...props,
    },
    global: {
      stubs: {
        LessonRenderer: {
          props: ["lesson", "completed", "completionError"],
          emits: ["pass-quiz"],
          template: `
            <article class="lesson-renderer-stub">
              <button class="pass-quiz" @click="$emit('pass-quiz', lesson.id)">Pass quiz</button>
              <section v-if="completed" class="award"><slot name="award-actions"></slot></section>
              <p v-if="completionError">{{ completionError }}</p>
            </article>
          `,
        },
      },
    },
  });
}

describe("HoloReaderView", () => {
  it("opens from the catalog and can exit back to the world", async () => {
    const wrapper = mountReader();

    expect(wrapper.text()).toContain("Lesson catalog");
    await wrapper.find(".lesson-row").trigger("click");
    await wrapper.find(".exit-button").trigger("click");

    expect(wrapper.emitted("select-lesson")).toEqual([["hydro-power-intro"]]);
    expect(wrapper.emitted("return-to-map")).toEqual([[]]);
  });

  it("surfaces an error for a stale selected lesson ID", async () => {
    const wrapper = mountReader({ selectedLessonId: "missing-lesson" });

    expect(wrapper.text()).toContain("Lesson unavailable");
    await wrapper.find(".reader-error button").trigger("click");

    expect(wrapper.emitted("select-lesson")).toEqual([[null]]);
  });

  it("bubbles quiz completion to the game view", async () => {
    const wrapper = mountReader({ selectedLessonId: lesson.id });

    await wrapper.find(".pass-quiz").trigger("click");

    expect(wrapper.emitted("complete-lesson")).toEqual([["hydro-power-intro"]]);
  });

  it("shows finish controls when the lesson is completed", async () => {
    const wrapper = mountReader({
      selectedLessonId: lesson.id,
      gameState: {
        lessons: {
          "hydro-power-intro": { completedAt: "passed" },
        },
      },
    });

    expect(wrapper.find(".award").exists()).toBe(true);
    expect(wrapper.text()).toContain("Finish lesson");

    await wrapper.find(".award button").trigger("click");
    expect(wrapper.emitted("return-to-map")).toEqual([[]]);
  });
});
