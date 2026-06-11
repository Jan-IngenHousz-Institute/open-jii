import { useMutation } from "@tanstack/react-query";
import { env } from "~/env";

export const useDownloadExport = (experimentId: string) => {
  const mutation = useMutation({
    mutationFn: async (exportId: string) => {
      const url = `${env.NEXT_PUBLIC_API_URL}/api/v1/experiments/${experimentId}/data/exports/${exportId}`;

      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Derive filename from Content-Disposition header if available
      const disposition = response.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `export-${exportId}`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    },
  });

  return {
    downloadExport: mutation.mutate,
    isDownloading: mutation.isPending,
    downloadingExportId: mutation.variables,
  };
};
