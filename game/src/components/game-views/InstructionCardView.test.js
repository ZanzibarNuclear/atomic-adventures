// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InstructionCardView from "./InstructionCardView.vue";

const documentEntry = {
  id: "hydro-startup-instruction-card",
  title: "Hydro Station Startup Card",
  properties: {
    type: "hydro-startup-card",
  },
};

function mountCard(props = {}) {
  return mount(InstructionCardView, {
    props: {
      documents: [documentEntry],
      payload: {
        kind: "document",
        id: documentEntry.id,
        documentType: "hydro-startup-card",
      },
      ...props,
    },
  });
}

describe("InstructionCardView", () => {
  it("renders the front checklist and returns to the map", async () => {
    const wrapper = mountCard();

    expect(wrapper.text()).toContain("Hydro Station Startup Card");
    expect(wrapper.text()).toContain("Clear debris and open the intake");
    expect(wrapper.text()).toContain("Connect station power");

    await wrapper.find(".exit-button").trigger("click");
    expect(wrapper.emitted("return-to-map")).toEqual([[]]);
  });

  it("flips to the back mini-map with numbered startup locations", async () => {
    const wrapper = mountCard();

    await wrapper.findAll(".card-toolbar button")[1].trigger("click");

    expect(wrapper.text()).toContain("Where each step happens");
    expect(wrapper.text()).toContain("Control room");
    expect(wrapper.find(".hydro-minimap").exists()).toBe(true);
    expect(wrapper.findAll(".map-point")).toHaveLength(6);
  });

  it("shows stale content errors for missing or unsupported documents", () => {
    const missing = mountCard({
      payload: { kind: "document", id: "missing-card", documentType: "hydro-startup-card" },
    });
    expect(missing.text()).toContain("Document unavailable");
    missing.unmount();

    const unsupported = mountCard({
      documents: [{ id: "plain-note", title: "Plain Note" }],
      payload: { kind: "document", id: "plain-note" },
    });
    expect(unsupported.text()).toContain("Unsupported document");
    unsupported.unmount();
  });
});
