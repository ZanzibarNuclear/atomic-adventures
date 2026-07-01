// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LessonRenderer from "./LessonRenderer.vue";

const mathStub = {
  props: ["source", "inline"],
  template: "<span class=\"math-stub\">{{ source }}</span>",
};

const lesson = {
  id: "hydro-power-intro",
  title: "Hydro Power, Water You Waiting For?",
  completion: {
    awardTitle: "Hydro Power Theory",
    awardText: "Zanzibar understands hydro power.",
  },
  sections: [
    { type: "text", title: "One", body: "Opening" },
    { type: "formula", title: "Two", formula: "$$P_\\text{elec} = \\eta\\,\\rho\\,g\\,Q\\,H_\\text{net}$$" },
    { type: "symbols", title: "Three", rows: [{ symbol: "$Q$", meaning: "Flow", units: "$\\mathrm{m^3/s}$" }] },
    { type: "examples", title: "Four", examples: [{ title: "Example", givens: ["$Q=1$"], result: "$P=1$" }] },
  ],
  quiz: [{
    id: "same-power",
    type: "multiple-choice",
    prompt: "Which setup produces more power?",
    options: [
      { id: "a-more", label: "A more", feedback: "A is not right." },
      { id: "same", label: "Same", feedback: "Correct." },
    ],
    correctOptionId: "same",
  }],
};

function mountLesson(props = {}) {
  return mount(LessonRenderer, {
    props: { lesson, ...props },
    global: {
      stubs: { MathMarkdown: mathStub },
    },
  });
}

describe("LessonRenderer", () => {
  it("clears previous feedback when the player changes answers", async () => {
    const wrapper = mountLesson();

    await wrapper.find('input[value="a-more"]').setValue(true);
    await wrapper.find(".quiz button").trigger("click");
    expect(wrapper.text()).toContain("A is not right.");

    await wrapper.find('input[value="same"]').setValue(true);
    expect(wrapper.text()).not.toContain("A is not right.");
    expect(wrapper.text()).not.toContain("Correct.");
  });

  it("does not emit completion or show the award for a wrong answer", async () => {
    const wrapper = mountLesson();

    await wrapper.find('input[value="a-more"]').setValue(true);
    await wrapper.find(".quiz button").trigger("click");

    expect(wrapper.emitted("pass-quiz")).toBeUndefined();
    expect(wrapper.find(".award").exists()).toBe(false);
  });

  it("emits completion when the correct answer is checked", async () => {
    const wrapper = mountLesson();

    await wrapper.find('input[value="same"]').setValue(true);
    await wrapper.find(".quiz button").trigger("click");

    expect(wrapper.emitted("pass-quiz")).toEqual([["hydro-power-intro"]]);
  });

  it("shows the certificate and finish affordance after completion", () => {
    const wrapper = mount(LessonRenderer, {
      props: { lesson, completed: true },
      slots: {
        "award-actions": "<button>Finish lesson</button>",
      },
      global: {
        stubs: { MathMarkdown: mathStub },
      },
    });

    expect(wrapper.text()).toContain("Certificate unlocked");
    expect(wrapper.text()).toContain("Hydro Power Theory");
    expect(wrapper.text()).toContain("Finish lesson");
  });

  it("shows section navigation for longer lessons", () => {
    const wrapper = mountLesson();

    const links = wrapper.findAll(".section-nav a");
    expect(links.map((link) => link.text())).toEqual(["One", "Two", "Three", "Four"]);
    expect(links[1].attributes("href")).toBe("#lesson-section-2");
  });

  it("resets transient quiz state when the lesson attempt changes", async () => {
    const wrapper = mountLesson();

    await wrapper.find('input[value="a-more"]').setValue(true);
    await wrapper.find(".quiz button").trigger("click");
    expect(wrapper.text()).toContain("A is not right.");

    await wrapper.setProps({
      lesson: {
        ...lesson,
        id: "hydro-power-intro-reopened",
      },
    });

    expect(wrapper.text()).not.toContain("A is not right.");
    expect(wrapper.find('input[value="a-more"]').element.checked).toBe(false);
  });
});
