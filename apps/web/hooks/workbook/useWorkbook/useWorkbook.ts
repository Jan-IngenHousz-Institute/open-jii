import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { workbookQuery } from "./workbook-query";

export function useWorkbook(id: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  const query = useQuery({ ...workbookQuery(orpc, id), enabled });

  return {
    data: enabled ? query.data : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
