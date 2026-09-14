export interface LinearClient {
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}

export interface LinearClientOptions {
  apiKey: string;
  request?: typeof fetch;
  endpoint?: string;
}

interface GraphqlError {
  message: string;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

const defaultEndpoint = "https://api.linear.app/graphql";

function isGraphqlResponse<T>(value: unknown): value is GraphqlResponse<T> {
  return typeof value === "object" && value !== null;
}

// Personal API keys go in the Authorization header bare; a Bearer prefix is a silent 401.
export function createLinearClient(options: LinearClientOptions): LinearClient {
  const request = options.request ?? fetch;
  const endpoint = options.endpoint ?? defaultEndpoint;

  return {
    async query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
      const response = await request(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: options.apiKey },
        body: JSON.stringify({ query: document, variables }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Linear returned ${response.status}: ${text}`);
      }

      const parsed: unknown = JSON.parse(text);
      if (!isGraphqlResponse<T>(parsed)) {
        throw new Error(`Linear returned a non-object body: ${text}`);
      }
      if (parsed.errors !== undefined && parsed.errors.length > 0) {
        const messages = parsed.errors.map((error) => error.message).join("; ");
        throw new Error(`Linear query failed: ${messages}`);
      }
      if (parsed.data === undefined) {
        throw new Error(`Linear returned no data: ${text}`);
      }
      return parsed.data;
    },
  };
}
