import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useListExports = ({
  experimentId,
  tableName,
}: {
  experimentId: string;
  tableName: string;
}) => {
  return useQuery(
    orpc.experiments.listExports.queryOptions({
      input: { id: experimentId, tableName },
      refetchInterval: 15_000,
    }),
  );
};
