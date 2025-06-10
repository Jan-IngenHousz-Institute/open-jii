import { useEffect, useState } from "react";

import type { ExperimentData } from "@repo/api";

const experimentData: ExperimentData = {
  columns: [
    {
      name: "plot_id",
      type_name: "string",
      type_text: "Plot identifier",
    },
    {
      name: "genotype",
      type_name: "string",
      type_text: "Corn genotype",
    },
    {
      name: "water_deficit",
      type_name: "float",
      type_text: "Water deficit percentage",
    },
    {
      name: "yield_kg_ha",
      type_name: "float",
      type_text: "Yield in kg per hectare",
    },
    {
      name: "plant_stress_index",
      type_name: "float",
      type_text: "Measured stress index (0-10)",
    },
  ],
  rows: [
    ["P1", "Pioneer3939", "0", "12540.5", "0.8"],
    ["P2", "Pioneer3939", "25", "10325.2", "2.5"],
    ["P3", "Pioneer3939", "50", "7845.8", "5.2"],
    ["D1", "DroughtMaster", "0", "12105.3", "0.7"],
    ["D2", "DroughtMaster", "25", "11256.7", "1.8"],
    ["D3", "DroughtMaster", "50", "9876.4", "3.4"],
    ["C1", "Control", "0", "11987.6", "0.9"],
    ["C2", "Control", "25", "9654.3", "3.2"],
    ["C3", "Control", "50", "6543.2", "6.5"],
  ],
  totalRows: 45,
  truncated: true,
};

export const useExperimentMockData = () => {
  const [data, setData] = useState<ExperimentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setData(experimentData);
    }, 1000);
  }, []);
  return { data, isLoading };
};
