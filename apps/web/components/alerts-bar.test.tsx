import { render, screen, assertExists } from "@/test/test-utils";
import { draftMode } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import type { ComponentAlertFieldsFragment } from "@repo/cms";

import { AlertsBar } from "./alerts-bar";

// unstable_cache requires Next.js incremental cache context unavailable in vitest — strip it to a passthrough
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockActiveAlerts = vi.fn();

vi.mock("@repo/cms", () => ({
  AlertsContainer: ({ alerts }: { alerts: ComponentAlertFieldsFragment[] }) => (
    <div role="region" aria-label="alerts">
      {alerts.map((a) => (
        <div key={a.sys.id} data-testid="alert-item">
          {a.title}
        </div>
      ))}
    </div>
  ),
}));

const makeAlert = (overrides: Record<string, unknown> = {}) => ({
  sys: { id: "alert-1" },
  internalName: "test-alert",
  title: "Test alert",
  severity: "info",
  type: "info",
  dismissible: true,
  active: true,
  audience: "both",
  startAt: new Date().toISOString(),
  endAt: null,
  ...overrides,
});

describe("AlertsBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { activeAlerts: mockActiveAlerts },
      previewClient: { activeAlerts: mockActiveAlerts },
    } as never);
  });

  const props = { locale: "en-US", preview: false };

  it("renders nothing when there are no active alerts", async () => {
    mockActiveAlerts.mockResolvedValue({ componentAlertCollection: { items: [] } });
    const ui = await AlertsBar(props);
    expect(ui).toBeNull();
  });

  it("renders AlertsContainer with fetched alerts", async () => {
    mockActiveAlerts.mockResolvedValue({
      componentAlertCollection: { items: [makeAlert()] },
    });
    const ui = await AlertsBar(props);
    assertExists(ui);
    render(ui);
    expect(screen.getByRole("region", { name: /alerts/i })).toBeInTheDocument();
    expect(screen.getByTestId("alert-item")).toHaveTextContent("Test alert");
  });

  it("renders multiple alerts", async () => {
    mockActiveAlerts.mockResolvedValue({
      componentAlertCollection: {
        items: [
          makeAlert({ sys: { id: "1" }, title: "First" }),
          makeAlert({ sys: { id: "2" }, title: "Second" }),
        ],
      },
    });
    const ui = await AlertsBar(props);
    assertExists(ui);
    render(ui);
    expect(screen.getAllByTestId("alert-item")).toHaveLength(2);
  });

  it("uses preview client when preview is true", async () => {
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never);
    mockActiveAlerts.mockResolvedValue({ componentAlertCollection: { items: [makeAlert()] } });
    const ui = await AlertsBar({ locale: "en-US", preview: true });
    assertExists(ui);
    render(ui);
    expect(mockActiveAlerts).toHaveBeenCalledWith(expect.objectContaining({ preview: true }));
  });

  it("filters out null items from the collection", async () => {
    mockActiveAlerts.mockResolvedValue({
      componentAlertCollection: { items: [null, makeAlert(), null] },
    });
    const ui = await AlertsBar(props);
    assertExists(ui);
    render(ui);
    expect(screen.getAllByTestId("alert-item")).toHaveLength(1);
  });

  it("queries with correct audience filter", async () => {
    mockActiveAlerts.mockResolvedValue({ componentAlertCollection: { items: [] } });
    await AlertsBar(props);
    expect(mockActiveAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ audience: ["web", "both"] }),
    );
  });
});
