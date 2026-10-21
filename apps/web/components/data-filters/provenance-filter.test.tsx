import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useExperimentData } from "~/hooks/experiment/useExperimentData/useExperimentData";

import { contract } from "@repo/api/contract";
import type {
  ExperimentDataColumn,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import common from "@repo/i18n/locales/en-US/common.json";
import dutch from "@repo/i18n/locales/nl-NL/common.json";

import { FilterChipBar } from "./filter-chip-bar";

const locale = vi.hoisted(() => ({ dutch: false }));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations = locale.dutch ? dutch : common;
      if (key === "provenance.simulated") return translations.provenance.simulated;
      if (key === "provenance.guest") return translations.provenance.guest;
      if (key === "common.yes") return translations.common.yes;
      if (key === "common.no") return translations.common.no;
      return key;
    },
  }),
}));

const columns: ExperimentDataColumn[] = [
  { name: "is_simulated", type_name: "BOOLEAN", type_text: "BOOLEAN" },
  { name: "is_guest", type_name: "BOOLEAN", type_text: "BOOLEAN" },
];

function DataFilters() {
  const [filters, setFilters] = useState<ExperimentDataFilter[]>([]);
  useExperimentData({
    experimentId: "exp-1",
    tableName: "raw_data",
    page: 1,
    pageSize: 20,
    filters,
    columns: columns.map((c) => c.name),
  });
  return (
    <FilterChipBar
      value={filters}
      onChange={setFilters}
      columns={columns}
      experimentId="exp-1"
      tableName="raw_data"
    />
  );
}

describe.each([false, true])(
  "provenance filters from picker to data request (Dutch: %s)",
  (isDutch) => {
    it.each([
      ["is_simulated", "simulated", true],
      ["is_simulated", "simulated", false],
      ["is_guest", "guest", true],
      ["is_guest", "guest", false],
    ] as const)(
      "sends %s=%s as a boolean and keeps its readable label",
      async (column, labelKey, value) => {
        locale.dutch = isDutch;
        const translations = isDutch ? dutch : common;
        const label = translations.provenance[labelKey];
        const valueLabel = value ? translations.common.yes : translations.common.no;
        const request = server.mount(contract.experiments.getExperimentData, { body: [] });
        const distinct = server.mount(contract.experiments.getDistinctColumnValues, {
          body: { values: [], truncated: false },
        });
        const user = userEvent.setup();
        render(<DataFilters />);
        await user.click(screen.getByRole("button", { name: "dataFilters.addFilter" }));
        await user.type(
          screen.getByPlaceholderText("dataFilters.filterByColumnPlaceholder"),
          label,
        );
        await user.click(screen.getByRole("option", { name: `${label} BOOLEAN` }));
        await user.click(screen.getAllByRole("combobox")[0]);
        expect(screen.getByRole("option", { name: "is" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "is not" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "contains" })).not.toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "in" })).not.toBeInTheDocument();
        await user.click(screen.getByRole("option", { name: "is" }));
        await user.click(screen.getByRole("combobox", { name: "dataFilters.placeholderValue" }));
        await user.click(screen.getByRole("option", { name: valueLabel }));
        await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));
        await waitFor(() =>
          expect(request.calls.at(-1)?.query.filters).toBe(
            JSON.stringify([{ column, operator: "equals", value }]),
          ),
        );
        expect(request.calls.at(-1)?.query.columns).toBe("is_simulated,is_guest");
        expect(
          screen.getByRole("button", { name: `${label} is ${valueLabel}` }),
        ).toBeInTheDocument();
        expect(screen.queryByText(column)).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: `${label} is ${valueLabel}` }));
        await user.click(screen.getAllByRole("combobox")[0]);
        await user.click(screen.getByRole("option", { name: "is not" }));
        await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));
        await waitFor(() =>
          expect(request.calls.at(-1)?.query.filters).toBe(
            JSON.stringify([{ column, operator: "not_equals", value }]),
          ),
        );
        expect(
          screen.getByRole("button", { name: `${label} is not ${valueLabel}` }),
        ).toBeInTheDocument();
        expect(distinct.called).toBe(false);
      },
    );
  },
);
