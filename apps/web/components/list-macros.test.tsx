import { createMacro } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMacroLanguageLabel } from "~/util/macro-language";

import { contract } from "@repo/api/contract";
import { zMacroLanguage } from "@repo/api/domains/macro/macro.schema";

import { ListMacros } from "./list-macros";

async function openFilter(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /^common\.filter/ }));
  await user.click(screen.getByRole("option", { name }));
  return screen.getByRole("listbox", { name });
}

const optionTexts = (list: HTMLElement) =>
  within(list)
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("ListMacros", () => {
  beforeEach(() => {
    openOnUrl("/platform/macros", "");
    vi.mocked(nav.useRouter().replace).mockClear();
  });

  it("offers language and visibility filters, without a language dropdown, my/all toggle or create link", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacros, { body: listEnvelope([]) });
    render(<ListMacros />);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("macros.allLanguages")).toBeNull();
    expect(screen.queryByText("macros.filterMacros")).toBeNull();
    expect(screen.queryByRole("link", { name: "macros.create" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "common.filter" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "macros.columns.language",
      "macros.visibility",
    ]);
  });

  it("renders macros as rows linking to their detail pages", async () => {
    server.mount(contract.macros.listMacros, {
      body: listEnvelope([createMacro({ id: "1", name: "M1" })]),
    });
    render(<ListMacros />);

    const link = await screen.findByRole("link", { name: "M1" });
    expect(link.getAttribute("href")).toContain("/platform/macros/1");
  });

  it("lists the three languages and filters by one through the URL and the API", async () => {
    const user = userEvent.setup();
    const replace = vi.mocked(nav.useRouter().replace);
    const spy = server.mount(contract.macros.listMacros, { body: listEnvelope([]) });
    render(<ListMacros />);

    const languages = await openFilter(user, "macros.columns.language");
    expect(optionTexts(languages)).toEqual(zMacroLanguage.options.map(getMacroLanguageLabel));
    await user.click(within(languages).getByRole("option", { name: "Python" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("/platform/macros?language=python", {
      scroll: false,
    });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "language")).toEqual(["python"]),
    );
  });

  it("lists both visibilities and filters by one through the URL and the API", async () => {
    const user = userEvent.setup();
    const replace = vi.mocked(nav.useRouter().replace);
    const spy = server.mount(contract.macros.listMacros, { body: listEnvelope([]) });
    render(<ListMacros />);

    const visibilities = await openFilter(user, "macros.visibility");
    expect(optionTexts(visibilities)).toEqual(["macros.private", "macros.public"]);
    await user.click(within(visibilities).getByRole("option", { name: "macros.private" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("/platform/macros?visibility=private", {
      scroll: false,
    });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "visibility")).toEqual(["private"]),
    );
  });

  it.each([
    ["", "macros.noMacros"],
    ["language=r", "macros.noFilterMatches"],
  ])("shows this resource's empty message for '%s'", async (qs, message) => {
    openOnUrl("/platform/macros", qs);
    server.mount(contract.macros.listMacros, { body: listEnvelope([]) });
    render(<ListMacros />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("shows this resource's message when a search matches nothing", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacros, { body: listEnvelope([]) });
    render(<ListMacros />);

    await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "missing");
    expect(await screen.findByText("macros.noMatches")).toBeInTheDocument();
  });
});
