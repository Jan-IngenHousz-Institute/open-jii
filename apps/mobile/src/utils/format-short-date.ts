const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = months[date.getUTCMonth()];
  const year = String(date.getUTCFullYear());
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day} ${month} ${year} ${hours}:${minutes}`;
}
