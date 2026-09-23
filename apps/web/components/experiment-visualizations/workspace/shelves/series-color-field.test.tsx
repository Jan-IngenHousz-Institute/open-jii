import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { SeriesColorField } from "./series-color-field";

let formRef: ReturnType<typeof useForm<ChartFormValues>> | undefined;

function Harness({ seriesIndex }: { seriesIndex: number }) {
  const form = useForm<ChartFormValues>({
    defaultValues: {
      name: "Untitled",
      description: "",
      chartFamily: lineChartType.family,
      chartType: lineChartType.type,
      config: lineChartType.defaultConfig(),
      dataConfig: lineChartType.defaultDataConfig(),
    },
  });
  formRef = form;
  return (
    <FormProvider {...form}>
      <SeriesColorField form={form} seriesIndex={seriesIndex} isColorMapped={false} />
    </FormProvider>
  );
}

function currentForm() {
  if (!formRef) {
    throw new Error("Harness has not rendered");
  }
  return formRef;
}

describe("SeriesColorField", () => {
  it("leaves the stored colours untouched until one is picked", () => {
    render(<Harness seriesIndex={1} />);

    expect(currentForm().getValues("config")).not.toHaveProperty("color");
  });

  it("commits a picked colour at its series index", async () => {
    render(<Harness seriesIndex={1} />);

    fireEvent.change(screen.getByLabelText("workspace.shelves.color"), {
      target: { value: "#ff0000" },
    });

    await waitFor(() => expect(currentForm().getValues("config.color.1")).toBe("#ff0000"));
  });
});
