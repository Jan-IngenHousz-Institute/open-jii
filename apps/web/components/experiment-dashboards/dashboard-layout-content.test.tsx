import {
  createDashboardLayout,
  createExperimentAccess,
  createExperimentDashboard,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { useFormContext } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import type { DashboardFormValues } from "./dashboard-form-shell";
import { DashboardLayoutContent } from "./dashboard-layout-content";
import { DashboardModeProvider } from "./dashboard-mode-context";

// Replace the shared autosave indicator + gradient body with stubs so this
// suite focuses on the header / metadata UI.
vi.mock("../shared/autosave/autosave-indicator", () => ({
  AutosaveIndicator: () => <span data-testid="save-indicator" />,
}));
vi.mock("./dashboard-gradient-body", () => ({
  DashboardGradientBody: ({
    isEditing,
    children,
  }: {
    isEditing: boolean;
    children: React.ReactNode;
  }) => (
    <div data-testid="gradient" data-editing={isEditing ? "1" : "0"}>
      {children}
    </div>
  ),
}));

function defaults(overrides: Partial<DashboardFormValues> = {}): DashboardFormValues {
  return {
    name: "My dashboard",
    description: "",
    layout: createDashboardLayout(),
    widgets: [],
    ...overrides,
  };
}

function renderLayout({
  isAdmin = false,
  initialMode = "view" as "view" | "edit",
  dashboard = createExperimentDashboard(),
  formDefaults = defaults(),
}: {
  isAdmin?: boolean;
  initialMode?: "view" | "edit";
  dashboard?: ReturnType<typeof createExperimentDashboard>;
  formDefaults?: DashboardFormValues;
} = {}) {
  server.mount(orpcContract.experiments.getExperimentAccess, {
    body: createExperimentAccess({ isAdmin }),
  });

  return renderWithForm<DashboardFormValues>(
    () => (
      <DashboardModeProvider initialMode={initialMode}>
        <DashboardLayoutContent experimentId="exp-1" dashboard={dashboard}>
          <FormSync />
          <div data-testid="body">canvas</div>
        </DashboardLayoutContent>
      </DashboardModeProvider>
    ),
    { useFormProps: { defaultValues: formDefaults } },
  );
}

// Mirrors form values into testIds so we can assert react-hook-form writes.
function FormSync() {
  const form = useFormContext<DashboardFormValues>();
  const v = form.watch();
  return (
    <div>
      <span data-testid="rhf-name">{v.name}</span>
      <span data-testid="rhf-desc">{v.description ?? ""}</span>
    </div>
  );
}

describe("DashboardLayoutContent", () => {
  it("renders the back link to the dashboards index", () => {
    renderLayout();
    const back = screen.getByRole("link", { name: /ui\.actions\.back/ });
    expect(back).toHaveAttribute("href", "/en-US/platform/experiments/exp-1/dashboards");
  });

  it("renders the current dashboard name as the title", () => {
    renderLayout({ formDefaults: defaults({ name: "Photosynth" }) });
    expect(screen.getAllByText("Photosynth").length).toBeGreaterThan(0);
  });

  it("shows the static description when not editing and a description exists", () => {
    renderLayout({ formDefaults: defaults({ description: "Some notes" }) });
    // FormSync mirrors the description into a <span>; the component renders
    // it inside a <p>. Both matches are expected.
    const matches = screen.getAllByText("Some notes");
    expect(matches.some((el) => el.tagName === "P")).toBe(true);
  });

  it("hides the toggle / save chrome when the viewer isn't an admin", async () => {
    renderLayout({ isAdmin: false });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /ui\.actions\.(edit|done)/ })).toBeNull();
    });
    expect(screen.queryByTestId("save-indicator")).toBeNull();
  });

  it("renders the edit toggle when the viewer is an admin", async () => {
    renderLayout({ isAdmin: true });
    expect(await screen.findByRole("button", { name: /ui\.actions\.edit/ })).toBeInTheDocument();
  });

  it("renders the save indicator while in edit mode", async () => {
    renderLayout({ isAdmin: true, initialMode: "edit" });
    expect(await screen.findByTestId("save-indicator")).toBeInTheDocument();
  });

  it("renders the metadata fields with formatted dates and the creator name", () => {
    const dashboard = createExperimentDashboard({
      createdAt: "2024-03-10T00:00:00.000Z",
      updatedAt: "2024-04-01T00:00:00.000Z",
      createdByName: "Alex",
    });
    renderLayout({ dashboard });
    expect(screen.getByText("common.created")).toBeInTheDocument();
    expect(screen.getByText("common.updated")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("toggles between view and edit modes when the admin clicks the toggle", async () => {
    renderLayout({ isAdmin: true });
    const user = userEvent.setup();

    const toggle = await screen.findByRole("button", { name: /ui\.actions\.edit/ });
    await user.click(toggle);

    // After toggling, the description Textarea appears and the save indicator mounts.
    expect(await screen.findByTestId("save-indicator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ui\.actions\.done/ })).toBeInTheDocument();
  });

  it("writes description edits back into the form when the textarea changes", async () => {
    renderLayout({ isAdmin: true, initialMode: "edit" });
    const user = userEvent.setup();

    const textarea = await screen.findByPlaceholderText("form.descriptionPlaceholder");
    await user.type(textarea, "Hello");

    await waitFor(() => expect(screen.getByTestId("rhf-desc").textContent).toBe("Hello"));
  });
});
