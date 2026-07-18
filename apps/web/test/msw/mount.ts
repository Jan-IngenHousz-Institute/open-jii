/**
 * `server.mount()`: concise per-test endpoint override.
 *
 * A thin wrapper around `server.use(http[method](url, handler))` that:
 * - Derives the HTTP method & URL from an oRPC contract procedure
 * - Returns a {@link RequestSpy} for asserting on request details
 * - Picks sensible default status codes (200/201/204) per method
 *
 * No factory knowledge; tests provide the exact body they want.
 */
import type { AnyContractProcedure } from "@orpc/contract";
import { http, HttpResponse, delay as mswDelay } from "msw";
import type { SetupServer } from "msw/node";

export const API_URL = "http://localhost:3020";

// ── Types ───────────────────────────────────────────────────────

/**
 * Mount function keyed off an oRPC contract procedure (method/path/status come
 * from `procedure["~orpc"].route`). `body` is intentionally `unknown`: many
 * tests respond with error envelopes or partial fixtures that don't match the
 * procedure's success output schema, so the contract output type isn't a useful
 * constraint here.
 */
export type MountFn = <T extends AnyContractProcedure>(
  endpoint: T,
  options?: {
    /** HTTP status. Defaults to the procedure's `successStatus`. */
    status?: number;
    /** JSON response body. */
    body?: unknown;
    /** Artificial delay in ms (or "infinite" to hang forever). */
    delay?: number | "infinite";
    /** Hold the response until this promise resolves (deterministic in-flight windows). */
    unblock?: Promise<unknown>;
  },
) => RequestSpy;

/** Individual request captured by the spy. */
export interface SpyCall {
  /**
   * Parsed POST/PATCH/PUT body. JSON requests come back as the parsed object;
   * multipart/form-data requests come back as a `FormData` instance so tests
   * can `body.get("field")` and `body.getAll("files")`.
   */
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

/** Runtime view of the route metadata an oRPC contract procedure carries. */
interface RouteCarrier {
  "~orpc": {
    route: {
      method?: string;
      path?: string;
      successStatus?: number;
    };
  };
}

function statusForMethod(method: HttpMethod): number {
  if (method === "post") return 201;
  if (method === "delete") return 204;
  return 200;
}

/**
 * Create a `mount` function bound to the given MSW server instance.
 * Called once in `server.ts`; tests use `server.mount(…)`.
 */
export function createMount(server: SetupServer): MountFn {
  function mount(
    endpoint: RouteCarrier,
    options: {
      body?: unknown;
      status?: number;
      delay?: number | "infinite";
      unblock?: Promise<unknown>;
    } = {},
  ): RequestSpy {
    const route = endpoint["~orpc"].route;
    const method = (route.method ?? "GET").toLowerCase() as HttpMethod;
    // oRPC paths use `{param}`; MSW expects `:param`.
    const path = (route.path ?? "").replace(/\{(\w+)\}/g, ":$1");
    const url = `${API_URL}${path}`;

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
      // Multipart endpoints (file uploads) need formData parsing; JSON
      // endpoints get the regular object. The content-type header drives the
      // branch so callers don't need a separate mount helper per shape.
      let body: unknown = null;
      if (["post", "patch", "put"].includes(method)) {
        const contentType = request.headers.get("content-type") ?? "";
        const isMultipart = contentType.includes("multipart/form-data");
        try {
          body = isMultipart ? await request.formData() : await request.json();
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
      if (options.unblock) await options.unblock;

      // ── Response ────────────────────────────────────────────
      const status = options.status ?? route.successStatus ?? statusForMethod(method);

      if (status === 204) return new HttpResponse(null, { status });
      if (status >= 400) return HttpResponse.json(options.body ?? { message: "Error" }, { status });
      return HttpResponse.json(options.body ?? null, { status });
    });

    server.use(handler);
    return spy;
  }
  return mount;
}
