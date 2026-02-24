/**
 * `server.mount()` — concise per-test endpoint override.
 *
 * A thin wrapper around `server.use(http[method](url, handler))` that:
 * - Derives the HTTP method & URL from a ts-rest contract endpoint
 * - Returns a {@link RequestSpy} for asserting on request details
 * - Picks sensible default status codes (200/201/204) per method
 *
 * No factory knowledge — tests provide the exact body they want.
 *
 * @example
 * ```ts
 * import { server } from "@/test/msw/server";
 * import { contract } from "@repo/api";
 * import { createExperiment } from "@/test/factories";
 *
 * // Return specific data
 * server.mount(contract.experiments.getExperiment, {
 *   body: createExperiment({ id: "exp-1", name: "Custom" }),
 * });
 *
 * // Error response
 * server.mount(contract.experiments.getExperiment, { status: 404 });
 *
 * // Capture what the component sent
 * const spy = server.mount(contract.macros.createMacro, {
 *   body: createMacro({ id: "new-1" }),
 * });
 * // … trigger action …
 * expect(spy.body).toMatchObject({ name: "Test" });
 * expect(spy.calls[0].query).toEqual({ search: "foo" });
 *
 * // Delay (e.g. to observe optimistic UI)
 * server.mount(contract.experiments.updateExperiment, {
 *   body: createExperiment({ id: "exp-1" }),
 *   delay: 100,
 * });
 * ```
 */
import { http, HttpResponse, delay as mswDelay } from "msw";
import type { SetupServerApi } from "msw/node";

export const API_URL = "http://localhost:3020";

// ── Types ───────────────────────────────────────────────────────

/** Minimal shape of a ts-rest contract endpoint. */
export interface ContractEndpoint {
  method: string;
  path: string;
}

/** Options for `server.mount()`. All optional. */
export interface MountOptions {
  /** JSON response body. Omit for 204 or error defaults. */
  body?: unknown;
  /** HTTP status. Auto-detected from method if omitted (200/201/204). ≥400 = error. */
  status?: number;
  /** Artificial delay in ms before responding. */
  delay?: number;
}

/** Individual request captured by the spy. */
export interface SpyCall {
  /** Parsed JSON body (POST/PATCH/PUT). */
  body: unknown;
  /** Path params (e.g. `{ id: "exp-1" }`). */
  params: Record<string, string | readonly string[]>;
  /** Parsed query parameters from the request URL. */
  query: Record<string, string>;
  /** Full request URL including query string. */
  url: string;
}

/** Captures request details. Populated when MSW handles the request. */
export interface RequestSpy {
  /** Whether the handler was invoked at least once. */
  called: boolean;
  /** All captured invocations, most recent last. */
  calls: SpyCall[];
  /** Shorthand: number of times the handler was invoked. */
  readonly callCount: number;
  // ── Last-call shortcuts (backwards-compatible) ──────────────
  /** Parsed JSON body of the *last* request. */
  body: unknown;
  /** Path params of the *last* request. */
  params: Record<string, string | readonly string[]>;
  /** Full URL of the *last* request. */
  url: string;
}

// ── Implementation ──────────────────────────────────────────────

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

function statusForMethod(method: HttpMethod): number {
  if (method === "post") return 201;
  if (method === "delete") return 204;
  return 200;
}

/**
 * Create a `mount` function bound to the given MSW server instance.
 * Called once in `server.ts`; tests use `server.mount(…)`.
 */
export function createMount(server: SetupServerApi) {
  return function mount(endpoint: ContractEndpoint, options: MountOptions = {}): RequestSpy {
    const method = endpoint.method.toLowerCase() as HttpMethod;
    const url = `${API_URL}${endpoint.path}`;

    const spy: RequestSpy = {
      called: false,
      calls: [],
      get callCount() {
        return this.calls.length;
      },
      body: null,
      params: {},
      url: "",
    };

    const handler = http[method](url, async ({ request, params }) => {
      // ── Parse query params ──────────────────────────────────
      const parsed = new URL(request.url);
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      // ── Parse body ──────────────────────────────────────────
      let body: unknown = null;
      if (["post", "patch", "put"].includes(method)) {
        try {
          body = await request.json();
        } catch {
          body = null;
        }
      }

      // ── Record call ─────────────────────────────────────────
      const call: SpyCall = {
        body,
        params: params as Record<string, string | readonly string[]>,
        query,
        url: request.url,
      };
      spy.calls.push(call);

      // ── Update last-call shortcuts ──────────────────────────
      spy.called = true;
      spy.body = body;
      spy.params = call.params;
      spy.url = call.url;

      // ── Delay ───────────────────────────────────────────────
      if (options.delay) await mswDelay(options.delay);

      // ── Response ────────────────────────────────────────────
      const status = options.status ?? statusForMethod(method);

      if (status === 204) return new HttpResponse(null, { status });
      if (status >= 400) return HttpResponse.json(options.body ?? { message: "Error" }, { status });
      return HttpResponse.json(options.body ?? null, { status });
    });

    server.use(handler);
    return spy;
  };
}
