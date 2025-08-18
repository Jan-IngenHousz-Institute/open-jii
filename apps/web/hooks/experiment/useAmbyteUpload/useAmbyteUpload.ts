import { tsr } from "~/lib/tsr";

interface UploadAmbyteDataParams {
  experimentId: string;
  files: FileList;
}

// Helper function to extract folder name from FileList
function extractAmbyteRootFolder(files: FileList): string {
  // From "Ambyte_10/1/file.txt" → "Ambyte_10"
  // From "1/file.txt" → "1"
  for (const file of files) {
    if (file.webkitRelativePath) {
      const parts = file.webkitRelativePath.split("/");
      if (/^Ambyte_\d+$/.exec(parts[0])) return parts[0];
      if (/^[1-4]$/.exec(parts[0])) return parts[0];
    }
  }
  throw new Error("No valid Ambyte folder structure detected");
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

// Export a wrapper function that handles file upload using FormData
export function useAmbyteUploadWrapper() {
  const mutation = useAmbyteUpload();

  const upload = async ({ experimentId, files }: UploadAmbyteDataParams) => {
    try {
      // Check if we have files
      if (files.length === 0) {
        throw new Error("No files to upload");
      }

      // Extract folder name for identification
      const folderName = extractAmbyteRootFolder(files);

      // Convert files to the format expected by the API schema
      const filesData = await Promise.all(
        Array.from(files).map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          return {
            name: file.webkitRelativePath || file.name,
            data: Buffer.from(arrayBuffer),
          };
        }),
      );

      // Create the request body that matches the API schema
      const requestBody = {
        sourceType: "ambyte" as const,
        files: filesData,
        folderName,
      };

      // Use ts-rest mutation
      return mutation.mutateAsync({
        params: { id: experimentId },
        body: requestBody,
      });
    } catch (error) {
      const uploadError = error instanceof Error ? error : new Error("Upload failed");
      throw uploadError;
    }
  };

  return {
    upload,
    uploadAsync: upload,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data?.body,
    reset: mutation.reset,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export type { UploadAmbyteDataParams };
