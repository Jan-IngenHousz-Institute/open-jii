import { requireDevkitKey } from "./config.js";
import type { DevkitKey } from "./config.js";

export type GrafanaEnvironment = "prod" | "dev";
export const grafanaEnvironments: readonly GrafanaEnvironment[] = ["prod", "dev"];

export function isGrafanaEnvironment(value: string): value is GrafanaEnvironment {
  return grafanaEnvironments.some((environment) => environment === value);
}

export function parseGrafanaEnvironment(value: string | undefined): GrafanaEnvironment {
  if (value !== undefined && isGrafanaEnvironment(value)) return value;
  throw new Error(`Name the environment: ${grafanaEnvironments.join(" or ")}`);
}

export interface GrafanaKeys {
  url: DevkitKey;
  token: DevkitKey;
}

export function grafanaKeys(environment: GrafanaEnvironment): GrafanaKeys {
  const prefix = `GRAFANA_${environment.toUpperCase()}`;
  const remedy = `pnpm grafana:auth ${environment} in the main checkout, with a token minted for the daily-round account on stdin, as tooling/devkit/README.md shows`;
  return {
    url: { variable: `${prefix}_URL`, name: `Grafana ${environment} address`, remedy },
    token: { variable: `${prefix}_TOKEN`, name: `Grafana ${environment} token`, remedy },
  };
}

export interface GrafanaQueryRequest {
  from: string;
  to: string;
  queries: Record<string, unknown>[];
}

export interface GrafanaClient {
  get(path: string): Promise<unknown>;
  query(request: GrafanaQueryRequest): Promise<unknown>;
}

export interface GrafanaClientOptions {
  url: string;
  token: string;
  environment: GrafanaEnvironment;
  request?: typeof fetch;
}

// Reads only: any GET under /api/, plus the data source query endpoint, which runs a panel's
// queries and changes nothing.
export function createGrafanaClient(options: GrafanaClientOptions): GrafanaClient {
  const request = options.request ?? fetch;
  const origin = new URL(options.url).origin;
  const reauth = `mint a new one and pipe it into pnpm grafana:auth ${options.environment} in the main checkout`;

  async function send(path: string, init: { method: string; body?: unknown }): Promise<unknown> {
    const url = new URL(path, origin);
    if (url.origin !== origin) {
      throw new Error(
        `Refusing to send the Grafana token to ${url.origin}, which is not ${origin}`,
      );
    }
    if (!url.pathname.startsWith("/api/")) {
      throw new Error(`Only Grafana's HTTP API is read, and ${url.pathname} is not under /api/`);
    }
    const response = await request(url.toString(), {
      method: init.method,
      headers: { "content-type": "application/json", authorization: `Bearer ${options.token}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (response.status === 401) {
      throw new Error(
        `Grafana ${options.environment} refused the token (401). It may have expired or been revoked; ${reauth}`,
      );
    }
    if (response.status === 403) {
      throw new Error(
        `Grafana ${options.environment} does not let the round's Viewer account read ${url.pathname} (403)`,
      );
    }
    if (!response.ok) throw new Error(`Grafana returned ${response.status}: ${text.slice(0, 500)}`);
    return text.length === 0 ? null : JSON.parse(text);
  }

  return {
    get(path) {
      return send(path, { method: "GET" });
    },

    query(body) {
      return send("/api/ds/query", { method: "POST", body });
    },
  };
}

export async function requireGrafanaClient(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
  environment: GrafanaEnvironment,
): Promise<GrafanaClient> {
  const keys = grafanaKeys(environment);
  const token = await requireDevkitKey(root, shellEnv, keys.token);
  const url = await requireDevkitKey(root, shellEnv, keys.url);
  return createGrafanaClient({ url, token, environment });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const rulesPath = "/api/prometheus/grafana/api/v1/rules";

export interface GrafanaRule {
  group: string;
  name: string;
  metricId: string | null;
  severity: string | null;
  state: string;
  health: string;
  // When its oldest active instance became active, which is when a firing rule started.
  activeSince: string | null;
  lastError: string | null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function activeSince(alerts: unknown): string | null {
  if (!Array.isArray(alerts)) return null;
  const times = alerts.flatMap((alert) =>
    isRecord(alert) && typeof alert.activeAt === "string" && !alert.activeAt.startsWith("0001")
      ? [alert.activeAt]
      : [],
  );
  return times.sort((a, b) => Date.parse(a) - Date.parse(b)).at(0) ?? null;
}

// The Prometheus-style rules listing Grafana serves for its own alert rules.
export function rulesOf(body: unknown): GrafanaRule[] {
  const data = isRecord(body) && isRecord(body.data) ? body.data : {};
  const groups = Array.isArray(data.groups) ? data.groups : [];
  return groups.flatMap((group) => {
    if (!isRecord(group) || !Array.isArray(group.rules)) return [];
    const groupName = String(group.name);
    return group.rules.flatMap((rule) => {
      if (!isRecord(rule)) return [];
      const labels = isRecord(rule.labels) ? rule.labels : {};
      return [
        {
          group: groupName,
          name: String(rule.name),
          metricId: textOrNull(labels.metric_id),
          severity: textOrNull(labels.severity),
          state: String(rule.state),
          health: String(rule.health),
          activeSince: activeSince(rule.alerts),
          lastError: textOrNull(rule.lastError),
        },
      ];
    });
  });
}
