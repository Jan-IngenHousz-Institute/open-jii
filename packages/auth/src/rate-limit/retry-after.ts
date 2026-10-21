export function retryAfterSeconds(headers: Headers): number | undefined {
  const raw = headers.get("Retry-After") ?? headers.get("X-Retry-After");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds < 0 ? undefined : Math.max(1, Math.ceil(seconds));
  const date = Date.parse(raw);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(1, Math.ceil((date - Date.now()) / 1000));
}
