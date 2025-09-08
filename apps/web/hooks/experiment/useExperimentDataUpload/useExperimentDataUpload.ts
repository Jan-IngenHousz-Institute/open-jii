import { tsr } from "@/lib/tsr";

interface ExperimentDataUploadProps {
  onSuccess?: (result: {
    uploadId?: string;
    files: { fileName: string; filePath: string }[];
  }) => void;
  onError?: (error: unknown) => void;
}

export const useExperimentDataUpload = (props?: ExperimentDataUploadProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.uploadExperimentData.useMutation({
    onSuccess: async (data) => {
      console.log("Upload success response:", data);
      // Invalidate experiment data queries to refresh data after upload
      await queryClient.invalidateQueries({
        queryKey: ["experiment"],
      });

      // Call the provided onSuccess callback if it exists
      if (props?.onSuccess) {
        props.onSuccess(data.body);
      }
    },
    onError: (error) => {
      console.error("Upload error details:", error);
      // Call the provided onError callback if it exists
      if (props?.onError) {
        props.onError(error);
      }
    },
  });
};
