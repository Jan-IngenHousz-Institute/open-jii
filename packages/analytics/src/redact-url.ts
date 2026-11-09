// An unsubscribe token is a credential for a year; it stays out of every log line and recording.
const UNSUBSCRIBE_TOKEN_PATH =
  /(\/api\/v1\/notifications\/email\/(?:unsubscribe|resubscribe)\/)[^/?#]+/i;
const TOKEN_QUERY_PARAMETER = /([?&]token=)[^&#]*/g;

export function redactRequestUrl(url: string): string {
  return url
    .replace(UNSUBSCRIBE_TOKEN_PATH, "$1[redacted]")
    .replace(TOKEN_QUERY_PARAMETER, "$1[redacted]");
}
