import type { LazyTraceType } from "./plotly-trace-types";
import { isEagerTraceType, isLazyTraceType } from "./plotly-trace-types";

const importRuntime = () => import("./plotly-runtime");

let runtimeLoad: ReturnType<typeof importRuntime> | undefined;

/**
 * Plotly touches `window` on import, so it only loads on the client, once a
 * chart renders. Every caller shares one load rather than racing its own import.
 */
export function loadPlotlyRuntime(): ReturnType<typeof importRuntime> {
  runtimeLoad ??= importRuntime();
  return runtimeLoad;
}

const registered = new Set<LazyTraceType>();
// A failed load stays cached: retrying it on every render would suspend forever.
const loading = new Map<string, Promise<void>>();
const reported = new Set<string>();

/**
 * The registration still owed before `types` can be drawn, or null when Plotly
 * already has them. A suspended render asks again on every retry, and `use()`
 * needs the same promise back, so it is cached by the set of missing types.
 */
export function pendingTraceTypes(types: Iterable<string>): Promise<void> | null {
  const missing = new Set<LazyTraceType>();

  for (const type of types) {
    if (isLazyTraceType(type)) {
      if (!registered.has(type)) {
        missing.add(type);
      }
    } else if (!isEagerTraceType(type)) {
      reportUnknown(type);
    }
  }

  if (missing.size === 0) {
    return null;
  }

  const batch = [...missing].sort();
  const key = batch.join(",");
  const cached = loading.get(key);
  if (cached) {
    return cached;
  }

  const registration = loadPlotlyRuntime()
    .then((runtime) => runtime.registerTraceTypes(batch))
    .then(() => {
      for (const type of batch) {
        registered.add(type);
      }
      loading.delete(key);
    });
  loading.set(key, registration);
  return registration;
}

function reportUnknown(type: string): void {
  if (reported.has(type)) {
    return;
  }
  reported.add(type);
  console.warn(`Plotly trace type "${type}" has no loader in plotly-runtime and draws as scatter`);
}
