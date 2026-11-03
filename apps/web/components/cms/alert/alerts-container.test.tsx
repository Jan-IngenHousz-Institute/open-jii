import { act, fireEvent, render, screen } from "@/test/test-utils";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { AlertsContainer } from "./alerts-container";

function alert(id: string, severity = "info", internalName?: string): ComponentAlertFieldsFragment {
  return {
    __typename: "ComponentAlert",
    sys: { id },
    internalName,
    title: id,
    severity,
    dismissible: true,
  };
}

describe("CMS alert dismissal", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("shows undismissed alerts in severity order and honors stored dismissals", () => {
    localStorage.setItem("alert-dismissed-hidden", "true");
    render(
      <AlertsContainer alerts={[alert("info"), alert("critical", "critical"), alert("hidden")]} />,
    );

    expect(screen.getAllByRole("alert").map((element) => element.textContent)).toEqual([
      "critical",
      "info",
    ]);
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("persists dismissal by internal name, including after remount", () => {
    const alerts = [alert("entry-id", "info", "maintenance")];
    const { container, unmount } = render(<AlertsContainer alerts={alerts} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss alert" }));
    const transition = new Event("transitionend", { bubbles: true });
    Object.defineProperty(transition, "propertyName", { value: "grid-template-rows" });
    if (!container.firstElementChild?.firstElementChild) throw new Error("Missing alert row");
    fireEvent(container.firstElementChild.firstElementChild, transition);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(localStorage.getItem("alert-dismissed-maintenance")).toBe("true");
    unmount();
    render(<AlertsContainer alerts={alerts} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows new alerts when the CMS response changes and uses the entry ID as fallback", () => {
    localStorage.setItem("alert-dismissed-first", "true");
    const { rerender } = render(<AlertsContainer alerts={[alert("first")]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<AlertsContainer alerts={[alert("first"), alert("new")]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("new");
  });

  it("keeps server output empty and hydrates without revealing dismissed alerts", async () => {
    const alerts = [alert("visible"), alert("hidden")];
    localStorage.setItem("alert-dismissed-hidden", "true");
    const element = <AlertsContainer alerts={alerts} />;
    const html = renderToString(element);
    expect(html).toBe("");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(() =>
        Promise.resolve().then(() => {
          root = hydrateRoot(container, element, {
            onRecoverableError: (error) => errors.push(error),
          });
        }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent("visible");
      expect(screen.queryByText("hidden")).not.toBeInTheDocument();
      expect(errors).toEqual([]);
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});
