import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";

import { ThemeProvider, ThemeToggle } from "../theme";

// The suite-wide matchMedia stub reports `matches: false`, so `system` resolves
// to light. That is the interesting starting point: the toggle has to move off
// `system` to an explicit theme on the very first click.
function renderToggle(defaultTheme = "system") {
  return render(
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  it("names the theme it will switch to, not the current one", async () => {
    renderToggle();
    expect(await screen.findByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it("switches the effective theme with one click from the system default", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("switches back on the second click", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("light");
  });

  it("offers no third state", async () => {
    renderToggle();
    await screen.findByRole("button", { name: "Switch to dark mode" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("forwards className so consuming chrome can restyle it", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle className="hover:text-brand-accent" />
      </ThemeProvider>,
    );
    expect(await screen.findByRole("button")).toHaveClass("hover:text-brand-accent");
  });

  it("uses consumer-provided labels for localized surfaces", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle
          labels={{
            toggle: "Darstellung umschalten",
            switchToDark: "Zum dunklen Modus wechseln",
            switchToLight: "Zum hellen Modus wechseln",
          }}
        />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", { name: "Zum dunklen Modus wechseln" });
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Zum hellen Modus wechseln" })).toBeInTheDocument();
  });

  it("can expose the action as visible text on discoverability-first surfaces", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle showLabel />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", { name: "Switch to dark mode" });
    expect(toggle).toHaveTextContent("Toggle theme");
  });
});
