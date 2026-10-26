import { createHomeExperiment, createRecentlyOpenedResource } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { RecentlyOpenedResource } from "@repo/api/domains/visit/visit.schema";

import { RecentlyOpenedSection } from "./recently-opened-section";

const PICKED_TYPE_KEY = "openjii.home.recentlyOpenedType";

const experiment = createRecentlyOpenedResource({
  type: "experiment",
  name: "Drought trial",
  status: "active",
  organizationName: "Plant Physiology Lab",
  callerRole: "owner",
});
const protocol = createRecentlyOpenedResource({
  type: "protocol",
  name: "Dark adapted",
  family: "multispeq",
  callerRole: null,
});
const workbook = createRecentlyOpenedResource({
  type: "workbook",
  name: "Leaf gas exchange",
  latestVersion: 4,
  callerRole: "viewer",
});

function mountVisits(items: RecentlyOpenedResource[]) {
  const types = Array.from(new Set(items.map((item) => item.type)));
  return server.mount(contract.visits.listRecentlyOpened, { body: { items, types } });
}

describe("RecentlyOpenedSection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.mount(contract.experiments.listHomeExperiments, { body: { experiments: [] } });
  });

  it("lists what the reader opened, with each type's detail, role and visit", async () => {
    mountVisits([experiment, protocol, workbook]);

    render(<RecentlyOpenedSection />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "dashboard.recentlyOpened" })).toBeInTheDocument();
    expect(within(rows[0]).getByRole("link", { name: "Drought trial" })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments/${experiment.id}`,
    );
    expect(within(rows[0]).getByText("Plant Physiology Lab")).toBeInTheDocument();
    expect(within(rows[0]).getByText("callerRoles.owner")).toBeInTheDocument();
    expect(within(rows[0]).getByText("openedOn")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "Dark adapted" })).toHaveAttribute(
      "href",
      `/en-US/platform/protocols/${protocol.id}`,
    );
    expect(within(rows[1]).queryByText(/callerRoles/)).not.toBeInTheDocument();
    expect(within(rows[2]).getByText("dashboard.workbookVersion")).toBeInTheDocument();
  });

  it("narrows to a picked type, links to its list and remembers the choice", async () => {
    mountVisits([experiment, protocol]);
    const user = userEvent.setup();

    render(<RecentlyOpenedSection />);

    const chip = await screen.findByRole("radio", { name: /types\.protocol/ });
    expect(screen.queryByRole("link", { name: /seeAllType/ })).not.toBeInTheDocument();
    const narrowed = server.mount(contract.visits.listRecentlyOpened, {
      body: { items: [protocol], types: ["experiment", "protocol"] },
    });
    await user.click(chip);

    await waitFor(() => expect(narrowed.calls.at(-1)?.query.type).toBe("protocol"));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.getByRole("link", { name: "dashboard.seeAllType.protocol" })).toHaveAttribute(
      "href",
      "/en-US/platform/protocols",
    );
    expect(window.localStorage.getItem(PICKED_TYPE_KEY)).toBe("protocol");
  });

  it("opens on a remembered type", async () => {
    window.localStorage.setItem(PICKED_TYPE_KEY, "experiment");
    mountVisits([experiment, protocol]);

    render(<RecentlyOpenedSection />);

    expect(
      await screen.findByRole("link", { name: "dashboard.seeAllType.experiment" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /types\.experiment/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("falls back to All when the remembered type has no visits left", async () => {
    window.localStorage.setItem(PICKED_TYPE_KEY, "macro");
    mountVisits([experiment, protocol]);

    render(<RecentlyOpenedSection />);

    expect(await screen.findByRole("radio", { name: "dashboard.allTypes" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows no chips while every visit is of one type", async () => {
    mountVisits([experiment]);

    render(<RecentlyOpenedSection />);

    await screen.findByRole("link", { name: "Drought trial" });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("stands in the related experiments before the first visit", async () => {
    mountVisits([]);
    server.mount(contract.experiments.listHomeExperiments, {
      body: { experiments: [createHomeExperiment({ name: "Mine", callerRole: "admin" })] },
    });

    render(<RecentlyOpenedSection />);

    expect(
      await screen.findByRole("heading", { name: "dashboard.yourExperiments" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mine" })).toBeInTheDocument();
    expect(screen.getByText("updatedOn")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dashboard.seeAll" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments",
    );
  });

  it("renders nothing, heading included, with neither visits nor related experiments", async () => {
    const visits = mountVisits([]);

    const { container } = render(<RecentlyOpenedSection />);

    await waitFor(() => expect(visits.called).toBe(true));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("says so when the related experiments cannot load before the first visit", async () => {
    mountVisits([]);
    const related = server.mount(contract.experiments.listHomeExperiments, { status: 500 });
    const user = userEvent.setup();

    render(<RecentlyOpenedSection />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "dashboard.userExperimentsLoadFailed",
    );
    expect(screen.getByRole("heading", { name: "dashboard.yourExperiments" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(related.callCount).toBeGreaterThan(1));
  });

  it("says so when one type's rows cannot load, keeping the chips to switch back", async () => {
    mountVisits([experiment, protocol]);
    const user = userEvent.setup();

    render(<RecentlyOpenedSection />);

    const chip = await screen.findByRole("radio", { name: /types\.protocol/ });
    const narrowed = server.mount(contract.visits.listRecentlyOpened, { status: 500 });
    await user.click(chip);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "dashboard.recentlyOpenedLoadFailed",
    );
    expect(screen.getByRole("radio", { name: "dashboard.allTypes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(narrowed.callCount).toBeGreaterThan(1));
  });

  it("says so when the visits cannot load, and retries", async () => {
    const visits = server.mount(contract.visits.listRecentlyOpened, { status: 500 });
    const user = userEvent.setup();

    render(<RecentlyOpenedSection />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "dashboard.recentlyOpenedLoadFailed",
    );
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(visits.callCount).toBeGreaterThan(1));
  });
});
