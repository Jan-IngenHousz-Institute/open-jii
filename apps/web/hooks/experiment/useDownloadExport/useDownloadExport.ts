import { orpcClient } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

export const useDownloadExport = (experimentId: string) => {
  const mutation = useMutation({
    mutationFn: async (exportId: string) => {
      const file = await orpcClient.experiments.downloadExport({ id: experimentId, exportId });

      const filename = file.name.length > 0 ? file.name : `export-${exportId}`;

      const objectUrl = URL.createObjectURL(file);
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
