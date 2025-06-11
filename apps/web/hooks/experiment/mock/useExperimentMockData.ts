import { useEffect, useState } from "react";

import type { ExperimentData } from "@repo/api";

const experimentData1: ExperimentData = {
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

const experimentData2 = {
  columns: [
    {
      name: "field_id",
      type_name: "string",
      type_text: "Field identifier",
    },
    {
      name: "wheat_variety",
      type_name: "string",
      type_text: "Wheat variety",
    },
    {
      name: "n_application_kg_ha",
      type_name: "float",
      type_text: "Nitrogen application in kg/ha",
    },
    {
      name: "yield_t_ha",
      type_name: "float",
      type_text: "Yield in tonnes per hectare",
    },
    {
      name: "grain_protein",
      type_name: "float",
      type_text: "Grain protein percentage",
    },
    {
      name: "nue",
      type_name: "float",
      type_text: "Nitrogen use efficiency",
    },
  ],
  rows: [
    ["F1", "Robigus", "0", "6.2", "9.8", "0"],
    ["F2", "Robigus", "120", "9.5", "11.3", "27.5"],
    ["F3", "Robigus", "240", "10.8", "13.5", "19.2"],
    ["F4", "Cordiale", "0", "5.8", "10.2", "0"],
    ["F5", "Cordiale", "120", "9.1", "12.1", "27.5"],
    ["F6", "Cordiale", "240", "10.5", "14.2", "19.6"],
    ["F7", "Hereward", "0", "5.5", "10.5", "0"],
    ["F8", "Hereward", "120", "8.9", "13.2", "28.3"],
    ["F9", "Hereward", "240", "10.3", "15.4", "20.0"],
  ],
  totalRows: 36,
  truncated: true,
};

const experimentData3 = {
  columns: [
    {
      name: "field_id",
      type_name: "string",
      type_text: "Field identifier",
    },
    {
      name: "wheat_variety",
      type_name: "string",
      type_text: "Wheat variety",
    },
    {
      name: "n_application_kg_ha",
      type_name: "float",
      type_text: "Nitrogen application in kg/ha",
    },
    {
      name: "yield_t_ha",
      type_name: "float",
      type_text: "Yield in tonnes per hectare",
    },
    {
      name: "grain_protein",
      type_name: "float",
      type_text: "Grain protein percentage",
    },
    {
      name: "nue",
      type_name: "float",
      type_text: "Nitrogen use efficiency",
    },
  ],
  rows: [],
  totalRows: 0,
  truncated: true,
};

const experimentData4 = {
  columns: [
    {
      name: "field_id",
      type_name: "string",
      type_text: "Field identifier",
    },
    {
      name: "crop_length",
      type_name: "float",
      type_text: "Crop length (mm)",
    },
  ],
  rows: [],
  totalRows: 0,
  truncated: true,
};

for (let i = 1; i <= 100; i++) {
  const row = [
    `F${i}`,
    (Math.random() * (0.1 - 20.02) + 20.02).toFixed(4).toString(),
  ];
  experimentData4.rows.push(row as never);
}

export const useExperimentMockData = (id: string) => {
  const [data, setData] = useState<ExperimentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
      switch (id) {
        case "1":
          setData(experimentData1);
          break;
        case "2":
          setData(experimentData2);
          break;
        case "3":
          setData(experimentData3);
          break;
        case "4":
          setData(experimentData4);
          break;
      }
    }, 500);
  }, [id]);
  return { data, isLoading };
};
