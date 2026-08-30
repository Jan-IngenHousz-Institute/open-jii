// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "../search-input";

describe("SearchInput", () => {
  it("forwards the input ref and standard input props", () => {
    const ref = React.createRef<HTMLInputElement>();

    render(
      <SearchInput ref={ref} value="" onChange={vi.fn()} aria-label="Find resources" disabled />,
    );

    expect(ref.current).toBe(screen.getByLabelText("Find resources"));
    expect(ref.current).toBeDisabled();
  });

  it("reports changes and clears a non-empty value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchInput value="query" onChange={onChange} clearLabel="Clear query" />,
    );

    await user.click(screen.getByRole("button", { name: "Clear query" }));
    expect(onChange).toHaveBeenCalledWith("");

    rerender(<SearchInput value="" onChange={onChange} clearLabel="Clear query" />);
    expect(screen.queryByRole("button", { name: "Clear query" })).not.toBeInTheDocument();
  });

  it("submits the current value through onSearch", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(
      <SearchInput
        value="chlorophyll"
        onChange={vi.fn()}
        onSearch={onSearch}
        aria-label="Search"
      />,
    );

    await user.type(screen.getByLabelText("Search"), "{Enter}");
    expect(onSearch).toHaveBeenCalledWith("chlorophyll");
  });

  it("shows an accessible spinner instead of the clear button while loading", () => {
    render(
      <SearchInput
        value="query"
        onChange={vi.fn()}
        isLoading
        clearLabel="Clear query"
        loadingLabel="Searching resources"
        aria-label="Search"
      />,
    );

    expect(screen.getByRole("status", { name: "Searching resources" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Clear query" })).not.toBeInTheDocument();
  });

  it("keeps the end addon fixed when the suffix changes", () => {
    const { container, rerender } = render(<SearchInput value="" onChange={vi.fn()} />);
    const getEndAddon = () => container.querySelector('[data-align="inline-end"]');

    expect(getEndAddon()).toHaveClass("w-8", "has-[>button]:mr-0");
    expect(getEndAddon()).toBeEmptyDOMElement();

    rerender(<SearchInput value="query" onChange={vi.fn()} />);
    expect(getEndAddon()).toHaveClass("w-8", "has-[>button]:mr-0");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();

    rerender(<SearchInput value="query" onChange={vi.fn()} isLoading />);
    expect(getEndAddon()).toHaveClass("w-8", "has-[>button]:mr-0");
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
