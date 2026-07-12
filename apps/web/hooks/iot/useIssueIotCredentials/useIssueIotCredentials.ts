import { tsr } from "@/lib/tsr";

import type { IssueIotCredentialsResponse } from "@repo/api/schemas/iot.schema";

interface IssueIotCredentialsProps {
  onSuccess?: (credentials: IssueIotCredentialsResponse) => void;
}

export const useIssueIotCredentials = (props: IssueIotCredentialsProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.issueIotCredentials.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onSuccess: (data) => {
      props.onSuccess?.(data.body);
    },
  });
};
