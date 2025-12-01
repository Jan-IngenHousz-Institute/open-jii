import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Experiment, ExperimentMember } from "@repo/api";

import { ExperimentInfoCard } from "./experiment-info-card";

globalThis.React = React;

/* ----------------------------- Hoisted mocks ---------------------------- */

const useLocaleMock = vi.hoisted(() => vi.fn());

/* --------------------------------- Mocks -------------------------------- */

// i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// auth
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-admin" } },
  }),
}));

// sub-components
vi.mock("./experiment-archive", () => ({
  ExperimentArchive: () => <div data-testid="experiment-archive">Experiment Archive</div>,
}));

vi.mock("./experiment-delete", () => ({
  ExperimentDelete: () => <div data-testid="experiment-delete">Experiment Delete</div>,
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: useLocaleMock,
}));

/* ------------------------------- Test Data ------------------------------- */

const experimentId = "exp-123";

const mockExperiment: Experiment = {
  id: experimentId,
  name: "Test Experiment",
  description: "Test Description",
  status: "active",
  visibility: "private",
  createdBy: "user-admin",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  embargoUntil: "2025-12-31T23:59:59.999Z",
};

/* -------------------------- Helpers -------------------------- */

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/* --------------------------------- Setup -------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  useLocaleMock.mockReturnValue("en");
});

/* --------------------------------- Tests -------------------------------- */

const membersData: ExperimentMember[] = [
  {
    role: "admin",
    user: { id: "user-admin", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
];

describe("<ExperimentInfoCard />", () => {
  it("renders sub-components", () => {
    renderWithClient(
      <ExperimentInfoCard
        experimentId={experimentId}
        experiment={mockExperiment}
        members={membersData}
      />,
    );

    expect(screen.getByTestId("experiment-archive")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-delete")).toBeInTheDocument();
  });
});
