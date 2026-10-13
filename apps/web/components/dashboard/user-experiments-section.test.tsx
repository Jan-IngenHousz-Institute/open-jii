import { orpc } from "@/lib/orpc";
import { createHomeExperiment, createRecentlyOpenedExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { HomeExperiments } from "@repo/api/domains/experiment/experiment.schema";

import { UserExperimentsSection } from "./user-experiments-section";

const noWork: HomeExperiments = { source: "related", experiments: [] };

describe("UserExperimentsSection", () => {
  it("asks for three home experiments", async () => {
    const spy = server.mount(contract.experiments.listHomeExperiments, { body: noWork });
    render(<UserExperimentsSection />);
    await screen.findByRole("heading", { name: "dashboard.yourExperiments" });
    expect(spy.calls[0].query).toEqual({ limit: "3" });
  });

  it("does not guess a title or show first-work content while loading", async () => {
    let release: () => void = vi.fn();
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = server.mount(contract.experiments.listHomeExperiments, { body: noWork, unblock });
    render(<UserExperimentsSection />);
    await waitFor(() => expect(spy.called).toBe(true));
    expect(screen.queryByRole("heading", { name: "dashboard.yourExperiments" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "dashboard.recentlyOpenedExperiments" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /dashboard\.firstWork\.create\.title/ })).toBeNull();
    release();
    await screen.findByRole("link", { name: /dashboard\.firstWork\.create\.title/ });
  });

  it("shows related work with roles and updated dates, without an opened date", async () => {
    server.mount(contract.experiments.listHomeExperiments, {
      body: {
        source: "related",
        experiments: [
          createHomeExperiment({ name: "Newest", callerRole: "viewer" }),
          createHomeExperiment({ name: "Older", callerRole: "member" }),
        ],
      },
    });
    render(<UserExperimentsSection />);
    await screen.findByRole("heading", { name: "dashboard.yourExperiments" });
    const newest = screen.getByRole("link", { name: /Newest/ });
    expect(newest).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/en-US\/platform\/experiments\//),
    );
    expect(screen.getByText("callerRoles.viewer")).toBeInTheDocument();
    expect(screen.getByText("callerRoles.member")).toBeInTheDocument();
    expect(screen.getAllByText("updatedOn")).toHaveLength(2);
    expect(screen.queryByText("openedOn")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "dashboard.recentlyOpenedExperiments" }),
    ).toBeNull();
  });

  it("shows real visited work in server order under the visited title", async () => {
    server.mount(contract.experiments.listHomeExperiments, {
      body: {
        source: "recently-opened",
        experiments: [
          createRecentlyOpenedExperiment({ name: "Newest", callerRole: "admin" }),
          createRecentlyOpenedExperiment({ name: "Older", callerRole: "member" }),
        ],
      },
    });
    render(<UserExperimentsSection />);
    await screen.findByRole("heading", { name: "dashboard.recentlyOpenedExperiments" });
    const cards = screen.getAllByRole("link", { name: /Newest|Older/ });
    expect(cards[0]).toHaveTextContent("Newest");
    expect(cards[1]).toHaveTextContent("Older");
    expect(screen.getAllByText("openedOn")).toHaveLength(2);
    expect(screen.queryByText("updatedOn")).toBeNull();
    expect(screen.queryByRole("heading", { name: "dashboard.yourExperiments" })).toBeNull();
  });

  it("retains all three first-work destinations when no work is available", async () => {
    server.mount(contract.experiments.listHomeExperiments, { body: noWork });
    render(<UserExperimentsSection />);
    expect(
      await screen.findByRole("link", { name: /dashboard\.firstWork\.create\.title/ }),
    ).toHaveAttribute("href", "/en-US/platform/experiments/new");
    expect(screen.getByRole("link", { name: /dashboard\.firstWork\.join\.title/ })).toHaveAttribute(
      "href",
      "/en-US/platform/organizations",
    );
    expect(
      screen.getByRole("link", { name: /dashboard\.firstWork\.browse\.title/ }),
    ).toHaveAttribute("href", "/en-US/platform/experiments?visibility=public&focus=search");
  });

  it.each([404, 500])(
    "shows a safe retry state after HTTP %s and recovers without reload",
    async (status) => {
      server.mount(contract.experiments.listHomeExperiments, {
        status,
        body: { message: "raw SQL private data" },
      });
      render(<UserExperimentsSection />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "dashboard.userExperimentsLoadFailed",
      );
      expect(screen.queryByText(/raw SQL/)).toBeNull();
      expect(
        screen.queryByRole("link", { name: /dashboard\.firstWork\.create\.title/ }),
      ).toBeNull();
      expect(
        screen.queryByRole("heading", {
          name: /dashboard\.(yourExperiments|recentlyOpenedExperiments)/,
        }),
      ).toBeNull();
      server.mount(contract.experiments.listHomeExperiments, {
        body: { source: "related", experiments: [createHomeExperiment({ name: "Recovered" })] },
      });
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "dashboard.userExperimentsRetry" }));
      expect(await screen.findByRole("link", { name: /Recovered/ })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("rechecks fresh cached private work on the next mount before showing it", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    client.setQueryData(
      orpc.experiments.listHomeExperiments.queryOptions({ input: { limit: 3 } }).queryKey,
      { source: "related", experiments: [createHomeExperiment({ name: "Revoked" })] },
    );
    let release: () => void = vi.fn();
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = server.mount(contract.experiments.listHomeExperiments, { body: noWork, unblock });
    render(<UserExperimentsSection />, { queryClient: client });
    await waitFor(() => expect(spy.called).toBe(true));
    expect(screen.queryByRole("link", { name: /Revoked/ })).toBeNull();
    release();
    await screen.findByRole("link", { name: /dashboard\.firstWork\.create\.title/ });
    expect(screen.queryByRole("link", { name: /Revoked/ })).toBeNull();
  });

  it("hides cached cards when their revalidation fails", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    client.setQueryData(
      orpc.experiments.listHomeExperiments.queryOptions({ input: { limit: 3 } }).queryKey,
      { source: "related", experiments: [createHomeExperiment({ name: "Revoked" })] },
    );
    server.mount(contract.experiments.listHomeExperiments, { status: 500 });
    render(<UserExperimentsSection />, { queryClient: client });
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: /Revoked/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /dashboard\.firstWork\.create\.title/ })).toBeNull();
  });

  it("keeps confirmed cards and their title during a background refresh", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.mount(contract.experiments.listHomeExperiments, {
      body: { source: "related", experiments: [createHomeExperiment({ name: "Confirmed" })] },
    });
    render(<UserExperimentsSection />, { queryClient: client });
    await screen.findByRole("link", { name: /Confirmed/ });

    let release: () => void = vi.fn();
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const refresh = server.mount(contract.experiments.listHomeExperiments, {
      body: { source: "related", experiments: [createHomeExperiment({ name: "Fresh" })] },
      unblock,
    });
    act(() => {
      void client.invalidateQueries({ queryKey: orpc.experiments.listHomeExperiments.key() });
    });
    await waitFor(() => expect(refresh.called).toBe(true));
    expect(screen.getByRole("link", { name: /Confirmed/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dashboard.yourExperiments" })).toBeInTheDocument();
    release();
    await screen.findByRole("link", { name: /Fresh/ });
    expect(screen.queryByRole("link", { name: /Confirmed/ })).toBeNull();
  });

  it.each([404, 500])(
    "replaces confirmed cards with the error when a background read fails with %s",
    async (status) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      server.mount(contract.experiments.listHomeExperiments, {
        body: {
          source: "related",
          experiments: [createHomeExperiment({ name: "Previously confirmed" })],
        },
      });
      render(<UserExperimentsSection />, { queryClient: client });
      await screen.findByRole("link", { name: /Previously confirmed/ });
      server.mount(contract.experiments.listHomeExperiments, { status });
      await act(async () => {
        await client.invalidateQueries({ queryKey: orpc.experiments.listHomeExperiments.key() });
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "dashboard.userExperimentsLoadFailed",
      );
      expect(screen.queryByRole("link", { name: /Previously confirmed/ })).toBeNull();
      expect(screen.queryByRole("heading", { name: "dashboard.yourExperiments" })).toBeNull();
      expect(
        screen.getByRole("button", { name: "dashboard.userExperimentsRetry" }),
      ).toBeInTheDocument();
    },
  );
});
