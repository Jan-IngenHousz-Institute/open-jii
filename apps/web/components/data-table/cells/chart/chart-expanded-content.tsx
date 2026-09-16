import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import { readThemeColor } from "@repo/ui/components/charts/utils";

import { parseNumericArray } from "./parse-numeric-array";

interface ChartExpandedContentProps {
  data: string;
  columnName: string;
}

// Expanded content component for rendering the full trace chart in a table row
export function ChartExpandedContent({ data, columnName }: ChartExpandedContentProps) {
  const parsedData = parseNumericArray(data);

  if (parsedData.length === 0) {
    return null;
  }

  const xValues = parsedData.map((_, index) => index);

  const seriesData: LineSeriesData[] = [
    {
      name: columnName || "Chart",
      x: xValues,
      y: parsedData,
      mode: "lines",
      // Plotly takes a concrete colour, so the contract token is resolved
      // rather than passed as `var()`.
      line: {
        color: readThemeColor("--chart-1"),
        width: 2,
      },
      showlegend: true,
    },
  ];

  return (
    <div className="bg-card w-full p-4">
      <div className="h-[460px] w-full">
        <LineChart
          data={seriesData}
          config={{
            title: `${columnName || "Chart"} Data Series`,
            xAxisTitle: "Pulses",
            yAxisTitle: "Intensity",
            useWebGL: false,
          }}
        />
      </div>
    </div>
  );
}
