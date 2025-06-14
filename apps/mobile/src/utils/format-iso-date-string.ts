export function formatIsoDateString(isoString: string | undefined): string {
  if (!isoString) {
    return "N/A";
  }

  const date = new Date(isoString);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
