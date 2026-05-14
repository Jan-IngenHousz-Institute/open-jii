export function formatRelativeTime(isoString: string | undefined): string {
  if (!isoString) {
    return "N/A";
  }

  const expirationDate = new Date(isoString);
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();

  if (diffMs < 0) {
    return "Expired";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `in ${diffDays} ${diffDays === 1 ? "day" : "days"}`;
  }

  if (diffHours > 0) {
    return `in ${diffHours} ${diffHours === 1 ? "hour" : "hours"}`;
  }

  if (diffMinutes > 0) {
    return `in ${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"}`;
  }

  return "in less than a minute";
}
