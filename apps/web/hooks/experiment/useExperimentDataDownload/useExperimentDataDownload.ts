import { useMutation } from "@tanstack/react-query";

export const useExperimentDataDownload = () => {
  return useMutation({
    mutationFn: async ({
      experimentId,
      tableName,
      format,
    }: {
      experimentId: string;
      tableName: string;
      format: "csv" | "json" | "parquet";
    }) => {
      // Construct the download URL
      const url = `/api/v1/experiments/${experimentId}/data/download?tableName=${encodeURIComponent(tableName)}&format=${format}`;

      // Trigger download by creating a temporary link
      const link = document.createElement("a");
      link.href = url;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { success: true };
    },
  });
};
