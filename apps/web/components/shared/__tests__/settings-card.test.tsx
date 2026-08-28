import { render, screen } from "@/test/test-utils";
import { BriefcaseBusiness } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SettingsCard } from "../settings-card";

describe("SettingsCard", () => {
  it("renders title, description and body", () => {
    render(
      <SettingsCard title="Passkeys" description="Sign in without a password">
        <p>Body</p>
      </SettingsCard>,
    );

    expect(screen.getByText("Passkeys")).toBeInTheDocument();
    expect(screen.getByText("Sign in without a password")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("puts a header action in the card-action slot so the header grows a column", () => {
    const { container } = render(
      <SettingsCard title="Passkeys" action={<button type="button">Add</button>}>
        <p>Body</p>
      </SettingsCard>,
    );

    const action = container.querySelector('[data-slot="card-action"]');
    expect(action).toBeInTheDocument();
    expect(action).toContainElement(screen.getByRole("button", { name: "Add" }));
    expect(action?.parentElement?.className).toContain("has-data-[slot=card-action]");
  });

  it("renders the icon beside the title only when one is given", () => {
    const { container: withIcon } = render(
      <SettingsCard title="Profile" icon={BriefcaseBusiness}>
        <p>Body</p>
      </SettingsCard>,
    );
    expect(withIcon.querySelector(".lucide-briefcase-business")).toBeInTheDocument();

    const { container: without } = render(
      <SettingsCard title="Profile">
        <p>Body</p>
      </SettingsCard>,
    );
    expect(without.querySelector("svg")).not.toBeInTheDocument();
  });

  it("tints the card and its title when the section is destructive", () => {
    const { container } = render(
      <SettingsCard tone="destructive" title="Danger zone">
        <p>Body</p>
      </SettingsCard>,
    );

    expect(container.firstElementChild).toHaveClass("border-destructive/30");
    expect(screen.getByText("Danger zone")).toHaveClass("text-destructive");
  });

  it("leaves the card untinted by default", () => {
    const { container } = render(
      <SettingsCard title="Profile">
        <p>Body</p>
      </SettingsCard>,
    );

    expect(container.firstElementChild).not.toHaveClass("border-destructive/30");
    expect(screen.getByText("Profile")).not.toHaveClass("text-destructive");
  });

  it("renders headerExtra under the description", () => {
    render(
      <SettingsCard
        title="Visibility"
        description="Who can see this"
        headerExtra={<a href="https://docs.openjii.test/d">Docs</a>}
      >
        <p>Body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument();
  });
});
