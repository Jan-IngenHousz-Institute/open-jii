import { tsr } from "@/lib/tsr";
import { useQuery } from "@tanstack/react-query";

const downloadFile = (url: string) => {
  // Create a link element and trigger download
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.target = "_blank";
  downloadLink.rel = "noopener noreferrer";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

export const useExperimentDataDownload = (
  experimentId: string,
  tableName: string,
  enabled = false,
) => {
  return useQuery({
    queryKey: ["downloadExperimentData", experimentId, tableName],
    queryFn: async () => {
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
    enabled,
  });
};

export const useDownloadFile = () => {
  return {
    downloadFile: (url: string) => downloadFile(url),
  };
};
