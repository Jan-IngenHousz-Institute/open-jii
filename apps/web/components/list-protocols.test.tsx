import { createProtocol } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { contract } from "@repo/api/contract";
import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";

import { ListProtocols } from "./list-protocols";

async function openFilter(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /^common\.filter/ }));
  await user.click(screen.getByRole("option", { name }));
  return screen.getByRole("listbox", { name });
}

const optionTexts = (root: HTMLElement) =>
  within(root)
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("ListProtocols", () => {
  it("has no my/all toggle and no route-wide create action in the toolbar", async () => {
    server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });
    render(<ListProtocols />);

    expect(screen.getByPlaceholderText("protocols.searchProtocols")).toBeInTheDocument();
    await screen.findByText("protocols.noProtocols");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "protocols.create" })).toBeNull();
  });

  it("links each row to the protocol detail page", async () => {
    server.mount(contract.protocols.listProtocols, {
      body: listEnvelope([createProtocol({ id: "1", name: "P1" })]),
    });
    render(<ListProtocols />);

    const link = await screen.findByRole("link", { name: "P1" });
    expect(link.getAttribute("href")).toContain("/platform/protocols/1");
  });

  it("shows the protocol message when a search matches nothing", async () => {
    server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await user.type(screen.getByPlaceholderText("protocols.searchProtocols"), "missing");
    expect(await screen.findByText("protocols.noMatches")).toBeInTheDocument();
  });

  it("shows the protocol message when filters match nothing", async () => {
    openOnUrl("/platform/protocols", "family=ambyte");
    server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });
    render(<ListProtocols />);

    expect(await screen.findByText("protocols.noFilterMatches")).toBeInTheDocument();
  });

  it("offers family and visibility filters", async () => {
    server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await user.click(screen.getByRole("button", { name: "common.filter" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "protocols.columns.family",
      "protocols.visibility",
    ]);
  });

  it("lists the authored families without mobile and filters by one", async () => {
    openOnUrl("/platform/protocols", "");
    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    const spy = server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    const families = await openFilter(user, "protocols.columns.family");
    const labels = optionTexts(families);
    expect(labels).toEqual(zProtocolFamily.options.map(getSensorFamilyLabel));
    expect(labels).not.toContain(getSensorFamilyLabel("mobile"));
    await user.click(
      within(families).getByRole("option", { name: getSensorFamilyLabel("ambyte") }),
    );

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("/platform/protocols?family=ambyte", {
      scroll: false,
    });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "http://x", "family")).toEqual(["ambyte"]),
    );
  });

  it("lists both visibilities and filters by one", async () => {
    openOnUrl("/platform/protocols", "");
    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    const spy = server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    const visibilities = await openFilter(user, "protocols.visibility");
    expect(optionTexts(visibilities)).toEqual(["protocols.private", "protocols.public"]);
    await user.click(within(visibilities).getByRole("option", { name: "protocols.private" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("/platform/protocols?visibility=private", {
      scroll: false,
    });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "http://x", "visibility")).toEqual(["private"]),
    );
  });
});
