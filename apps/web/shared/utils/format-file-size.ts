/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - The file size in bytes
 * @returns A formatted string with appropriate unit (B, KB, MB, GB)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);

  // Format to 1 decimal place, then remove trailing .0 if it's a whole number
  const formatted = value.toFixed(1);
  const finalFormatted = formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted;

  return `${finalFormatted} ${sizes[i]}`;
};
