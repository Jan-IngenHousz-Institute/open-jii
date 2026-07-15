import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { IssueIotCredentialsResponse } from "@repo/api/domains/iot/iot.schema";

interface RotateIotCredentialsProps {
  onSuccess?: (credentials: IssueIotCredentialsResponse) => void;
}

export const useRotateIotCredentials = (props: RotateIotCredentialsProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.rotateIotCredentials.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.getIotDevice.key() });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
