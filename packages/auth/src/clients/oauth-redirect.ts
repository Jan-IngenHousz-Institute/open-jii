export function isOAuthRedirect(data: unknown): data is { redirect: true; url: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "redirect" in data &&
    data.redirect === true &&
    "url" in data &&
    typeof data.url === "string"
  );
}
