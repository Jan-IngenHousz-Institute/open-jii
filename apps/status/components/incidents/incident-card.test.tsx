import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import { incidentStatusDocument } from "@repo/monitoring/status-fixtures";

import { IncidentCard } from "./incident-card";

const [incident] = incidentStatusDocument.incidents;

describe("IncidentCard", () => {
  it("shows every update when two share a stage and a time, without a key clash", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const [update] = incident.updates;

    renderWithProviders(
      <IncidentCard
        incident={{
          ...incident,
          updates: [
            update,
            { ...update, id: "upd-second", text: "A second note at the same minute." },
          ],
        }}
      />,
    );

    expect(screen.getByText(update.text)).toBeInTheDocument();
    expect(screen.getByText("A second note at the same minute.")).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps the paragraph breaks in an update", () => {
    const [update] = incident.updates;

    renderWithProviders(
      <IncidentCard
        incident={{ ...incident, updates: [{ ...update, text: "First.\n\nSecond." }] }}
      />,
    );

    expect(screen.getByText(/First\.\s+Second\./)).toHaveClass("whitespace-pre-line");
  });
});
