import {
  CLIENT_ADDRESS_UNAVAILABLE,
  INTERNAL_CLIENT_ADDRESS_HEADER,
  resolveClientAddress,
} from "./client-address";

export function withClientAddress(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const address = resolveClientAddress(request);
    if (!address) {
      console.warn("Auth request rejected: trusted client address unavailable");
      return Response.json(CLIENT_ADDRESS_UNAVAILABLE, { status: 400 });
    }
    const headers = new Headers(request.headers);
    headers.delete(INTERNAL_CLIENT_ADDRESS_HEADER);
    headers.set(INTERNAL_CLIENT_ADDRESS_HEADER, address);
    const response = await handler(new Request(request, { headers }));
    if (response.status !== 429 || response.headers.has("Retry-After")) return response;
    const retry = response.headers.get("X-Retry-After");
    if (!retry) return response;
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Retry-After", retry);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  };
}
