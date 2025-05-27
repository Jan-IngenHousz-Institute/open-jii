/**
 * Format a date string into a more readable format
 * @param dateString ISO date string
 * @returns Formatted date string (e.g., "May 23, 2025")
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
