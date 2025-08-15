import { tsr } from "~/lib/tsr";

interface UploadAmbyteDataParams {
  experimentId: string;
  files: FileList;
}

// Helper function to convert FileList to a zip buffer
async function createZipFromFiles(files: FileList): Promise<ArrayBuffer> {
  // For now, we'll just send the first file or create a simple structure
  // In a real implementation, you'd use a library like JSZip
  if (files.length === 0) {
    throw new Error("No files to upload");
  }
  const file = files[0];
  return file.arrayBuffer();
}

// Helper function to prepare file data for upload
async function prepareFileForUpload(files: FileList) {
  if (files.length === 1 && files[0].name.endsWith(".zip")) {
    // Direct zip file upload
    const file = files[0];
    const data = Buffer.from(await file.arrayBuffer());
    return {
      name: file.name,
      data,
    };
  } else {
    // Multiple files - need to zip them
    const zipBuffer = await createZipFromFiles(files);
    const data = Buffer.from(zipBuffer);
    return {
      name: "ambyte-data.zip",
      data,
    };
  }
}

export function useAmbyteUpload() {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.uploadExperimentData.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: ["experiments", variables.params.id, "data"],
      });

      // Get the current data
      const previousData = queryClient.getQueryData(["experiments", variables.params.id, "data"]);

      return { previousData };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousData) {
        queryClient.setQueryData(
          ["experiments", variables.params.id, "data"],
          context.previousData,
        );
      }
      console.error("Ambyte upload failed:", error);
    },
    onSettled: async (_data, _error, variables) => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["experiments", variables.params.id, "data"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments", variables.params.id],
      });
    },
  });
}

// Export a wrapper function that handles the file preparation and tsrest call
export function useAmbyteUploadWrapper() {
  const mutation = useAmbyteUpload();

  const upload = async ({ experimentId, files }: UploadAmbyteDataParams) => {
    const fileData = await prepareFileForUpload(files);

    return mutation.mutateAsync({
      params: { id: experimentId },
      body: {
        sourceType: "ambyte",
        file: fileData,
      },
    });
  };

  return {
    upload,
    uploadAsync: upload,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export type { UploadAmbyteDataParams };
