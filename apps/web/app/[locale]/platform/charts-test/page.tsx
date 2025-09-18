"use client";

import React from "react";

import { PlotlyChart } from "@repo/ui/components";

export default function ChartsTestPage() {
  // Sample data for different chart types
  const scatterData = [
    {
      type: "scatter" as const,
      x: [1, 2, 3, 4, 5],
      y: [2, 4, 3, 8, 6],
      mode: "lines+markers" as const,
      name: "Scatter Plot",
      marker: { color: "rgb(255, 127, 14)" },
    },
  ];

  const barData = [
    {
      type: "bar" as const,
      x: ["Jan", "Feb", "Mar", "Apr", "May"],
      y: [20, 14, 23, 25, 22],
      name: "Bar Chart",
      marker: { color: "rgb(158, 202, 225)" },
    },
  ];

  const lineData = [
    {
      type: "scatter" as const,
      x: [1, 2, 3, 4, 5, 6],
      y: [1, 4, 9, 16, 25, 36],
      mode: "lines" as const,
      name: "Line Chart",
      line: { color: "rgb(255, 127, 14)", width: 3 },
    },
    {
      type: "scatter" as const,
      x: [1, 2, 3, 4, 5, 6],
      y: [2, 8, 18, 32, 50, 72],
      mode: "lines" as const,
      name: "Second Line",
      line: { color: "rgb(44, 160, 44)", width: 3 },
    },
  ];

  const basicLayout = {
    title: { text: "Sample Chart" },
    xaxis: { title: { text: "X Axis" } },
    yaxis: { title: { text: "Y Axis" } },
    autosize: true,
  };

  const customLayout = {
    title: { text: "Custom Styled Chart" },
    xaxis: {
      title: { text: "Time" },
      gridcolor: "rgba(128,128,128,0.2)",
    },
    yaxis: {
      title: { text: "Value" },
      gridcolor: "rgba(128,128,128,0.2)",
    },
    plot_bgcolor: "rgba(0,0,0,0)",
    paper_bgcolor: "rgba(0,0,0,0)",
    autosize: true,
  };

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">PlotlyChart Test Page</h1>
        <p className="text-muted-foreground">
          Testing the PlotlyChart component with different chart types and configurations
        </p>
      </div>

      {/* Basic Scatter Plot */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Basic Scatter Plot</h2>
        <div className="h-96 rounded-lg border p-4">
          <PlotlyChart className="h-full" data={scatterData} layout={basicLayout} />
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Bar Chart</h2>
        <div className="h-96 rounded-lg border p-4">
          <PlotlyChart
            className="h-full"
            data={barData}
            layout={{
              ...basicLayout,
              title: { text: "Monthly Sales" },
              xaxis: { title: { text: "Month" } },
              yaxis: { title: { text: "Sales ($)" } },
            }}
          />
        </div>
      </div>

      {/* Multi-line Chart */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Multi-line Chart</h2>
        <div className="h-96 rounded-lg border p-4">
          <PlotlyChart className="h-full" data={lineData} layout={customLayout} />
        </div>
      </div>

      {/* Minimal Configuration */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Minimal Configuration</h2>
        <div className="h-96 rounded-lg border p-4">
          <PlotlyChart
            className="h-full"
            data={[
              {
                type: "scatter" as const,
                x: [1, 2, 3, 4],
                y: [10, 11, 12, 13],
                mode: "lines+markers" as const,
              },
            ]}
            layout={{}}
          />
        </div>
      </div>

      {/* Loading State Demo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading State</h2>
        <div className="h-96 rounded-lg border p-4">
          <PlotlyChart className="h-full" data={scatterData} layout={basicLayout} loading={true} />
        </div>
      </div>

      {/* Error State Demo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Error State</h2>
        <div className="h-96 rounded-lg border p-4">
          <PlotlyChart
            className="h-full"
            data={scatterData}
            error="This is a sample error message"
            layout={basicLayout}
          />
        </div>
      </div>

      {/* Responsive Test */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Responsive Chart</h2>
        <p className="text-muted-foreground text-sm">This chart should resize with the container</p>
        <div
          className="resize overflow-auto rounded-lg border p-4"
          style={{ minHeight: "300px", maxHeight: "600px" }}
        >
          <PlotlyChart
            className="h-full w-full"
            data={scatterData}
            layout={{
              ...basicLayout,
              title: { text: "Responsive Chart - Try resizing!" },
            }}
          />
        </div>
      </div>
    </div>
  );
}
