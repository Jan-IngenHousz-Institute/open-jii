import { useEffect } from "react";
import type { useForm } from "react-hook-form";

import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";
import { useLiveVizPublisher } from "../context/live-viz-context";

/**
 * Publishes in-flight form values to the live-viz context so the canvas
 * widget renders from form state without waiting for autosave. Uses
 * `form.watch` (not `useWatch`) so programmatic `setValue` calls
 * (which fire watch without event-type metadata) also publish.
 */
export function useLiveVizPreview(
  form: ReturnType<typeof useForm<ChartFormValues>>,
  visualizationId: string,
): void {
  const publish = useLiveVizPublisher();

  useEffect(() => {
    publish({ vizId: visualizationId, values: form.getValues() });

    const subscription = form.watch((_values, info) => {
      // Blur events don't change values; mount-tick has no name.
      if (info.type === "blur" || !info.name) return;
      publish({ vizId: visualizationId, values: form.getValues() });
    });

    return () => {
      subscription.unsubscribe();
      publish(null);
    };
  }, [form, visualizationId, publish]);
}
