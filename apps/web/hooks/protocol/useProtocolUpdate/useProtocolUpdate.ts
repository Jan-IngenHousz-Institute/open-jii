import { useRouter } from "next/navigation";

import type { Protocol } from "@repo/api";

import { tsr } from "../../../lib/tsr";
import { useLocale } from "../../useLocale";

interface ProtocolUpdateProps {
  onSuccess?: (protocol: Protocol) => void;
}

/**
 * Hook to update an existing protocol.
 * Updates create a new version (new UUID), so the hook redirects to the new version's page.
 */
export const useProtocolUpdate = (protocolId: string, props: ProtocolUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();
  const router = useRouter();
  const locale = useLocale();

  return tsr.protocols.updateProtocol.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["protocol", protocolId] });
      await queryClient.cancelQueries({ queryKey: ["protocols"] });

      // Get the current protocol
      const previousProtocol = queryClient.getQueryData<{
        body: Protocol;
      }>(["protocol", protocolId]);

      // Return the previous protocol to use in case of error
      return { previousProtocol };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousProtocol) {
        queryClient.setQueryData(["protocol", protocolId], context.previousProtocol);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["protocol", protocolId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["protocols"],
      });
      // Invalidate version history cache
      await queryClient.invalidateQueries({
        queryKey: ["protocol-versions"],
      });
      // Invalidate breadcrumbs to update entity names
      await queryClient.invalidateQueries({
        queryKey: ["breadcrumbs"],
      });
    },
    onSuccess: (data) => {
      const newProtocol = data.body;
      // Redirect to the new version's page if the ID changed
      if (newProtocol.id !== protocolId) {
        router.replace(`/${locale}/platform/protocols/${newProtocol.id}`);
      }
      if (props.onSuccess) {
        props.onSuccess(newProtocol);
      }
    },
  });
};
