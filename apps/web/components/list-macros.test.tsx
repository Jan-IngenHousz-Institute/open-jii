import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import { ListMacros } from "./list-macros";

vi.mock("~/components/macro-overview-cards", () => ({
  MacroOverviewCards: (props: { macros?: unknown[]; isLoading: boolean }) => (
    <div data-testid="macro-cards" data-loading={props.isLoading}>
      {props.macros?.length ?? 0} macros
    </div>
  ),
}));

describe("ListMacros", () => {
  it("renders search input and language filter", () => {
    server.mount(contract.macros.listMacros, { body: [] });
    render(<ListMacros />);

    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("macros.allLanguages")).toBeInTheDocument();
  });

  it("passes data to MacroOverviewCards", async () => {
    server.mount(contract.macros.listMacros, {
      body: [createMacro({ id: "1", name: "M1" })],
    });
    render(<ListMacros />);

    await waitFor(() => {
      expect(screen.getByTestId("macro-cards")).toHaveTextContent("1 macros");
    });
  });

  it("shows error state when API fails", async () => {
    server.mount(contract.macros.listMacros, { status: 500 });
    render(<ListMacros />);

    await waitFor(() => {
      expect(screen.getByText("macros.errorLoading")).toBeInTheDocument();
    });
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: [] });
    const user = userEvent.setup();
    render(<ListMacros />);

    await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });
});
