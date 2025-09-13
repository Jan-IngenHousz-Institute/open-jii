import { tsr } from "@/lib/tsr";
import { useMutation } from "@tanstack/react-query";

import type { DownloadExperimentDataResponse } from "@repo/api";

const downloadFiles = (data: DownloadExperimentDataResponse, tableName: string) => {
  if (data.external_links.length > 0) {
    data.external_links.forEach((link, index) => {
      // Create a link element and trigger download
      const downloadLink = document.createElement("a");
      downloadLink.href = link.external_link;
      downloadLink.download = `${tableName}_chunk_${index + 1}.csv`;
      downloadLink.target = "_blank";
      downloadLink.rel = "noopener noreferrer";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    });
  }
};

export const useExperimentDataDownload = () => {
  return useMutation({
    mutationFn: async ({
      experimentId,
      tableName,
    }: {
      experimentId: string;
      tableName: string;
    }) => {
      const result = await tsr.experiments.downloadExperimentData.query({
        params: { id: experimentId },
        query: { tableName },
      });

      if (result.status === 200) {
        return { data: result.body, tableName };
      } else {
        throw new Error("Failed to generate download links");
      }
    },
    onSuccess: ({ data, tableName }) => {
      downloadFiles(data, tableName);
    },
    onError: (error: Error) => {
      console.error("Download failed:", error);
    },
  });
};
