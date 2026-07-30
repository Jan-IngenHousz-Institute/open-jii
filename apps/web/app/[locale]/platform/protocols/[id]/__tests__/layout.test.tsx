import { createProtocolDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound, useParams, usePathname } from "next/navigation";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import ProtocolLayout from "../layout";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

const mockBrowserSupport = {
  bluetooth: true,
  serial: true,
  any: true,
  bluetoothReason: null as string | null,
  serialReason: null as string | null,
};
vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => mockBrowserSupport,
}));

vi.mock("@/components/shared/inline-editable-title", () => ({
  InlineEditableTitle: ({
    name,
    hasAccess,
    isPending,
    badges,
    actions,
    onSave,
  }: {
    name: string;
    hasAccess: boolean;
    onSave: (newName: string) => Promise<void>;
    isPending: boolean;
    badges?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="inline-editable-title">
      <span data-testid="title-name">{name}</span>
      <span data-testid="title-has-access">{String(hasAccess)}</span>
      <span data-testid="title-is-pending">{String(isPending)}</span>
      {badges && <div data-testid="title-badges">{badges}</div>}
      {actions && <div data-testid="title-actions">{actions}</div>}
      <button
        data-testid="save-title-btn"
        onClick={() =>
          void onSave("New Title").catch(() => {
            /* noop */
          })
        }
      >
        Save
      </button>
    </div>
  ),
}));

const defaultProtocol = createProtocolDetail({
  id: "test-id",
  name: "Test Protocol",
  family: "multispeq",
  sortOrder: null,
  createdBy: "other-user",
});

const defaultSession = {
  data: { user: { id: "user-123" } },
  isPending: false,
};

function renderLayout({
  protocolId = "test-id",
  session = defaultSession,
  children = <div>Children Content</div>,
  pathname,
}: {
  protocolId?: string;
  session?:
    | { data: { user: { id: string } }; isPending: boolean }
    | { data: null; isPending: boolean };
  children?: React.ReactNode;
  /** Defaults to the protocol's overview route; pass `/run` for the tester. */
  pathname?: string;
} = {}) {
  vi.mocked(useParams).mockReturnValue({ id: protocolId, locale: "en" });
  vi.mocked(usePathname).mockReturnValue(pathname ?? `/en/platform/protocols/${protocolId}`);
  vi.mocked(useSession).mockReturnValue(session as ReturnType<typeof useSession>);

  return render(<ProtocolLayout>{children}</ProtocolLayout>);
}

describe("ProtocolLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserSupport.bluetooth = true;
    mockBrowserSupport.serial = true;
    mockBrowserSupport.any = true;
    mockBrowserSupport.bluetoothReason = null;
    mockBrowserSupport.serialReason = null;
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail(),
        delay: 999_999,
      });
      renderLayout();

      expect(screen.getByText("protocols.loadingProtocols")).toBeInTheDocument();
    });

    it("should not render children when loading", () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail(),
        delay: 999_999,
      });
      renderLayout();

      expect(screen.queryByText("Children Content")).not.toBeInTheDocument();
    });

    it("should not render the inline editable title when loading", () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail(),
        delay: 999_999,
      });
      renderLayout();

      expect(screen.queryByTestId("inline-editable-title")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should call notFound for 404 errors", async () => {
      server.mount(contract.protocols.getProtocol, { status: 404 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("should call notFound for 404 errors (invalid UUID)", async () => {
      server.mount(contract.protocols.getProtocol, { status: 404 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("should display error display for 500 errors", async () => {
      server.mount(contract.protocols.getProtocol, { status: 500 });
      renderLayout();

      await waitFor(
        () => {
          expect(screen.getByTestId("error-display")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("should display error heading and description for non-404/400 errors", async () => {
      server.mount(contract.protocols.getProtocol, { status: 500 });
      renderLayout();

      await waitFor(
        () => {
          expect(screen.getByText("errors.error")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText("protocols.notFoundDescription")).toBeInTheDocument();
    });

    it("should not render children when there is an error", async () => {
      server.mount(contract.protocols.getProtocol, { status: 500 });
      renderLayout();

      await waitFor(
        () => {
          expect(screen.getByTestId("error-display")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("Children Content")).not.toBeInTheDocument();
    });
  });

  describe("Success State", () => {
    it("should render InlineEditableTitle with protocol name", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, name: "My Protocol" }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
      });
      expect(screen.getByTestId("title-name")).toHaveTextContent("My Protocol");
    });

    it("should render children content", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("Children Content")).toBeInTheDocument();
      });
    });

    it("should pass hasAccess=true when the caller may update", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, createdBy: "user-123" }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-has-access")).toHaveTextContent("true");
      });
    });

    it("should pass hasAccess=false when the caller cannot update", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          ...defaultProtocol,
          createdBy: "different-user",
          capabilities: readOnlyCapabilities,
        }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
      });
    });

    it("should pass hasAccess=false when the response carries no capabilities", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, capabilities: readOnlyCapabilities }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout({
        session: { data: null, isPending: false },
      });

      await waitFor(() => {
        expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
      });
    });

    it("should render preferred badge when sortOrder is not null", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, sortOrder: 1 }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        const badges = screen.getByTestId("title-badges");
        expect(badges).toHaveTextContent("common.preferred");
      });
    });

    it("should not render preferred badge when sortOrder is null", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, sortOrder: null }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("title-badges")).not.toBeInTheDocument();
    });

    it("should render the outer container with space-y-6 class", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("Children Content")).toBeInTheDocument();
      });
      expect(document.querySelector(".space-y-6")).toBeInTheDocument();
    });
  });

  describe("Overview / Collaborators strip", () => {
    it("renders the strip under the title, linked at the protocol's own routes", async () => {
      server.mount(contract.protocols.getProtocol, { body: createProtocolDetail(defaultProtocol) });
      renderLayout();

      const overview = await screen.findByRole("tab", { name: "common.overview" });
      expect(overview).toHaveAttribute("href", "/en-US/platform/protocols/test-id");
      expect(screen.getByRole("tab", { name: "sharing.collaboratorsTab" })).toHaveAttribute(
        "href",
        "/en-US/platform/protocols/test-id/collaborators",
      );
    });

    it("renders no strip for a reader who can neither share nor leave", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, capabilities: readOnlyCapabilities }),
      });
      renderLayout();

      await waitFor(() => expect(screen.getByText("Children Content")).toBeInTheDocument());
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("leaves the strip off the tester, which is a full-page tool with its own Back", async () => {
      server.mount(contract.protocols.getProtocol, { body: createProtocolDetail(defaultProtocol) });
      renderLayout({ pathname: "/en/platform/protocols/test-id/run" });

      await waitFor(() => expect(screen.getByText("Children Content")).toBeInTheDocument());
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });
  });

  describe("Title Save Handler", () => {
    it("should call toast on successful title save", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, createdBy: "user-123" }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      const user = userEvent.setup();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("save-title-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("save-title-btn"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({ description: "protocols.protocolUpdated" });
      });
    });

    it("should call toast with destructive variant on title save error", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol, createdBy: "user-123" }),
      });
      server.mount(contract.protocols.updateProtocol, { status: 400 });
      const user = userEvent.setup();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("save-title-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("save-title-btn"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: expect.any(String) as unknown,
          variant: "destructive",
        });
      });
    });

    it("should pass isPending=true while update is in progress", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol }),
      });
      server.mount(contract.protocols.updateProtocol, {
        body: createProtocolDetail(),
        delay: 999_999,
      });
      const user = userEvent.setup();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("save-title-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("save-title-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("title-is-pending")).toHaveTextContent("true");
      });
    });

    it("should pass isPending=false when not updating", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ ...defaultProtocol }),
      });
      server.mount(contract.protocols.updateProtocol, { body: createProtocolDetail() });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-is-pending")).toHaveTextContent("false");
      });
    });
  });
});
