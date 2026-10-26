import { createHomeExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { GetStartedSection } from "./get-started-section";

describe("GetStartedSection", () => {
  it("offers three places to start to a researcher with no related experiments", async () => {
    server.mount(contract.experiments.listHomeExperiments, { body: { experiments: [] } });

    render(<GetStartedSection />);

    expect(
      await screen.findByRole("heading", { name: "dashboard.getStarted" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders nothing for a researcher with experiments", async () => {
    const spy = server.mount(contract.experiments.listHomeExperiments, {
      body: { experiments: [createHomeExperiment()] },
    });

    const { container } = render(<GetStartedSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });

  it("does not take a failed read for an empty one", async () => {
    const spy = server.mount(contract.experiments.listHomeExperiments, { status: 500 });

    const { container } = render(<GetStartedSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });
});
