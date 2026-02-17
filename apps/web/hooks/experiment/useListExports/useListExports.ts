import { tsr } from "@/lib/tsr";

export const useListExports = ({
  experimentId,
  tableName,
}: {
  experimentId: string;
  tableName: string;
}) => {
  return tsr.experiments.listExports.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName },
    },
    queryKey: ["exports", experimentId, tableName],
  });
};
