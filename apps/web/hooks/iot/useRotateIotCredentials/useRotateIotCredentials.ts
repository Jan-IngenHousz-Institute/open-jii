import { tsr } from "@/lib/tsr";

import type { IssueIotCredentialsResponse } from "@repo/api/schemas/iot.schema";

interface RotateIotCredentialsProps {
  onSuccess?: (credentials: IssueIotCredentialsResponse) => void;
}

export const useRotateIotCredentials = (props: RotateIotCredentialsProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.rotateIotCredentials.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onSuccess: (data) => {
      props.onSuccess?.(data.body);
    },
  });
};
